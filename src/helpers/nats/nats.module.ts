import { Module } from '@nestjs/common';
import { NatsService } from './nats.service';
import { ConfigService } from '@nestjs/config';
import { InboundQueueService } from '../inbound-queue/inbound-queue.service';
import { InboundQueueModule } from '../inbound-queue/inbound-queue.module';

@Module({
  imports: [InboundQueueModule],
  providers: [NatsService, ConfigService, InboundQueueService],
  exports: [NatsService],
})
export class NatsModule {}
