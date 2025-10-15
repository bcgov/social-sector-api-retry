import { Module } from '@nestjs/common';
import { TestModule } from './test/test.module';

@Module({ imports: [TestModule], exports: [TestModule] })
export class ControllersModule {}
