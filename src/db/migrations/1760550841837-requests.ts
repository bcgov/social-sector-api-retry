import { MigrationInterface, QueryRunner } from 'typeorm';

export class Requests1760550841837 implements MigrationInterface {
  name = 'Requests1760550841837';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "request" ` +
        `("id" uuid NOT NULL DEFAULT uuid_generate_v4(), ` +
        `"email" text, ` +
        `"first_name" text, ` +
        `"last_name" text, ` +
        `"upstream_type" text, ` +
        `"outbound_url" text, ` +
        `"http_method" text, ` +
        `"headers" jsonb, ` +
        `"params" jsonb, ` +
        `"content_type" text, ` +
        `"body" text, ` +
        `"webhook_headers" jsonb, ` +
        `"webhook_params" jsonb, ` +
        `"webhook_content_type" text, ` +
        `"webhook_body" text, ` +
        `"overall_status" text, ` +
        `"latest_upstream_error_code" integer, ` +
        `"latest_upstream_error_message" text, ` +
        `CONSTRAINT "PK_167d324701e6867f189aed52e18" PRIMARY KEY ("id"))`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "request"`);
  }
}
