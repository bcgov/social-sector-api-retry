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
   * Recursively looks for the component with key "Base_Paths"
   * @param components the root components object in the version schema
   * @returns the properties of the "Base_Paths" component, or undefined if not found
   */
  grabJsonBasePathRecursive(
    components: Array<object> | undefined | null,
  ): object | undefined {
    for (const component of components) {
      if (component['key'] == 'Base_Paths' && component['properties']) {
        const basePathMap = structuredClone(component['properties']) as object;
        return basePathMap;
      }
      if (
        typeof component['components'] === 'object' &&
        component['components'] != null
      ) {
        this.grabJsonBasePathRecursive(component['components']);
      } else if (
        typeof component['columns'] === 'object' &&
        component['columns'] != null
      ) {
        this.grabJsonBasePathRecursive(component['columns']);
      }
    }
  }

  /**
   * Replaces base path markers, denoted by $ at the start of a json path, with their respective
   * base paths as defined by the the base path map.
   * @param schemaMap the map created by the grabDynamicFieldMappingsRecursive function
   * @param basePathMap the map created by the grabJsonBasePathRecursive function
   */
  formatSchemaMapWithBasePaths(schemaMap: object, basePathMap: object) {
    for (const [key, value] of Object.entries(schemaMap)) {
      if (typeof value === 'object' && value !== null) {
        this.formatSchemaMapWithBasePaths(value, basePathMap);
      }
      if (typeof value === 'string' && value.startsWith('$')) {
        const basePath = value.substring(1, value.indexOf('>'));
        schemaMap[key] = (schemaMap[key] as string).replace(
          '$' + basePath,
          basePathMap[basePath],
        );
      }
    }
  }

  /**
   * Finds if any value(s) match the path in the given object. Works for paths with objects and arrays.
   * @param obj the input object
   * @param pathArray an array denoting the path, with [ at the end of each string denoting an array path
   * @returns the value(s) found at the path specified, or undefined if not found
   */
  checkObjectPathWithArray(obj, pathArray) {
    let datum = obj;
    for (let i = 0; i < pathArray.length; i = i + 1) {
      if (typeof datum === 'undefined') {
        return undefined;
      }
      if (Array.isArray(datum)) {
        // prev path is array
        const reducedDatum = [];
        let hasNonUndefinedValue = false;
        for (const innerValue of datum) {
          if (typeof innerValue[pathArray[i]] !== 'undefined') {
            hasNonUndefinedValue = true;
            reducedDatum.push(innerValue[pathArray[i]]);
          } else {
            reducedDatum.push(undefined);
          }
        }
        if (!hasNonUndefinedValue) {
          return undefined;
        }
        datum = reducedDatum;
      } else {
        datum =
          datum[pathArray[i]] !== undefined ? datum[pathArray[i]] : undefined;
      }
    }
    if (
      Array.isArray(datum) &&
      datum.filter((value) => typeof value !== 'undefined').length === 0
    ) {
      return undefined;
    }
    return datum;
  }

  /**
   * Maps part of the output object based on ther input submission, and a single given submission and output path.
   * @param submission the data as submitted
   * @param outputObject the current output object for the mapping
   * @param submissionPath the submission path as string, with parts separated by "."
   * @param outputPath the output path as string, with parts separated by ">" and arrays denoted by "["
   * @returns the outputObject, with the mapping adding for all applicable items if they exist in the submission
   */
  mapSubmissionUsingSchemaRecursive(
    submission: object,
    outputObject: object,
    submissionPath,
    outputPath,
  ): object {
    // Get submission path as array
    const submissionPathArray = this.convertFormKeytoPath(submissionPath);

    // Check if submission path exists
    const submissionInfo = this.checkObjectPathWithArray(
      submission,
      submissionPathArray,
    );

    if (submissionInfo !== undefined) {
      // Get output path as array
      const outputPathArray = this.convertJsonpathToPath(outputPath);
      // Map the object recursively
      return this.mapSubmissionInnerObjectRecursive(
        submissionInfo,
        outputObject,
        outputPathArray,
      );
    }
    return outputObject;
  }

  /**
   * Maps part of the output object based on ther input submission, and a single given submission and output path.
   * @param submissionInfo the data as submitted
   * @param outputObject the current output object for the mapping
   * @param outputPathArray the output path as an array
   * @returns the output object
   */
  mapSubmissionInnerObjectRecursive(
    submissionInfo,
    outputObject,
    outputPathArray,
  ) {
    // Create internal structure, if it doesn't exist
    let referenceObject = outputObject;
    for (let i = 0; i < outputPathArray.length; i = i + 1) {
      let output = outputPathArray[i];
      // Determine if previous item is an array
      if (Array.isArray(referenceObject)) {
        // Create inner objects for next property
        if (Array.isArray(submissionInfo)) {
          if (referenceObject.length === 0) {
            // create inner objects
            if (i !== outputPathArray.length - 1) {
              for (const item of submissionInfo) {
                referenceObject.push(
                  this.mapSubmissionInnerObjectRecursive(
                    item,
                    {},
                    outputPathArray.slice(i),
                  ),
                );
              }
            } else {
              referenceObject.push(
                this.mapSubmissionInnerObjectRecursive(
                  submissionInfo,
                  {},
                  outputPathArray.slice(i),
                ),
              );
            }
          } else {
            // inner objects already created
            for (let j = 0; j < submissionInfo.length; j = j + 1) {
              this.mapSubmissionInnerObjectRecursive(
                submissionInfo[j],
                referenceObject[j],
                outputPathArray.slice(i),
              );
            }
          }
        } else {
          if (referenceObject.length === 0) {
            // create inner object
            referenceObject.push(
              this.mapSubmissionInnerObjectRecursive(
                submissionInfo,
                {},
                outputPathArray.slice(i),
              ),
            );
          } else {
            // inner object already created
            for (const item of referenceObject) {
              this.mapSubmissionInnerObjectRecursive(
                submissionInfo,
                item,
                outputPathArray.slice(i),
              );
            }
          }
        }
        break;
      }

      // Determine if next item is array or object
      else if (this.isArrayOrObject(output) === 'object') {
        if (i === outputPathArray.length - 1) {
          referenceObject[output] = submissionInfo;
        } else if (!referenceObject[output]) {
          referenceObject[output] = {};
        }
      } else {
        output = output.substring(0, output.length - 1); // remove array indicator from name
        if (i === outputPathArray.length - 1) {
          referenceObject[output] = submissionInfo;
        } else if (!referenceObject[output]) {
          referenceObject[output] = [];
        }
      }

      // Go to next level for next iteration
      referenceObject = referenceObject[output];
    }

    return outputObject;
  }

  isArrayOrObject(path: string) {
    return path.endsWith('[') ? 'array' : 'object';
  }

  formatDynamicForUpstream(body: object) {
    const submissionData = body['submission']['submission']['data'];
    const fieldSchema = body['version']['schema']['components'];
    const formId = body['version']['formId'];
    const schemaMap = {};
    // Grab base paths, if applicable
    const basePathMap = this.grabJsonBasePathRecursive(fieldSchema);
    // Grab submission data -> output key name mapping
    this.grabDynamicFieldMappingsRecursive(fieldSchema, schemaMap);
    if (basePathMap && Object.keys(basePathMap).length !== 0) {
      // Add base paths into output path keys, if applicable
      this.formatSchemaMapWithBasePaths(schemaMap, basePathMap);
    }
    let upstreamBody = {};
    for (const [submissionPath, outputPath] of Object.entries(schemaMap)) {
      // For each input -> output mapping, map all applicable parts of submission data
      upstreamBody = this.mapSubmissionUsingSchemaRecursive(
        submissionData,
        upstreamBody,
        submissionPath,
        outputPath,
      );
    }
    console.log(upstreamBody);
    // Format the request as required for outbound worker and siebel
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
