import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { BadRequestException, Logger } from '@nestjs/common';
import { Job, Queue } from 'bullmq';
import { RequestPreparerService } from '../../external-api/request-preparer/request-preparer.service';
import { RequestDBService } from '../../db/request.service';
import { AxiosError, HttpStatusCode } from 'axios';
import { UtilitiesService } from '../utilities/utilities.service';
import { ConfigService } from '@nestjs/config';
import {
  FormType,
  HttpMethod,
  MessageClass,
  MessageType,
  UpstreamType,
} from '../../common/constants/enumerations';
import { MailerService } from '../mailer/mailer.service';
import {
  dbUpdateError,
  unsupportedChefsFormTypeError,
} from '../../common/constants/errors';
import {
  chefsRetryWaitSeconds,
  CONTENT_TYPE,
  trustedIdirHeaderName,
  uniformResponseParamName,
} from '../../common/constants/parameter-constants';

@Processor('inbound')
export class InboundQueueWorker extends WorkerHost {
  formSubmissionJobName: string;
  inPersonVisitsUrl: string;
  inPersonVisitsWorkspace: string | undefined;
  chefsEndpoints: object;
  chefsWorkspaces: object;
  chefsMethods: object;

  constructor(
    private readonly requestPreparerService: RequestPreparerService,
    private readonly requestDBService: RequestDBService,
    @InjectQueue('inbound') private readonly inboundQueue: Queue,
    private readonly utilitiesService: UtilitiesService,
    private readonly configService: ConfigService,
    private readonly mailerService: MailerService,
  ) {
    super();
    this.formSubmissionJobName = `${MessageClass.Submission}-${MessageType.Created}`;
    this.inPersonVisitsUrl = encodeURI(
      this.configService.get<string>('authorizedUrls.siebel') +
        this.configService.get<string>('siebel.endpointUrls.inPersonVisits'),
    );
    this.inPersonVisitsWorkspace = this.configService.get<string>(
      'siebel.workspace.inPersonVisits',
    );
    this.chefsEndpoints = this.configService.get<object>(
      `siebel.endpointUrls.${FormType.Dynamic}`,
    );
    this.chefsWorkspaces = this.configService.get<object>(
      `siebel.workspace.${FormType.Dynamic}`,
    );
    this.chefsMethods = this.configService.get<object>(
      `siebel.method.${FormType.Dynamic}`,
    );
  }

  private readonly logger = new Logger(InboundQueueWorker.name);

  async process(job: Job<any, any, string>): Promise<any> {
    switch (job.name) {
      case this.formSubmissionJobName:
        await this.processFormSubmission(job);
        return;
      default:
        throw new Error(`No processor defined for job with name: ${job.name}`);
    }
  }

  formatMemoForUpstream(body: object) {
    // TODO: Change to Memo form when Data API is fixed
    // For now, use in person visits
    const submissionData = body['submission']['submission']['data'];

    const upstreamBody = {
      Id: 'NULL',
      'Date of visit':
        this.utilitiesService.convertISODateToUpstreamFormatNoTime(
          submissionData.dateOfVisit,
        ),
      'Parent Id': submissionData['caseRowId'],
      Type: 'In Person Child Youth',
      'Visit Description': submissionData['visitDescription'],
      VisitDetails: [
        {
          'Visit Detail Value': submissionData['visitDetail'],
        },
      ],
    };
    const headers = {
      Accept: CONTENT_TYPE,
      'Content-Type': CONTENT_TYPE,
      'Accept-Encoding': '*',
      [trustedIdirHeaderName]: submissionData.user.username,
    };
    const params = {
      [uniformResponseParamName]: 'y',
    };
    if (this.inPersonVisitsWorkspace !== undefined) {
      params['workspace'] = this.inPersonVisitsWorkspace;
    }

    const updateObject = {
      email: submissionData.user.email,
      idir: submissionData.user.username,
      firstName: submissionData.user.firstName,
      lastName: submissionData.user.lastName,
      upstreamType: UpstreamType.Siebel,
      outboundUrl: this.inPersonVisitsUrl,
      httpMethod: HttpMethod.Put,
      contentType: CONTENT_TYPE,
      headers,
      params,
      body: JSON.stringify(upstreamBody),
    };
    return updateObject;
  }

  formatSiebelUpstream(
    upstreamBody: object,
    submissionData: any,
    formId: string,
  ) {
    const headers = {
      Accept: CONTENT_TYPE,
      'Content-Type': CONTENT_TYPE,
      'Accept-Encoding': '*',
      [trustedIdirHeaderName]: submissionData.userDataRetryApi.username,
    };
    const params = {
      [uniformResponseParamName]: 'y',
    };
    const workspace = this.chefsWorkspaces[formId];
    if (workspace !== undefined) {
      params['workspace'] = workspace;
    }

    const url = encodeURI(
      this.configService.get<string>('authorizedUrls.siebel') +
        this.chefsEndpoints[formId],
    );
    const method = this.chefsMethods[formId];

    const updateObject = {
      email: submissionData.userDataRetryApi.email,
      idir: submissionData.userDataRetryApi.username,
      firstName: submissionData.userDataRetryApi.firstName,
      lastName: submissionData.userDataRetryApi.lastName,
      upstreamType: UpstreamType.Siebel,
      outboundUrl: url,
      httpMethod: method ?? HttpMethod.Put,
      contentType: CONTENT_TYPE,
      headers,
      params,
      body: JSON.stringify(upstreamBody),
    };
    return updateObject;
  }

  // Note: This function assumes that Siebel field names do not contain '.'
  convertFormKeytoPath(key: string) {
    return key.split('.');
  }

  // Note: This function assumes that Siebel field names do not contain '>'
  convertJsonpathToPath(property: string) {
    return property.split('>');
  }

  /**
   * Recursively grab mappings from the property "jsonpath", where the key is the how it appears in submission data
   * (seperated by '.') and the value is how it should appear in the output (seperated by '>')
   * @param components the root components object in the version schema
   * @param schemaMap reference to an empty object, which will become your mapping
   */
  grabDynamicFieldMappingsRecursive(
    components: Array<object> | undefined | null,
    schemaMap: object,
  ) {
    for (const component of components) {
      if (component['properties'] && component['properties']['jsonpath']) {
        schemaMap[`${component['key']}`] = component['properties']['jsonpath'];
      }
      if (
        typeof component['components'] === 'object' &&
        component['components'] != null
      ) {
        this.grabDynamicFieldMappingsRecursive(
          component['components'],
          schemaMap,
        );
      } else if (
        typeof component['columns'] === 'object' &&
        component['columns'] != null
      ) {
        this.grabDynamicFieldMappingsRecursive(component['columns'], schemaMap);
      }
    }
  }

  /**
   * Maps any keys that are referenced as an intermediate part of a key, but currently don't have their own discrete mapping.
   * For instance, with the input schemaMap:
   * {
   * 	"Root.ChildA.ChildB" : "A>B>C"
   * }
   * The output would become
   * {
   * 	"Root" : "A",
   * 	"Root.ChildA" : "A>B",
   * 	"Root.ChildA.ChildB" : "A>B>C"
   * }
   */
  mapRootKeys(schemaMap: object) {
    const additionMap = {};
    for (const [submissionKey, outputKey] of Object.entries(schemaMap)) {
      const submissionPath = this.convertFormKeytoPath(submissionKey);
      const outputPath = this.convertJsonpathToPath(outputKey as string);
      if (submissionPath.length != outputPath.length) continue;
      let currentSubName = submissionPath[0];
      let currentOutputName = outputPath[0];
      for (let i = 0; i < submissionPath.length; i = i + 1) {
        if (i !== 0) {
          currentSubName = currentSubName + '.' + submissionPath[i];
          currentOutputName = currentOutputName + '>' + outputPath[i];
        }
        if (schemaMap[currentSubName] == undefined) {
          additionMap[currentSubName] = currentOutputName;
        }
      }
    }
    return {
      ...additionMap,
      ...schemaMap,
    };
  }

  checkNameBackwardsRecursive(
    renameFn,
    currentPath: string,
    map: object,
  ): [string | undefined, string] {
    if (currentPath.includes('.')) {
      // it is nested at least once
      const keyPart = currentPath.slice(
        currentPath.lastIndexOf('.'),
        currentPath.length,
      ); // grabs the key preceded by '.'
      currentPath = currentPath.slice(0, currentPath.lastIndexOf('.')); // grabs the rest of the path
      if (currentPath.includes('.')) {
        // it is nested at least twice: we want to remove the middle path component and not the end part
        currentPath =
          currentPath.slice(0, currentPath.lastIndexOf('.')) + keyPart;
      } else {
        // remove the '.' from the path as it is root level
        currentPath = keyPart.slice(1, keyPart.length);
      }
      // Try the rename function to see if it exists on this level
      const newKey = renameFn(map, currentPath);
      if (newKey == undefined) {
        // if not try again
        this.checkNameBackwardsRecursive(renameFn, currentPath, map);
      }
      return [newKey, currentPath];
    } else {
      // base case, the key doesn't exist on any level
      return [undefined, currentPath];
    }
  }

  /**
   * Creates a new object with renamed keys of the submission obj based on the provided map.
   * If a mapping does not exist for a submission property, that property is not included in the output.
   * Note that it is assumed that outputs are at the same level and location of mapping as the submission data inputs.
   * @param obj the submission object
   * @param renameFn the function that describes how rename based on the map
   * @param currentPath the current property path we are at in the submission object
   * @param map the map that describes how submission data is related to the desired oiutput data
   * @returns a mapped object.
   */
  renameKeys(obj, renameFn, currentPath: string, map: object) {
    if (Array.isArray(obj)) {
      // Required to properly handle arrays.
      return obj.map((v) => this.renameKeys(v, renameFn, currentPath, map));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.entries(obj).reduce((result, [key, value]) => {
        if (currentPath !== '') {
          // Used for nested (non-root) properties
          currentPath = currentPath + '.' + key;
        } else {
          currentPath = key; // Used for root properties
        }

        let newKey = renameFn(map, currentPath);

        if (newKey == undefined) {
          // For nested properties, step backwards to see if it is on the same level as the previous property
          [newKey, currentPath] = this.checkNameBackwardsRecursive(
            renameFn,
            currentPath,
            map,
          );
          if (newKey == undefined) {
            // The key doesn't exist at any level of the object hierarchy, skip
            return result;
          }
        }
        if (
          typeof obj[currentPath] !== 'object' &&
          !currentPath.includes('.')
        ) {
          // Reset current path to base level when you reach the root object
          currentPath = '';
        }

        if (result[newKey] == undefined) {
          // Call the function to map all nested keys
          result[newKey] = this.renameKeys(value, renameFn, currentPath, map);
        }
        return result;
      }, {});
    }
    return obj;
  }

  renameWithMap(map: object, key: string): string | undefined {
    const newKey = map[key];
    if (newKey == undefined) return undefined;
    return newKey.split('>').pop(); // returns last element
  }

  formatDynamicForUpstream(body: object) {
    const submissionData = body['submission']['submission']['data'];
    const fieldSchema = body['version']['schema']['components'];
    const formId = body['version']['formId'];
    let schemaMap = {};
    this.grabDynamicFieldMappingsRecursive(fieldSchema, schemaMap);
    schemaMap = this.mapRootKeys(schemaMap);
    const upstreamBody = this.renameKeys(
      submissionData,
      this.renameWithMap,
      '',
      schemaMap,
    );
    return this.formatSiebelUpstream(upstreamBody, submissionData, formId);
  }

  formatInputForUpstream(body: object, formName: FormType) {
    switch (formName) {
      case FormType.Memo:
        return this.formatMemoForUpstream(body);
      case FormType.Dynamic:
        return this.formatDynamicForUpstream(body);
      default:
        throw new Error(unsupportedChefsFormTypeError);
    }
  }

  async processFormSubmission(job: Job<any, any, string>) {
    // Check if data has already been added to DB. If not, add it
    let requestData = await this.requestDBService.findOneByFormSubmissionId(
      job.id,
    );
    if (requestData == null) {
      requestData = await this.requestDBService.createWebhookEntry(
        job.id,
        job.data,
      );
    }
    const data = JSON.parse(requestData.webhookBody);

    // Get CHEFS form data from upstream
    let response, formName;
    try {
      [response, formName] =
        await this.requestPreparerService.getFormSubmissionPayload(data);
    } catch (error) {
      if (error instanceof AxiosError) {
        // Temporarily pause queue if rate limited
        if (error.status === HttpStatusCode.TooManyRequests) {
          const retryAfter = error.response.headers[`retry-after`]
            ? Number.parseInt(error.response.headers[`retry-after`])
            : chefsRetryWaitSeconds;
          this.logger.error(
            `Rate limited, pausing queue for ${retryAfter} seconds...`,
          );
          setTimeout(async () => {
            await this.inboundQueue.resume();
          }, retryAfter * 1000);
          await this.inboundQueue.pause();
        }
        throw error; // return to queue
      } else {
        // Complete job and delete DB entry if form is not currently accepted
        this.logger.error(error, undefined, {
          formSubmissionId: requestData.webhookFormSubmissionId,
          formId: data['meta']['formId'],
        });
        await this.requestDBService.remove(requestData.id);
        return;
      }
    }

    // Add to outbound queue
    let updateObject;
    try {
      updateObject = this.formatInputForUpstream(response.data, formName);
    } catch (error) {
      // Complete job and delete DB entry if form is not formatted correctly
      this.logger.error(`Formatting error`);
      this.logger.error(error);
      await this.requestDBService.remove(requestData.id);
      return;
    }
    let result;
    try {
      result = await this.requestDBService.updateAndAddToQueue(
        updateObject,
        requestData.id,
      );
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException([dbUpdateError]);
    }

    // Notify user that webhook submission was received
    await this.mailerService.sendWebhookSubmissionSuccess(
      result.email,
      response.data['submission']['confirmationId'],
    );
    this.logger.log(`Grabbed form data for request with id '${result.id}'`);
  }
}
