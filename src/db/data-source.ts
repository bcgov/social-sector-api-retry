// This file is only used for migrations.
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { Request } from './entities/request.entity';
dotenv.config();

export default new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT as string),
  username: process.env.DB_USERNAME,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  schema: process.env.DB_SCHEMA,
  synchronize: process.env.DB_SYNCHRONIZE === 'true',
  entities: [Request],
  migrations: ['dist/db/migrations/**/*{.js,.ts}'],
});
