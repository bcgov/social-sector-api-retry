import { MigrationInterface, QueryRunner } from 'typeorm';

export class FormSubmissionId1770074950322 implements MigrationInterface {
  name = 'FormSubmissionId1770074950322';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "request" ADD "webhook_form_submission_id" text`,
    );
    await queryRunner.query(
      `ALTER TABLE "request" ADD CONSTRAINT "UQ_482ba9f03873b9d3f3001169eaa" UNIQUE ("webhook_form_submission_id")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "request" DROP CONSTRAINT "UQ_482ba9f03873b9d3f3001169eaa"`,
    );
    await queryRunner.query(
      `ALTER TABLE "request" DROP COLUMN "webhook_form_submission_id"`,
    );
  }
}
