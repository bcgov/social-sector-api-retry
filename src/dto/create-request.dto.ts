// TODO: Add input validation, and auto content type population

export class CreateRequestDto {
  email?: string;
  firstName?: string;
  lastName?: string;
  upstreamType?: string;
  outboundUrl?: string;
  httpMethod?: string;
  headers?: object;
  params?: object;
  body?: string;
  webhook_headers?: object;
  webhook_params?: object;
  webhook_body?: string;
}
