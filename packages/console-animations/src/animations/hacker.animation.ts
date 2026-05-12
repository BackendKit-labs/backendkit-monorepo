import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

const HEX = '0123456789ABCDEF';
const rand = () => HEX[Math.floor(Math.random() * 16)] + HEX[Math.floor(Math.random() * 16)];

export class HackerAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    for (let i = 0; i < 8; i++) {
      const cols = [rand(), rand(), rand(), rand()];
      frames.push(cols.map((v, j) => (j === i % 4 ? `[${v}]` : ` ${v} `)).join(''));
    }
    return frames;
  }
}
