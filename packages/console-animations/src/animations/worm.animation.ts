import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

export class WormAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    const width = 10;
    const frames: string[] = [];
    for (let i = 0; i < width; i++) {
      frames.push('[' + '─'.repeat(i) + '●' + '─'.repeat(width - i - 1) + ']');
    }
    for (let i = width - 2; i > 0; i--) {
      frames.push('[' + '─'.repeat(i) + '●' + '─'.repeat(width - i - 1) + ']');
    }
    return frames;
  }
}
