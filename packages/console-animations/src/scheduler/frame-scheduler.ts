import { IAnimation } from '../core/animation.interface.js';
import { AnimationState } from '../types/animation-types.js';
import { RenderEngine } from '../renderer/render-engine.js';

export class FrameScheduler {
  private animations: Map<string, IAnimation> = new Map();
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private _isRunning: boolean = false;
  private renderEngine: RenderEngine;

  constructor(renderEngine: RenderEngine) {
    this.renderEngine = renderEngine;
  }

  get isRunning(): boolean {
    return this._isRunning;
  }

  register(animation: IAnimation): void {
    this.animations.set(animation.id, animation);
  }

  unregister(id: string): void {
    this.animations.delete(id);
  }

  start(): void {
    if (this._isRunning) return;
    this._isRunning = true;
    this.scheduleNext();
  }

  stop(): void {
    this._isRunning = false;
    if (this.timerId !== null) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  private scheduleNext(): void {
    if (!this._isRunning) return;
    const tick = this.calculateNextTick();
    this.timerId = setTimeout(() => {
      this.tick();
    }, tick);
  }

  private tick(): void {
    if (!this._isRunning) return;

    const timestamp = performance.now();
    let hasActiveAnimations = false;

    for (const [, animation] of this.animations) {
      if (animation.state === AnimationState.RUNNING) {
        hasActiveAnimations = true;
        const frame = animation.nextFrame(timestamp);
        if (frame.content) {
          this.renderEngine.enqueue(frame);
        }
      }
    }

    this.renderEngine.flush();

    if (hasActiveAnimations) {
      this.scheduleNext();
    } else {
      this.stop();
    }
  }

  private calculateNextTick(): number {
    let minSpeed = Infinity;
    for (const [, animation] of this.animations) {
      if (animation.state === AnimationState.RUNNING) {
        const speed = animation.getConfig().speed ?? 80;
        if (speed < minSpeed) minSpeed = speed;
      }
    }
    return minSpeed === Infinity ? 80 : Math.max(minSpeed, 16);
  }
}
