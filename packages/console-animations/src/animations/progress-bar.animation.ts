import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';
import { repeat } from '../utils/frame-utils.js';

export class ProgressBarAnimation extends AbstractAnimation {
  private width: number;
  private total: number;
  private current: number = 0;

  constructor(config: AnimationConfig) {
    super(config);
    this.width = config.width ?? 20;
    this.total = config.total ?? 100;
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    const steps = Math.min(this.width, 20);
    for (let i = 0; i <= steps; i++) {
      const filled = Math.round((i / steps) * this.width);
      const empty = this.width - filled;
      const percent = Math.round((i / steps) * 100);
      frames.push(`[${repeat('=', filled)}${repeat(' ', empty)}] ${percent}%`);
    }
    return frames;
  }

  setProgress(value: number): void {
    this.current = Math.min(value, this.total);
    const ratio = this.current / this.total;
    const frameIndex = Math.round(ratio * (this.frames.length - 1));
    this.currentFrameIndex = Math.min(frameIndex, this.frames.length - 1);
  }
}
