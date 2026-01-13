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
        {
          outboundUrl: 'http://www.gov.bc.ca',
          httpMethod: HttpMethod.Post,
          email: 'example@gmail.com',
          firstName: 'First',
          lastName: 'Last',
          idir: 'idirHere',
        },
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
        {
          outboundUrl: 'http://www.gov.bc.ca',
          httpMethod: HttpMethod.Post,
          email: 'example@gmail.com',
          firstName: 'First',
          lastName: 'Last',
          idir: 'idirHere',
        },
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
      async (createRequestDto, dbReturn) => {
        const requestDBServiceSpy = jest
          .spyOn(requestDBservice, 'createAndAddToQueue')
          .mockResolvedValue(dbReturn);
        const expectedResult = new EnqueueEntity(dbReturn);
        const result = await service.postEnqueueEvent(createRequestDto);
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
      email: 'example@gmail.com',
      firstName: 'First',
      lastName: 'Last',
      idir: 'idirHere',
    };
    await expect(service.postEnqueueEvent(createRequestDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(utilitiesServiceSpy).toHaveBeenCalledTimes(1);
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
      email: 'example@gmail.com',
      firstName: 'First',
      lastName: 'Last',
      idir: 'idirHere',
    };
    await expect(service.postEnqueueEvent(createRequestDto)).rejects.toThrow(
      BadRequestException,
    );
    expect(requestDBServiceSpy).toHaveBeenCalledTimes(1);
  });
});
