import { Test, TestingModule } from '@nestjs/testing';
import { InboundQueueWorker } from './inbound-queue.worker';
import { getQueueToken } from '@nestjs/bullmq';
import { RequestPreparerService } from '../../external-api/request-preparer/request-preparer.service';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { TokenRefresherService } from '../../external-api/token-refresher/token-refresher.service';
import { Request } from '../../db/entities/request.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestDBService } from '../../db/request.service';
import { UtilitiesService } from '../utilities/utilities.service';
import { Job } from 'bullmq';
import { mock } from '@suites/doubles.jest';
import { AxiosError, AxiosRequestHeaders, AxiosResponse } from 'axios';
import { JwtModule } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { InboundQueueService } from './inbound-queue.service';
import { MailerService } from '../mailer/mailer.service';
import {
  FormType,
  HttpMethod,
  MessageClass,
  MessageType,
  UpstreamType,
} from '../../common/constants/enumerations';
import { OutboundQueueService } from '../outbound-queue/outbound-queue.service';
import {
  CONTENT_TYPE,
  trustedIdirHeaderName,
  uniformResponseParamName,
} from '../../common/constants/parameter-constants';
import { unsupportedChefsFormTypeError } from '../../common/constants/errors';
import { BadRequestException } from '@nestjs/common';

describe('InboundQueueWorker', () => {
  let inboundQueueWorker: InboundQueueWorker;
  let requestDBService: RequestDBService;
  let requestPreparerService: RequestPreparerService;
  let queue;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };

  const webhookBody = {
    submission: {
      submission: {
        data: {
          dateOfVisit: '2026-02-08T00:00:00-07:00',
          caseRowId: 'idHere',
          visitDescription: 'description here',
          visitDetail: 'Private visit age 0-5',
          user: {
            username: 'username here',
            email: 'email here',
            firstName: 'First',
            lastName: 'Last',
          },
        },
      },
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InboundQueueWorker,
        InboundQueueService,
        OutboundQueueService,
        UtilitiesService,
        RequestPreparerService,
        {
          provide: getQueueToken('inbound'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('outbound'),
          useValue: mockQueue,
        },
        TokenRefresherService,
        {
          provide: HttpService,
          useValue: {
            request: () => jest.fn(),
          },
        },
        {
          provide: CACHE_MANAGER,
          useValue: {
            set: () => jest.fn(),
            get: () => 'Bearer token',
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const lookup = {
                ['authorizedUrls.siebel']: 'http://baseurlhere',
                ['siebel.endpointUrls.inPersonVisits']: '/endpointhere',
                ['siebel.workspace.inPersonVisits']: 'workspace here',
              };
              return lookup[key];
            }),
          },
        },
        RequestDBService,
        { provide: getRepositoryToken(Request), useValue: {} },
        { provide: DataSource, useValue: {} },
        {
          provide: MailerService,
          useValue: {
            sendSuccess: jest.fn(),
            sendFail: jest.fn(),
            sendWebhookSubmissionSuccess: jest.fn(),
          },
        },
      ],
      imports: [JwtModule.register({ global: true })],
    }).compile();

    inboundQueueWorker = module.get<InboundQueueWorker>(InboundQueueWorker);
    requestDBService = module.get<RequestDBService>(RequestDBService);
    requestPreparerService = module.get<RequestPreparerService>(
      RequestPreparerService,
    );
    queue = module.get(getQueueToken('inbound'));
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(inboundQueueWorker).toBeDefined();
  });

  describe('process tests', () => {
    it('should process a form submission type job', async () => {
      const job = mock<Job>({
        id: 'jobId',
        name: `${MessageClass.Submission}-${MessageType.Created}`,
      });
      const processSubmissionSpy = jest
        .spyOn(inboundQueueWorker, 'processFormSubmission')
        .mockResolvedValueOnce(undefined);
      await inboundQueueWorker.process(job as unknown as Job);
      expect(processSubmissionSpy).toHaveBeenCalledTimes(1);
    });

    it('should throw error on invalid job type', async () => {
      const job = mock<Job>({ id: 'jobId', name: 'invalidJob' });
      const errorMessage = `No processor defined for job with name: ${job.name}`;
      await expect(
        inboundQueueWorker.process(job as unknown as Job),
      ).rejects.toHaveProperty('message', errorMessage);
    });
  });

  describe('formatMemoForUpstream tests', () => {
    it('should properly format user input', () => {
      const upstreamBody = {
        Id: 'NULL',
        'Date of visit': '02/08/2026',
        'Parent Id': 'idHere',
        Type: 'In Person Child Youth',
        'Visit Description': 'description here',
        VisitDetails: [
          {
            'Visit Detail Value': 'Private visit age 0-5',
          },
        ],
      };

      const expected = {
        email: 'email here',
        idir: 'username here',
        firstName: 'First',
        lastName: 'Last',
        upstreamType: UpstreamType.Siebel,
        outboundUrl: inboundQueueWorker.inPersonVisitsUrl,
        httpMethod: HttpMethod.Put,
        contentType: CONTENT_TYPE,
        headers: {
          Accept: CONTENT_TYPE,
          'Content-Type': CONTENT_TYPE,
          'Accept-Encoding': '*',
          [trustedIdirHeaderName]: 'username here',
        },
        params: {
          [uniformResponseParamName]: 'y',
          workspace: inboundQueueWorker.inPersonVisitsWorkspace,
        },
        body: JSON.stringify(upstreamBody),
      };
      const result = inboundQueueWorker.formatMemoForUpstream(webhookBody);
      expect(result).toEqual(expected);
    });
  });

  describe('formatInputForUpstream tests', () => {
    it('should format a memo type submission', () => {
      const processSubmissionSpy = jest
        .spyOn(inboundQueueWorker, 'formatMemoForUpstream')
        .mockReturnValueOnce(undefined);
      inboundQueueWorker.formatInputForUpstream({}, FormType.Memo);
      expect(processSubmissionSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('processFormSubmission', () => {
    it('should complete a job on upstream 200', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: `${MessageClass.Submission}-${MessageType.Created}`,
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
        webhookBody: '{"param":"value"}',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOneByFormSubmissionId')
        .mockResolvedValueOnce(req);
      const dbUpdateSpy = jest
        .spyOn(requestDBService, 'updateAndAddToQueue')
        .mockResolvedValueOnce(req);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockResolvedValueOnce([
          {
            status: 200,
            data: webhookBody,
          } as AxiosResponse,
          FormType.Memo,
        ]);
      await inboundQueueWorker.processFormSubmission(job as unknown as Job);
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.id);
      expect(dbUpdateSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ param: 'value' });
    });

    it.each([[{}], [{ 'retry-after': '13' }]])(
      'should pause queue on upstream 429',
      async (headers) => {
        const job = mock<Job>({
          id: 'formId',
          name: 'siebel',
          data: { id: 'dbId' },
        });
        const req = Object.assign(new Request(), {
          httpMethod: 'POST',
          inboundUrl: 'sampleUrl',
          webhookBody: '{"param":"value"}',
        });
        const dbFindSpy = jest
          .spyOn(requestDBService, 'findOneByFormSubmissionId')
          .mockResolvedValueOnce(null);
        const dbCreateSpy = jest
          .spyOn(requestDBService, 'createWebhookEntry')
          .mockResolvedValueOnce(req);
        const requestSpy = jest
          .spyOn(requestPreparerService, 'getFormSubmissionPayload')
          .mockImplementationOnce(async () => {
            throw new AxiosError(
              'Too Many Requests',
              '429',
              undefined,
              undefined,
              {
                status: 429,
                statusText: 'Too Many Requests',
                data: {},
                headers: headers,
                config: { headers: {} as AxiosRequestHeaders },
              },
            );
          });
        const pauseSpy = jest
          .spyOn(queue, 'pause')
          .mockImplementationOnce(async () => {});
        const resumeSpy = jest
          .spyOn(queue, 'resume')
          .mockImplementationOnce(async () => {});
        await expect(
          inboundQueueWorker.processFormSubmission(job as unknown as Job),
        ).rejects.toThrow();
        expect(dbFindSpy).toHaveBeenCalledTimes(1);
        expect(dbFindSpy).toHaveBeenCalledWith(job.id);
        expect(dbCreateSpy).toHaveBeenCalledTimes(1);
        expect(dbCreateSpy).toHaveBeenCalledWith(job.id, job.data);
        expect(requestSpy).toHaveBeenCalledTimes(1);
        expect(requestSpy).toHaveBeenCalledWith({ param: 'value' });
        expect(pauseSpy).toHaveBeenCalledTimes(1);
        jest.advanceTimersToNextTimer();
        expect(resumeSpy).toHaveBeenCalledTimes(1);
      },
    );

    it('should return job to queue on upstream non 429', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: 'siebel',
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
        webhookBody: '{"param":"value"}',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOneByFormSubmissionId')
        .mockResolvedValueOnce(null);
      const dbCreateSpy = jest
        .spyOn(requestDBService, 'createWebhookEntry')
        .mockResolvedValueOnce(req);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockImplementationOnce(async () => {
          throw new AxiosError('Bad Request', '400', undefined, undefined, {
            status: 400,
            statusText: 'Bad Request',
            data: {},
            headers: {},
            config: { headers: {} as AxiosRequestHeaders },
          });
        });
      await expect(
        inboundQueueWorker.processFormSubmission(job as unknown as Job),
      ).rejects.toThrow();
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.id);
      expect(dbCreateSpy).toHaveBeenCalledTimes(1);
      expect(dbCreateSpy).toHaveBeenCalledWith(job.id, job.data);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ param: 'value' });
    });

    it('should delete db entry on non-accepted job type', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: 'siebel',
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        id: 'id',
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
        webhookFormSubmissionId: 'formId',
        webhookBody: '{"meta":{"formId":"formId"}}',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOneByFormSubmissionId')
        .mockResolvedValueOnce(null);
      const dbCreateSpy = jest
        .spyOn(requestDBService, 'createWebhookEntry')
        .mockResolvedValueOnce(req);
      const dbRemoveSpy = jest
        .spyOn(requestDBService, 'remove')
        .mockResolvedValueOnce(undefined);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockImplementationOnce(async () => {
          throw new Error(unsupportedChefsFormTypeError);
        });
      await inboundQueueWorker.processFormSubmission(job as unknown as Job);
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.id);
      expect(dbCreateSpy).toHaveBeenCalledTimes(1);
      expect(dbCreateSpy).toHaveBeenCalledWith(job.id, job.data);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ meta: { formId: 'formId' } });
      expect(dbRemoveSpy).toHaveBeenCalledTimes(1);
      expect(dbRemoveSpy).toHaveBeenCalledWith(req.id);
    });

    it('should throw on update error', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: 'siebel',
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        id: 'id',
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
        webhookFormSubmissionId: 'formId',
        webhookBody: '{"meta":{"formId":"formId"}}',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOneByFormSubmissionId')
        .mockResolvedValueOnce(null);
      const dbCreateSpy = jest
        .spyOn(requestDBService, 'createWebhookEntry')
        .mockResolvedValueOnce(req);
      const dbUpdateSpy = jest
        .spyOn(requestDBService, 'updateAndAddToQueue')
        .mockImplementationOnce(async () => {
          throw new Error();
        });
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockResolvedValueOnce([
          {
            status: 200,
            data: webhookBody,
          } as AxiosResponse,
          FormType.Memo,
        ]);
      await expect(
        inboundQueueWorker.processFormSubmission(job as unknown as Job),
      ).rejects.toThrow(BadRequestException);
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.id);
      expect(dbCreateSpy).toHaveBeenCalledTimes(1);
      expect(dbCreateSpy).toHaveBeenCalledWith(job.id, job.data);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ meta: { formId: 'formId' } });
      expect(dbUpdateSpy).toHaveBeenCalledTimes(1);
    });
  });
});
