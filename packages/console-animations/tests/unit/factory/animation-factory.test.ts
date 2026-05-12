import { describe, it, expect } from 'vitest';
import { AnimationFactory } from '../../../src/factory/animation-factory.js';
import { AnimationType } from '../../../src/types/animation-types.js';
import { AnimationConfig } from '../../../src/core/animation-config.interface.js';
import { AbstractAnimation } from '../../../src/core/animation.abstract.js';

class CustomAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }
  protected buildFrames(): string[] {
    return ['x', 'y'];
  }
}

describe('AnimationFactory', () => {
  const config: AnimationConfig = { type: AnimationType.SPINNER, speed: 1000 };

  it('create() with registered type should return IAnimation', () => {
    const factory = new AnimationFactory();
    const anim = factory.create(AnimationType.SPINNER, config);

    expect(anim).toBeDefined();
    expect(anim.type).toBe(AnimationType.SPINNER);
  });

  it('create() with unregistered type should throw', () => {
    const factory = new AnimationFactory();
    expect(() => factory.create('unknown' as AnimationType, config)).toThrow();
  });

  it('register() should add new type', () => {
    const factory = new AnimationFactory();
    factory.register('custom' as AnimationType, CustomAnimation);

    const anim = factory.create('custom' as AnimationType, { type: 'custom' as AnimationType, speed: 1000 });
    expect(anim).toBeDefined();
    expect(anim.type).toBe('custom');
  });

  it('should create all default types', () => {
    const factory = new AnimationFactory();
    const types = Object.values(AnimationType);

    for (const type of types) {
      const anim = factory.create(type, { type, speed: 1000 });
      expect(anim).toBeDefined();
      expect(anim.type).toBe(type);
    }
  });
});
