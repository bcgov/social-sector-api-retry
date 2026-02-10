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
  CONTENT_TYPE,
  trustedIdirHeaderName,
  uniformResponseParamName,
} from '../../common/constants/parameter-constants';

@Processor('inbound')
export class InboundQueueWorker extends WorkerHost {
  formSubmissionJobName: string;
  inPersonVisitsUrl: string;
  inPersonVisitsWorkspace: string | undefined;

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

  formatInputForUpstream(body: object, formName: FormType) {
    switch (formName) {
      case FormType.Memo:
        return this.formatMemoForUpstream(body);
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
            : 60;
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
    const updateObject = this.formatInputForUpstream(response.data, formName);
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
