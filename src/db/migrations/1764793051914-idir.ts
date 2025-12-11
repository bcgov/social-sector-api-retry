import { MigrationInterface, QueryRunner } from 'typeorm';

export class Idir1764793051914 implements MigrationInterface {
  name = 'Idir1764793051914';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "request" ADD "idir" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "request" DROP COLUMN "idir"`);
  }
}
