import { Test, TestingModule } from '@nestjs/testing';
import { InboundQueueService } from './inbound-queue.service';
import { getQueueToken } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import configuration from '../../configuration/configuration';
import { mock } from '@suites/doubles.jest';
import { JsMsg, JSONCodec } from 'nats.ws';
import * as codec from '../../../node_modules/nats.ws/lib/nats-base-client/codec';
import { MessageClass, MessageType } from '../../common/constants/enumerations';

describe('InboundQueueService', () => {
  let service: InboundQueueService;
  let queue;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] })],
      providers: [
        InboundQueueService,
        {
          provide: getQueueToken('inbound'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<InboundQueueService>(InboundQueueService);
    queue = module.get(getQueueToken('inbound'));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('addMessageToInboundQueue tests', () => {
    it('uses the form submission function on a submission created message', async () => {
      const data = {
        meta: {
          class: MessageClass.Submission,
          type: MessageType.Created,
        },
      };
      const message = mock<JsMsg>({
        data: JSONCodec().encode(data),
      });
      const formSubmissionSpy = jest
        .spyOn(service, 'addFormSubmissionEventToQueue')
        .mockImplementationOnce(async () => {});
      jest.spyOn(codec, 'JSONCodec').mockImplementationOnce(() => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          encode(a) {
            return message.data;
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          decode(a) {
            return data;
          },
        };
      });
      await service.addMessageToInboundQueue(message);
      expect(formSubmissionSpy).toHaveBeenCalledTimes(1);
    });

    it('logs an error on message type not supported', async () => {
      const data = {
        meta: {
          class: MessageClass.Submission,
          type: MessageType.Deleted,
        },
      };
      const message = mock<JsMsg>({
        data: JSONCodec().encode(data),
      });
      const formSubmissionSpy = jest
        .spyOn(service, 'addFormSubmissionEventToQueue')
        .mockImplementationOnce(async () => {});
      jest.spyOn(codec, 'JSONCodec').mockImplementationOnce(() => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          encode(a) {
            return message.data;
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          decode(a) {
            return data;
          },
        };
      });
      await service.addMessageToInboundQueue(message);
      expect(formSubmissionSpy).toHaveBeenCalledTimes(0);
    });

    it('logs an error on message class not supported', async () => {
      const data = {
        meta: {
          class: MessageClass.Schema,
          type: MessageType.Created,
        },
      };
      const message = mock<JsMsg>({
        data: JSONCodec().encode(data),
      });
      const formSubmissionSpy = jest
        .spyOn(service, 'addFormSubmissionEventToQueue')
        .mockImplementationOnce(async () => {});
      jest.spyOn(codec, 'JSONCodec').mockImplementationOnce(() => {
        return {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          encode(a) {
            return message.data;
          },
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          decode(a) {
            return data;
          },
        };
      });
      await service.addMessageToInboundQueue(message);
      expect(formSubmissionSpy).toHaveBeenCalledTimes(0);
    });
  });

  describe('addFormSubmissionEventToQueue tests', () => {
    it('ignores draft submissions', async () => {
      const data = {
        meta: {
          class: MessageClass.Submission,
          type: MessageType.Created,
          submissionId: 'idhere',
          draft: true,
        },
      };
      const queueSpy = jest.spyOn(queue, 'add');
      await service.addFormSubmissionEventToQueue(
        data,
        data['meta']['class'],
        data['meta']['type'],
      );
      expect(queueSpy).toHaveBeenCalledTimes(0);
    });

    it('submits non-drafts to queue', async () => {
      const data = {
        meta: {
          class: MessageClass.Submission,
          type: MessageType.Created,
          submissionId: 'idhere',
          draft: false,
        },
      };
      const queueSpy = jest
        .spyOn(queue, 'add')
        .mockImplementationOnce(async () => {});
      await service.addFormSubmissionEventToQueue(
        data,
        data['meta']['class'],
        data['meta']['type'],
      );
      expect(queueSpy).toHaveBeenCalledTimes(1);
    });
  });
});
