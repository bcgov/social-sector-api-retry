import { Test, TestingModule } from '@nestjs/testing';
import { OutboundQueueWorker } from './outbound-queue.worker';
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
import { OutboundQueueService } from './outbound-queue.service';
import { MailerService } from '../mailer/mailer.service';

describe('OutboundQueueWorker', () => {
  let outboundQueueWorker: OutboundQueueWorker;
  let utilitiesService: UtilitiesService;
  let requestDBService: RequestDBService;
  let requestPreparerService: RequestPreparerService;
  let queue;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OutboundQueueWorker,
        OutboundQueueService,
        UtilitiesService,
        RequestPreparerService,
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
                [`siebel.queueOptions.retryDelayMs`]: 2000,
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
          },
        },
      ],
      imports: [JwtModule.register({ global: true })],
    }).compile();

    outboundQueueWorker = module.get<OutboundQueueWorker>(OutboundQueueWorker);
    utilitiesService = module.get<UtilitiesService>(UtilitiesService);
    requestDBService = module.get<RequestDBService>(RequestDBService);
    requestPreparerService = module.get<RequestPreparerService>(
      RequestPreparerService,
    );
    queue = module.get(getQueueToken('outbound'));
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(outboundQueueWorker).toBeDefined();
  });

  describe('process tests', () => {
    it('should process a siebel type job', async () => {
      const job = mock<Job>({ id: 'jobId', name: 'siebel' });
      const processSiebelSpy = jest
        .spyOn(outboundQueueWorker, 'processSiebel')
        .mockResolvedValueOnce(undefined);
      await outboundQueueWorker.process(job as unknown as Job);
      expect(processSiebelSpy).toHaveBeenCalledTimes(1);
    });

    it('should pause the queue on a blocking job', async () => {
      const pauseSpy = jest.spyOn(queue, 'pause');
      const resumeSpy = jest.spyOn(queue, 'resume');
      const sleepSpy = jest
        .spyOn(utilitiesService, 'sleep')
        .mockResolvedValue(undefined);
      const job = mock<Job>({ id: 'jobId', name: 'siebelBlockDelay' });
      await outboundQueueWorker.process(job as unknown as Job);
      expect(pauseSpy).toHaveBeenCalledTimes(1);
      expect(resumeSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledTimes(1);
      expect(sleepSpy).toHaveBeenCalledWith(2000);
    });

    it('should throw error on invalid job type', async () => {
      const job = mock<Job>({ id: 'jobId', name: 'invalidJob' });
      const errorMessage = `No processor defined for job with name: ${job.name}`;
      await expect(
        outboundQueueWorker.process(job as unknown as Job),
      ).rejects.toHaveProperty('message', errorMessage);
    });
  });

  describe('processSiebelTests', () => {
    it('should complete a job on upstream 200', async () => {
      const job = mock<Job>({
        id: 'jobId',
        name: 'siebel',
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        outboundUrl: 'sampleUrl',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOne')
        .mockResolvedValueOnce(req);
      const dbRemoveSpy = jest
        .spyOn(requestDBService, 'remove')
        .mockResolvedValueOnce(undefined);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'sendOutboundSiebelRequest')
        .mockResolvedValueOnce({
          status: 200,
        } as AxiosResponse);
      await outboundQueueWorker.processSiebel(job as unknown as Job);
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.data.id);
      expect(dbRemoveSpy).toHaveBeenCalledTimes(1);
      expect(dbRemoveSpy).toHaveBeenCalledWith(job.data.id);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith(req);
    });

    it('should process job on upstream non 503', async () => {
      const job = mock<Job>({
        id: 'jobId',
        name: 'siebel',
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        outboundUrl: 'sampleUrl',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOne')
        .mockResolvedValueOnce(req);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'sendOutboundSiebelRequest')
        .mockImplementationOnce(async () => {
          throw new AxiosError('Bad Request', '400', undefined, undefined, {
            status: 400,
            statusText: 'Bad Request',
            data: {},
            headers: {},
            config: { headers: {} as AxiosRequestHeaders },
          });
        });
      await outboundQueueWorker.processSiebel(job as unknown as Job);
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.data.id);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith(req);
    });

    it.each([[503], [null]])(
      'should fail on 503 or connection error',
      async (status) => {
        const job = mock<Job>({
          id: 'jobId',
          name: 'siebel',
          data: { id: 'dbId' },
        });
        const req = Object.assign(new Request(), {
          httpMethod: 'POST',
          outboundUrl: 'sampleUrl',
        });
        const dbFindSpy = jest
          .spyOn(requestDBService, 'findOne')
          .mockResolvedValueOnce(req);
        const requestSpy = jest
          .spyOn(requestPreparerService, 'sendOutboundSiebelRequest')
          .mockImplementationOnce(async () => {
            throw new AxiosError(
              'Failed',
              Number.isInteger(status) ? `${status}` : '',
              undefined,
              undefined,
              {
                status: status,
                statusText: 'Failed',
                data: {},
                headers: {},
                config: { headers: {} as AxiosRequestHeaders },
              },
            );
          });
        await expect(
          outboundQueueWorker.processSiebel(job as unknown as Job),
        ).rejects.toHaveProperty('status', status);
        expect(dbFindSpy).toHaveBeenCalledTimes(1);
        expect(dbFindSpy).toHaveBeenCalledWith(job.data.id);
        expect(requestSpy).toHaveBeenCalledTimes(1);
        expect(requestSpy).toHaveBeenCalledWith(req);
      },
    );

    it('should fail on token refresh error', async () => {
      const job = mock<Job>({
        id: 'jobId',
        name: 'siebel',
        data: { id: 'dbId' },
      });
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        outboundUrl: 'sampleUrl',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOne')
        .mockResolvedValueOnce(req);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'sendOutboundSiebelRequest')
        .mockImplementationOnce(async () => {
          throw new Error('Upstream auth failed');
        });
      await expect(
        outboundQueueWorker.processSiebel(job as unknown as Job),
      ).rejects.toHaveProperty('message', 'Upstream auth failed');
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.data.id);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith(req);
    });
  });

  describe('onFailed tests', () => {
    it(`should add a blocking job and change the current job's priority on job failure`, async () => {
      const job = mock<Job>({ id: 'jobId', priority: 10000 });
      const queueSpy = jest.spyOn(queue, 'add');
      const jobSpy = jest.spyOn(job, 'changePriority');
      await outboundQueueWorker.onFailed(job as unknown as Job);
      expect(queueSpy).toHaveBeenCalledTimes(1);
      expect(jobSpy).toHaveBeenCalledTimes(1);
      expect(jobSpy).toHaveBeenCalledWith({ priority: 2 });
    });
  });
});
