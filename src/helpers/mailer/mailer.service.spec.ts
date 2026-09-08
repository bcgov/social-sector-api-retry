import { Test, TestingModule } from '@nestjs/testing';
import { MailerService } from './mailer.service';
import { ConfigService } from '@nestjs/config';
import { Transporter } from 'nodemailer';

describe('MailerService', () => {
  let service: MailerService;
  let transporter: Transporter;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MailerService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const lookup = {
                [`siebel.queueOptions.retryDelayMs`]: 2000,
              };
              return lookup[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<MailerService>(MailerService);
    transporter = service.transporter;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  //   describe('sendEmail tests', () => {
  //     it('should log error when email is not sent', async () => {
  //       const sendSpy = jest
  //         .spyOn(transporter, 'sendMail')
  //         .mockRejectedValueOnce(new Error(`Couldn't send mail`));
  //       await service.sendEmail('toEmail', 'emailSubject', 'emailText');
  //       expect(sendSpy).toHaveBeenCalledTimes(1);
  //     });
  //   });

  describe('sendWebhookSubmissionSuccess tests', () => {
    it('should send a success message', async () => {
      const sendSpy = jest
        .spyOn(transporter, 'sendMail')
        .mockImplementationOnce(async () => {});
      await service.sendWebhookSubmissionSuccess('toEmail', 'confirmId');
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendSuccess tests', () => {
    it('should send a success message', async () => {
      const sendSpy = jest
        .spyOn(transporter, 'sendMail')
        .mockImplementationOnce(async () => {});
      await service.sendSuccess('toEmail', 'id', 'rowId');
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('sendFail tests', () => {
    it('should send a failure message', async () => {
      const sendSpy = jest
        .spyOn(transporter, 'sendMail')
        .mockImplementationOnce(async () => {});
      await service.sendFail('toEmail', 'id', '422', 'Unprocessable entity');
      expect(sendSpy).toHaveBeenCalledTimes(1);
    });
  });
});
