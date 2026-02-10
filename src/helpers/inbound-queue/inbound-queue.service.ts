import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { ConfigService } from '@nestjs/config';
import { MessageClass, MessageType } from '../../common/constants/enumerations';
import { JsMsg, JSONCodec } from 'nats.ws';

@Injectable()
export class InboundQueueService implements OnApplicationBootstrap {
  backoffDelay: number;

  private readonly logger = new Logger(InboundQueueService.name);

  constructor(
    @InjectQueue('inbound') private readonly inboundQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.backoffDelay = this.configService.get<number>(
      'nats.queueOptions.backoffDelayMs',
    );
  }

  async onApplicationBootstrap() {
    await this.resumeInboundQueue(); // restart queue if paused
  }

  async addMessageToInboundQueue(message: JsMsg) {
    const data = JSONCodec().decode(message.data) as object;
    const messageClass = data['meta']['class'];
    const messageType = data['meta']['type'];
    switch (messageClass) {
      case MessageClass.Submission:
        if (messageType === MessageType.Created) {
          await this.addFormSubmissionEventToQueue(
            data,
            messageClass,
            messageType,
          );
          break;
        }
        this.logger.error(`Message type '${messageType}' not supported.`);
        break;
      default:
        this.logger.error(`Message class '${messageClass}' not supported.`);
    }
  }

  async addFormSubmissionEventToQueue(
    data: object,
    messageClass: string,
    messageType: string,
  ) {
    const submissionId = data['meta']['submissionId'];
    if (data['meta']['draft'] === true) {
      this.logger.log(
        `Submission with id ${submissionId} is a draft, ignoring`,
      );
      return;
    }
    await this.inboundQueue.add(`${messageClass}-${messageType}`, data, {
      attempts: 5,
      jobId: submissionId,
      removeOnComplete: true,
    });
  }

  async pauseInboundQueue() {
    await this.inboundQueue.pause();
  }

  async resumeInboundQueue() {
    await this.inboundQueue.resume();
  }
}
