import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

const CHARS = '01アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';

export class MatrixAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    for (let i = 0; i < 8; i++) {
      let line = '';
      for (let j = 0; j < 10; j++) {
        line += CHARS[Math.floor(Math.random() * CHARS.length)] + ' ';
      }
      frames.push(line);
    }
    return frames;
  }
}
