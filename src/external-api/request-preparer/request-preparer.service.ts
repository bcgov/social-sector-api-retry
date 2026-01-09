import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from '../../db/entities/request.entity';
import { firstValueFrom } from 'rxjs';
import { TokenRefresherService } from '../token-refresher/token-refresher.service';

@Injectable()
export class RequestPreparerService {
  private readonly logger = new Logger(RequestPreparerService.name);
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly tokenRefresherService: TokenRefresherService,
  ) {}

  async sendOutboundSiebelRequest(req: Partial<Request>) {
    const token = await this.tokenRefresherService.refreshUpstreamBearerToken();
    if (token === undefined) {
      throw new Error('Upstream auth failed');
    }
    if (req.headers) {
      req.headers['Authorization'] = token;
      req.headers['Content-Type'] = req.contentType ?? 'application/json';
      req.headers['X-ICM-TrustedUsername'] = req.idir;
    } else {
      req.headers = {
        Authorization: token,
        'Content-Type': req.contentType ?? 'application/json',
        'X-ICM-TrustedUsername': req.idir,
      };
    }
    let data = undefined;
    /*
	 Note: Axios automatically converts data of the following content types from JSON
	 to what's needed upstream (ex: an encoded url). We're taking the plaintext data from the DB
	 and converting it into the correct format for axios here.
	 */
    if (req.body) {
      if (
        req.headers['Content-Type'] === 'application/json' ||
        req.headers['Content-Type'] === 'multipart/form-data'
      ) {
        data = JSON.parse(req.body); // this is so axios can serialize the data correctly for upstream
      } else if (
        req.headers['Content-Type'] === 'application/x-www-form-urlencoded'
      ) {
        data = JSON.parse(decodeURIComponent(req.body));
      } else {
        data = req.body;
      }
    }
    const axiosConfig = {
      method: req.httpMethod,
      url: req.outboundUrl,
      headers: req.headers,
      params: req.params ?? undefined,
      data: data ?? undefined,
    };
    let response;
    try {
      response = await firstValueFrom(this.httpService.request(axiosConfig));
    } catch (error) {
      throw error; // throw to catching function
    }
    return response;
  }
}
