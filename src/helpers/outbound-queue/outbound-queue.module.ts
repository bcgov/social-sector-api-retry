import { Module } from '@nestjs/common';
import { OutboundQueueService } from './outbound-queue.service';
import { BullModule } from '@nestjs/bullmq';
import { OutboundQueueWorker } from './outbound-queue.worker';
import { ExternalApiModule } from '../../external-api/external-api.module';
import { TokenRefresherService } from '../../external-api/token-refresher/token-refresher.service';
import { RequestPreparerService } from '../../external-api/request-preparer/request-preparer.service';
import { RequestDBService } from '../../db/request.service';
import { Request } from '../../db/entities/request.entity';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UtilitiesModule } from '../utilities/utilities.module';
import { UtilitiesService } from '../utilities/utilities.service';
import { MailerService } from '../mailer/mailer.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'outbound',
    }),
    ExternalApiModule,
    HttpModule,
    TypeOrmModule.forFeature([Request]),
    UtilitiesModule,
  ],
  providers: [
    OutboundQueueService,
    OutboundQueueWorker,
    TokenRefresherService,
    RequestPreparerService,
    RequestDBService,
    ConfigService,
    UtilitiesService,
    MailerService,
  ],
  exports: [OutboundQueueService, OutboundQueueWorker, BullModule],
})
export class OutboundQueueModule {}
