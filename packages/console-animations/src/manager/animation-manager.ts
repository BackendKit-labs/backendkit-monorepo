import { AnimationConfig } from '../core/animation-config.interface.js';
import { IAnimation } from '../core/animation.interface.js';
import { AnimationType, AnimationEvent } from '../types/animation-types.js';
import { EventEmitter } from '../observer/event-emitter.js';
import { RenderEngine } from '../renderer/render-engine.js';
import { FrameScheduler } from '../scheduler/frame-scheduler.js';
import { AnimationRegistry } from '../registry/animation-registry.js';
import { AnimationFactory } from '../factory/animation-factory.js';

type EventHandler = (data: Record<string, unknown>) => void;

export class AnimationManager {
  private eventEmitter: EventEmitter;
  private renderEngine: RenderEngine;
  private scheduler: FrameScheduler;
  private registry: AnimationRegistry;
  private factory: AnimationFactory;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.renderEngine = new RenderEngine();
    this.scheduler = new FrameScheduler(this.renderEngine);
    this.registry = new AnimationRegistry();
    this.factory = new AnimationFactory();
  }

  start(config: AnimationConfig): IAnimation {
    const animation = this.factory.create(config.type, config);
    this.registry.register(animation);
    this.scheduler.register(animation);
    animation.start();

    if (!this.scheduler.isRunning) {
      this.scheduler.start();
    }

    return animation;
  }

  stop(id: string): void {
    const animation = this.registry.get(id);
    if (animation) {
      animation.stop();
      this.scheduler.unregister(id);
      this.registry.unregister(id);
    }
  }

  pause(id: string): void {
    this.registry.get(id)?.pause();
  }

  resume(id: string): void {
    this.registry.get(id)?.resume();
  }

  destroy(id: string): void {
    const animation = this.registry.get(id);
    if (animation) {
      animation.destroy();
      this.scheduler.unregister(id);
      this.registry.unregister(id);
    }
  }

  destroyAll(): void {
    for (const animation of this.registry.getAll()) {
      animation.destroy();
    }
    this.registry.clear();
    this.scheduler.stop();
    this.renderEngine.destroy();
  }

  get(id: string): IAnimation | undefined {
    return this.registry.get(id);
  }

  getAll(): IAnimation[] {
    return this.registry.getAll();
  }

  getByType(type: AnimationType): IAnimation[] {
    return this.registry.getByType(type);
  }

  on(event: AnimationEvent, handler: EventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  async run<T>(config: AnimationConfig, task: () => Promise<T>): Promise<T> {
    const animation = this.start(config);
    try {
      const result = await task();
      this.stop(animation.id);
      return result;
    } catch (error) {
      this.stop(animation.id);
      throw error;
    }
  }
}
