export default () => ({
  buildInfo: {
    buildNumber: process.env.SOCIAL_RETRY_APP_LABEL ?? 'localBuild',
  },
  db: {
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT as string),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    runMigrations: process.env.DB_RUN_MIGRATIONS === 'true',
    logging: process.env.DB_LOGGING === 'true',
  },
});
