// ---------------------------------------------------------------------------
// @backendkit-labs/saga — src/events/saga-event-bus.ts
//
// In-memory SagaEventBus implementation with typed subscriptions.
// Supports subscribeAll for catch-all handlers.
// ---------------------------------------------------------------------------

import type { SagaEvent, SagaEventType, EventHandler, SagaEventBus } from '../types/events.types';

export class SagaEventBusImpl implements SagaEventBus {
  private readonly subscriptions = new Map<SagaEventType, Set<EventHandler>>();
  private readonly allHandlers = new Set<EventHandler>();

  async publish(event: SagaEvent): Promise<void> {
    const eventHandlers = this.subscriptions.get(event.eventType);

    if (eventHandlers !== undefined) {
      const promises: Array<void | Promise<void>> = [];
      for (const handler of eventHandlers) {
        promises.push(handler(event));
      }
      await Promise.all(promises);
    }

    // Also notify all-handler subscribers
    if (this.allHandlers.size > 0) {
      const promises: Array<void | Promise<void>> = [];
      for (const handler of this.allHandlers) {
        promises.push(handler(event));
      }
      await Promise.all(promises);
    }
  }

  subscribe(eventType: SagaEventType, handler: EventHandler): () => void {
    if (!this.subscriptions.has(eventType)) {
      this.subscriptions.set(eventType, new Set());
    }
    this.subscriptions.get(eventType)!.add(handler);

    return () => {
      this.subscriptions.get(eventType)?.delete(handler);
    };
  }

  unsubscribe(eventType: SagaEventType, handler: EventHandler): void {
    this.subscriptions.get(eventType)?.delete(handler);
  }

  subscribeAll(handler: EventHandler): () => void {
    this.allHandlers.add(handler);

    return () => {
      this.allHandlers.delete(handler);
    };
  }
}
