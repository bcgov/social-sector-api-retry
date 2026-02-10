import { Module } from '@nestjs/common';
import { OutboundQueueModule } from './outbound-queue/outbound-queue.module';
import { UtilitiesModule } from './utilities/utilities.module';
import { MailerModule } from './mailer/mailer.module';
import { InboundQueueModule } from './inbound-queue/inbound-queue.module';

@Module({
  imports: [
    OutboundQueueModule,
    UtilitiesModule,
    MailerModule,
    InboundQueueModule,
  ],
  exports: [OutboundQueueModule, UtilitiesModule],
})
export class HelpersModule {}
