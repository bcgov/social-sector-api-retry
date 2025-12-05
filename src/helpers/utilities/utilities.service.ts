import { Injectable } from '@nestjs/common';

@Injectable()
export class UtilitiesService {
  async sleep(timeMs: number) {
    return new Promise((resolve) => {
      setTimeout(resolve, timeMs);
    });
  }
}
