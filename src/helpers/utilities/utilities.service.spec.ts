import { Test, TestingModule } from '@nestjs/testing';
import { UtilitiesService } from './utilities.service';

describe('UtilitiesService', () => {
  let service: UtilitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UtilitiesService],
    }).compile();

    service = module.get<UtilitiesService>(UtilitiesService);
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sleep tests', () => {
    it('returns after a set time', async () => {
      const spy = jest.spyOn(global, 'setTimeout');
      const promise = service.sleep(5000);
      jest.advanceTimersByTime(5000);
      await promise;
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenLastCalledWith(expect.any(Function), 5000);
    });
  });
});
