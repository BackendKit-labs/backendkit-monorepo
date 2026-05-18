import { Controller, Get, HttpCode, HttpStatus } from '@nestjs/common';
import { AutoLearn }   from '@backendkit-labs/auto-learning/nestjs';
import { DemoService } from './demo.service';

@Controller('demo')
export class DemoController {
  constructor(private readonly demo: DemoService) {}

  @Get('call')
  @HttpCode(HttpStatus.OK)
  @AutoLearn()
  callExternal() {
    return this.demo.callExternalApi();
  }

  @Get('status')
  getStatus() {
    return this.demo.getStatus();
  }
}
