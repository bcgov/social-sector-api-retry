import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, OnApplicationBootstrap } from '@nestjs/common';
import { Queue } from 'bullmq';
import { Request } from '../../db/entities/request.entity';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class OutboundQueueService implements OnApplicationBootstrap {
  backoffDelay: number;
  constructor(
    @InjectQueue('outbound') private readonly outboundQueue: Queue,
    private readonly configService: ConfigService,
  ) {
    this.backoffDelay = this.configService.get<number>(
      'siebel.queueOptions.backoffDelayMs',
    );
  }

  async onApplicationBootstrap() {
    await this.resumeOutboundQueue(); // restart queue if paused
  }

  async addRequestToTypeQueue(req: Partial<Request>) {
    switch (req.upstreamType) {
      case 'siebel':
        await this.addSiebelRequest(req.id, req);
        return;
      default:
        throw new Error(`Invalid request type`);
    }
  }

  async addSiebelRequest(id: string, req: Partial<Request>) {
    await this.outboundQueue.add('siebel', req, {
      attempts: Number.MAX_SAFE_INTEGER,
      backoff: { type: 'fixed', delay: 30000 },
      // this is so the lock on the blocking job can expire if there is an unexpected shutdown
      jobId: id,
      removeOnComplete: true,
      priority: 10000, // lower priority than blocking jobs
    });
  }

  async pauseOutboundQueue() {
    await this.outboundQueue.pause();
  }

  async resumeOutboundQueue() {
    await this.outboundQueue.resume();
  }
}
