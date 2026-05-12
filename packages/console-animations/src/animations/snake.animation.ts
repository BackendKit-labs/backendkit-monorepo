import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

export class SnakeAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    return [
      'o=====',
      '=o====',
      '==o===',
      '===o==',
      '====o=',
      '=====o',
      '====o=',
      '===o==',
      '==o===',
      '=o====',
    ];
  }
}
