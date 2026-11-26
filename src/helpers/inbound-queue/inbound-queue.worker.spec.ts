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
import { Job, UnrecoverableError } from 'bullmq';
import { mock } from '@suites/doubles.jest';
import { AxiosError, AxiosRequestHeaders, AxiosResponse } from 'axios';
import { JwtModule } from '@nestjs/jwt';
import { DataSource } from 'typeorm';
import { InboundQueueService } from './inbound-queue.service';
import { MailerService } from '../mailer/mailer.service';
import {
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
  let mailerService: MailerService;
  let queue;
  let configService: ConfigService;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
    pause: jest.fn(),
    resume: jest.fn(),
  };

  const dynamicWebhookBody = {
    submission: {
      submission: {
        data: {
          Arr: [
            { inneritem: ['text1', 'text2'], otherinneritem: 'text' },
            { inneritem: ['text3', 'text4'], otherinneritem: 'text5' },
          ],
          middleitem: 'middle',
          userDataRetryApi: {
            username: 'username here',
            email: 'email here',
            firstName: 'First',
            lastName: 'Last',
          },
        },
      },
    },
    version: {
      formId: 'dynamic',
      schema: {
        components: [
          { key: 'not in use' },
          {
            key: 'Base_Paths',
            properties: {
              BasePathNested: 'Message>A>B[>C>D[',
            },
          },
          {
            key: 'messagedata',
            columns: [
              {
                key: 'container',
                components: [
                  {
                    key: 'Arr.inneritem',
                    properties: {
                      jsonpath: '$BasePathNested>E',
                    },
                  },
                  {
                    key: 'Arr.otherinneritem',
                    properties: {
                      jsonpath: '$BasePathNested>F',
                    },
                  },
                  {
                    key: 'Arr.anotherinneritem',
                    properties: {
                      jsonpath: '$BasePathNested>G',
                    },
                  },
                  {
                    key: 'middleitem',
                    properties: {
                      jsonpath: 'Message>A>B[>H',
                    },
                  },
                ],
              },
            ],
          },
        ],
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
                ['chefs.formConfigs']: {
                  dynamic: {
                    formId: 'dynamic',
                    events: ['created'],
                    upstreamUrl: '/endpointhere',
                    requiresApprovalForIngestion: false,
                    apiKey: 'apiKey',
                    httpMethod: 'PUT',
                  },
                },
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
            sendAdminAlert: jest.fn(),
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
    configService = module.get<ConfigService>(ConfigService);
    mailerService = module.get<MailerService>(MailerService);
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

  describe('formatDynamicForUpstream tests', () => {
    it('should properly format dyanmic user input', () => {
      const upstreamBody = {
        Message: {
          A: {
            B: [
              {
                C: {
                  D: [{ E: ['text1', 'text2'], F: 'text' }],
                },
                H: 'middle',
              },
              {
                C: {
                  D: [{ E: ['text3', 'text4'], F: 'text5' }],
                },
                H: 'middle',
              },
            ],
          },
        },
      };
      const expected = {
        email: 'email here',
        idir: 'username here',
        firstName: 'First',
        lastName: 'Last',
        upstreamType: UpstreamType.Siebel,
        outboundUrl:
          configService.get<string>('authorizedUrls.siebel') +
          inboundQueueWorker.formConfigs['dynamic'].upstreamUrl,
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
        },
        body: JSON.stringify(upstreamBody),
      };
      const result =
        inboundQueueWorker.formatDynamicForUpstream(dynamicWebhookBody);
      expect(result).toEqual(expected);
    });

    it('should correctly map fields nested in an Edit Grid whose own keys have no "."', () => {
      const editGridWebhookBody = {
        submission: {
          submission: {
            data: {
              Arr: [
                { field1: 'row1Value1', field2: 'row1Value2' },
                { field1: 'row2Value1', field2: 'row2Value2' },
              ],
              userDataRetryApi: {
                username: 'username here',
                email: 'email here',
                firstName: 'First',
                lastName: 'Last',
              },
            },
          },
        },
        version: {
          formId: 'dynamic',
          schema: {
            components: [
              {
                key: 'Arr',
                type: 'editgrid',
                components: [
                  {
                    key: 'field1',
                    properties: { jsonpath: 'Message>A>B[>FieldOne' },
                  },
                  {
                    key: 'field2',
                    properties: { jsonpath: 'Message>A>B[>FieldTwo' },
                  },
                ],
              },
            ],
          },
        },
      };
      const upstreamBody = {
        Message: {
          A: {
            B: [
              { FieldOne: 'row1Value1', FieldTwo: 'row1Value2' },
              { FieldOne: 'row2Value1', FieldTwo: 'row2Value2' },
            ],
          },
        },
      };
      const expected = {
        email: 'email here',
        idir: 'username here',
        firstName: 'First',
        lastName: 'Last',
        upstreamType: UpstreamType.Siebel,
        outboundUrl:
          configService.get<string>('authorizedUrls.siebel') +
          inboundQueueWorker.formConfigs['dynamic'].upstreamUrl,
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
        },
        body: JSON.stringify(upstreamBody),
      };
      const result =
        inboundQueueWorker.formatDynamicForUpstream(editGridWebhookBody);
      expect(result).toEqual(expected);
    });

    it('should merge a nested Edit Grid repeating group into a bracket shared with unrelated scalar fields (base path reuse)', () => {
      const reportableCircumstancesWebhookBody = {
        submission: {
          submission: {
            data: {
              Reportable_Type: 'seriousIncident',
              practitionersGrid: [
                { RCPractitioner: { Id: 1, Practitoner: 'John' } },
                { RCPractitioner: { Id: 2, Practitoner: 'Jane' } },
              ],
              userDataRetryApi: {
                username: 'username here',
                email: 'email here',
                firstName: 'First',
                lastName: 'Last',
              },
            },
          },
        },
        version: {
          formId: 'dynamic',
          schema: {
            components: [
              {
                key: 'Base_Paths',
                properties: {
                  BasePathReportableCircumstances:
                    'RCMessage>ListOfICM REST Workflow RC IO>ReportableCircumstances[',
                  BasePathRCPractitioners:
                    'RCMessage>ListOfICM REST Workflow RC IO>ReportableCircumstances[>ListOfRCPractitioners>RCPractitioner[',
                },
              },
              {
                key: 'Reportable_Type',
                properties: {
                  jsonpath: '$BasePathReportableCircumstances>Reportable Type',
                },
              },
              {
                key: 'practitionersGrid',
                type: 'editgrid',
                components: [
                  {
                    key: 'RCPractitioner.Id',
                    properties: { jsonpath: '$BasePathRCPractitioners>Id' },
                  },
                  {
                    key: 'RCPractitioner.Practitoner',
                    properties: {
                      jsonpath: '$BasePathRCPractitioners>Practitoner',
                    },
                  },
                ],
              },
            ],
          },
        },
      };
      const upstreamBody = {
        RCMessage: {
          'ListOfICM REST Workflow RC IO': {
            ReportableCircumstances: [
              {
                'Reportable Type': 'seriousIncident',
                ListOfRCPractitioners: {
                  RCPractitioner: [
                    { Id: 1, Practitoner: 'John' },
                    { Id: 2, Practitoner: 'Jane' },
                  ],
                },
              },
            ],
          },
        },
      };
      const expected = {
        email: 'email here',
        idir: 'username here',
        firstName: 'First',
        lastName: 'Last',
        upstreamType: UpstreamType.Siebel,
        outboundUrl:
          configService.get<string>('authorizedUrls.siebel') +
          inboundQueueWorker.formConfigs['dynamic'].upstreamUrl,
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
        },
        body: JSON.stringify(upstreamBody),
      };
      const result = inboundQueueWorker.formatDynamicForUpstream(
        reportableCircumstancesWebhookBody,
      );
      expect(result).toEqual(expected);
    });
  });

  describe('checkObjectPathWithArray tests', () => {
    it('should return a simple array of values for a single-level array of objects', () => {
      const data = {
        Arr: [{ field: 'a' }, { field: 'b' }],
      };
      const result = inboundQueueWorker.checkObjectPathWithArray(data, [
        'Arr',
        'field',
      ]);
      expect(result).toEqual({ value: ['a', 'b'], arrayDepth: 1 });
    });

    it('should properly construct nested arrays of objects (a repeating group within a repeating group)', () => {
      const data = {
        Arr: [
          {
            subArr: [
              { x: 1, y: 2 },
              { x: 3, y: 4 },
            ],
          },
          { subArr: [{ x: 5, y: 6 }] },
        ],
      };
      const result = inboundQueueWorker.checkObjectPathWithArray(data, [
        'Arr',
        'subArr',
        'x',
      ]);
      expect(result).toEqual({ value: [[1, 3], [5]], arrayDepth: 2 });
    });

    it('should return undefined if no entry at any depth has the requested key', () => {
      const data = {
        Arr: [{ subArr: [{ y: 2 }] }],
      };
      const result = inboundQueueWorker.checkObjectPathWithArray(data, [
        'Arr',
        'subArr',
        'x',
      ]);
      expect(result.value).toBeUndefined();
    });

    it('should not count an extra array-depth level for a plain object property reached after entering an array', () => {
      const data = {
        Arr: [{ nested: { x: 1 } }, { nested: { x: 2 } }],
      };
      const result = inboundQueueWorker.checkObjectPathWithArray(data, [
        'Arr',
        'nested',
        'x',
      ]);
      expect(result).toEqual({ value: [1, 2], arrayDepth: 1 });
    });

    it('should not count array-depth for a terminal multi-value (e.g. multi-select) field', () => {
      const data = {
        multiSelect: ['optionA', 'optionB'],
      };
      const result = inboundQueueWorker.checkObjectPathWithArray(data, [
        'multiSelect',
      ]);
      expect(result).toEqual({ value: ['optionA', 'optionB'], arrayDepth: 0 });
    });
  });

  describe('mapSubmissionUsingSchemaRecursive tests', () => {
    it('should correlate multiple fields row-by-row when an array bracket is immediately followed by the leaf', () => {
      const submission = {
        Arr: [
          { fieldA: 'a1', fieldB: 'b1' },
          { fieldA: 'a2', fieldB: 'b2' },
          { fieldA: 'a3', fieldB: 'b3' },
        ],
      };
      let outputObject = {};
      outputObject = inboundQueueWorker.mapSubmissionUsingSchemaRecursive(
        submission,
        outputObject,
        'Arr.fieldA',
        'Row[>FieldA',
      );
      outputObject = inboundQueueWorker.mapSubmissionUsingSchemaRecursive(
        submission,
        outputObject,
        'Arr.fieldB',
        'Row[>FieldB',
      );
      expect(outputObject).toEqual({
        Row: [
          { FieldA: 'a1', FieldB: 'b1' },
          { FieldA: 'a2', FieldB: 'b2' },
          { FieldA: 'a3', FieldB: 'b3' },
        ],
      });
    });

    it('should still embed a multi-value field as-is when there is no genuine repeating group', () => {
      const submission = {
        multiSelect: ['optionA', 'optionB'],
      };
      const outputObject = inboundQueueWorker.mapSubmissionUsingSchemaRecursive(
        submission,
        {},
        'multiSelect',
        'Wrapper[>Values',
      );
      expect(outputObject).toEqual({
        Wrapper: [{ Values: ['optionA', 'optionB'] }],
      });
    });

    it('should merge a genuine repeating group into a bracket already established as a single wrapper by an unrelated field', () => {
      const submission = {
        // reportableType is a plain (non-repeating) field
        reportableType: 'seriousIncident',
        // practitionersGrid is a genuine repeating group, unrelated in cardinality
        practitionersGrid: [{ name: 'a' }, { name: 'b' }, { name: 'c' }],
      };
      let outputObject = {};
      outputObject = inboundQueueWorker.mapSubmissionUsingSchemaRecursive(
        submission,
        outputObject,
        'reportableType',
        'ReportableCircumstances[>Reportable Type',
      );
      outputObject = inboundQueueWorker.mapSubmissionUsingSchemaRecursive(
        submission,
        outputObject,
        'practitionersGrid.name',
        'ReportableCircumstances[>ListOfPractitioners>Practitioner[>Name',
      );
      expect(outputObject).toEqual({
        ReportableCircumstances: [
          {
            'Reportable Type': 'seriousIncident',
            ListOfPractitioners: {
              Practitioner: [{ Name: 'a' }, { Name: 'b' }, { Name: 'c' }],
            },
          },
        ],
      });
    });
  });

  describe('grabDynamicFieldMappingsRecursive tests', () => {
    it('should prepend an Edit Grid component key to its nested fields, without needing a "." in their own key', () => {
      const components = [
        {
          key: 'Arr',
          type: 'editgrid',
          components: [
            {
              key: 'field1',
              properties: { jsonpath: 'Message>A>B[>FieldOne' },
            },
            {
              key: 'field2',
              properties: { jsonpath: 'Message>A>B[>FieldTwo' },
            },
          ],
        },
      ];
      const schemaMap = {};
      inboundQueueWorker.grabDynamicFieldMappingsRecursive(
        components,
        schemaMap,
      );
      expect(schemaMap).toEqual({
        'Arr.field1': 'Message>A>B[>FieldOne',
        'Arr.field2': 'Message>A>B[>FieldTwo',
      });
    });

    it('should accumulate prefixes for an Edit Grid nested inside another Edit Grid', () => {
      const components = [
        {
          key: 'Arr',
          type: 'editgrid',
          components: [
            {
              key: 'SubArr',
              type: 'editgrid',
              components: [
                {
                  key: 'field1',
                  properties: { jsonpath: 'Message>A>B[>C[>Field' },
                },
              ],
            },
          ],
        },
      ];
      const schemaMap = {};
      inboundQueueWorker.grabDynamicFieldMappingsRecursive(
        components,
        schemaMap,
      );
      expect(schemaMap).toEqual({
        'Arr.SubArr.field1': 'Message>A>B[>C[>Field',
      });
    });

    it('should leave fields outside of an Edit Grid unaffected, using their own key as the full path', () => {
      const components = [
        {
          key: 'somePanel',
          type: 'panel',
          components: [
            {
              key: 'Group.Field',
              properties: { jsonpath: 'Message>Group>Field' },
            },
          ],
        },
      ];
      const schemaMap = {};
      inboundQueueWorker.grabDynamicFieldMappingsRecursive(
        components,
        schemaMap,
      );
      expect(schemaMap).toEqual({
        'Group.Field': 'Message>Group>Field',
      });
    });
  });

  describe('grabFieldValueRecursive tests', () => {
    it('should find a value at the top level of the data', () => {
      const data = { isApprovedForIngestion: true };
      expect(
        inboundQueueWorker.grabFieldValueRecursive(
          data,
          'isApprovedForIngestion',
        ),
      ).toBe(true);
    });

    it('should find a value nested inside an object', () => {
      const data = { section: { isApprovedForIngestion: 'approved' } };
      expect(
        inboundQueueWorker.grabFieldValueRecursive(
          data,
          'isApprovedForIngestion',
        ),
      ).toBe('approved');
    });

    it('should find a value nested inside an array (e.g. an Edit Grid row)', () => {
      const data = {
        grid: [{ other: 'x' }, { isApprovedForIngestion: true }],
      };
      expect(
        inboundQueueWorker.grabFieldValueRecursive(
          data,
          'isApprovedForIngestion',
        ),
      ).toBe(true);
    });

    it('should return undefined when the key is not present anywhere', () => {
      const data = { section: { other: 'x' } };
      expect(
        inboundQueueWorker.grabFieldValueRecursive(
          data,
          'isApprovedForIngestion',
        ),
      ).toBeUndefined();
    });
  });

  describe('checkApprovedForIngestion tests', () => {
    it('should approve a submission for a form that does not require approval', () => {
      expect(inboundQueueWorker.checkApprovedForIngestion('dynamic', {})).toBe(
        true,
      );
    });

    it('should approve a submission for a form with no form config', () => {
      expect(
        inboundQueueWorker.checkApprovedForIngestion('unknownForm', {}),
      ).toBe(true);
    });

    it('should reject a submission for a form requiring approval when the field is missing', () => {
      inboundQueueWorker.formConfigs['dynamic'].requiresApprovalForIngestion =
        true;
      expect(inboundQueueWorker.checkApprovedForIngestion('dynamic', {})).toBe(
        false,
      );
    });

    it('should reject a submission for a form requiring approval when the field is falsy (e.g. an empty textbox)', () => {
      inboundQueueWorker.formConfigs['dynamic'].requiresApprovalForIngestion =
        true;
      expect(
        inboundQueueWorker.checkApprovedForIngestion('dynamic', {
          isApprovedForIngestion: '',
        }),
      ).toBe(false);
    });

    it('should approve a submission for a form requiring approval when the field is truthy (e.g. a checked checkbox)', () => {
      inboundQueueWorker.formConfigs['dynamic'].requiresApprovalForIngestion =
        true;
      expect(
        inboundQueueWorker.checkApprovedForIngestion('dynamic', {
          isApprovedForIngestion: true,
        }),
      ).toBe(true);
    });

    it('should approve a submission for a form requiring approval when the field is truthy (e.g. a non-empty textbox)', () => {
      inboundQueueWorker.formConfigs['dynamic'].requiresApprovalForIngestion =
        true;
      expect(
        inboundQueueWorker.checkApprovedForIngestion('dynamic', {
          nested: { isApprovedForIngestion: 'approved by Jane' },
        }),
      ).toBe(true);
    });
  });

  describe('processFormSubmission', () => {
    it('should complete a job on upstream 200', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: `${MessageClass.Submission}-${MessageType.Created}`,
      });
      job.data = { param: 'value' };
      const req = Object.assign(new Request(), {
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
      });
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOneByFormSubmissionId')
        .mockResolvedValueOnce(req);
      const dbUpdateSpy = jest
        .spyOn(requestDBService, 'updateAndAddToQueue')
        .mockResolvedValueOnce(req);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockResolvedValueOnce({
          status: 200,
          data: dynamicWebhookBody,
        } as AxiosResponse);
      await inboundQueueWorker.processFormSubmission(job as unknown as Job);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ param: 'value' });
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.id);
      expect(dbUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it.each([[{}], [{ 'retry-after': '13' }]])(
      'should pause queue on upstream 429 without persisting anything',
      async (headers) => {
        const job = mock<Job>({
          id: 'formId',
          name: 'siebel',
        });
        job.data = { param: 'value' };
        const dbFindSpy = jest.spyOn(
          requestDBService,
          'findOneByFormSubmissionId',
        );
        const dbCreateSpy = jest.spyOn(requestDBService, 'createWebhookEntry');
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
        expect(requestSpy).toHaveBeenCalledTimes(1);
        expect(requestSpy).toHaveBeenCalledWith({ param: 'value' });
        // nothing is persisted before the submission is successfully fetched and approved
        expect(dbFindSpy).toHaveBeenCalledTimes(0);
        expect(dbCreateSpy).toHaveBeenCalledTimes(0);
        expect(pauseSpy).toHaveBeenCalledTimes(1);
        jest.advanceTimersToNextTimer();
        expect(resumeSpy).toHaveBeenCalledTimes(1);
      },
    );

    it('should return job to queue on upstream non 429 without persisting anything', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: 'siebel',
      });
      job.data = { param: 'value' };
      const dbFindSpy = jest.spyOn(
        requestDBService,
        'findOneByFormSubmissionId',
      );
      const dbCreateSpy = jest.spyOn(requestDBService, 'createWebhookEntry');
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
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ param: 'value' });
      expect(dbFindSpy).toHaveBeenCalledTimes(0);
      expect(dbCreateSpy).toHaveBeenCalledTimes(0);
    });

    it('should not persist anything for a non-accepted job type', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: 'siebel',
      });
      job.data = { meta: { formId: 'formId' } };
      const dbFindSpy = jest.spyOn(
        requestDBService,
        'findOneByFormSubmissionId',
      );
      const dbCreateSpy = jest.spyOn(requestDBService, 'createWebhookEntry');
      const dbRemoveSpy = jest.spyOn(requestDBService, 'remove');
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockImplementationOnce(async () => {
          throw new Error(unsupportedChefsFormTypeError);
        });
      await inboundQueueWorker.processFormSubmission(job as unknown as Job);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ meta: { formId: 'formId' } });
      expect(dbFindSpy).toHaveBeenCalledTimes(0);
      expect(dbCreateSpy).toHaveBeenCalledTimes(0);
      expect(dbRemoveSpy).toHaveBeenCalledTimes(0);
    });

    it('should throw on update error', async () => {
      const job = mock<Job>({
        id: 'formId',
        name: 'siebel',
      });
      job.data = { meta: { formId: 'formId' } };
      const req = Object.assign(new Request(), {
        id: 'id',
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
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
        .mockResolvedValueOnce({
          status: 200,
          data: dynamicWebhookBody,
        } as AxiosResponse);
      await expect(
        inboundQueueWorker.processFormSubmission(job as unknown as Job),
      ).rejects.toThrow(BadRequestException);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(requestSpy).toHaveBeenCalledWith({ meta: { formId: 'formId' } });
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledWith(job.id);
      expect(dbCreateSpy).toHaveBeenCalledTimes(1);
      expect(dbCreateSpy).toHaveBeenCalledWith(job.id, job.data);
      expect(dbUpdateSpy).toHaveBeenCalledTimes(1);
    });

    it('should skip ingestion without persisting anything when a form requiring approval is not yet approved', async () => {
      inboundQueueWorker.formConfigs['dynamic'].requiresApprovalForIngestion =
        true;
      const job = mock<Job>({
        id: 'formId',
        name: `${MessageClass.Submission}-${MessageType.Created}`,
      });
      job.data = { meta: { formId: 'dynamic' } };
      const unapprovedBody = structuredClone(dynamicWebhookBody);
      unapprovedBody.submission.submission.data['isApprovedForIngestion'] =
        false;
      const dbFindSpy = jest.spyOn(
        requestDBService,
        'findOneByFormSubmissionId',
      );
      const dbCreateSpy = jest.spyOn(requestDBService, 'createWebhookEntry');
      const dbRemoveSpy = jest.spyOn(requestDBService, 'remove');
      const dbUpdateSpy = jest.spyOn(requestDBService, 'updateAndAddToQueue');
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockResolvedValueOnce({
          status: 200,
          data: unapprovedBody,
        } as AxiosResponse);
      await inboundQueueWorker.processFormSubmission(job as unknown as Job);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      // the submission is rejected before an entry is ever created, so nothing is persisted
      // and there is nothing to remove, even if the server crashes right after this point
      expect(dbFindSpy).toHaveBeenCalledTimes(0);
      expect(dbCreateSpy).toHaveBeenCalledTimes(0);
      expect(dbRemoveSpy).toHaveBeenCalledTimes(0);
      expect(dbUpdateSpy).toHaveBeenCalledTimes(0);
    });

    it('should ingest a form requiring approval once the submission is approved', async () => {
      inboundQueueWorker.formConfigs['dynamic'].requiresApprovalForIngestion =
        true;
      const job = mock<Job>({
        id: 'formId',
        name: `${MessageClass.Submission}-${MessageType.Created}`,
      });
      job.data = { meta: { formId: 'dynamic' } };
      const req = Object.assign(new Request(), {
        id: 'id',
        httpMethod: 'POST',
        inboundUrl: 'sampleUrl',
      });
      const approvedBody = structuredClone(dynamicWebhookBody);
      approvedBody.submission.submission.data['isApprovedForIngestion'] = true;
      const dbFindSpy = jest
        .spyOn(requestDBService, 'findOneByFormSubmissionId')
        .mockResolvedValueOnce(null);
      const dbCreateSpy = jest
        .spyOn(requestDBService, 'createWebhookEntry')
        .mockResolvedValueOnce(req);
      const dbUpdateSpy = jest
        .spyOn(requestDBService, 'updateAndAddToQueue')
        .mockResolvedValueOnce(req);
      const requestSpy = jest
        .spyOn(requestPreparerService, 'getFormSubmissionPayload')
        .mockResolvedValueOnce({
          status: 200,
          data: approvedBody,
        } as AxiosResponse);
      await inboundQueueWorker.processFormSubmission(job as unknown as Job);
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(dbFindSpy).toHaveBeenCalledTimes(1);
      expect(dbCreateSpy).toHaveBeenCalledTimes(1);
      expect(dbUpdateSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('onFailed tests', () => {
    it('should log a retry message when attempts remain and the error is recoverable, without alerting the admin', async () => {
      const job = mock<Job>({ id: 'formId' });
      job.data = { meta: { formId: 'dynamic' } };
      job.attemptsMade = 1;
      job.opts = { attempts: 5 };
      const errorSpy = jest.spyOn(inboundQueueWorker['logger'], 'error');
      const alertSpy = jest.spyOn(mailerService, 'sendAdminAlert');
      const error = new Error('transient failure');
      await inboundQueueWorker.onFailed(job as unknown as Job, error);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed on attempt 1 of 5'),
        error.stack,
        expect.objectContaining({
          formSubmissionId: 'formId',
          formId: 'dynamic',
          attemptsMade: 1,
          maxAttempts: 5,
        }),
      );
      expect(alertSpy).toHaveBeenCalledTimes(0);
    });

    it('should log a permanent failure message and alert the admin once attempts are exhausted', async () => {
      const job = mock<Job>({ id: 'formId' });
      job.data = { meta: { formId: 'dynamic' } };
      job.attemptsMade = 5;
      job.opts = { attempts: 5 };
      const errorSpy = jest.spyOn(inboundQueueWorker['logger'], 'error');
      const alertSpy = jest.spyOn(mailerService, 'sendAdminAlert');
      const error = new Error('final failure');
      await inboundQueueWorker.onFailed(job as unknown as Job, error);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed'),
        error.stack,
        expect.objectContaining({
          formSubmissionId: 'formId',
          formId: 'dynamic',
          attemptsMade: 5,
          maxAttempts: 5,
        }),
      );
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed'),
        expect.stringContaining('final failure'),
      );
    });

    it('should log a permanent failure message and alert the admin for an UnrecoverableError even if attempts remain (e.g. a job that stalled too many times)', async () => {
      const job = mock<Job>({ id: 'formId' });
      job.data = { meta: { formId: 'dynamic' } };
      job.attemptsMade = 1;
      job.opts = { attempts: 5 };
      const errorSpy = jest.spyOn(inboundQueueWorker['logger'], 'error');
      const alertSpy = jest.spyOn(mailerService, 'sendAdminAlert');
      const error = new UnrecoverableError(
        'job stalled more than allowable limit',
      );
      await inboundQueueWorker.onFailed(job as unknown as Job, error);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(alertSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('permanently failed'),
        error.stack,
        expect.objectContaining({
          formSubmissionId: 'formId',
          formId: 'dynamic',
          attemptsMade: 1,
          maxAttempts: 5,
        }),
      );
    });
  });
});
