import { AnimationType } from '../types/animation-types.js';
import { Color } from '../types/color.types.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

export class AnimationBuilder {
  private config: Partial<AnimationConfig> = {};

  setType(type: AnimationType): this {
    this.config.type = type;
    return this;
  }

  setText(text: string): this {
    this.config.text = text;
    return this;
  }

  setColor(color: Color): this {
    this.config.color = color;
    return this;
  }

  setSpeed(speed: number): this {
    this.config.speed = speed;
    return this;
  }

  setPrefix(prefix: string): this {
    this.config.prefix = prefix;
    return this;
  }

  setSuffix(suffix: string): this {
    this.config.suffix = suffix;
    return this;
  }

  setOverwrite(overwrite: boolean): this {
    this.config.overwrite = overwrite;
    return this;
  }

  setMultiline(multiline: boolean): this {
    this.config.multiline = multiline;
    return this;
  }

  setCustomFrames(frames: string[]): this {
    this.config.frames = frames;
    return this;
  }

  setWidth(width: number): this {
    this.config.width = width;
    return this;
  }

  setTotal(total: number): this {
    this.config.total = total;
    return this;
  }

  setCustom(data: Record<string, unknown>): this {
    this.config.custom = data;
    return this;
  }

  build(): AnimationConfig {
    if (!this.config.type) {
      throw new Error('Animation type is required. Call setType() before build().');
    }
    return this.config as AnimationConfig;
  }
}
