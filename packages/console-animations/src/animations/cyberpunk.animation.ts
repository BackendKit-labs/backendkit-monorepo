import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

export class CyberpunkAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    const total = 10;
    const frames: string[] = [];
    for (let i = 0; i <= total; i++) {
      frames.push('▰'.repeat(i) + '▱'.repeat(total - i));
    }
    for (let i = total - 1; i >= 1; i--) {
      frames.push('▰'.repeat(i) + '▱'.repeat(total - i));
    }
    return frames;
  }
}
