import { Body, Controller, Get, Post } from '@nestjs/common';
import { RequestDBService } from '../../db/request.service';
import { InsertResult } from 'typeorm';
import { CreateRequestDto } from '../../dto/create-request.dto';
import { OutboundQueueService } from '../../helpers/outbound-queue/outbound-queue.service';

@Controller('test')
export class TestController {
  constructor(
    private readonly requestDBService: RequestDBService,
    private readonly outboundQueueService: OutboundQueueService,
  ) {}

  @Post()
  async createRequest(
    @Body() createRequestDto: CreateRequestDto,
  ): Promise<InsertResult> {
    return await this.requestDBService.createOne(createRequestDto);
  }

  @Get('start-queue')
  async startQueue() {
    await this.outboundQueueService.pauseOutboundQueue();
    const waitingJobs = await this.requestDBService.findAll();
    for (const request of waitingJobs) {
      await this.outboundQueueService.addRequestToTypeQueue(request);
    }
    await this.outboundQueueService.resumeOutboundQueue();
  }
}
