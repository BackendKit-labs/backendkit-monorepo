// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/nestjs/saga.decorators.ts
//
// NestJS decorators for saga definition and step management.
//
// Usage:
//   @Saga({ name: 'order-flow' })
//   class OrderSaga {
//     @Step({ name: 'create-order', timeout: 5000 })
//     async createOrder(@StepContext() ctx: StepContext) { ... }
//
//     @Compensate('create-order')
//     async cancelOrder(@StepContext() ctx: CompensationContext) { ... }
//
//     @SagaEventHandler('SAGA_COMPLETED')
//     onCompleted(event: SagaEvent) { ... }
//   }
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import type { RetryPolicy } from '../types/step.types';

// ---- Metadata keys ----

const SAGA_METADATA_KEY = 'saga:definition';
const STEP_METADATA_KEY = 'saga:step';
const COMPENSATE_METADATA_KEY = 'saga:compensate';
const STEP_CONTEXT_PARAM_KEY = 'saga:stepContextParam';
const EVENT_HANDLER_KEY = 'saga:eventHandler';

// ---- SagaConfig ----

export interface SagaConfig {
  name: string;
}

// ---- StepConfig ----

export interface StepConfig {
  name?: string;
  timeout?: number;
  retry?: RetryPolicy;
  requiresManualApproval?: string;
}

// ---- Decorators ----

/**
 * Class decorator: marks a class as a saga definition.
 */
export function Saga(config: SagaConfig): ClassDecorator {
  return (target) => {
    Reflect.defineMetadata(SAGA_METADATA_KEY, config, target);
  };
}

/**
 * Method decorator: marks a method as a step handler.
 */
export function Step(config?: StepConfig): MethodDecorator {
  return (target, propertyKey, _descriptor) => {
    const stepName = config?.name ?? String(propertyKey);
    const metadata = {
      name: stepName,
      timeoutMs: config?.timeout,
      retry: config?.retry,
      requiresManualApproval: config?.requiresManualApproval,
      methodName: String(propertyKey),
    };
    Reflect.defineMetadata(STEP_METADATA_KEY, metadata, target, propertyKey);
  };
}

/**
 * Method decorator: marks a method as the compensation handler for a step.
 */
export function Compensate(stepName: string): MethodDecorator {
  return (target, propertyKey, _descriptor) => {
    Reflect.defineMetadata(COMPENSATE_METADATA_KEY, { stepName, methodName: String(propertyKey) }, target, propertyKey);
  };
}

/**
 * Parameter decorator: injects StepContext or CompensationContext
 * into a step handler method parameter.
 */
export function StepContext(): ParameterDecorator {
  return (target, propertyKey, parameterIndex) => {
    const existingParams: number[] = Reflect.getOwnMetadata(STEP_CONTEXT_PARAM_KEY, target, propertyKey!) ?? [];
    existingParams.push(parameterIndex);
    Reflect.defineMetadata(STEP_CONTEXT_PARAM_KEY, existingParams, target, propertyKey!);
  };
}

/**
 * Method decorator: marks a method as an event handler for saga events.
 */
export function SagaEventHandler(eventType: string): MethodDecorator {
  return (target, propertyKey, _descriptor) => {
    const handlers: Array<{ eventType: string; methodName: string }> =
      Reflect.getOwnMetadata(EVENT_HANDLER_KEY, target.constructor) ?? [];
    handlers.push({ eventType, methodName: String(propertyKey) });
    Reflect.defineMetadata(EVENT_HANDLER_KEY, handlers, target.constructor);
  };
}

// ---- Internal reflection helpers ----

export interface ReflectStepMetadata {
  name: string;
  timeoutMs?: number;
  retry?: RetryPolicy;
  requiresManualApproval?: string;
  methodName: string;
}

export interface ReflectCompensateMetadata {
  stepName: string;
  methodName: string;
}

export interface ReflectEventHandlerMetadata {
  eventType: string;
  methodName: string;
}

export function getSagaConfig(target: object): SagaConfig | undefined {
  return Reflect.getMetadata(SAGA_METADATA_KEY, target);
}

export function getStepMetadata(target: object, propertyKey: string): ReflectStepMetadata | undefined {
  return Reflect.getMetadata(STEP_METADATA_KEY, target, propertyKey);
}

export function getCompensateMetadata(target: object, propertyKey: string): ReflectCompensateMetadata | undefined {
  return Reflect.getMetadata(COMPENSATE_METADATA_KEY, target, propertyKey);
}

export function getStepContextParamIndex(target: object, propertyKey: string): number | undefined {
  const params: number[] = Reflect.getOwnMetadata(STEP_CONTEXT_PARAM_KEY, target, propertyKey) ?? [];
  return params.length > 0 ? params[0] : undefined;
}

export function getEventHandlerMetadata(target: object): ReflectEventHandlerMetadata[] {
  return Reflect.getOwnMetadata(EVENT_HANDLER_KEY, target) ?? [];
}
