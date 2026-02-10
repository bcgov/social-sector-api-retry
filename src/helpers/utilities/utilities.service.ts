import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import {
  invalidJSONError,
  invalidMimeTypeError,
  invalidMultipartFormError,
  invalidURLEncodedError,
  maxFileSizeError,
  unauthorizedURLError,
} from '../../common/constants/errors';
import {
  maxFileSizeBytes,
  upstreamDateFormatNoTime,
} from '../../common/constants/parameter-constants';
import { isMimeType } from 'class-validator';
import { ConfigService } from '@nestjs/config';
import { UpstreamType } from '../../common/constants/enumerations';
import { JwtService } from '@nestjs/jwt';
import { DateTime } from 'luxon';

@Injectable()
export class UtilitiesService {
  authorizedUrls: object;
  private readonly logger = new Logger(UtilitiesService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.authorizedUrls = this.configService.get<object>('authorizedUrls');
  }

  async sleep(timeMs: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeMs);
    });
  }

  grabJWT(req: Request): string {
    const authToken = req.header('authorization').split(/\s+/)[1];
    try {
      const decoded = this.jwtService.decode(authToken);
      return decoded;
    } catch {
      const error = `Invalid JWT`;
      this.logger.error(error);
      throw new Error(error);
    }
  }

  isValidOutboundUrl(input: string) {
    try {
      const url = new URL(input);
      for (const type of Object.keys(UpstreamType)) {
        if (url.href.startsWith(this.authorizedUrls[UpstreamType[type]])) {
          return UpstreamType[type];
        }
      }
      throw new Error(unauthorizedURLError);
    } catch {
      throw new BadRequestException([unauthorizedURLError]);
    }
  }
  /**
   * Converts an ISO 8601 formatted string to the MM/dd/yyyy HH:mm:ss format.
   * @param isoDate an ISO 8601 formatted string. Assumes the date given is provided in UTC
   * @returns string formatted date for upstream use if valid ISO 8601 date is provided, or undefined if not
   */
  convertISODateToUpstreamFormatNoTime(isoDate: string): string | undefined {
    const upstreamDate = DateTime.fromISO(isoDate.trim(), {
      zone: 'UTC',
    }).toFormat(upstreamDateFormatNoTime);
    if (upstreamDate === 'Invalid DateTime') {
      return undefined;
    }
    return upstreamDate;
  }
}

export function validateStringFileSize(text: string) {
  if (maxFileSizeBytes < Buffer.byteLength(text, 'utf-8')) {
    throw new BadRequestException([maxFileSizeError]);
  }
  return text;
}

export function getContentType(obj) {
  return (
    getObjectParameterCaseInsensitive(obj['headers'], 'Content-Type') ??
    'application/json'
  );
}

export function validateStringMatchingMimeType(type: string, body: string) {
  if (!isMimeType(type)) {
    throw new BadRequestException([invalidMimeTypeError]);
  }
  if (type === 'application/json' || type === 'multipart/form-data') {
    try {
      JSON.parse(body);
    } catch {
      const error =
        type === 'application/json'
          ? invalidJSONError
          : invalidMultipartFormError;
      throw new BadRequestException([error]);
    }
  } else if (type === 'application/x-www-form-urlencoded') {
    try {
      decodeURIComponent(body);
    } catch {
      throw new BadRequestException([invalidURLEncodedError]);
    }
  }
}

export function getObjectParameterCaseInsensitive(object, key) {
  if (object == undefined) {
    return undefined;
  }
  const asLowercase = key.toLowerCase();
  return object[
    Object.keys(object).find((k) => k.toLowerCase() === asLowercase)
  ];
}
