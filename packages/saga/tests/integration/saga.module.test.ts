// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- tests/integration/saga.module.test.ts
//
// Integration tests for SagaModule (NestJS DynamicModule).
// ---------------------------------------------------------------------------

import 'reflect-metadata';
import { SagaModule, SAGA_OPTIONS_TOKEN } from '../../src/nestjs/saga.module';
import { SagaOrchestrator } from '../../src/nestjs/saga.service';
import { SagaCorrelationIdInterceptor, CORRELATION_ID_HEADER } from '../../src/nestjs/saga.interceptor';
import { InMemoryStore } from '../../src/persistence/in-memory-store';
import { InMemoryLock } from '../../src/lock/in-memory-lock';
import { SagaEventBusImpl } from '../../src/events/saga-event-bus';

describe('SagaModule', () => {
  const options = {
    stores: {
      sagaStore: new InMemoryStore(),
      lockProvider: new InMemoryLock(),
      eventBus: new SagaEventBusImpl(),
    },
  };

  describe('forRoot()', () => {
    it('should return a DynamicModule', () => {
      const dynamicModule = SagaModule.forRoot(options);

      expect(dynamicModule).toBeDefined();
      expect(dynamicModule.module).toBe(SagaModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('should register SAGA_OPTIONS_TOKEN provider', () => {
      const dynamicModule = SagaModule.forRoot(options);

      const optionsProvider = dynamicModule.providers?.find(
        (p) => typeof p === 'object' && 'provide' in p && p.provide === SAGA_OPTIONS_TOKEN,
      );

      expect(optionsProvider).toBeDefined();
    });

    it('should register SagaOrchestrator provider', () => {
      const dynamicModule = SagaModule.forRoot(options);

      const hasOrchestrator = dynamicModule.providers?.some(
        (p) => p === SagaOrchestrator || (typeof p === 'object' && 'useClass' in p && p.useClass === SagaOrchestrator) || (typeof p === 'object' && 'provide' in p && p.provide === SagaOrchestrator),
      );

      expect(hasOrchestrator).toBe(true);
    });

    it('should register APP_INTERCEPTOR with SagaCorrelationIdInterceptor', () => {
      const dynamicModule = SagaModule.forRoot(options);

      const interceptorProvider = dynamicModule.providers?.find(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === 'APP_INTERCEPTOR' &&
          'useClass' in p &&
          p.useClass === SagaCorrelationIdInterceptor,
      );

      expect(interceptorProvider).toBeDefined();
    });

    it('should export SagaOrchestrator', () => {
      const dynamicModule = SagaModule.forRoot(options);

      expect(dynamicModule.exports).toContain(SagaOrchestrator);
    });

    it('should have global: true', () => {
      const dynamicModule = SagaModule.forRoot(options);

      expect(dynamicModule.global).toBe(true);
    });
  });

  describe('forFeature()', () => {
    it('should return a DynamicModule', () => {
      const dynamicModule = SagaModule.forFeature();

      expect(dynamicModule).toBeDefined();
      expect(dynamicModule.module).toBe(SagaModule);
      expect(dynamicModule.providers).toBeDefined();
      expect(dynamicModule.exports).toBeDefined();
    });

    it('should register SagaOrchestrator provider', () => {
      const dynamicModule = SagaModule.forFeature();

      const hasOrchestrator = dynamicModule.providers?.some(
        (p) => p === SagaOrchestrator || (typeof p === 'object' && 'provide' in p && p.provide === SagaOrchestrator),
      );

      expect(hasOrchestrator).toBe(true);
    });

    it('should export SagaOrchestrator', () => {
      const dynamicModule = SagaModule.forFeature();

      expect(dynamicModule.exports).toContain(SagaOrchestrator);
    });

    it('should not inject APP_INTERCEPTOR', () => {
      const dynamicModule = SagaModule.forFeature();

      const hasInterceptor = dynamicModule.providers?.some(
        (p) =>
          typeof p === 'object' &&
          'provide' in p &&
          p.provide === 'APP_INTERCEPTOR',
      );

      expect(hasInterceptor).toBeFalsy();
    });
  });

  describe('SAGA_OPTIONS_TOKEN', () => {
    it('should be a string constant', () => {
      expect(SAGA_OPTIONS_TOKEN).toBe('SAGA_MODULE_OPTIONS');
    });
  });

  describe('CORRELATION_ID_HEADER', () => {
    it('should be defined', () => {
      expect(CORRELATION_ID_HEADER).toBe('x-correlation-id');
    });
  });
});
