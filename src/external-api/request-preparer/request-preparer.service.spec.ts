import { Test, TestingModule } from '@nestjs/testing';
import { RequestPreparerService } from './request-preparer.service';

describe('RequestPreparerService', () => {
  let service: RequestPreparerService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RequestPreparerService],
    }).compile();

    service = module.get<RequestPreparerService>(RequestPreparerService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
