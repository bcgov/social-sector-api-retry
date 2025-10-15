import { Test, TestingModule } from '@nestjs/testing';
import { TestController } from './test.controller';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Request } from '../../db/entities/request.entity';
import { RequestDBService } from '../../db/request.service';

describe('TestController', () => {
  let controller: TestController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TestController],
      providers: [
        RequestDBService,
        { provide: getRepositoryToken(Request), useValue: {} },
      ],
    }).compile();

    controller = module.get<TestController>(TestController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
