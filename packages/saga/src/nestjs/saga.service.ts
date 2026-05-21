// ---------------------------------------------------------------------------
// @backendkit-labs/saga -- src/nestjs/saga.service.ts
//
// SagaOrchestrator: injectable NestJS service wrapping the core SagaEngine.
// Provides saga lifecycle management with native NestJS integration.
// ---------------------------------------------------------------------------

import { Injectable, Inject, Optional } from '@nestjs/common';
import type { SagaResult } from '../types/error.types';
import type { SagaState, SagaOutput, SagaFilter, SagaId } from '../types/saga.types';
import { SagaEngine } from '../core/saga-engine';
import { SagaBuilder, type SagaDefinition } from '../core/saga-builder';
import type { SagaEventType, EventHandler } from '../types/events.types';
import type { SagaLogger } from '../integration/observability-adapter';
import { ConsoleSagaLogger } from '../integration/observability-adapter';
import { SAGA_OPTIONS_TOKEN, type SagaModuleOptions } from './saga.module';

// ---- SagaOrchestrator ----

@Injectable()
export class SagaOrchestrator {
  private readonly engine: SagaEngine;
  private readonly logger: SagaLogger;

  constructor(
    @Inject(SAGA_OPTIONS_TOKEN) private readonly options: SagaModuleOptions,
    @Optional() @Inject('SAGA_LOGGER') customLogger?: SagaLogger,
  ) {
    this.logger = customLogger ?? new ConsoleSagaLogger();
    this.engine = new SagaEngine(
      options.stores.sagaStore,
      options.stores.lockProvider,
      options.stores.eventBus,
    );
  }

  /**
   * Register a saga definition built via SagaBuilder.
   */
  define(builder: SagaBuilder): SagaDefinition {
    this.logger.debug('Registered saga definition', { sagaName: (builder as unknown as Record<string, unknown>)['name'] as string });
    return this.engine.define(builder);
  }

  /**
   * Create a new saga instance and start executing it.
   */
  async run<TInput = unknown>(sagaType: string, input?: TInput): Promise<SagaResult<SagaOutput>> {
    this.logger.info('Running saga', { sagaType });
    return this.engine.run(sagaType, input);
  }

  /**
   * Load a saga by ID and return its current state.
   */
  async getStatus(sagaId: SagaId): Promise<SagaResult<SagaState>> {
    return this.engine.getStatus(sagaId);
  }

  /**
   * List sagas matching optional filter criteria.
   */
  async list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>> {
    return this.engine.list(filter);
  }

  /**
   * Pause a running saga.
   */
  async pause(sagaId: SagaId): Promise<SagaResult<void>> {
    this.logger.debug('Pausing saga', { sagaId });
    return this.engine.pause(sagaId);
  }

  /**
   * Resume a paused saga.
   */
  async resume(sagaId: SagaId): Promise<SagaResult<SagaOutput>> {
    this.logger.debug('Resuming saga', { sagaId });
    return this.engine.resume(sagaId);
  }

  /**
   * Subscribe to saga events.
   */
  on(eventType: SagaEventType, handler: EventHandler): () => void {
    return this.options.stores.eventBus.subscribe(eventType, handler);
  }

  /**
   * Subscribe to all saga events.
   */
  onAll(handler: EventHandler): () => void {
    return this.options.stores.eventBus.subscribeAll(handler);
  }

  /**
   * Get the underlying SagaEngine instance (advanced use).
   */
  getEngine(): SagaEngine {
    return this.engine;
  }
}
