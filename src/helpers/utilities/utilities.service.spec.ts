import { Test, TestingModule } from '@nestjs/testing';
import {
  getContentType,
  UtilitiesService,
  validateStringFileSize,
  validateStringMatchingMimeType,
} from './utilities.service';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { getMockReq } from '@jest-mock/express';
import { UpstreamType } from '../../common/constants/enumerations';
import { BadRequestException } from '@nestjs/common';
import { maxFileSizeBytes } from '../../common/constants/parameter-constants';
import { randomBytes } from 'node:crypto';

describe('UtilitiesService', () => {
  let service: UtilitiesService;
  let jwtService: JwtService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UtilitiesService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              const lookup = {
                authorizedUrls: {
                  [UpstreamType.Siebel]: 'http://www.gov.bc.ca',
                },
              };
              return lookup[key];
            }),
          },
        },
      ],
      imports: [JwtModule.register({ global: true })],
    }).compile();

    service = module.get<UtilitiesService>(UtilitiesService);
    jwtService = module.get<JwtService>(JwtService);
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

  describe('grabJWT tests', () => {
    it.each([[`cd529a83c49099f722bfb3e1f31fa01b`]])(
      `should decode jwt if valid`,
      (jti) => {
        const jwt = jwtService.sign(`{"jti":"${jti}"}`, {
          secret: 'aTotalSecret',
        });
        const req = getMockReq({
          header: jest.fn((headerName) => {
            const lookup = { authorization: `Bearer ${jwt}` };
            return lookup[headerName];
          }),
        });
        expect(service.grabJWT(req)).toEqual({ jti: jti });
      },
    );
  });

  describe('isValidOutboundUrl tests', () => {
    it.each([
      [`http://www.gov.bc.ca`, `http://www.gov.bc.ca/yourEndpointHere`],
    ])(`should return type of url if valid`, (url) => {
      expect(service.isValidOutboundUrl(url)).toEqual(UpstreamType.Siebel);
    });

    it('should throw if url is not in valid url list', () => {
      expect(() => {
        service.isValidOutboundUrl('http://www.google.com');
      }).toThrow(BadRequestException);
    });
  });

  describe('validateStringFileSize tests', () => {
    it('validates a file below the file size limit', () => {
      const input = 'texthere';
      const output = validateStringFileSize(input);
      expect(output).toBe(input);
    });

    it('rejects when the length of the input text is too long', () => {
      expect(() => {
        validateStringFileSize(randomBytes(maxFileSizeBytes + 1).toString());
      }).toThrow(BadRequestException);
    });
  });

  describe('getContentType', () => {
    it('returns content type when headers is provide with a content type parameter', () => {
      const type = 'application/x-www-form-urlencoded';
      const obj = {
        headers: {
          'CoNteNT-TyPe': type,
        },
      };
      const output = getContentType(obj);
      expect(output).toBe(type);
    });

    it.each([[{}], [{ headers: {} }]])(
      'returns application/json if content type not provided',
      (obj) => {
        const output = getContentType(obj);
        expect(output).toBe('application/json');
      },
    );
  });

  describe('validateStringMatchingMimeType', () => {
    it.each([
      ['application/json', '{"param":  "value"}'],
      ['multipart/form-data', '{"param":  "value"}'],
      [
        'application/x-www-form-urlencoded',
        '%3Fparam1%3Dvalue1%26param2%3Dvalue2',
      ],
      ['text/plain', 'textexample'],
    ])(
      'returns without throwing if mime type is valid and matches content type',
      (type, body) => {
        const output = validateStringMatchingMimeType(type, body);
        expect(output).toBe(undefined);
      },
    );

    it.each([
      ['application/json', 'notAJSON'],
      ['multipart/form-data', 'alsoNotAJSON'],
      ['application/x-www-form-urlencoded', '%E0%A4%A'],
    ])(`throws if content type doesn't match mime type`, (type, body) => {
      expect(() => {
        validateStringMatchingMimeType(type, body);
      }).toThrow(BadRequestException);
    });

    it('throws if an invalid mime type is passed', () => {
      expect(() => {
        validateStringMatchingMimeType('notAMimeType', undefined);
      }).toThrow(BadRequestException);
    });
  });
});
