import { AnimationType } from '../types/animation-types.js';
import { AnimationConfig } from '../core/animation-config.interface.js';
import { IAnimation } from '../core/animation.interface.js';
import { SpinnerAnimation } from '../animations/spinner.animation.js';
import { DotsAnimation } from '../animations/dots.animation.js';
import { ProgressBarAnimation } from '../animations/progress-bar.animation.js';
import { WormAnimation } from '../animations/worm.animation.js';
import { StarsAnimation } from '../animations/stars.animation.js';
import { ParticlesAnimation } from '../animations/particles.animation.js';
import { WavesAnimation } from '../animations/waves.animation.js';
import { PulseAnimation } from '../animations/pulse.animation.js';
import { MatrixAnimation } from '../animations/matrix.animation.js';
import { FireAnimation } from '../animations/fire.animation.js';
import { TypingAnimation } from '../animations/typing.animation.js';
import { SnakeAnimation } from '../animations/snake.animation.js';
import { BouncingBallAnimation } from '../animations/bouncing-ball.animation.js';
import { RainAnimation } from '../animations/rain.animation.js';
import { CyberpunkAnimation } from '../animations/cyberpunk.animation.js';
import { HackerAnimation } from '../animations/hacker.animation.js';
import { FuturistaAnimation } from '../animations/futurista.animation.js';

type AnimationConstructor = new (config: AnimationConfig) => IAnimation;

export class AnimationFactory {
  private strategies: Map<string, AnimationConstructor> = new Map();

  constructor() {
    this.registerDefaults();
  }

  register(type: AnimationType, ctor: AnimationConstructor): void {
    this.strategies.set(type, ctor);
  }

  create(type: AnimationType, config: AnimationConfig): IAnimation {
    const Ctor = this.strategies.get(type);
    if (!Ctor) {
      throw new Error(
        `No animation registered for type '${type}'. Available types: ${Array.from(this.strategies.keys()).join(', ')}`,
      );
    }
    return new Ctor({ ...config, type });
  }

  private registerDefaults(): void {
    this.register(AnimationType.SPINNER, SpinnerAnimation);
    this.register(AnimationType.DOTS, DotsAnimation);
    this.register(AnimationType.PROGRESS_BAR, ProgressBarAnimation);
    this.register(AnimationType.WORM, WormAnimation);
    this.register(AnimationType.STARS, StarsAnimation);
    this.register(AnimationType.PARTICLES, ParticlesAnimation);
    this.register(AnimationType.WAVES, WavesAnimation);
    this.register(AnimationType.PULSE, PulseAnimation);
    this.register(AnimationType.MATRIX, MatrixAnimation);
    this.register(AnimationType.FIRE, FireAnimation);
    this.register(AnimationType.TYPING, TypingAnimation);
    this.register(AnimationType.SNAKE, SnakeAnimation);
    this.register(AnimationType.BOUNCING_BALL, BouncingBallAnimation);
    this.register(AnimationType.RAIN, RainAnimation);
    this.register(AnimationType.CYBERPUNK, CyberpunkAnimation);
    this.register(AnimationType.HACKER, HackerAnimation);
    this.register(AnimationType.FUTURISTA, FuturistaAnimation);
  }
}
