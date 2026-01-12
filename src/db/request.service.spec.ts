import { Test, TestingModule } from '@nestjs/testing';
import { RequestDBService } from './request.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Request } from './entities/request.entity';
import { OutboundQueueService } from '../helpers/outbound-queue/outbound-queue.service';

describe('RequestDBService', () => {
  let service: RequestDBService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let repository: Repository<Request>;
  const mockQueue: any = {
    add: jest.fn(),
    process: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestDBService,
        { provide: getRepositoryToken(Request), useValue: {} },
        { provide: DataSource, useValue: {} },
        { provide: OutboundQueueService, useValue: {} },
      ],
    })
      .overrideProvider('BullQueue_outbound')
      .useValue(mockQueue)
      .compile();

    service = module.get<RequestDBService>(RequestDBService);
    repository = module.get<Repository<Request>>(getRepositoryToken(Request));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
