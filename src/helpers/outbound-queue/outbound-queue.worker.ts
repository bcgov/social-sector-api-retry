import {
  InjectQueue,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { RequestPreparerService } from '../../external-api/request-preparer/request-preparer.service';
import { RequestDBService } from '../../db/request.service';
import { AxiosError } from 'axios';
import { UtilitiesService } from '../utilities/utilities.service';
import { ConfigService } from '@nestjs/config';

@Processor('outbound')
export class OutboundQueueWorker extends WorkerHost {
  queueDelay: number;

  constructor(
    private readonly requestPreparerService: RequestPreparerService,
    private readonly requestDBservice: RequestDBService,
    @InjectQueue('outbound') private readonly outboundQueue: Queue,
    private readonly utilitiesService: UtilitiesService,
    private readonly configService: ConfigService,
  ) {
    super();
    this.queueDelay = this.configService.get<number>(
      'siebel.queueOptions.retryDelayMs',
    );
  }

  private readonly logger = new Logger(OutboundQueueWorker.name);
  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case 'siebel':
        await this.processSiebel(job);
        return;
      case 'siebelBlockDelay':
        await this.outboundQueue.pause();
        await this.utilitiesService.sleep(this.queueDelay);
        await this.outboundQueue.resume();
        // Note: if the pod initiating the pause fails, any node restart will resume the queue
        return;
      default:
        throw new Error(`No processor defined for job with name: ${job.name}`);
    }
  }

  async processSiebel(job: Job<any, any, string>) {
    // Fetch request information
    const requestData = await this.requestDBservice.findOne(job.data.id);
    // Try upstream request
    try {
      await this.requestPreparerService.sendOutboundSiebelRequest(requestData);
    } catch (error) {
      if (error instanceof AxiosError) {
        if (!error.status || error.status === 503) {
          this.logger.error(
            `Upstream request failed with message: ${error.message}`,
          );
          // network / connection error or service unavailable
          throw error; // moves to failed state for retry
        }
      } else {
        this.logger.error(error);
        throw error;
      }
    }

    // Else, email result and succeed job (regardless of email success)
    // TODO: Add email processor

    // Update DB states and complete job
    await this.requestDBservice.remove(job.data.id);
    this.logger.log(`Completed upstream request with id '${job.data.id}'`);
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<any, any, string>) {
    await this.outboundQueue.add(
      'siebelBlockDelay',
      {},
      {
        attempts: Number.MAX_SAFE_INTEGER,
        priority: 1, // Highest priority
        jobId: 'blockQueue',
        removeOnComplete: true,
        deduplication: { id: 'blockQueue', ttl: this.queueDelay },
      },
    );
    this.logger.error(
      `Job with id '${job.id}' failed. Blocking queue for ${this.queueDelay} milliseconds.`,
    );

    // Reprioritize failed job so it goes just below blocking jobs
    await job.changePriority({ priority: 2 });
  }
}
