import { Module } from '@nestjs/common';
import { InboundQueueService } from './inbound-queue.service';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { InboundQueueWorker } from './inbound-queue.worker';
import { TokenRefresherService } from '../../external-api/token-refresher/token-refresher.service';
import { RequestPreparerService } from '../../external-api/request-preparer/request-preparer.service';
import { RequestDBService } from '../../db/request.service';
import { Request } from '../../db/entities/request.entity';
import { HttpModule } from '@nestjs/axios';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilitiesService } from '../utilities/utilities.service';
import { MailerService } from '../mailer/mailer.service';
import { OutboundQueueModule } from '../outbound-queue/outbound-queue.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'inbound',
    }),
    TypeOrmModule.forFeature([Request]),
    HttpModule,
    OutboundQueueModule,
  ],
  providers: [
    InboundQueueService,
    ConfigService,
    InboundQueueWorker,
    RequestPreparerService,
    RequestDBService,
    UtilitiesService,
    MailerService,
    TokenRefresherService,
  ],
  exports: [BullModule, InboundQueueService, InboundQueueWorker],
})
export class InboundQueueModule {}
