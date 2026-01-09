import { Test, TestingModule } from '@nestjs/testing';
import { EnqueueController } from './enqueue.controller';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import configuration from '../../configuration/configuration';
import { RequestDBService } from '../../db/request.service';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';
import { UtilitiesService } from '../../helpers/utilities/utilities.service';
import { DataSource } from 'typeorm';
import { EnqueueService } from './enqueue.service';

describe('EnqueueController', () => {
  let controller: EnqueueController;

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
      controllers: [EnqueueController],
    })
      .overrideProvider('BullQueue_outbound')
      .useValue(mockQueue)
      .compile();

    controller = module.get<EnqueueController>(EnqueueController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
