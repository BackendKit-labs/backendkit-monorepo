import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

export class DotsAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    return ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
  }
}
