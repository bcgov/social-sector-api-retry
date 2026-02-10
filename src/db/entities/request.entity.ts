import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export class Request {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text', nullable: true })
  email: string;

  @Column({ type: 'text', nullable: true })
  idir: string;

  @Column({ type: 'text', nullable: true, name: 'first_name' })
  firstName: string;

  @Column({ type: 'text', nullable: true, name: 'last_name' })
  lastName: string;

  @Column({ type: 'text', nullable: true, name: 'upstream_type' })
  upstreamType: string; // enum?

  @Column({ type: 'text', nullable: true, name: 'outbound_url' })
  outboundUrl: string;

  @Column({ type: 'text', nullable: true, name: 'http_method' })
  httpMethod: string; // enum?

  @Column({ type: 'jsonb', nullable: true })
  headers: object;

  @Column({ type: 'jsonb', nullable: true })
  params: object;

  @Column({ type: 'text', nullable: true, name: 'content_type' })
  contentType: string;

  @Column({ type: 'text', nullable: true })
  body: string;

  @Column({ type: 'jsonb', nullable: true, name: 'webhook_headers' })
  webhookHeaders?: object;

  @Column({ type: 'jsonb', nullable: true, name: 'webhook_params' })
  webhookParams?: object;

  @Column({ type: 'text', nullable: true, name: 'webhook_content_type' })
  webhookContentType?: string;

  @Column({ type: 'text', nullable: true, name: 'webhook_body' })
  webhookBody?: string;

  @Column({
    type: 'text',
    nullable: true,
    name: 'webhook_form_submission_id',
    unique: true,
  })
  webhookFormSubmissionId?: string;

  @Column({ type: 'text', nullable: true, name: 'overall_status' })
  overallStatus?: string; // enum?

  @Column({
    type: 'integer',
    nullable: true,
    name: 'latest_upstream_error_code',
  })
  latestUpstreamErrorCode?: number;

  @Column({
    type: 'text',
    nullable: true,
    name: 'latest_upstream_error_message',
  })
  latestUpstreamErrorMessage?: string;
}
