import {
  IsEnum,
  IsJSON,
  IsNotEmpty,
  IsOptional,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { HttpMethod } from '../common/constants/enumerations';
import { Exclude, Expose, Transform } from 'class-transformer';
import { ApiProperty, ApiSchema } from '@nestjs/swagger';
import { urlMax } from '../common/constants/parameter-constants';
import {
  getContentType,
  validateStringFileSize,
  validateStringMatchingMimeType,
} from '../helpers/utilities/utilities.service';

@Exclude()
@ApiSchema({ name: 'CreateRequest' })
export class CreateRequestDto {
  @IsNotEmpty()
  @IsUrl()
  @MaxLength(urlMax)
  @Expose()
  @ApiProperty({
    example: 'http://www.gov.bc.ca',
    description:
      'The URL to make your request against, including the endpoint.',
    maxLength: urlMax,
  })
  outboundUrl: string;

  @IsNotEmpty()
  @IsEnum(HttpMethod)
  @Expose()
  @ApiProperty({
    example: HttpMethod.Post,
    description: 'The HTTP Method of the request.',
    enum: HttpMethod,
  })
  httpMethod: string;

  @IsOptional()
  @IsJSON()
  @Expose()
  @ApiProperty({
    example: `{ "Content-Type" : "application/json" }`,
    description: 'The headers for the request, in stringified JSON format.',
  })
  headers?: string;

  @IsOptional()
  @IsJSON()
  @Expose()
  @ApiProperty({
    example: `{ "yourParameter" : "value" }`,
    description: 'The parameters for the request, in stringified JSON format.',
  })
  params?: string;

  @IsOptional()
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  @Transform(({ value, key, obj }) => {
    if (value == undefined) {
      return value;
    }
    validateStringFileSize(value);
    const type = getContentType(obj);
    validateStringMatchingMimeType(type, value);
    return value;
  })
  @Expose()
  @ApiProperty({
    example: `{ "requestBodyParameter" : "value" }`,
    description:
      'The request body. Note that the content type must match what is provided in headers.' +
      ' If no headers are specified, the assumed content type is application/json.' +
      ' Additionally, all data of content type "multipart/form-data" is expected to be provided in stringified JSON format.' +
      ' Data of content type "application/x-www-form-urlencoded" will be formatted automatically',
  })
  body?: string;

  constructor(object) {
    Object.assign(this, object);
  }
}

// This is for internal creation only, and as such has no additional
// input validation
export class ExpandedCreateRequestDto {
  idir: string;

  email: string;

  firstName?: string;

  lastName?: string;

  upstreamType: string;

  outboundUrl: string;

  httpMethod: string;

  headers?: object;

  params?: object;

  contentType: string;

  body?: string;

  constructor(object) {
    Object.assign(this, object);
  }
}
