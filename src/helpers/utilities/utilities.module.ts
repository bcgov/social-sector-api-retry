import { Module } from '@nestjs/common';
import { UtilitiesService } from './utilities.service';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

@Module({
  providers: [UtilitiesService, ConfigService],
  imports: [JwtModule.register({ global: true })],
})
export class UtilitiesModule {}
