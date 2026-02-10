import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Timeout } from '@nestjs/schedule';
import { AckPolicy, NatsConnection, nkeyAuthenticator } from 'nats';
// eslint-disable-next-line @typescript-eslint/no-require-imports
globalThis.WebSocket = require('websocket').w3cwebsocket;
import { connect, Consumer, JetStreamClient, JetStreamManager } from 'nats.ws';
import { InboundQueueService } from '../inbound-queue/inbound-queue.service';

@Injectable()
export class NatsService implements OnModuleInit, OnApplicationShutdown {
  private natsConnection: NatsConnection;
  private jetstream: JetStreamClient;
  private jetstreamManager: JetStreamManager;
  pullConsumer: Consumer;
  private readonly host;
  private readonly nkeySeed;
  private readonly streamName;
  private readonly durableName;
  filterSubjects;
  maxMessages;
  sourceFilter;
  reconnectTimeWait;
  maxReconnectAttempts;
  pollingWait;

  private readonly logger = new Logger(NatsService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly inboundQueueService: InboundQueueService,
  ) {
    const nkeySeedValue = this.configService.get<string>('nats.nkeySeedValue');
    this.host = this.configService.get<string>('nats.host');
    this.nkeySeed = new TextEncoder().encode(nkeySeedValue);
    this.streamName = this.configService.get<string>('nats.streamName');
    this.sourceFilter = this.configService.get<string>('nats.sourceFilter');
    this.durableName = this.configService.get<string>('nats.durableName');
    this.filterSubjects = this.configService.get<Array<string>>(
      'nats.filterSubjects',
    );
    this.maxMessages = this.configService.get<number>('nats.maxMessages');
    this.reconnectTimeWait = this.configService.get<number>(
      'nats.reconnectTimeWait',
    );
    this.maxReconnectAttempts = this.configService.get<number>(
      'nats.maxReconnectAttempts',
    );
    this.pollingWait = this.configService.get<number>('nats.pollingWait');
  }

  async onModuleInit() {
    await this.startConnect();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async onApplicationShutdown(signal?: string) {
    await this.natsConnection.drain(); // drains the connection safely on shutdown
  }

  async startConnect(): Promise<void> {
    try {
      this.logger.log('Attempting NATS connection...');
      this.natsConnection = await connect({
        servers: [this.host],
        reconnectTimeWait: this.reconnectTimeWait,
        authenticator: nkeyAuthenticator(this.nkeySeed),
        maxReconnectAttempts: this.maxReconnectAttempts,
      });
      this.logger.log('Accessing Jetstream...');
      this.jetstream = this.natsConnection.jetstream();
      this.logger.log('Getting Jetstream Manager...');
      this.jetstreamManager = await this.jetstream.jetstreamManager();
      await this.jetstreamManager.consumers.add(this.streamName, {
        ack_policy: AckPolicy.Explicit,
        durable_name: this.durableName,
      });
      this.logger.log(
        `Getting consumer: stream = ${this.streamName}, durable name = ${this.durableName}...`,
      );
      this.pullConsumer = await this.jetstream.consumers.get(this.streamName, {
        name_prefix: this.durableName,
        filterSubjects: this.filterSubjects,
      });
    } catch (error) {
      this.logger.fatal(`NATS connection failed`);
      this.logger.fatal(error);
      process.exitCode = 1;
    }
  }

  @Timeout('fetch', 5000)
  async fetch() {
    this.logger.log(`Fetching from stream...`);
    const iter = await this.pullConsumer.fetch({
      max_messages: this.maxMessages,
    });
    for await (const m of iter) {
      await this.inboundQueueService.addMessageToInboundQueue(m);
      m.ack();
    }
    setTimeout(this.fetch.bind(this), this.pollingWait);
  }
}
