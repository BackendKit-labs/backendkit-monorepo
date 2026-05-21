import { SagaBuilder } from '../../../src/core/saga-builder';
import type { StepDefinition, StepHandler } from '../../../src/types/step.types';


function createStep(name: string, execute?: StepHandler): StepDefinition {
  return {
    name,
    execute: execute ?? vi.fn().mockResolvedValue({ ok: true, value: undefined }),
  };
}

describe('SagaBuilder', () => {
  describe('define', () => {
    it('should create a builder with the given name', () => {
      const builder = SagaBuilder.define('order-flow');
      const def = builder.build();

      expect(def.name).toBe('order-flow');
    });

    it('should build a definition with no steps', () => {
      const def = SagaBuilder.define('empty').build();

      expect(def.steps).toEqual([]);
      expect(def.onComplete).toBeUndefined();
      expect(def.onFail).toBeUndefined();
      expect(def.globalTimeoutMs).toBeUndefined();
    });
  });

  describe('step', () => {
    it('should add a sequential step', () => {
      const step = createStep('create-order');
      const def = SagaBuilder.define('test').step(step).build();

      expect(def.steps).toHaveLength(1);
      expect(def.steps[0]).toBe(step);
    });

    it('should add multiple steps in order', () => {
      const step1 = createStep('step-1');
      const step2 = createStep('step-2');
      const step3 = createStep('step-3');

      const def = SagaBuilder.define('test')
        .step(step1)
        .step(step2)
        .step(step3)
        .build();

      expect(def.steps).toHaveLength(3);
      expect((def.steps[0] as StepDefinition).name).toBe('step-1');
      expect((def.steps[1] as StepDefinition).name).toBe('step-2');
      expect((def.steps[2] as StepDefinition).name).toBe('step-3');
    });

    it('should return this for chaining', () => {
      const builder = SagaBuilder.define('test');
      const returned = builder.step(createStep('step-1'));

      expect(returned).toBe(builder);
    });
  });

  describe('parallel', () => {
    it('should add a parallel step group', () => {
      const step1 = createStep('parallel-1');
      const step2 = createStep('parallel-2');

      const def = SagaBuilder.define('test')
        .parallel(step1, step2)
        .build();

      expect(def.steps).toHaveLength(1);
      const group = def.steps[0] as any;
      expect(group.type).toBe('parallel');
      expect(group.steps).toHaveLength(2);
    });

    it('should mix sequential and parallel steps', () => {
      const seq1 = createStep('before');
      const p1 = createStep('p1');
      const p2 = createStep('p2');
      const seq2 = createStep('after');

      const def = SagaBuilder.define('test')
        .step(seq1)
        .parallel(p1, p2)
        .step(seq2)
        .build();

      expect(def.steps).toHaveLength(3);
      expect((def.steps[0] as StepDefinition).name).toBe('before');
      expect((def.steps[1] as any).type).toBe('parallel');
      expect((def.steps[2] as StepDefinition).name).toBe('after');
    });

    it('should handle single step parallel group', () => {
      const step = createStep('solo');
      const def = SagaBuilder.define('test').parallel(step).build();

      expect(def.steps).toHaveLength(1);
      const group = def.steps[0] as any;
      expect(group.type).toBe('parallel');
      expect(group.steps).toHaveLength(1);
    });

    it('should return this for chaining', () => {
      const builder = SagaBuilder.define('test');
      const returned = builder.parallel(createStep('p1'));

      expect(returned).toBe(builder);
    });
  });

  describe('onComplete', () => {
    it('should set the onComplete handler', () => {
      const handler = vi.fn();
      const def = SagaBuilder.define('test')
        .onComplete(handler)
        .build();

      expect(def.onComplete).toBe(handler);
    });

    it('should return this for chaining', () => {
      const builder = SagaBuilder.define('test');
      const returned = builder.onComplete(vi.fn());

      expect(returned).toBe(builder);
    });
  });

  describe('onFail', () => {
    it('should set the onFail handler', () => {
      const handler = vi.fn();
      const def = SagaBuilder.define('test')
        .onFail(handler)
        .build();

      expect(def.onFail).toBe(handler);
    });

    it('should return this for chaining', () => {
      const builder = SagaBuilder.define('test');
      const returned = builder.onFail(vi.fn());

      expect(returned).toBe(builder);
    });
  });

  describe('withTimeout', () => {
    it('should set the global timeout', () => {
      const def = SagaBuilder.define('test')
        .withTimeout(10000)
        .build();

      expect(def.globalTimeoutMs).toBe(10000);
    });

    it('should return this for chaining', () => {
      const builder = SagaBuilder.define('test');
      const returned = builder.withTimeout(5000);

      expect(returned).toBe(builder);
    });
  });

  describe('build', () => {
    it('should return a frozen copy of steps (not same reference)', () => {
      const builder = SagaBuilder.define('test');

      const def = builder.build();
      expect(def.steps).toEqual([]);

      // Modifying the original should not affect the built definition
      builder.step(createStep('added-after'));
      expect(def.steps).toHaveLength(0);
    });

    it('should create independent definitions from same builder usage', () => {
      const builder = SagaBuilder.define('test')
        .step(createStep('step-a'));

      const def1 = builder.build();
      const def2 = builder.step(createStep('step-b')).build();

      expect(def1.steps).toHaveLength(1);
      expect(def2.steps).toHaveLength(2);
    });
  });

  describe('fluent API chain', () => {
    it('should support full chaining', () => {
      const onComplete = vi.fn();
      const onFail = vi.fn();

      const def = SagaBuilder.define('order-flow')
        .step(createStep('create'))
        .step(createStep('pay'))
        .parallel(
          createStep('inventory'),
          createStep('shipping'),
        )
        .step(createStep('notify'))
        .onComplete(onComplete)
        .onFail(onFail)
        .withTimeout(30000)
        .build();

      expect(def.name).toBe('order-flow');
      expect(def.steps).toHaveLength(4);
      expect(def.onComplete).toBe(onComplete);
      expect(def.onFail).toBe(onFail);
      expect(def.globalTimeoutMs).toBe(30000);
    });
  });
});
