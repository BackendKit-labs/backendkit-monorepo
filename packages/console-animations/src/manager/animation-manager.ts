import { AnimationConfig } from '../core/animation-config.interface.js';
import { IAnimation } from '../core/animation.interface.js';
import { AnimationType, AnimationEvent } from '../types/animation-types.js';
import { EventEmitter } from '../observer/event-emitter.js';
import { RenderEngine } from '../renderer/render-engine.js';
import { FrameScheduler } from '../scheduler/frame-scheduler.js';
import { AnimationRegistry } from '../registry/animation-registry.js';
import { AnimationFactory } from '../factory/animation-factory.js';
import { symbols } from '../utils/terminal.js';

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

  update(id: string, partial: Partial<AnimationConfig>): void {
    this.registry.get(id)?.update(partial);
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

  succeed(id: string, text?: string): void {
    this._finalState(id, symbols.success, 'green', text);
  }

  fail(id: string, text?: string): void {
    this._finalState(id, symbols.error, 'red', text);
  }

  warn(id: string, text?: string): void {
    this._finalState(id, symbols.warning, 'yellow', text);
  }

  info(id: string, text?: string): void {
    this._finalState(id, symbols.info, 'cyan', text);
  }

  async run<T>(
    config: AnimationConfig,
    task: () => Promise<T>,
    options?: { successText?: string; failText?: string },
  ): Promise<T> {
    const animation = this.start(config);
    const label = (config.prefix ?? '').trim();
    try {
      const result = await task();
      this.succeed(animation.id, options?.successText ?? label);
      return result;
    } catch (error) {
      this.fail(animation.id, options?.failText ?? (label ? `${label} failed` : 'Failed'));
      throw error;
    }
  }

  private _finalState(id: string, symbol: string, color: string, text?: string): void {
    const animation = this.registry.get(id);
    const label = text ?? (animation?.getConfig().prefix ?? '').trim();
    animation?.stop();
    this.scheduler.unregister(id);
    this.registry.unregister(id);
    this.renderEngine.renderFinal(symbol, color, label);
  }
}
