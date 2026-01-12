import { Module } from '@nestjs/common';
import { Request } from '../../db/entities/request.entity';
import { EnqueueController } from './enqueue.controller';
import { EnqueueService } from './enqueue.service';
import { UtilitiesService } from '../../helpers/utilities/utilities.service';
import { ConfigService } from '@nestjs/config';
import { RequestDBService } from '../../db/request.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OutboundQueueModule } from '../../helpers/outbound-queue/outbound-queue.module';

@Module({
  controllers: [EnqueueController],
  providers: [
    EnqueueService,
    UtilitiesService,
    ConfigService,
    RequestDBService,
  ],
  imports: [TypeOrmModule.forFeature([Request]), OutboundQueueModule],
})
export class EnqueueModule {}
