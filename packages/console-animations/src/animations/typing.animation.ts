import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

export class TypingAnimation extends AbstractAnimation {
  private text: string;

  constructor(config: AnimationConfig) {
    super(config);
    this.text = config.text ?? '...';
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    const len = this.text.length;
    if (len === 0) {
      frames.push('_');
      return frames;
    }
    for (let i = 0; i <= len; i++) {
      frames.push(this.text.substring(0, i) + '_');
    }
    for (let i = len; i >= 0; i--) {
      frames.push(this.text.substring(0, i) + '_');
    }
    return frames;
  }
}
