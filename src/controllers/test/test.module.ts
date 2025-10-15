import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from '../../db/entities/request.entity';
import { RequestDBService } from '../../db/request.service';
import { TestController } from './test.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Request])],
  exports: [TypeOrmModule],
  providers: [RequestDBService],
  controllers: [TestController],
})
export class TestModule {}
