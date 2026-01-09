import { Test, TestingModule } from '@nestjs/testing';
import { EnqueueService } from './enqueue.service';
import { UtilitiesService } from '../../helpers/utilities/utilities.service';
import { Request } from '../../db/entities/request.entity';
import { getRepositoryToken } from '@nestjs/typeorm';
import { RequestDBService } from '../../db/request.service';
import { DataSource } from 'typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import configuration from '../../configuration/configuration';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';

describe('EnqueueService', () => {
  let service: EnqueueService;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EnqueueService,
        UtilitiesService,
        RequestDBService,
        { provide: getRepositoryToken(Request), useValue: {} },
        { provide: DataSource, useValue: {} },
        ConfigService,
        { provide: OutboundQueueService, useValue: {} },
      ],
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        JwtModule.register({ global: true }),
      ],
    })
      .overrideProvider('BullQueue_outbound')
      .useValue(mockQueue)
      .compile();

    service = module.get<EnqueueService>(EnqueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
