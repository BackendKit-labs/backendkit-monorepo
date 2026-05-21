// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/core/saga-instance.ts
//
// SagaInstance: orchestrates a single saga execution.
//   - start(): PENDING -> RUNNING -> execute steps -> COMPLETED or COMPENSATING
//   - pause(): RUNNING -> PAUSED
//   - resume(): PAUSED -> RUNNING, continues from currentStepIndex
//   - Publishes events for every transition.
// ---------------------------------------------------------------------------

import { ok, isFail, isOk } from '@backendkit-labs/result';
import type { SagaResult, SagaError } from '../types/error.types';
import type { SagaState, SagaOutput, SagaId } from '../types/saga.types';
import { SagaStatus, StepStatus } from '../types/saga.types';
import type { SagaEvent, SagaEventType, EventHandler } from '../types/events.types';
import type { SagaDefinition } from './saga-builder';
import type { SagaEventBus } from '../types/events.types';
import type { SagaStore } from '../persistence/saga-store.interface';
import type { LockProvider } from '../types/lock.types';
import { SagaStateMachine } from '../state-machine/saga-state-machine';
import { StepRunner, type StepResult } from './step-runner';
import { CompensationRunner } from './compensation-runner';
import { ParallelExecutor } from '../parallel/parallel-executor';
import { generateEventId } from '../utils/id-generator';
import { currentTimestamp } from '../utils/time';
import type { StepContext, StepDefinition, StepGroup } from '../types/step.types';
import { isWaitForSignal } from '../types/signal.types';
import type { WaitForSignalResult } from '../types/signal.types';

function createEvent(
  sagaId: SagaId,
  eventType: SagaEventType,
  payload?: unknown,
  stepName?: string,
  error?: SagaError,
): SagaEvent {
  return {
    id: generateEventId(),
    sagaId,
    eventType,
    stepName,
    payload,
    error,
    timestamp: currentTimestamp(),
  };
}

export class SagaInstance {
  constructor(
    private readonly definition: SagaDefinition,
    private state: SagaState,
    private readonly store: SagaStore,
    private readonly lockProvider: LockProvider,
    private readonly eventBus: SagaEventBus,
    private readonly stepRunner: StepRunner,
    private readonly compensationRunner: CompensationRunner,
  ) {}

  async start(): Promise<SagaResult<SagaOutput>> {
    return this.executeWithLifecycle(async () => {
      // Transition PENDING -> RUNNING
      const transitionResult = SagaStateMachine.transition(this.state, SagaStatus.RUNNING);
      if (isFail(transitionResult)) {
        return transitionResult as unknown as SagaResult<SagaOutput>;
      }
      this.state = transitionResult.value;
      await this.persistAndPublish(createEvent(this.state.id, 'SAGA_STARTED'));

      return this.executeSteps();
    });
  }

  async pause(): Promise<SagaResult<void>> {
    const transitionResult = SagaStateMachine.transition(this.state, SagaStatus.PAUSED);
    if (isFail(transitionResult)) {
      return transitionResult as unknown as SagaResult<void>;
    }

    this.state = transitionResult.value;
    await this.persistAndPublish(createEvent(this.state.id, 'SAGA_PAUSED'));
    return ok(undefined);
  }

  async resume(): Promise<SagaResult<SagaOutput>> {
    return this.executeWithLifecycle(async () => {
      const transitionResult = SagaStateMachine.transition(this.state, SagaStatus.RUNNING);
      if (isFail(transitionResult)) {
        return transitionResult as unknown as SagaResult<SagaOutput>;
      }

      this.state = transitionResult.value;
      await this.persistAndPublish(createEvent(this.state.id, 'SAGA_RESUMED'));

      return this.executeSteps();
    });
  }

  async signal(payload?: unknown): Promise<SagaResult<SagaOutput>> {
    return this.executeWithLifecycle(async () => {
      if (this.state.status !== SagaStatus.WAITING_FOR_EVENT) {
        return fail({
          category: 'INVALID_TRANSITION',
          from: this.state.status,
          to: SagaStatus.RUNNING,
        });
      }

      // Mark waiting step as SUCCEEDED with the signal payload as its output
      this.updateStepState(this.state.currentStepIndex, StepStatus.SUCCEEDED, payload);

      // Clear wait fields and advance to the next step
      this.state = {
        ...this.state,
        eventToken: undefined,
        waitExpiresAt: undefined,
        currentStepIndex: this.state.currentStepIndex + 1,
      };

      const transitionResult = SagaStateMachine.transition(this.state, SagaStatus.RUNNING);
      if (isFail(transitionResult)) {
        return transitionResult as unknown as SagaResult<SagaOutput>;
      }
      this.state = transitionResult.value;
      await this.persistAndPublish(
        createEvent(this.state.id, 'SAGA_SIGNALED', { payload }),
      );

      return this.executeSteps();
    });
  }

  async expireWait(): Promise<SagaResult<SagaOutput>> {
    return this.executeWithLifecycle(async () => {
      if (this.state.status !== SagaStatus.WAITING_FOR_EVENT) {
        return this.buildOutput();
      }

      const stepName = this.state.steps[this.state.currentStepIndex]?.name ?? '';
      const timeoutError: SagaError = {
        type: 'STEP_TIMEOUT',
        step: stepName,
        timeoutMs: this.state.waitExpiresAt !== undefined
          ? this.state.waitExpiresAt - this.state.updatedAt
          : 0,
      };

      // Mark the step as failed and clear wait fields
      const steps = this.state.steps.map((s, i) =>
        i === this.state.currentStepIndex
          ? { ...s, status: StepStatus.FAILED, error: timeoutError, completedAt: currentTimestamp() }
          : s,
      );
      this.state = { ...this.state, steps, eventToken: undefined, waitExpiresAt: undefined };

      await this.persistAndPublish(
        createEvent(this.state.id, 'SAGA_WAIT_TIMEOUT', undefined, stepName, timeoutError),
      );

      return this.handleStepFailure(timeoutError, this.definition.steps);
    });
  }

  getState(): SagaState {
    return { ...this.state };
  }

  on(eventType: SagaEventType, handler: EventHandler): void {
    this.eventBus.subscribe(eventType, handler);
  }

  // ---- Private helpers ----

  private async executeWithLifecycle(
    fn: () => Promise<SagaResult<SagaOutput>>,
  ): Promise<SagaResult<SagaOutput>> {
    const lockKey = `saga:lock:${this.state.id}`;
    const lockResult = await this.lockProvider.acquire(lockKey, 30000);

    if (isFail(lockResult)) {
      return lockResult as unknown as SagaResult<SagaOutput>;
    }

    const acquired = lockResult.value;
    if (!acquired) {
      return ok({
        sagaId: this.state.id,
        status: this.state.status,
        timeline: [],
      });
    }

    await this.eventBus.publish(createEvent(this.state.id, 'LOCK_ACQUIRED'));

    try {
      const result = await fn();
      return result;
    } finally {
      await this.lockProvider.release(lockKey);
      await this.eventBus.publish(createEvent(this.state.id, 'LOCK_RELEASED'));
    }
  }

  private async executeSteps(): Promise<SagaResult<SagaOutput>> {
    const steps = this.definition.steps;

    // Run remaining steps from currentStepIndex
    for (let i = this.state.currentStepIndex; i < steps.length; i++) {
      this.state = {
        ...this.state,
        currentStepIndex: i,
        status: SagaStatus.STEP_EXECUTING,
        updatedAt: currentTimestamp(),
      };
      await this.persistAndPublish(createEvent(this.state.id, 'STEP_STARTED', undefined, getStepName(steps[i])));

      const stepOrGroup = steps[i];
      const result = await this.executeSingleStep(stepOrGroup);

      if (isFail(result)) {
        return this.handleStepFailure(result.error, steps);
      }

      const stepResult = result.value;

      // Detect wait-for-signal: step defers completion to an external event
      if (isWaitForSignal(stepResult.output)) {
        return this.handleWaitForSignal(stepResult.output, i, stepOrGroup);
      }

      // Update step state to SUCCEEDED
      this.updateStepState(i, StepStatus.SUCCEEDED, stepResult.output);
      await this.persistAndPublish(
        createEvent(this.state.id, 'STEP_SUCCEEDED', stepResult.output, getStepName(stepOrGroup)),
      );

      // Transition back to RUNNING
      const transitionResult = SagaStateMachine.transition(this.state, SagaStatus.RUNNING);
      if (isFail(transitionResult)) {
        return transitionResult as unknown as SagaResult<SagaOutput>;
      }
      this.state = transitionResult.value;
    }

    // All steps completed successfully
    const completeResult = SagaStateMachine.transition(this.state, SagaStatus.COMPLETED);
    if (isFail(completeResult)) {
      return completeResult as unknown as SagaResult<SagaOutput>;
    }
    this.state = completeResult.value;
    await this.persistAndPublish(createEvent(this.state.id, 'SAGA_COMPLETED'));

    // Call onComplete lifecycle hook
    if (this.definition.onComplete !== undefined) {
      await this.definition.onComplete({
        sagaId: this.state.id,
        sagaType: this.state.sagaType,
        correlationId: this.state.correlationId,
        status: SagaStatus.COMPLETED,
        metadata: this.state.metadata,
      });
    }

    return this.buildOutput();
  }

  private async executeSingleStep(
    stepOrGroup: StepDefinition | StepGroup,
  ): Promise<SagaResult<StepResult>> {
    if (isStepGroup(stepOrGroup)) {
      // Parallel execution — delegate to parallel executor
      const executor = new ParallelExecutor();
      const ctx = this.buildStepContext(stepOrGroup.steps[0]?.name ?? 'parallel');
      const results = await executor.execute(stepOrGroup.steps, ctx);

      if (isFail(results)) {
        return results as unknown as SagaResult<StepResult>;
      }

      // Return first step result as representative output
      const stepResults = results.value;
      return ok(stepResults[0] ?? { stepName: 'parallel', output: undefined, durationMs: 0 });
    }

    const step = stepOrGroup as StepDefinition;
    const ctx = this.buildStepContext(step.name);
    return this.stepRunner.execute(step, ctx);
  }

  private async handleStepFailure(
    error: SagaError,
    steps: Array<StepDefinition | StepGroup>,
  ): Promise<SagaResult<SagaOutput>> {
    await this.persistAndPublish(
      createEvent(this.state.id, 'STEP_FAILED', undefined, getStepName(steps[this.state.currentStepIndex]), error),
    );

    // Start compensation
    const compensateResult = SagaStateMachine.transition(this.state, SagaStatus.COMPENSATING);
    if (isFail(compensateResult)) {
      return compensateResult as unknown as SagaResult<SagaOutput>;
    }
    this.state = compensateResult.value;
    await this.persistAndPublish(createEvent(this.state.id, 'COMPENSATION_STARTED'));

    const plainSteps = steps.filter(isStepDefinition);
    const compensationResult = await this.compensationRunner.run(plainSteps, this.state);

    const doneResult = SagaStateMachine.transition(this.state, SagaStatus.COMPENSATION_DONE);
    if (isFail(doneResult)) {
      return doneResult as unknown as SagaResult<SagaOutput>;
    }
    this.state = doneResult.value;

    const finalResult = SagaStateMachine.transition(
      this.state,
      isOk(compensationResult) ? SagaStatus.FAILED : SagaStatus.PARTIALLY_COMPENSATED,
    );
    if (isFail(finalResult)) {
      return finalResult as unknown as SagaResult<SagaOutput>;
    }
    this.state = finalResult.value;

    const finalEventType: SagaEventType =
      this.state.status === SagaStatus.PARTIALLY_COMPENSATED
        ? 'SAGA_PARTIALLY_COMPENSATED'
        : 'SAGA_FAILED';
    await this.persistAndPublish(createEvent(this.state.id, finalEventType));

    // Call onFail lifecycle hook
    if (this.definition.onFail !== undefined) {
      await this.definition.onFail({
        sagaId: this.state.id,
        sagaType: this.state.sagaType,
        correlationId: this.state.correlationId,
        status: this.state.status,
        metadata: this.state.metadata,
      });
    }

    return this.buildOutput();
  }

  private async handleWaitForSignal(
    signal: WaitForSignalResult,
    stepIndex: number,
    stepOrGroup: StepDefinition | StepGroup,
  ): Promise<SagaResult<SagaOutput>> {
    // Mark the step as waiting (not yet completed)
    this.updateStepState(stepIndex, StepStatus.WAITING_FOR_SIGNAL);

    this.state = {
      ...this.state,
      eventToken: signal.token,
      waitExpiresAt: signal.timeoutMs !== undefined
        ? currentTimestamp() + signal.timeoutMs
        : undefined,
    };

    const transitionResult = SagaStateMachine.transition(this.state, SagaStatus.WAITING_FOR_EVENT);
    if (isFail(transitionResult)) {
      return transitionResult as unknown as SagaResult<SagaOutput>;
    }
    this.state = transitionResult.value;

    await this.persistAndPublish(
      createEvent(this.state.id, 'SAGA_WAITING_FOR_EVENT', { token: signal.token }, getStepName(stepOrGroup)),
    );

    return this.buildOutput();
  }

  private updateStepState(index: number, status: StepStatus, output?: unknown): void {
    const step = this.state.steps[index];
    if (step !== undefined) {
      step.status = status;
      step.output = output;
      step.completedAt = currentTimestamp();
    }
  }

  private buildStepContext(stepName: string): StepContext {
    const currentStep = this.state.steps[this.state.currentStepIndex];
    const attempt = currentStep?.attempt ?? 1;
    return {
      sagaId: this.state.id,
      correlationId: this.state.correlationId,
      stepName,
      attempt,
      idempotencyKey: `${this.state.id}:${stepName}:${attempt}`,
      input: currentStep?.input,
      previousOutput: this.state.steps
        .slice(0, this.state.currentStepIndex)
        .filter((s) => s.status === StepStatus.SUCCEEDED)
        .pop()?.output,
      metadata: this.state.metadata,
    };
  }

  private async persistAndPublish(event: SagaEvent): Promise<void> {
    this.state.updatedAt = currentTimestamp();
    this.state.version += 1;
    await this.store.save(this.state);
    await this.eventBus.publish(event);
  }

  private buildOutput(): SagaResult<SagaOutput> {
    return ok({
      sagaId: this.state.id,
      status: this.state.status,
      completedAt: this.state.completedAt,
      timeline: [],
      output: this.state.steps[this.state.steps.length - 1]?.output,
    });
  }
}

function getStepName(stepOrGroup: StepDefinition | StepGroup): string {
  return isStepGroup(stepOrGroup)
    ? `parallel(${stepOrGroup.steps.map((s) => s.name).join(',')})`
    : stepOrGroup.name;
}

function isStepGroup(s: StepDefinition | StepGroup): s is StepGroup {
  return 'type' in s && s.type === 'parallel';
}

function isStepDefinition(s: StepDefinition | StepGroup): s is StepDefinition {
  return !('type' in s && s.type === 'parallel');
}
