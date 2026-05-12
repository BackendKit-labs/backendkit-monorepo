import { describe, it, expect } from 'vitest';
import { AnimationBuilder } from '../../../src/builder/animation-builder.js';
import { AnimationType } from '../../../src/types/animation-types.js';

describe('AnimationBuilder', () => {
  it('build() with type should return config', () => {
    const config = new AnimationBuilder()
      .setType(AnimationType.SPINNER)
      .setText('loading')
      .setColor('cyan')
      .setSpeed(50)
      .setPrefix('> ')
      .setSuffix(' <')
      .build();

    expect(config.type).toBe(AnimationType.SPINNER);
    expect(config.text).toBe('loading');
    expect(config.color).toBe('cyan');
    expect(config.speed).toBe(50);
    expect(config.prefix).toBe('> ');
    expect(config.suffix).toBe(' <');
  });

  it('build() without type should throw', () => {
    expect(() => new AnimationBuilder().build()).toThrow('Animation type is required');
  });

  it('should support method chaining', () => {
    const builder = new AnimationBuilder();
    expect(builder.setType(AnimationType.DOTS)).toBe(builder);
    expect(builder.setText('text')).toBe(builder);
    expect(builder.setColor('red')).toBe(builder);
  });

  it('should set overwrite and multiline', () => {
    const config = new AnimationBuilder()
      .setType(AnimationType.WORM)
      .setOverwrite(false)
      .setMultiline(true)
      .build();

    expect(config.overwrite).toBe(false);
    expect(config.multiline).toBe(true);
  });

  it('should set custom frames', () => {
    const frames = ['a', 'b', 'c'];
    const config = new AnimationBuilder()
      .setType(AnimationType.SPINNER)
      .setCustomFrames(frames)
      .build();

    expect(config.frames).toEqual(frames);
  });

  it('should set width and total', () => {
    const config = new AnimationBuilder()
      .setType(AnimationType.PROGRESS_BAR)
      .setWidth(30)
      .setTotal(200)
      .build();

    expect(config.width).toBe(30);
    expect(config.total).toBe(200);
  });
});
