import { Test, TestingModule } from '@nestjs/testing';
import { RequestDBService } from './request.service';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './entities/request.entity';

describe('RequestDBService', () => {
  let service: RequestDBService;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  let repository: Repository<Request>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RequestDBService,
        { provide: getRepositoryToken(Request), useValue: {} },
      ],
    }).compile();

    service = module.get<RequestDBService>(RequestDBService);
    repository = module.get<Repository<Request>>(getRepositoryToken(Request));
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
