// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/nestjs/index.ts
//
// NestJS integration barrel.
// ---------------------------------------------------------------------------

export { SagaModule } from './saga.module';
export type { SagaModuleOptions, SagaStoreSet } from './saga.module';

export { SagaOrchestrator } from './saga.service';

export {
  Saga,
  Step,
  Compensate,
  StepContext as StepContextDecorator,
  SagaEventHandler,
} from './saga.decorators';
export type {
  SagaConfig,
  StepConfig,
  ReflectStepMetadata,
  ReflectCompensateMetadata,
  ReflectEventHandlerMetadata,
} from './saga.decorators';
export {
  getSagaConfig,
  getStepMetadata,
  getCompensateMetadata,
  getStepContextParamIndex,
  getEventHandlerMetadata,
} from './saga.decorators';

export { SagaCorrelationIdInterceptor, CORRELATION_ID_HEADER } from './saga.interceptor';
