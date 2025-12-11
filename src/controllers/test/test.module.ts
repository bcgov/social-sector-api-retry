import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from '../../db/entities/request.entity';
import { RequestDBService } from '../../db/request.service';
import { TestController } from './test.controller';
import { OutboundQueueModule } from '../../helpers/outbound-queue/outbound-queue.module';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [OutboundQueueModule, TypeOrmModule.forFeature([Request])],
  providers: [RequestDBService, OutboundQueueService, ConfigService],
  controllers: [TestController],
})
export class TestModule {}
