import { Module } from '@nestjs/common';
import { OutboundQueueModule } from './outbound-queue/outbound-queue.module';
import { UtilitiesModule } from './utilities/utilities.module';
import { MailerModule } from './mailer/mailer.module';

@Module({
  imports: [OutboundQueueModule, UtilitiesModule, MailerModule],
  exports: [OutboundQueueModule, UtilitiesModule],
})
export class HelpersModule {}
