// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/core/saga-engine.ts
//
// SagaEngine: top-level orchestrator. Creates saga instances, runs them,
// queries status, pauses, resumes. Central access point for the library.
// ---------------------------------------------------------------------------

import { ok, fail, isFail } from '@backendkit-labs/result';
import type { SagaResult, SagaEngineError } from '../types/error.types';
import type { SagaState, SagaOutput, SagaFilter, SagaId } from '../types/saga.types';
import { SagaStatus, StepStatus } from '../types/saga.types';
import type { SagaDefinition, SagaBuilder } from './saga-builder';
import { SagaInstance } from './saga-instance';
import { StepRunner } from './step-runner';
import { CompensationRunner } from './compensation-runner';
import { generateSagaId, generateCorrelationId } from '../utils/id-generator';
import { currentTimestamp } from '../utils/time';
import type { SagaStore } from '../persistence/saga-store.interface';
import type { LockProvider } from '../types/lock.types';
import type { SagaEventBus } from '../types/events.types';

export class SagaEngine {
  private readonly definitions = new Map<string, SagaDefinition>();

  constructor(
    private readonly store: SagaStore,
    private readonly lockProvider: LockProvider,
    private readonly eventBus: SagaEventBus,
  ) {}

  define(builder: SagaBuilder): SagaDefinition {
    const definition = builder.build();
    this.definitions.set(definition.name, definition);
    return definition;
  }

  getRegisteredTypes(): string[] {
    return Array.from(this.definitions.keys());
  }

  async create(sagaType: string, input?: unknown): Promise<SagaResult<SagaInstance>> {
    const definition = this.definitions.get(sagaType);
    if (definition === undefined) {
      return fail({
        category: 'DEFINITION_NOT_REGISTERED',
        sagaType,
      } satisfies SagaEngineError);
    }

    const sagaId = generateSagaId();
    const now = currentTimestamp();

    const initialState: SagaState = {
      id: sagaId,
      sagaType,
      status: SagaStatus.PENDING,
      correlationId: generateCorrelationId(),
      steps: definition.steps.map((step, idx) => ({
        name: getStepLabel(step),
        status: StepStatus.PENDING,
        attempt: 0,
        input: idx === 0 ? input : undefined,
      })),
      currentStepIndex: 0,
      createdAt: now,
      updatedAt: now,
      metadata: {},
      version: 1,
    };

    const saveResult = await this.store.save(initialState);
    if (isFail(saveResult)) {
      return saveResult as unknown as SagaResult<SagaInstance>;
    }

    const runner = new StepRunner();
    const compensationRunner = new CompensationRunner();

    const instance = new SagaInstance(
      definition,
      initialState,
      this.store,
      this.lockProvider,
      this.eventBus,
      runner,
      compensationRunner,
    );

    return ok(instance);
  }

  async run(sagaType: string, input?: unknown): Promise<SagaResult<SagaOutput>> {
    const createResult = await this.create(sagaType, input);
    if (isFail(createResult)) {
      return createResult as unknown as SagaResult<SagaOutput>;
    }

    const instance = createResult.value;
    return instance.start();
  }

  async getStatus(sagaId: SagaId): Promise<SagaResult<SagaState>> {
    return this.store.load(sagaId);
  }

  async list(filter?: SagaFilter): Promise<SagaResult<SagaState[]>> {
    return this.store.list(filter);
  }

  async pause(sagaId: SagaId): Promise<SagaResult<void>> {
    const loadResult = await this.store.load(sagaId);
    if (isFail(loadResult)) {
      return loadResult as unknown as SagaResult<void>;
    }

    const state = loadResult.value;
    const definition = this.definitions.get(state.sagaType);
    if (definition === undefined) {
      return fail({
        category: 'DEFINITION_NOT_REGISTERED',
        sagaType: state.sagaType,
      } satisfies SagaEngineError);
    }

    const runner = new StepRunner();
    const compensationRunner = new CompensationRunner();

    const instance = new SagaInstance(
      definition,
      state,
      this.store,
      this.lockProvider,
      this.eventBus,
      runner,
      compensationRunner,
    );

    return instance.pause();
  }

  async signal(token: string, payload?: unknown): Promise<SagaResult<SagaOutput>> {
    const loadResult = await this.store.findByEventToken(token);
    if (isFail(loadResult)) {
      return loadResult as unknown as SagaResult<SagaOutput>;
    }

    const state = loadResult.value;
    const definition = this.definitions.get(state.sagaType);
    if (definition === undefined) {
      return fail({
        category: 'DEFINITION_NOT_REGISTERED',
        sagaType: state.sagaType,
      } satisfies SagaEngineError);
    }

    const instance = new SagaInstance(
      definition,
      state,
      this.store,
      this.lockProvider,
      this.eventBus,
      new StepRunner(),
      new CompensationRunner(),
    );

    return instance.signal(payload);
  }

  async expireWait(sagaId: SagaId): Promise<SagaResult<SagaOutput>> {
    const loadResult = await this.store.load(sagaId);
    if (isFail(loadResult)) {
      return loadResult as unknown as SagaResult<SagaOutput>;
    }

    const state = loadResult.value;
    const definition = this.definitions.get(state.sagaType);
    if (definition === undefined) {
      return fail({
        category: 'DEFINITION_NOT_REGISTERED',
        sagaType: state.sagaType,
      } satisfies SagaEngineError);
    }

    const instance = new SagaInstance(
      definition,
      state,
      this.store,
      this.lockProvider,
      this.eventBus,
      new StepRunner(),
      new CompensationRunner(),
    );

    return instance.expireWait();
  }

  async resume(sagaId: SagaId): Promise<SagaResult<SagaOutput>> {
    const loadResult = await this.store.load(sagaId);
    if (isFail(loadResult)) {
      return loadResult as unknown as SagaResult<SagaOutput>;
    }

    const state = loadResult.value;
    const definition = this.definitions.get(state.sagaType);
    if (definition === undefined) {
      return fail({
        category: 'DEFINITION_NOT_REGISTERED',
        sagaType: state.sagaType,
      } satisfies SagaEngineError);
    }

    const runner = new StepRunner();
    const compensationRunner = new CompensationRunner();

    const instance = new SagaInstance(
      definition,
      state,
      this.store,
      this.lockProvider,
      this.eventBus,
      runner,
      compensationRunner,
    );

    return instance.resume();
  }
}

function getStepLabel(step: import('./saga-builder').SagaDefinition['steps'][0]): string {
  if ('type' in step && step.type === 'parallel') {
    return `parallel(${step.steps.map((s) => s.name).join(',')})`;
  }
  if ('name' in step) {
    return step.name;
  }
  return '';
}
