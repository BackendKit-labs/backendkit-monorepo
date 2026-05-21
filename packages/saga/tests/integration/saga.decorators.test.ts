// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/saga.decorators.test.ts
//
// Integration tests for saga.decorators.ts (NestJS decorators + helpers).
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import {
  Saga,
  Step,
  Compensate,
  StepContext,
  SagaEventHandler,
  getSagaConfig,
  getStepMetadata,
  getCompensateMetadata,
  getStepContextParamIndex,
  getEventHandlerMetadata,
} from '../../src/nestjs/saga.decorators';
import type { StepContext as StepContextType } from '../../src/types/step.types';

// =====================================================================
// @Saga
// =====================================================================

describe('@Saga decorator', () => {
  it('should store saga name in metadata', () => {
    @Saga({ name: 'order-flow' })
    class OrderSaga {}

    const config = getSagaConfig(OrderSaga);
    expect(config).toBeDefined();
    expect(config!.name).toBe('order-flow');
  });

  it('should return undefined for non-decorated class', () => {
    class PlainClass {}

    const config = getSagaConfig(PlainClass);
    expect(config).toBeUndefined();
  });
});

// =====================================================================
// @Step
// =====================================================================

describe('@Step decorator', () => {
  it('should store step metadata with explicit name', () => {
    class TestSaga {
      @Step({ name: 'create-order', timeout: 5000 })
      async createOrder() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getStepMetadata(saga, 'createOrder');

    expect(meta).toBeDefined();
    expect(meta!.name).toBe('create-order');
    expect(meta!.timeoutMs).toBe(5000);
  });

  it('should use method name as default name when not provided', () => {
    class TestSaga {
      @Step()
      async validateOrder() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getStepMetadata(saga, 'validateOrder');

    expect(meta).toBeDefined();
    expect(meta!.name).toBe('validateOrder');
    expect(meta!.timeoutMs).toBeUndefined();
  });

  it('should store retry policy', () => {
    class TestSaga {
      @Step({ name: 'retry-step', retry: { maxAttempts: 5, initialBackoffMs: 100, backoffMultiplier: 2, maxBackoffMs: 5000, jitter: true, retryOn: ['INFRASTRUCTURE_ERROR'] } })
      async retryStep() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getStepMetadata(saga, 'retryStep');

    expect(meta).toBeDefined();
    expect(meta!.retry).toBeDefined();
    expect(meta!.retry!.maxAttempts).toBe(5);
    expect(meta!.retry!.retryOn).toEqual(['INFRASTRUCTURE_ERROR']);
  });

  it('should store requiresManualApproval', () => {
    class TestSaga {
      @Step({ name: 'approval-step', requiresManualApproval: 'manager-group' })
      async approvalStep() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getStepMetadata(saga, 'approvalStep');

    expect(meta).toBeDefined();
    expect(meta!.requiresManualApproval).toBe('manager-group');
  });

  it('should return undefined for non-decorated method', () => {
    class TestSaga {
      async plainMethod() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getStepMetadata(saga, 'plainMethod');
    expect(meta).toBeUndefined();
  });
});

// =====================================================================
// @Compensate
// =====================================================================

describe('@Compensate decorator', () => {
  it('should store stepName and methodName', () => {
    class TestSaga {
      @Compensate('create-order')
      async cancelOrder() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getCompensateMetadata(saga, 'cancelOrder');

    expect(meta).toBeDefined();
    expect(meta!.stepName).toBe('create-order');
    expect(meta!.methodName).toBe('cancelOrder');
  });

  it('should return undefined for non-decorated method', () => {
    class TestSaga {
      async plainMethod() { return {}; }
    }

    const saga = new TestSaga();
    const meta = getCompensateMetadata(saga, 'plainMethod');
    expect(meta).toBeUndefined();
  });
});

// =====================================================================
// @StepContext (parameter decorator)
// =====================================================================

describe('@StepContext parameter decorator', () => {
  it('should register parameter index', () => {
    class TestSaga {
      async createOrder(@StepContext() ctx: StepContextType) {
        return ctx;
      }
    }

    const idx = getStepContextParamIndex(TestSaga.prototype, 'createOrder');

    expect(idx).toBe(0);
  });

  it('should return undefined when no decorator', () => {
    class TestSaga {
      async plainMethod(ctx: StepContextType) {
        return ctx;
      }
    }

    const idx = getStepContextParamIndex(TestSaga.prototype, 'plainMethod');
    expect(idx).toBeUndefined();
  });

  it('should handle multiple parameters correctly', () => {
    class TestSaga {
      async processOrder(_id: number, @StepContext() ctx: StepContextType, _extra: string) {
        return ctx;
      }
    }

    const idx = getStepContextParamIndex(TestSaga.prototype, 'processOrder');

    expect(idx).toBe(1);
  });
});

// =====================================================================
// @SagaEventHandler
// =====================================================================

describe('@SagaEventHandler decorator', () => {
  it('should store event type and method name on constructor', () => {
    class TestSaga {
      @SagaEventHandler('SAGA_COMPLETED')
      onCompleted() { /* noop */ }

      @SagaEventHandler('SAGA_FAILED')
      onFailed() { /* noop */ }
    }

    const handlers = getEventHandlerMetadata(TestSaga);

    expect(handlers).toHaveLength(2);
    expect(handlers[0]).toEqual({ eventType: 'SAGA_COMPLETED', methodName: 'onCompleted' });
    expect(handlers[1]).toEqual({ eventType: 'SAGA_FAILED', methodName: 'onFailed' });
  });

  it('should return empty array when no handlers defined', () => {
    class TestSaga {
      async doSomething() { return {}; }
    }

    const handlers = getEventHandlerMetadata(TestSaga);
    expect(handlers).toEqual([]);
  });
});

// =====================================================================
// Integration: full decorator stack on a class
// =====================================================================

describe('full decorator stack', () => {
  it('should store saga config, step, compensate, and event handler metadata', () => {
    @Saga({ name: 'payment-flow' })
    class PaymentSaga {
      @Step({ name: 'charge-card', timeout: 3000 })
      async chargeCard(@StepContext() _ctx: StepContextType) {
        return { charged: true };
      }

      @Compensate('charge-card')
      async refundCard() {
        return { refunded: true };
      }

      @SagaEventHandler('SAGA_COMPLETED')
      onPaymentCompleted() { /* noop */ }
    }

    const saga = new PaymentSaga();

    // Saga config
    const sagaConfig = getSagaConfig(PaymentSaga);
    expect(sagaConfig!.name).toBe('payment-flow');

    // Step metadata
    const stepMeta = getStepMetadata(saga, 'chargeCard');
    expect(stepMeta!.name).toBe('charge-card');
    expect(stepMeta!.timeoutMs).toBe(3000);

    // Compensate metadata
    const compMeta = getCompensateMetadata(saga, 'refundCard');
    expect(compMeta!.stepName).toBe('charge-card');

    // StepContext parameter
    const ctxIdx = getStepContextParamIndex(PaymentSaga.prototype, 'chargeCard');
    expect(ctxIdx).toBe(0);

    // Event handlers
    const handlers = getEventHandlerMetadata(PaymentSaga);
    expect(handlers).toHaveLength(1);
    expect(handlers[0].eventType).toBe('SAGA_COMPLETED');
  });
});
