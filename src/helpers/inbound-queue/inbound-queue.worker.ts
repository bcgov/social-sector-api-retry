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
import util from 'node:util';

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
   * Component "type" values that represent a genuine repeating/array structure in the submission
   * data (e.g. form.io's Edit Grid). Fields nested inside one of these cannot have a "." in their
   * own key (CHEFS reserves dots in a key for building nested submission paths), so the array
   * component's own key is automatically prepended to its descendants' keys instead - see
   * grabDynamicFieldMappingsRecursive.
   */
  static readonly arrayComponentTypes = ['editgrid', 'datagrid'];

  /**
   * Recursively grab mappings from the property "jsonpath", where the key is the how it appears in submission data
   * (seperated by '.') and the value is how it should appear in the output (seperated by '>')
   * @param components the root components object in the version schema
   * @param schemaMap reference to an empty object, which will become your mapping
   * @param pathPrefix the submission path prefix (ending in '.') inherited from an ancestor array
   * component (e.g. an Edit Grid), or an empty string if not currently inside one. This is
   * prepended to each component's own key, since fields nested inside an array component cannot
   * include a "." in their own key
   */
  grabDynamicFieldMappingsRecursive(
    components: Array<object> | undefined | null,
    schemaMap: object,
    pathPrefix = '',
  ) {
    for (const component of components) {
      const fullKey = `${pathPrefix}${component['key']}`;
      if (component['properties'] && component['properties']['jsonpath']) {
        schemaMap[fullKey] = component['properties']['jsonpath'];
      }
      // If this component is itself a repeating/array component, its own (fully-qualified) key
      // becomes the path prefix for all of its descendants
      const childPrefix = InboundQueueWorker.arrayComponentTypes.includes(
        component['type'],
      )
        ? `${fullKey}.`
        : pathPrefix;
      if (
        typeof component['components'] === 'object' &&
        component['components'] != null
      ) {
        this.grabDynamicFieldMappingsRecursive(
          component['components'],
          schemaMap,
          childPrefix,
        );
      } else if (
        typeof component['columns'] === 'object' &&
        component['columns'] != null
      ) {
        this.grabDynamicFieldMappingsRecursive(
          component['columns'],
          schemaMap,
          childPrefix,
        );
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
   * Recursively resolves the remaining pathArray (starting at index) against datum, correlating
   * through any genuine repeating-group (array) boundaries encountered along the way, including
   * nested ones (a repeating group within a repeating group).
   * @param datum the value currently being navigated - an object, array, or scalar
   * @param pathArray the full path being resolved
   * @param index the next segment of pathArray to consume
   * @returns the resolved value (or undefined if not found), and arrayDepth: how many genuine
   * repeating-group (array) boundaries were crossed while resolving the remaining path. Plain
   * object property access after entering an array does not add to arrayDepth (e.g. a nested
   * object within a grid row); only a further array actually being iterated over does. A value
   * that happens to itself be an array, but with no remaining path segments left to resolve, is a
   * terminal/leaf value (e.g. a multi-select field) and does not count towards arrayDepth either
   */
  resolveObjectPath(
    datum: unknown,
    pathArray: Array<string>,
    index: number,
  ): { value: unknown; arrayDepth: number } {
    if (index >= pathArray.length) {
      return { value: datum, arrayDepth: 0 };
    }
    if (datum === undefined || datum === null) {
      return { value: undefined, arrayDepth: 0 };
    }
    if (Array.isArray(datum)) {
      // genuine repeating group: correlate the remaining path across every row
      let hasValue = false;
      let childDepth = 0;
      const values = datum.map((row) => {
        const resolved =
          row === undefined || row === null
            ? { value: undefined, arrayDepth: 0 }
            : this.resolveObjectPath(
                row[pathArray[index]],
                pathArray,
                index + 1,
              );
        if (resolved.value !== undefined) {
          hasValue = true;
          childDepth = Math.max(childDepth, resolved.arrayDepth);
        }
        return resolved.value;
      });
      return {
        value: hasValue ? values : undefined,
        arrayDepth: 1 + childDepth,
      };
    }
    // plain object property access does not add array depth
    return this.resolveObjectPath(
      datum[pathArray[index]],
      pathArray,
      index + 1,
    );
  }

  /**
   * Finds if any value(s) match the path in the given object. Works for paths with objects and arrays.
   * @param obj the input object
   * @param pathArray an array denoting the path, with [ at the end of each string denoting an array path
   * @returns an object containing the value(s) found at the path specified (or undefined if not
   * found), and arrayDepth: the number of genuine repeating-group levels represented in the value
   * - see resolveObjectPath
   */
  checkObjectPathWithArray(
    obj,
    pathArray,
  ): { value: unknown; arrayDepth: number } {
    return this.resolveObjectPath(obj, pathArray, 0);
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
    const { value: submissionInfo, arrayDepth } = this.checkObjectPathWithArray(
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
        arrayDepth,
      );
    }
    return outputObject;
  }

  /**
   * Maps part of the output object based on ther input submission, and a single given submission and output path.
   * @param submissionInfo the data as submitted
   * @param outputObject the current output object for the mapping
   * @param outputPathArray the output path as an array
   * @param arrayDepth the number of remaining genuine repeating-group levels represented in
   * submissionInfo (as computed from the schema tree by grabDynamicFieldMappingsRecursive). While
   * this is greater than 0, an array-typed submissionInfo is spread across one output array
   * element per row; once it reaches 0, an array-typed submissionInfo is instead embedded as-is
   * (e.g. a multi-select field's value)
   * @returns the output object
   */
  mapSubmissionInnerObjectRecursive(
    submissionInfo,
    outputObject,
    outputPathArray,
    arrayDepth = 0,
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
            if (arrayDepth > 0) {
              // genuine repeating group: one output element per submission row
              for (const item of submissionInfo) {
                referenceObject.push(
                  this.mapSubmissionInnerObjectRecursive(
                    item,
                    {},
                    outputPathArray.slice(i),
                    arrayDepth - 1,
                  ),
                );
              }
            } else {
              // value is simply array-typed (e.g. a multi-select): embed it as-is
              referenceObject.push(
                this.mapSubmissionInnerObjectRecursive(
                  submissionInfo,
                  {},
                  outputPathArray.slice(i),
                  arrayDepth,
                ),
              );
            }
          } else if (
            referenceObject.length === 1 &&
            submissionInfo.length !== 1
          ) {
            // this array position was already established as a single shared wrapper by a
            // different, unrelated field (e.g. one with no genuine repeating group of its own);
            // merge into that single element instead of trying to correlate by row index, and
            // keep the arrayDepth budget for a later bracket that represents this field's own
            // repeating group
            this.mapSubmissionInnerObjectRecursive(
              submissionInfo,
              referenceObject[0],
              outputPathArray.slice(i),
              arrayDepth,
            );
          } else if (arrayDepth > 0) {
            // inner objects already created, correlate by row index
            const rowCount = Math.min(
              referenceObject.length,
              submissionInfo.length,
            );
            for (let j = 0; j < rowCount; j = j + 1) {
              this.mapSubmissionInnerObjectRecursive(
                submissionInfo[j],
                referenceObject[j],
                outputPathArray.slice(i),
                arrayDepth - 1,
              );
            }
          } else {
            // another array-typed value sharing the same already-created single element
            this.mapSubmissionInnerObjectRecursive(
              submissionInfo,
              referenceObject[0],
              outputPathArray.slice(i),
              arrayDepth,
            );
          }
        } else {
          if (referenceObject.length === 0) {
            // create inner object
            referenceObject.push(
              this.mapSubmissionInnerObjectRecursive(
                submissionInfo,
                {},
                outputPathArray.slice(i),
                arrayDepth,
              ),
            );
          } else {
            // inner object already created
            for (const item of referenceObject) {
              this.mapSubmissionInnerObjectRecursive(
                submissionInfo,
                item,
                outputPathArray.slice(i),
                arrayDepth,
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
    console.log(util.inspect(upstreamBody, true, 10));
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
