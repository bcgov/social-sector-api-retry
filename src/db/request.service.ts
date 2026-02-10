import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DataSource,
  InsertResult,
  Repository,
  TypeORMError,
  UpdateResult,
} from 'typeorm';
import { Request } from './entities/request.entity';
import { ExpandedCreateRequestDto } from '../dto/create-request.dto';
import { OutboundQueueService } from '../helpers/outbound-queue/outbound-queue.service';
import { UpstreamType } from '../common/constants/enumerations';

@Injectable()
export class RequestDBService {
  constructor(
    @InjectRepository(Request)
    private readonly requestsRepository: Repository<Request>,
    private dataSource: DataSource,
    private readonly outboundQueueService: OutboundQueueService,
  ) {}

  async findAll(): Promise<Request[]> {
    return await this.requestsRepository.find();
  }

  async findOne(id: string): Promise<Request | null> {
    return await this.requestsRepository.findOneBy({ id });
  }

  async findOneByFormSubmissionId(
    formSubmissionId: string,
  ): Promise<Request | null> {
    return await this.requestsRepository.findOneBy({
      webhookFormSubmissionId: formSubmissionId,
    });
  }

  async remove(id: string): Promise<void> {
    await this.requestsRepository.delete(id);
  }

  async createOne(requestDto: ExpandedCreateRequestDto): Promise<InsertResult> {
    const request = this.requestsRepository.create(requestDto);
    return await this.requestsRepository.insert(request);
  }

  async createWebhookEntry(jobSubmissionId: string, body: object) {
    const request = new Request();
    request.webhookFormSubmissionId = jobSubmissionId;
    request.webhookBody = JSON.stringify(body);
    request.upstreamType = UpstreamType.FormSubmission;
    return await this.requestsRepository.save(request);
  }

  async createAndAddToQueue(
    requestDto: ExpandedCreateRequestDto,
  ): Promise<Request> {
    const request = this.requestsRepository.create(requestDto);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const insertResult = await this.requestsRepository.insert(request);
      const result = await this.requestsRepository.findOneBy({
        id: insertResult.identifiers[0].id,
      });
      await this.outboundQueueService.addRequestToTypeQueue(result);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateAndAddToQueue(
    requestDto: ExpandedCreateRequestDto,
    id: string,
  ): Promise<Request> {
    const request = this.requestsRepository.create(requestDto);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      await this.requestsRepository.update({ id }, request);
      const result = await this.requestsRepository.findOneBy({
        id,
      });
      await this.outboundQueueService.addRequestToTypeQueue(result);
      await queryRunner.commitTransaction();
      return result;
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async updateOne(request: Partial<Request>): Promise<UpdateResult> {
    if (request.id) {
      return await this.requestsRepository.update(request.id, request);
    }
    throw new TypeORMError(`${Request.name} id not provided.`);
  }
}
