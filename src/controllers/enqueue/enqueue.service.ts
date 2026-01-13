import { BadRequestException, Injectable, Logger } from '@nestjs/common';

import { CreateRequestDto } from '../../dto/create-request.dto';
import {
  getContentType,
  UtilitiesService,
} from '../../helpers/utilities/utilities.service';
import { dbInsertError } from '../../common/constants/errors';
import { RequestDBService } from '../../db/request.service';
import { EnqueueEntity } from '../../entities/enqueue.entity';

@Injectable()
export class EnqueueService {
  private readonly logger = new Logger(EnqueueService.name);

  constructor(
    private readonly utilitiesService: UtilitiesService,
    private readonly requestDBService: RequestDBService,
  ) {}

  async postEnqueueEvent(createRequestDto: CreateRequestDto) {
    // Evaluate request type, reject if applicable
    let upstreamType;
    try {
      upstreamType = this.utilitiesService.isValidOutboundUrl(
        createRequestDto.outboundUrl,
      );
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
    const insertObject = {
      email: createRequestDto.email,
      idir: createRequestDto.idir,
      firstName: createRequestDto.firstName,
      lastName: createRequestDto.lastName,
      upstreamType,
      outboundUrl: createRequestDto.outboundUrl,
      httpMethod: createRequestDto.httpMethod,
      contentType: getContentType(createRequestDto),
      headers: createRequestDto.headers
        ? JSON.parse(createRequestDto.headers)
        : undefined,
      params: createRequestDto.params
        ? JSON.parse(createRequestDto.params)
        : undefined,
      body: createRequestDto.body,
    };

    // Insert into DB and add to queue
    let result;
    try {
      result = await this.requestDBService.createAndAddToQueue(insertObject);
    } catch (error) {
      this.logger.error(error);
      throw new BadRequestException([dbInsertError]);
    }
    return new EnqueueEntity(result);
  }
}
