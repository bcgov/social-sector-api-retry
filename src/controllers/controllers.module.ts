import { Module } from '@nestjs/common';
import { TestModule } from './test/test.module';
import { EnqueueModule } from './enqueue/enqueue.module';

@Module({ imports: [TestModule, EnqueueModule], exports: [TestModule] })
export class ControllersModule {}
