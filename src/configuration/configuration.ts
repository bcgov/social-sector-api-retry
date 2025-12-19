export default () => ({
  buildInfo: {
    buildNumber: process.env.SOCIAL_RETRY_APP_LABEL ?? 'localBuild',
  },
  db: {
    host: process.env.DB_HOST,
    port: Number.parseInt(process.env.DB_PORT),
    username: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    schema: process.env.DB_SCHEMA,
    synchronize: process.env.DB_SYNCHRONIZE === 'true',
    runMigrations: process.env.DB_RUN_MIGRATIONS === 'true',
    logging: process.env.DB_LOGGING === 'true',
    useSSL: process.env.DB_SSL === 'true',
    ssl: {
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTH === 'true',
      ca: process.env.DB_CA_CERT,
      cert: process.env.DB_CLIENT_CERT,
    },
  },
  redis: {
    host: process.env.REDIS_HOST,
    port: Number.parseInt(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD,
    user: process.env.REDIS_USER,
  },
  siebel: {
    oauth: {
      accessTokenUrl: process.env.SIEBEL_ACCESS_TOKEN_URL ?? ' ',
      clientId: process.env.SIEBEL_CLIENT_ID ?? ' ',
      clientSecret: process.env.SIEBEL_CLIENT_SECRET ?? ' ',
    },
    queueOptions: {
      retryDelayMs:
        Number.parseInt(process.env.SIEBEL_RETRY_DELAY_MS) ?? 900000,
      backoffDelayMs:
        Number.parseInt(process.env.SIEBEL_BACKOFF_DELAY_MS) ?? 30000,
    },
  },
});
