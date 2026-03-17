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
import { UpstreamType } from '../../common/constants/enumerations';
import { MailerService } from '../mailer/mailer.service';

/*
	Notes about queue priority and blocking:
	There are 3 job priorities used for this queue, with 1 being the highest priority
	1 - Blocking job (pauses and resumes the queue when processed)
	2 - The job that triggered the block (to ensure it is retried first)
	10000 - Standard priority (any job when it is first added to the queue)

	The blocking job is created whenever the onFailed event is triggered. The function onFailed creates the blocking job
	with highest priority, and schedules the job that triggered the event to priority 2, so that it is processed immediately
	following that job.

	When processed, the blocking job pauses the queue centrally (for all workers), then uses setTimeout to wait to
	resume the queue. Note that this job is deduplicated: that is, there can only be one of this job at a time. This avoids
	edge case scenarios in which a job is picked up while waiting for the onFailed event to trigger, which would cause multiple
	workers to attempt to pause and resume the queue at different times. Additionally, each standard job is created with a
	backoff. This is to address the edge case scenario in which the pod processing the blocking job were to go down before its
	lock on the job expired. In this case, restarting the pod would resume the queue using onApplicationBootstrap in the
	OutboundQueueService. This would restart the queue, but it would assume that the blocking job was being handled by another pod
	due to the lock not being expired. This would cause the next job in the queue to be picked up, which if it failed, would attempt
	to create another blocking job. Due to dedupilcation this would fail, but it would succesfully set itself to priority 2.
	It would then be reprocessed, fail again, and repeat the same process until the lock expired. By setting a backoff, we limit the
	number of times this can occur before the lock expires.
*/

@Processor('outbound')
export class OutboundQueueWorker extends WorkerHost {
  queueDelay: number;

  constructor(
    private readonly requestPreparerService: RequestPreparerService,
    private readonly requestDBservice: RequestDBService,
    @InjectQueue('outbound') private readonly outboundQueue: Queue,
    private readonly utilitiesService: UtilitiesService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {
    super();
    this.queueDelay = this.configService.get<number>(
      'siebel.queueOptions.retryDelayMs',
    );
  }

  private readonly logger = new Logger(OutboundQueueWorker.name);
  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case UpstreamType.Siebel:
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
    let statusCode,
      response,
      errorMessage = ``;
    try {
      response =
        await this.requestPreparerService.sendOutboundSiebelRequest(
          requestData,
        );
    } catch (error) {
      if (error instanceof AxiosError) {
        if (!error.status) {
          this.logger.error(
            `Upstream request failed to connect with message: ${error.message}`,
          );
          // network / connection error
          throw error; // moves to failed state for retry
        } else if (error.status === 503) {
          this.logger.error(
            `Upstream request status 503, failed with message: ${error.message}`,
          );
          //service unavailable
          throw error; // moves to failed state for retry
        }
        statusCode = error.status;
        errorMessage = error.message;
        this.logger.error({
          msg: error.message,
          errorDetails: error.response?.data,
          stack: error.stack,
          cause: error.cause,
        });
      } else {
        this.logger.error(error);
        throw error;
      }
    }
    if (!statusCode) {
      statusCode = response.status;
    }

    // Else, email result and succeed job (regardless of email success)
    if (statusCode >= 300) {
      await this.mailerService.sendFail(
        requestData.email,
        requestData.id,
        statusCode.toString(),
        errorMessage,
      );
      this.logger.log(
        `Upstream request with id '${job.data.id}' had error with status ${statusCode.toString()}, preserving DB entry`,
      );
    } else {
      await this.mailerService.sendSuccess(
        requestData.email,
        response?.data?.Id ?? requestData.id,
      );
      // Update DB states and complete job
      await this.requestDBservice.remove(job.data.id);
      this.logger.log(`Completed upstream request with id '${job.data.id}'`);
    }
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
