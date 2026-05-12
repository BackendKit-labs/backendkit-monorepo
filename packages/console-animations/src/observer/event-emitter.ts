import { AnimationEvent } from '../types/animation-types.js';

type Handler = (data: Record<string, unknown>) => void;

export class EventEmitter {
  private listeners: Map<string, Handler[]> = new Map();

  on(event: AnimationEvent | string, handler: Handler): void {
    const handlers = this.listeners.get(event);
    if (handlers) {
      handlers.push(handler);
    } else {
      this.listeners.set(event, [handler]);
    }
  }

  off(event: AnimationEvent | string, handler: Handler): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  emit(event: AnimationEvent | string, data: Record<string, unknown>): void {
    const handlers = this.listeners.get(event);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(data);
    }
  }

  removeAllListeners(): void {
    this.listeners.clear();
  }

  listenerCount(event: AnimationEvent | string): number {
    return this.listeners.get(event)?.length ?? 0;
  }
}
