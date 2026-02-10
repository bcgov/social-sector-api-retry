import { Test, TestingModule } from '@nestjs/testing';
import { NatsService } from './nats.service';
import configuration from '../../configuration/configuration';
import { ConfigModule } from '@nestjs/config';
import { InboundQueueService } from '../inbound-queue/inbound-queue.service';
import { getQueueToken } from '@nestjs/bullmq';
import * as NatsWS from 'nats.ws';
import { mock } from '@suites/doubles.jest';

describe('NatsService', () => {
  let service: NatsService;
  let queue;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] })],
      providers: [
        NatsService,
        InboundQueueService,
        {
          provide: getQueueToken('inbound'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<NatsService>(NatsService);
    queue = module.get<InboundQueueService>(InboundQueueService);
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('startConnect tests', () => {
    it('should properly configure pull consumer with correct setup', async () => {
      const natsConnection = mock<NatsWS.NatsConnection>({
        jetstream: () => {
          return mock<NatsWS.JetStreamClient>({
            jetstreamManager: async () => {
              return mock<NatsWS.JetStreamManager>({
                consumers: {
                  add: jest.fn(),
                },
              });
            },
          });
        },
        drain: jest.fn(),
      });
      const connectSpy = jest
        .spyOn(NatsWS, 'connect')
        .mockResolvedValueOnce(natsConnection);
      await service.startConnect();
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBe(undefined);
    });

    it('should set exit code to 1 on error', async () => {
      const connectSpy = jest
        .spyOn(NatsWS, 'connect')
        .mockRejectedValueOnce(new Error('Connection failed'));
      await service.startConnect();
      expect(connectSpy).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBe(1);
      process.exitCode = undefined;
    });
  });

  describe('fetch tests', () => {
    it('fetches messages from stream', async () => {
      const mockIterator = {
        next: jest
          .fn()
          .mockResolvedValueOnce({
            value: mock<NatsWS.JsMsg>({ ack: jest.fn() }),
            done: false,
          })
          .mockResolvedValue({
            done: true,
          }),
      };
      service.pullConsumer = mock<NatsWS.Consumer>({
        fetch: async () => {
          return mock<NatsWS.ConsumerMessages>({
            [Symbol.asyncIterator]: jest.fn(() => mockIterator),
          });
        },
      });
      const timeoutSpy = jest.spyOn(global, 'setTimeout');
      const queueSpy = jest
        .spyOn(queue, 'addMessageToInboundQueue')
        .mockImplementationOnce(async () => {
          return;
        });
      await service.fetch();
      expect(queueSpy).toHaveBeenCalledTimes(1);
      jest.advanceTimersToNextTimer();
      expect(timeoutSpy).toHaveBeenCalledTimes(1);
    });
  });
});
