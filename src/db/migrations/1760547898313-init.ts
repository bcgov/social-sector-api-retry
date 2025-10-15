import { MigrationInterface, QueryRunner, TypeORMError } from 'typeorm';

export class Init1760547898313 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const dbName = process.env.DB_NAME;
    if (dbName == undefined) {
      throw new TypeORMError('DB name not found.');
    }
    await queryRunner.createDatabase(dbName, true);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const dbName = process.env.DB_NAME;
    if (dbName == undefined) {
      throw new TypeORMError('DB name not found.');
    }
    await queryRunner.dropDatabase(dbName, true);
  }
}
