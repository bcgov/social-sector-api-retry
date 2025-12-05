import { Module } from '@nestjs/common';
import { OutboundQueueModule } from './outbound-queue/outbound-queue.module';
import { UtilitiesModule } from './utilities/utilities.module';

@Module({
  imports: [OutboundQueueModule, UtilitiesModule],
  exports: [OutboundQueueModule, UtilitiesModule],
})
export class HelpersModule {}
