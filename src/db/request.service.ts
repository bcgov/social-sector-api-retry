import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InsertResult, Repository, TypeORMError, UpdateResult } from 'typeorm';
import { Request } from './entities/request.entity';
import { CreateRequestDto } from '../dto/create-request.dto';

@Injectable()
export class RequestDBService {
  constructor(
    @InjectRepository(Request)
    private readonly requestsRepository: Repository<Request>,
  ) {}

  async findAll(): Promise<Request[]> {
    return await this.requestsRepository.find();
  }

  async findOne(id: string): Promise<Request | null> {
    return await this.requestsRepository.findOneBy({ id });
  }

  async remove(id: string): Promise<void> {
    await this.requestsRepository.delete(id);
  }

  async createOne(requestDto: CreateRequestDto): Promise<InsertResult> {
    const request = this.requestsRepository.create(requestDto);
    return await this.requestsRepository.insert(request);
  }

  async updateOne(request: Partial<Request>): Promise<UpdateResult> {
    if (request.id) {
      return await this.requestsRepository.update(request.id, request);
    }
    throw new TypeORMError(`${Request.name} id not provided.`);
  }
}
