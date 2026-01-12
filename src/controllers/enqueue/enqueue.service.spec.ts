import { Test, TestingModule } from '@nestjs/testing';
import { EnqueueService } from './enqueue.service';
import { UtilitiesService } from '../../helpers/utilities/utilities.service';
import { Request } from '../../db/entities/request.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestDBService } from '../../db/request.service';
import { DataSource, TypeORMError } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';
import { getMockReq } from '@jest-mock/express';
import { HttpMethod, UpstreamType } from '../../common/constants/enumerations';
import { EnqueueEntity } from '../../entities/enqueue.entity';
import { BadRequestException } from '@nestjs/common';

describe('EnqueueService', () => {
  let service: EnqueueService;
  let requestDBservice: RequestDBService;
  let utilitiesService: UtilitiesService;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnqueueService,
        UtilitiesService,
        RequestDBService,
        { provide: getRepositoryToken(Request), useValue: {} },
        { provide: DataSource, useValue: {} },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const lookup = {
                authorizedUrls: {
                  [UpstreamType.Siebel]: 'http://www.gov.bc.ca',
                },
              };
              return lookup[key];
            }),
          },
        },
        { provide: OutboundQueueService, useValue: {} },
      ],
      imports: [JwtModule.register({ global: true })],
    })
      .overrideProvider('BullQueue_outbound')
      .useValue(mockQueue)
      .compile();

    service = module.get<EnqueueService>(EnqueueService);
    requestDBservice = module.get<RequestDBService>(RequestDBService);
    utilitiesService = module.get<UtilitiesService>(UtilitiesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('postEnqueueEvent tests', () => {
    it.each([
      [
        { outboundUrl: 'http://www.gov.bc.ca', httpMethod: HttpMethod.Post },
        getMockReq({
          header: jest.fn((headerName) => {
            const lookup = {
              authorization:
                'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJ1c2VyX3ByaW5jaXBhbF9uYW1lI' +
                'joiZXhhbXBsZUBnbWFpbC5jb20iLCJpZGlyX3VzZXJuYW1lIjoiaWRpckhlcmUiLCJnaXZlbl' +
                '9uYW1lIjoiZmlyc3ROYW1lIiwiZmFtaWx5X25hbWUiOiJsYXN0TmFtZSIsImV4cCI6MTc2ODI0' +
                'NTYxMywianRpIjoiYjhlNmRlYjAtNTZkYy00ZTEwLWI3NTAtYmJmMWNiZjI0ZDU5IiwiaWF0IjoxNzY4MjQ1NTgzfQ.',
            };
            return lookup[headerName];
          }),
        }),
        {
          id: 'idHere',
          idir: 'idirHere',
          firstName: 'firstName',
          lastName: 'lastName',
          outboundUrl: 'http://www.gov.bc.ca',
          httpMethod: HttpMethod.Post,
          headers: undefined,
          params: undefined,
          body: undefined,
          contentType: 'application/json',
          email: 'example@gmail.com',
          upstreamType: UpstreamType.Siebel,
        },
      ],
      [
        { outboundUrl: 'http://www.gov.bc.ca', httpMethod: HttpMethod.Post },
        getMockReq({
          header: jest.fn((headerName) => {
            const lookup = {
              authorization:
                'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6ImV4YW1wbGVAZ21haWwuY2' +
                '9tIiwiaWRpcl91c2VybmFtZSI6ImlkaXJIZXJlIiwiZ2l2ZW5fbmFtZSI6ImZpcnN0TmFtZSIsImZh' +
                'bWlseV9uYW1lIjoibGFzdE5hbWUiLCJzdWIiOiJzdWIiLCJhdWQiOiJhdWQiLCJleHAiOjE3NjgyNDU' +
                '4MzMsImp0aSI6IjcwZjEzZmQ2LTgyZTEtNGZiOS1iZjA1LWJiMGUyMzMwOTM2MiIsImlhdCI6MTc2ODI0NTgwM30.',
            };
            return lookup[headerName];
          }),
        }),
        {
          id: 'idHere',
          idir: 'idirHere',
          firstName: 'firstName',
          lastName: 'lastName',
          outboundUrl: 'http://www.gov.bc.ca',
          httpMethod: HttpMethod.Post,
          headers: { param: 'value' },
          params: { param: 'value' },
          body: undefined,
          contentType: 'application/json',
          email: 'example@gmail.com',
          upstreamType: UpstreamType.Siebel,
        },
      ],
    ])(
      'should return EnqueueEntity on succesful submission',
      async (createRequestDto, req, dbReturn) => {
        const requestDBServiceSpy = jest
          .spyOn(requestDBservice, 'createAndAddToQueue')
          .mockResolvedValue(dbReturn);
        const expectedResult = new EnqueueEntity(dbReturn);
        const result = await service.postEnqueueEvent(createRequestDto, req);
        expect(result).toEqual(expectedResult);
        expect(requestDBServiceSpy).toHaveBeenCalledTimes(1);
      },
    );
  });

  it('should throw on invalid url', async () => {
    const utilitiesServiceSpy = jest.spyOn(
      utilitiesService,
      'isValidOutboundUrl',
    );
    const createRequestDto = {
      outboundUrl: 'invalidUrl',
      httpMethod: HttpMethod.Post,
    };
    const req = getMockReq();
    await expect(
      service.postEnqueueEvent(createRequestDto, req),
    ).rejects.toThrow(BadRequestException);
    expect(utilitiesServiceSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    [
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6ImV4YW1wbGVAZ21haWwuY29tIiwiZ2l2ZW5fbm' +
        'FtZSI6ImZpcnN0TmFtZSIsImZhbWlseV9uYW1lIjoibGFzdE5hbWUiLCJzdWIiOiJzdWIiLCJhdWQiOiJhdWQiL' +
        'CJleHAiOjE3NjgyNDYzMDQsImp0aSI6IjVjMDdiZGMzLWIyOTgtNDI2ZS04ZDE4LWFhMjRhMmNmN2NiMyIsImlhdCI6MTc2ODI0NjI3M30.',
    ],
    [
      'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJpZGlyX3VzZXJuYW1lIjoiaWRpckhlcmUiLCJnaXZlbl9uYW1' +
        'lIjoiZmlyc3ROYW1lIiwiZmFtaWx5X25hbWUiOiJsYXN0TmFtZSIsInN1YiI6InN1YiIsImF1ZCI6ImF1ZCIsImV' +
        '4cCI6MTc2ODI0NjM1MywianRpIjoiYmNlYzBkZjgtMjk0Mi00MzhjLWIyZjMtNjFjZTYyNjEwNjU0IiwiaWF0IjoxNzY4MjQ2MzIyfQ.',
    ],
  ])('should throw if idir or email are unavailable in JWT', async (jwt) => {
    const createRequestDto = {
      outboundUrl: 'http://www.gov.bc.ca',
      httpMethod: HttpMethod.Post,
    };
    const req = getMockReq({
      header: jest.fn((headerName) => {
        const lookup = {
          authorization: `Bearer ${jwt}`,
        };
        return lookup[headerName];
      }),
    });
    await expect(
      service.postEnqueueEvent(createRequestDto, req),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw on DB or queue insert error', async () => {
    const requestDBServiceSpy = jest
      .spyOn(requestDBservice, 'createAndAddToQueue')
      .mockImplementationOnce(() => {
        throw new TypeORMError();
      });
    const createRequestDto = {
      outboundUrl: 'http://www.gov.bc.ca',
      httpMethod: HttpMethod.Post,
    };
    const req = getMockReq({
      header: jest.fn((headerName) => {
        const lookup = {
          authorization:
            'Bearer eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJlbWFpbCI6ImV4YW1wbGVAZ21haWwuY2' +
            '9tIiwiaWRpcl91c2VybmFtZSI6ImlkaXJIZXJlIiwiZ2l2ZW5fbmFtZSI6ImZpcnN0TmFtZSIsImZh' +
            'bWlseV9uYW1lIjoibGFzdE5hbWUiLCJzdWIiOiJzdWIiLCJhdWQiOiJhdWQiLCJleHAiOjE3NjgyNDU' +
            '4MzMsImp0aSI6IjcwZjEzZmQ2LTgyZTEtNGZiOS1iZjA1LWJiMGUyMzMwOTM2MiIsImlhdCI6MTc2ODI0NTgwM30.',
        };
        return lookup[headerName];
      }),
    });
    await expect(
      service.postEnqueueEvent(createRequestDto, req),
    ).rejects.toThrow(BadRequestException);
    expect(requestDBServiceSpy).toHaveBeenCalledTimes(1);
  });
});
