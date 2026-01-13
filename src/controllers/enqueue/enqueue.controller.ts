import {
  Body,
  ClassSerializerInterceptor,
  Controller,
  Post,
  UseInterceptors,
  ValidationPipe,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiInternalServerErrorResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CONTENT_TYPE } from '../../common/constants/parameter-constants';
import { CreateRequestDto } from '../../dto/create-request.dto';
import { EnqueueService } from './enqueue.service';
import {
  EnqueueEntity,
  EnqueueResponseExample,
} from '../../entities/enqueue.entity';
import { ApiBadRequestErrorEntity } from '../../entities/api-bad-request-error.entity';
import { ApiForbiddenErrorEntity } from '../../entities/api-forbidden-error.entity';
import { ApiInternalServerErrorEntity } from '../../entities/api-internal-server-error.entity';
import { ApiNotFoundErrorEntity } from '../../entities/api-not-found-error.entity';
import { ApiUnauthorizedErrorEntity } from '../../entities/api-unauthorized-error.entity';

@Controller('enqueue')
@ApiBadRequestResponse({ type: ApiBadRequestErrorEntity })
@ApiNotFoundResponse({ type: ApiNotFoundErrorEntity })
@ApiUnauthorizedResponse({ type: ApiUnauthorizedErrorEntity })
@ApiForbiddenResponse({ type: ApiForbiddenErrorEntity })
@ApiInternalServerErrorResponse({ type: ApiInternalServerErrorEntity })
export class EnqueueController {
  constructor(private readonly enqueueService: EnqueueService) {}

  @UseInterceptors(ClassSerializerInterceptor)
  @Post(``)
  @ApiOperation({
    description:
      'Queue a request to be sent to upstream, once it is available.',
  })
  @ApiCreatedResponse({
    content: {
      [CONTENT_TYPE]: {
        examples: {
          EnqueueResponse: {
            value: EnqueueResponseExample,
          },
        },
      },
    },
  })
  async postSingleRequest(
    @Body(
      new ValidationPipe({
        transform: true,
        transformOptions: { enableImplicitConversion: true },
        whitelist: true,
      }),
    )
    createRequestDto: CreateRequestDto,
  ): Promise<EnqueueEntity> {
    return await this.enqueueService.postEnqueueEvent(createRequestDto);
  }
}
