import { AnimationState, AnimationEvent } from '../types/animation-types.js';
import { AnimationConfig } from './animation-config.interface.js';
import { Frame } from './frame.type.js';
import { IAnimation, EventHandler } from './animation.interface.js';
import { EventEmitter } from '../observer/event-emitter.js';
import { generateId } from '../utils/frame-utils.js';

export abstract class AbstractAnimation implements IAnimation {
  public readonly id: string;
  public readonly type: string;
  public state: AnimationState = AnimationState.IDLE;

  protected config: AnimationConfig;
  protected currentFrameIndex: number = 0;
  protected lastFrameTime: number = 0;
  protected frames: string[] = [];
  protected eventEmitter: EventEmitter;

  constructor(config: AnimationConfig) {
    this.id = config.id ?? generateId();
    this.type = config.type;
    this.config = {
      speed: 80,
      overwrite: true,
      multiline: false,
      ...config,
    };
    this.eventEmitter = new EventEmitter();
  }

  protected ensureFrames(): void {
    if (this.frames.length === 0) {
      this.frames = this.buildFrames();
    }
  }

  start(): void {
    if (this.state !== AnimationState.IDLE && this.state !== AnimationState.DONE) {
      return;
    }
    this.ensureFrames();
    this.transitionTo(AnimationState.RUNNING);
    this.currentFrameIndex = 0;
    this.lastFrameTime = performance.now();
    this.eventEmitter.emit(AnimationEvent.START, { id: this.id, type: this.type });
  }

  stop(): void {
    if (this.state !== AnimationState.RUNNING && this.state !== AnimationState.PAUSED) {
      return;
    }
    this.transitionTo(AnimationState.DONE);
    this.eventEmitter.emit(AnimationEvent.STOP, { id: this.id, type: this.type });
    this.eventEmitter.emit(AnimationEvent.COMPLETE, { id: this.id, type: this.type });
  }

  pause(): void {
    if (this.state !== AnimationState.RUNNING) return;
    this.transitionTo(AnimationState.PAUSED);
    this.eventEmitter.emit(AnimationEvent.PAUSE, { id: this.id, type: this.type });
  }

  resume(): void {
    if (this.state !== AnimationState.PAUSED) return;
    this.transitionTo(AnimationState.RUNNING);
    this.lastFrameTime = performance.now();
    this.eventEmitter.emit(AnimationEvent.RESUME, { id: this.id, type: this.type });
  }

  destroy(): void {
    this.transitionTo(AnimationState.DESTROYED);
    this.eventEmitter.emit(AnimationEvent.DESTROY, { id: this.id, type: this.type });
    this.eventEmitter.removeAllListeners();
    this.frames = [];
  }

  nextFrame(timestamp: number): Frame {
    if (this.state !== AnimationState.RUNNING) {
      return this.buildEmptyFrame();
    }

    this.ensureFrames();
    const delta = timestamp - this.lastFrameTime;
    if (delta < (this.config.speed ?? 80)) {
      return this.buildEmptyFrame();
    }

    this.lastFrameTime = timestamp;
    const frameContent = this.frames[this.currentFrameIndex];
    this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;

    const frame = this.buildFrame(frameContent);
    this.eventEmitter.emit(AnimationEvent.FRAME, { id: this.id, frame });
    return frame;
  }

  reset(): void {
    this.currentFrameIndex = 0;
    this.lastFrameTime = 0;
    this.transitionTo(AnimationState.IDLE);
  }

  update(partial: Partial<AnimationConfig>): void {
    Object.assign(this.config, partial);
    if (partial.frames !== undefined) {
      this.frames = partial.frames;
    }
  }

  on(event: AnimationEvent, handler: EventHandler): void {
    this.eventEmitter.on(event, handler);
  }

  getConfig(): AnimationConfig {
    return { ...this.config };
  }

  protected abstract buildFrames(): string[];

  protected buildFrame(content: string): Frame {
    return {
      content: `${this.config.prefix ?? ''}${content}${this.config.suffix ?? ''}`,
      color: this.config.color,
      overwrite: this.config.overwrite ?? true,
      multiline: this.config.multiline ?? false,
      timestamp: Date.now(),
    };
  }

  protected buildEmptyFrame(): Frame {
    return {
      content: '',
      color: undefined,
      overwrite: false,
      multiline: false,
      timestamp: Date.now(),
    };
  }

  private transitionTo(newState: AnimationState): void {
    const prev = this.state;
    this.state = newState;
    this.eventEmitter.emit(AnimationEvent.STATE_CHANGE, {
      from: prev,
      to: newState,
      id: this.id,
      type: this.type,
    });
  }
}
