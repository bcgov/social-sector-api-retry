import { Test, TestingModule } from '@nestjs/testing';
import { UtilitiesService } from './utilities.service';
import configuration from '../../configuration/configuration';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

describe('UtilitiesService', () => {
  let service: UtilitiesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UtilitiesService, ConfigService],
      imports: [
        ConfigModule.forRoot({ load: [configuration] }),
        JwtModule.register({ global: true }),
      ],
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
