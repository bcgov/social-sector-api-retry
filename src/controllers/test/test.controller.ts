import { Body, Controller, Post } from '@nestjs/common';
import { RequestDBService } from '../../db/request.service';
import { InsertResult } from 'typeorm';
import { CreateRequestDto } from '../../dto/create-request.dto';

@Controller('test')
export class TestController {
  constructor(private readonly requestDBService: RequestDBService) {}

  @Post()
  create(@Body() createRequestDto: CreateRequestDto): Promise<InsertResult> {
    return this.requestDBService.createOne(createRequestDto);
  }
}
