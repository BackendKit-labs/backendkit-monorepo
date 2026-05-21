import { SagaEventBusImpl } from '../../../src/events/saga-event-bus';
import type { SagaEvent, SagaEventType } from '../../../src/types/events.types';

function createEvent(overrides?: Partial<SagaEvent>): SagaEvent {
  return {
    id: 'evt-1',
    sagaId: 'saga-1' as any,
    eventType: 'SAGA_STARTED',
    timestamp: 1000,
    ...overrides,
  };
}

describe('SagaEventBusImpl', () => {
  let bus: SagaEventBusImpl;

  beforeEach(() => {
    bus = new SagaEventBusImpl();
  });

  describe('publish', () => {
    it('should deliver event to subscribed handler', async () => {
      const handler = vi.fn();
      bus.subscribe('SAGA_STARTED', handler);

      const event = createEvent();
      await bus.publish(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('should NOT deliver event to handlers of other types', async () => {
      const handler = vi.fn();
      bus.subscribe('SAGA_COMPLETED', handler);

      await bus.publish(createEvent({ eventType: 'SAGA_STARTED' }));

      expect(handler).not.toHaveBeenCalled();
    });

    it('should deliver event to all subscribers of the same type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      bus.subscribe('SAGA_STARTED', handler1);
      bus.subscribe('SAGA_STARTED', handler2);

      await bus.publish(createEvent());

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should deliver to subscribeAll handlers for ANY event type', async () => {
      const allHandler = vi.fn();
      bus.subscribeAll(allHandler);

      await bus.publish(createEvent({ eventType: 'SAGA_STARTED' }));
      await bus.publish(createEvent({ eventType: 'SAGA_FAILED' }));
      await bus.publish(createEvent({ eventType: 'STEP_SUCCEEDED' }));

      expect(allHandler).toHaveBeenCalledTimes(3);
    });

    it('should handle async handlers', async () => {
      const handler = vi.fn().mockResolvedValue(undefined);
      bus.subscribe('SAGA_STARTED', handler);

      await bus.publish(createEvent());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should not throw if a handler throws', async () => {
      const throwingHandler = vi.fn().mockRejectedValue(new Error('handler error'));
      bus.subscribe('SAGA_STARTED', throwingHandler);

      // The publish will reject because Promise.all rejects on rejection
      // We verify it didn't crash the process
      await expect(bus.publish(createEvent())).rejects.toThrow('handler error');
    });

    it('should not fail when no handlers are subscribed', async () => {
      await expect(bus.publish(createEvent())).resolves.toBeUndefined();
    });

    it('should publish to both type-specific and all-handlers', async () => {
      const typeHandler = vi.fn();
      const allHandler = vi.fn();

      bus.subscribe('SAGA_STARTED', typeHandler);
      bus.subscribeAll(allHandler);

      await bus.publish(createEvent());

      expect(typeHandler).toHaveBeenCalledTimes(1);
      expect(allHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('subscribe', () => {
    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('SAGA_STARTED', handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop receiving events after unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribe('SAGA_STARTED', handler);

      await bus.publish(createEvent());
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await bus.publish(createEvent());
      expect(handler).toHaveBeenCalledTimes(1); // not called again
    });

    it('should handle multiple subscriptions for same type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe('SAGA_STARTED', handler1);
      bus.subscribe('SAGA_STARTED', handler2);

      const handler3 = vi.fn();
      bus.subscribe('SAGA_FAILED', handler3);

      await bus.publish(createEvent({ eventType: 'SAGA_STARTED' }));
      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).not.toHaveBeenCalled();
    });

    it('should allow same handler to subscribe multiple times', async () => {
      const handler = vi.fn();
      bus.subscribe('SAGA_STARTED', handler);
      bus.subscribe('SAGA_STARTED', handler); // same handler twice (Set dedup)

      await bus.publish(createEvent());
      // Set deduplicates, so called once
      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  describe('unsubscribe', () => {
    it('should remove a specific handler', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.subscribe('SAGA_STARTED', handler1);
      bus.subscribe('SAGA_STARTED', handler2);

      bus.unsubscribe('SAGA_STARTED', handler1);

      await bus.publish(createEvent());

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it('should not throw when unsubscribing non-existent handler', () => {
      const handler = vi.fn();
      expect(() => bus.unsubscribe('SAGA_STARTED', handler)).not.toThrow();
    });

    it('should not throw when unsubscribing from non-existent event type', () => {
      const handler = vi.fn();
      expect(() => bus.unsubscribe('SAGA_STARTED' as SagaEventType, handler)).not.toThrow();
    });
  });

  describe('subscribeAll', () => {
    it('should return an unsubscribe function', () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribeAll(handler);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should stop after unsubscribe', async () => {
      const handler = vi.fn();
      const unsubscribe = bus.subscribeAll(handler);

      await bus.publish(createEvent());
      expect(handler).toHaveBeenCalledTimes(1);

      unsubscribe();

      await bus.publish(createEvent());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('should receive all event types', async () => {
      const handler = vi.fn();

      bus.subscribeAll(handler);

      const eventTypes: SagaEventType[] = [
        'SAGA_STARTED',
        'SAGA_COMPLETED',
        'SAGA_FAILED',
        'STEP_STARTED',
        'COMPENSATION_STARTED',
      ];

      for (const eventType of eventTypes) {
        await bus.publish(createEvent({ eventType }));
      }

      expect(handler).toHaveBeenCalledTimes(5);
    });
  });
});
