import { Module } from '@nestjs/common';
import { ResultInterceptor } from './interceptor.js';

@Module({
  providers: [ResultInterceptor],
  exports:   [ResultInterceptor],
})
export class ResultModule {}
