// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/core/saga-builder.ts
//
// SagaBuilder: fluent API for building SagaDefinitions.
// Steps are stored internally and flattened on build():
//   - Sequential steps are kept as-is
//   - Parallel groups are inserted as StepGroup entries
// ---------------------------------------------------------------------------

import type { StepDefinition, StepGroup } from '../types/step.types';
import type { SagaId, SagaStatus } from '../types/saga.types';

// Context passed to saga-level lifecycle callbacks
export interface SagaContext {
  sagaId: SagaId;
  sagaType: string;
  correlationId: string;
  status: SagaStatus;
  // biome-ignore lint/suspicious/noExplicitAny: unknown payload
  output?: any;
  metadata: Record<string, unknown>;
}

export interface SagaDefinition {
  name: string;
  steps: Array<StepDefinition | StepGroup>;
  onComplete?: (ctx: SagaContext) => Promise<void>;
  onFail?: (ctx: SagaContext) => Promise<void>;
  globalTimeoutMs?: number;
}

export class SagaBuilder {
  private readonly name: string;
  private readonly steps: Array<StepDefinition | StepGroup> = [];
  private onCompleteHandler?: (ctx: SagaContext) => Promise<void>;
  private onFailHandler?: (ctx: SagaContext) => Promise<void>;
  private timeoutMs?: number;

  private constructor(name: string) {
    this.name = name;
  }

  static define(name: string): SagaBuilder {
    return new SagaBuilder(name);
  }

  step(step: StepDefinition): this {
    this.steps.push(step);
    return this;
  }

  parallel(...parallelSteps: StepDefinition[]): this {
    const group: StepGroup = {
      type: 'parallel',
      steps: parallelSteps,
    };
    this.steps.push(group);
    return this;
  }

  onComplete(handler: (ctx: SagaContext) => Promise<void>): this {
    this.onCompleteHandler = handler;
    return this;
  }

  onFail(handler: (ctx: SagaContext) => Promise<void>): this {
    this.onFailHandler = handler;
    return this;
  }

  withTimeout(globalTimeoutMs: number): this {
    this.timeoutMs = globalTimeoutMs;
    return this;
  }

  build(): SagaDefinition {
    this.validateStepNames();
    return {
      name: this.name,
      steps: [...this.steps],
      onComplete: this.onCompleteHandler,
      onFail: this.onFailHandler,
      globalTimeoutMs: this.timeoutMs,
    };
  }

  private validateStepNames(): void {
    const seen = new Set<string>();
    for (const step of this.steps) {
      if ('type' in step && step.type === 'parallel') {
        for (const inner of step.steps) {
          if (seen.has(inner.name)) {
            throw new Error(`Duplicate step name "${inner.name}" in saga "${this.name}"`);
          }
          seen.add(inner.name);
        }
      } else if ('name' in step) {
        if (seen.has(step.name)) {
          throw new Error(`Duplicate step name "${step.name}" in saga "${this.name}"`);
        }
        seen.add(step.name);
      }
    }
  }
}
