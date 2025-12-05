import { Test, TestingModule } from '@nestjs/testing';
import { OutboundQueueService } from './outbound-queue.service';

describe('OutboundQueueService', () => {
  let service: OutboundQueueService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [OutboundQueueService],
    }).compile();

    service = module.get<OutboundQueueService>(OutboundQueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
