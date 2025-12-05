import { Module } from '@nestjs/common';
import { RequestPreparerService } from './request-preparer.service';
import { TokenRefresherService } from '../token-refresher/token-refresher.service';
import { HttpModule } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';

@Module({
  imports: [HttpModule],
  providers: [RequestPreparerService, TokenRefresherService, ConfigService],
  exports: [RequestPreparerService],
})
export class RequestPreparerModule {}
