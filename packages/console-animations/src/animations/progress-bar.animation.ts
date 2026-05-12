import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';
import { AnimationState, AnimationEvent } from '../types/animation-types.js';
import { Frame } from '../core/frame.type.js';
import { repeat } from '../utils/frame-utils.js';

export class ProgressBarAnimation extends AbstractAnimation {
  private width: number;
  private total: number;
  private current: number = 0;
  private startTime: number = 0;
  private showEta: boolean;

  constructor(config: AnimationConfig) {
    super(config);
    this.width = config.width ?? 20;
    this.total = config.total ?? 100;
    this.showEta = config.showEta ?? false;
  }

  start(): void {
    this.startTime = Date.now();
    super.start();
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    const steps = Math.min(this.width, 20);
    for (let i = 0; i <= steps; i++) {
      const filled = Math.round((i / steps) * this.width);
      const empty = this.width - filled;
      const percent = Math.round((i / steps) * 100);
      frames.push(`[${repeat('█', filled)}${repeat('░', empty)}] ${String(percent).padStart(3)}%`);
    }
    return frames;
  }

  override nextFrame(timestamp: number): Frame {
    if (this.state !== AnimationState.RUNNING) {
      return this.buildEmptyFrame();
    }
    this.ensureFrames();
    const delta = timestamp - this.lastFrameTime;
    if (delta < (this.config.speed ?? 80)) {
      return this.buildEmptyFrame();
    }
    this.lastFrameTime = timestamp;

    const content = this.showEta
      ? this.buildDynamicContent()
      : this.frames[this.currentFrameIndex];

    if (!this.showEta) {
      this.currentFrameIndex = (this.currentFrameIndex + 1) % this.frames.length;
    }

    const frame = this.buildFrame(content);
    this.eventEmitter.emit(AnimationEvent.FRAME, { id: this.id, frame });
    return frame;
  }

  setProgress(value: number): void {
    this.current = Math.min(value, this.total);
    if (!this.showEta) {
      const ratio = this.current / this.total;
      const frameIndex = Math.round(ratio * (this.frames.length - 1));
      this.currentFrameIndex = Math.min(frameIndex, this.frames.length - 1);
    }
  }

  private buildDynamicContent(): string {
    const ratio = this.current / this.total;
    const filled = Math.round(ratio * this.width);
    const empty = this.width - filled;
    const percent = Math.round(ratio * 100);
    let content = `[${repeat('█', filled)}${repeat('░', empty)}] ${String(percent).padStart(3)}%`;

    if (this.current > 0 && this.current < this.total) {
      const elapsed = (Date.now() - this.startTime) / 1000;
      const rate = this.current / elapsed;
      const remaining = Math.ceil((this.total - this.current) / rate);
      content += ` | ETA: ${remaining}s`;
    } else if (this.current >= this.total) {
      const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1);
      content += ` | ${elapsed}s`;
    }

    return content;
  }
}
