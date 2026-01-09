import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import {
  CreateRequestDto,
  ExpandedCreateRequestDto,
} from '../../dto/create-request.dto';
import {
  getContentType,
  UtilitiesService,
} from '../../helpers/utilities/utilities.service';
import { dbInsertError, invalidJWTError } from '../../common/constants/errors';
import { RequestDBService } from '../../db/request.service';
import { EnqueueEntity } from '../../entities/enqueue.entity';

@Injectable()
export class EnqueueService {
  private readonly logger = new Logger(EnqueueService.name);

  constructor(
    private readonly utilitiesService: UtilitiesService,
    private readonly requestDBService: RequestDBService,
  ) {}

  async postEnqueueEvent(createRequestDto: CreateRequestDto, req: Request) {
    // Evaluate request type, reject with 422 if applicable
    let upstreamType;
    try {
      upstreamType = this.utilitiesService.isValidOutboundUrl(
        createRequestDto.outboundUrl,
      );
    } catch (error) {
      this.logger.error(error);
      throw error;
    }
    // Grab info from token for DB object
    let jwt, insertObject: ExpandedCreateRequestDto, email, idir;
    try {
      jwt = this.utilitiesService.grabJWT(req);
      email = jwt['user_principal_name'] ?? jwt['email'];
      idir = jwt['idir_username'];
      if (email == undefined || idir == undefined) {
        throw new Error(invalidJWTError);
      }
      insertObject = {
        email,
        idir,
        firstName: jwt['given_name'],
        lastName: jwt['family_name'],
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
    } catch {
      throw new BadRequestException([invalidJWTError]);
    }

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
