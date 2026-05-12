import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

const HEX = '0123456789ABCDEF';

export class HackerAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    for (let i = 0; i < 8; i++) {
      let line = '';
      for (let j = 0; j < 8; j++) {
        line += HEX[Math.floor(Math.random() * 16)] + ' ';
      }
      frames.push(line);
    }
    return frames;
  }
}
