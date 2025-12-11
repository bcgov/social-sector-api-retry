import { Test, TestingModule } from '@nestjs/testing';
import { OutboundQueueService } from './outbound-queue.service';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../configuration/configuration';
import { Request } from '../../db/entities/request.entity';
import { getQueueToken } from '@nestjs/bullmq';

describe('OutboundQueueService', () => {
  let service: OutboundQueueService;
  let queue;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] })],
      providers: [
        OutboundQueueService,
        {
          provide: getQueueToken('outbound'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<OutboundQueueService>(OutboundQueueService);
    queue = module.get(getQueueToken('outbound'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addRequestToTypeQueue tests', () => {
    it('uses the siebel function on siebel request upstream type', async () => {
      const req = Object.assign(new Request(), {
        id: 'idHere',
        upstreamType: 'siebel',
      });
      const addSiebelRequestSpy = jest.spyOn(service, 'addSiebelRequest');
      const outboundQueueSpy = jest.spyOn(queue, 'add');
      await service.addRequestToTypeQueue(req);
      expect(addSiebelRequestSpy).toHaveBeenCalledTimes(1);
      expect(outboundQueueSpy).toHaveBeenCalledTimes(1);
    });

    it('errors on invalid request upstream type', async () => {
      const req = Object.assign(new Request(), {
        id: 'idHere',
        upstreamType: undefined,
      });
      await expect(service.addRequestToTypeQueue(req)).rejects.toHaveProperty(
        'message',
        'Invalid request type',
      );
    });
  });
});
