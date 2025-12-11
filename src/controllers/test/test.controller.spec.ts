import { Test, TestingModule } from '@nestjs/testing';
import { TestController } from './test.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Request } from '../../db/entities/request.entity';
import { RequestDBService } from '../../db/request.service';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';
import { ConfigModule, ConfigService } from '@nestjs/config';
import configuration from '../../configuration/configuration';
import { Repository } from 'typeorm';

describe('TestController', () => {
  let controller: TestController;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let repository: Repository<Request>;

  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ load: [configuration] })],
      controllers: [TestController],
      providers: [
        { provide: RequestDBService, useValue: { createOne: jest.fn() } },
        ConfigService,
        { provide: OutboundQueueService, useValue: {} },
        { provide: getRepositoryToken(Request), useValue: {} },
      ],
    })
      .overrideProvider('BullQueue_outbound')
      .useValue(mockQueue)
      .compile();

    controller = module.get<TestController>(TestController);
    repository = module.get<Repository<Request>>(getRepositoryToken(Request));
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
