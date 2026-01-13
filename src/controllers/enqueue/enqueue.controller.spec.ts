import { Test, TestingModule } from '@nestjs/testing';
import { EnqueueController } from './enqueue.controller';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestDBService } from '../../db/request.service';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';
import { UtilitiesService } from '../../helpers/utilities/utilities.service';
import { DataSource } from 'typeorm';
import { EnqueueService } from './enqueue.service';
import { EnqueueResponseExample } from '../../entities/enqueue.entity';
import { HttpMethod, UpstreamType } from '../../common/constants/enumerations';

describe('EnqueueController', () => {
  let controller: EnqueueController;
  let enqueueService: EnqueueService;

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
      controllers: [EnqueueController],
    })
      .overrideProvider('BullQueue_outbound')
      .useValue(mockQueue)
      .compile();

    controller = module.get<EnqueueController>(EnqueueController);
    enqueueService = module.get<EnqueueService>(EnqueueService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('postSingleRequest tests', () => {
    it('should return entity info given good input', async () => {
      const spy = jest
        .spyOn(enqueueService, 'postEnqueueEvent')
        .mockResolvedValue(EnqueueResponseExample);
      const body = {
        outboundUrl: 'http://www.gov.bc.ca/endpointHere',
        httpMethod: HttpMethod.Post,
        email: 'example@gmail.com',
        firstName: 'First',
        lastName: 'Last',
        idir: 'idirHere',
      };

      const result = await controller.postSingleRequest(body);
      expect(spy).toHaveBeenCalledWith(body);
      expect(result).toEqual(EnqueueResponseExample);
    });
  });
});
