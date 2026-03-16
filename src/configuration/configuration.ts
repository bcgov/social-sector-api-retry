import { FormType } from '../common/constants/enumerations';

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
      key: process.env.DB_CLIENT_KEY,
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
    endpointUrls: {
      inPersonVisits: process.env.SIEBEL_IN_PERSON_VISITS_ENDPOINT,
      [FormType.Dynamic]: process.env.CHEFS_DYNAMIC_FORM_ENDPOINTS
        ? JSON.parse(process.env.CHEFS_DYNAMIC_FORM_ENDPOINTS)
        : undefined,
    },
    workspace: {
      inPersonVisits: process.env.SIEBEL_IN_PERSON_VISITS_WORKSPACE,
      [FormType.Dynamic]: process.env.CHEFS_DYNAMIC_FORM_WORKSPACES
        ? JSON.parse(process.env.CHEFS_DYNAMIC_FORM_WORKSPACES)
        : undefined,
    },
    method: {
      [FormType.Dynamic]: process.env.CHEFS_DYNAMIC_FORM_METHODS
        ? JSON.parse(process.env.CHEFS_DYNAMIC_FORM_METHODS)
        : undefined,
    },
  },
  authorizedUrls: {
    siebel: process.env.SIEBEL_UPSTREAM_URL,
  },
  mail: {
    host: process.env.MAIL_HOST,
    port: Number.parseInt(process.env.MAIL_PORT),
    secure: process.env.MAIL_SECURE === 'true',
    auth: process.env.MAIL_AUTH === 'true',
    user: process.env.MAIL_USER,
    pass: process.env.MAIL_PASSWORD,
    pool: process.env.MAIL_POOL_CONNECTION === 'true',
    sender: process.env.MAIL_SENDER_ADDRESS,
  },
  nats: {
    filterSubjects: process.env.NATS_FILTER_SUBJECTS.split(/\n/),
    maxMessages: Number.parseInt(process.env.NATS_MAX_MESSAGES),
    sourceFilter: process.env.NATS_SOURCE_FILTER,
    nkeySeedValue: process.env.NATS_NKEY_SEED_VALUE,
    streamName: process.env.NATS_STREAM_NAME,
    host: process.env.NATS_HOST,
    durableName:
      process.env.NATS_DURABLE_NAME ?? 'da166e52-19fb-47ab-bdc8-6f06b69e29e8',
    reconnectTimeWait: Number.parseInt(process.env.NATS_RECONNECT_TIME_WAIT),
    maxReconnectAttempts: Number.parseInt(
      process.env.NATS_MAX_RECONNECT_ATTEMPTS,
    ),
    pollingWait: Number.parseInt(process.env.NATS_POLLING_WAIT_MS),
  },
  chefs: {
    apiKeys: {
      [FormType.Memo]: process.env.CHEFS_MEMO_API_KEY,
      [FormType.Dynamic]: process.env.CHEFS_DYNAMIC_API_KEYS
        ? JSON.parse(process.env.CHEFS_DYNAMIC_API_KEYS)
        : undefined,
    },
    formIds: {
      [FormType.Memo]: process.env.CHEFS_MEMO_FORM_ID,
      [FormType.Dynamic]: process.env.CHEFS_DYNAMIC_FORM_IDS
        ? JSON.parse(process.env.CHEFS_DYNAMIC_FORM_IDS)
        : undefined,
    },
    endpointUrls: {
      baseUrl: process.env.CHEFS_BASE_URL,
      getFormSubmission: process.env.CHEFS_GET_FORM_SUBMISSION_ENDPOINT,
    },
  },
});
