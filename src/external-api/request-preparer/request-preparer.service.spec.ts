import { Test, TestingModule } from '@nestjs/testing';
import { RequestPreparerService } from './request-preparer.service';
import { Request } from '../../db/entities/request.entity';
import { ConfigService } from '@nestjs/config';
import { TokenRefresherService } from '../token-refresher/token-refresher.service';
import { HttpService } from '@nestjs/axios';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { getMockRes } from '@jest-mock/express';
import { of } from 'rxjs';
import {
  AxiosError,
  AxiosResponse,
  InternalAxiosRequestConfig,
  RawAxiosRequestHeaders,
} from 'axios';
import { unsupportedChefsFormTypeError } from '../../common/constants/errors';

describe('RequestPreparerService', () => {
  let service: RequestPreparerService;
  let httpService: HttpService;
  let tokenRefresherService: TokenRefresherService;
  const { mockClear } = getMockRes();

  const eventBody = {
    meta: {
      formId: 'formId',
      submissionId: 'submissionId',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestPreparerService,
        TokenRefresherService,
        {
          provide: HttpService,
          useValue: {
            request: () => jest.fn(),
            get: () => jest.fn(),
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
                ['chefs.formConfigs']: {
                  formId: {
                    formId: 'formId',
                    events: ['created'],
                    upstreamUrl: '/endpointhere',
                    requiresApprovalForIngestion: false,
                    apiKey: 'apiKey',
                    httpMethod: 'PUT',
                  },
                },
                ['chefs.endpointUrls.getFormSubmission']:
                  '/endpointhere/formSubmissionId',
                ['chefs.endpointUrls.baseUrl']: 'http://baseurl',
              };
              return lookup[key];
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RequestPreparerService>(RequestPreparerService);
    httpService = module.get<HttpService>(HttpService);
    tokenRefresherService = module.get<TokenRefresherService>(
      TokenRefresherService,
    );
    mockClear();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendOutboundSiebelRequest tests', () => {
    it.each([
      [undefined, undefined, undefined, { workspace: 'sample' }],
      [{ sampleHeader: 'header' }, undefined, undefined, undefined],
      [undefined, 'application/x-www-form-urlencoded', undefined, undefined],
      [
        { sampleHeader: 'header' },
        'application/x-www-form-urlencoded',
        undefined,
        undefined,
      ],
      [
        undefined,
        'application/x-www-form-urlencoded',
        '{ "property": [{ "value": "name" }] }',
        undefined,
      ],
      [
        { sampleHeader: 'header' },
        'application/x-www-form-urlencoded',
        '{ "property": [{ "value": "name" }] }',
        undefined,
      ],
      [
        { sampleHeader: 'header' },
        'application/xml',
        '{ "property": [{ "value": "name" }] }',
        undefined,
      ],
      [
        { sampleHeader: 'header' },
        'multipart/form-data',
        '{ "property": [{ "value": "name" }] }',
        undefined,
      ],
      [
        undefined,
        undefined,
        '{ "property": [{ "value": "name" }] }',
        undefined,
      ],
      [
        { sampleHeader: 'header' },
        undefined,
        '{ "property": [{ "value": "name" }] }',
        undefined,
      ],
    ])(
      'provides a response on sucessful http service call',
      async (headers, contentType, body, params) => {
        const spy = jest.spyOn(httpService, 'request').mockReturnValueOnce(
          of({
            data: {},
            headers: {} as RawAxiosRequestHeaders,
            status: 200,
            statusText: 'OK',
          } as AxiosResponse<any, any>),
        );
        const req = Object.assign(new Request(), {
          httpMethod: 'POST',
          outboundUrl: 'sampleUrl',
          headers: headers,
          params: params,
          body: body,
          contentType: contentType,
        });
        const result = await service.sendOutboundSiebelRequest(req);
        expect(spy).toHaveBeenCalledTimes(1);
        expect(result.data).toEqual({});
      },
    );

    it.each([[500]])(`Should fail on axios error`, async (status) => {
      const spy = jest.spyOn(httpService, 'request').mockImplementation(() => {
        throw new AxiosError(
          'Axios Error',
          status.toString(),
          {} as InternalAxiosRequestConfig,
          {},
          {
            data: {},
            status: status,
            statusText: '',
            headers: {} as RawAxiosRequestHeaders,
            config: {} as InternalAxiosRequestConfig,
          },
        );
      });
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        outboundUrl: 'sampleUrl',
        headers: {},
        params: undefined,
        body: undefined,
        contentType: undefined,
      });

      await expect(
        service.sendOutboundSiebelRequest(req),
      ).rejects.toHaveProperty('status', status);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it('Should return error on bearer token undefined', async () => {
      const spy = jest
        .spyOn(tokenRefresherService, 'refreshUpstreamBearerToken')
        .mockResolvedValueOnce(undefined);
      const req = new Request();
      await expect(
        service.sendOutboundSiebelRequest(req),
      ).rejects.toHaveProperty('message', 'Upstream auth failed');
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe('getFormSubmissionPayload tests', () => {
    it('provides a response on sucessful http service call', async () => {
      const spy = jest.spyOn(httpService, 'get').mockReturnValueOnce(
        of({
          data: {},
          headers: {} as RawAxiosRequestHeaders,
          status: 200,
          statusText: 'OK',
        } as AxiosResponse<any, any>),
      );
      const result = await service.getFormSubmissionPayload(eventBody);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith(
        'http://baseurl/endpointhere/submissionId',
        {
          auth: { username: 'formId', password: 'apiKey' },
        },
      );
      expect(result.data).toEqual({});
    });

    it('throws an error for a formId without a form config', async () => {
      const spy = jest.spyOn(httpService, 'get');
      await expect(
        service.getFormSubmissionPayload({
          meta: { formId: 'unknownFormId', submissionId: 'submissionId' },
        }),
      ).rejects.toHaveProperty('message', unsupportedChefsFormTypeError);
      expect(spy).toHaveBeenCalledTimes(0);
    });
  });
});
