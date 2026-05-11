import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

@Injectable()
export class MailerService {
  transporter: Transporter;
  from: string;
  private readonly logger = new Logger(MailerService.name);

  constructor(private readonly configService: ConfigService) {
    this.from = this.configService.get<string>('mail.sender');
    const transportOptions = {
      host: this.configService.get<string>('mail.host'),
      port: this.configService.get<number>('mail.port'),
      secure: this.configService.get<boolean>('mail.secure'),
      pool: this.configService.get<boolean>('mail.pool'),
    };
    if (this.configService.get<boolean>('mail.auth') === true) {
      transportOptions['auth'] = {
        user: this.configService.get<string>('mail.user'),
        pass: this.configService.get<string>('mail.pass'),
      };
    }
    this.transporter = createTransport(transportOptions);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    this.transporter.verify((error, success) => {
      if (error) {
        this.logger.error({
          msg: `Email service verfication check: Error`,
          error,
        });
      } else {
        this.logger.log(
          'Email service verfication check: Email service is ready',
        );
      }
    });
  }

  async sendEmail(to: string, subject: string, text: string) {
    try {
      const info = await this.transporter.sendMail({
        from: this.from,
        to: to,
        subject: subject,
        text: text,
      });
      this.logger.log(`Message sent with id ${info.messageId}`);
    } catch (error) {
      this.logger.error('Error while sending mail', error);
    }
  }

  async sendWebhookSubmissionSuccess(to: string, confirmationId: string) {
    const subject = `Retry Mechanism Webhook Submission Notification`;
    const text = `This is to inform you that your request with confirmation id ${confirmationId} has been added to the queue.`;
    await this.sendEmail(to, subject, text);
  }

  async sendSuccess(to: string, id: string, info: string) {
    const subject = `Retry Mechanism Success Notification`;
    const text =
      `This is to inform you that your request with id ${id} has succeded. ` +
      `Additional info: \n${info}\n` +
      `Please check your upstream system for more information.`;
    await this.sendEmail(to, subject, text);
  }

  async sendFail(to: string, id: string, status: string, error: string) {
    const subject = `Retry Mechanism Failure Notification`;
    const text =
      `This is to inform you that your request with id ${id} has failed.` +
      `\nHTTP Status: ${status}` +
      `\nError message: ${error}`;
    await this.sendEmail(to, subject, text);
  }
}
