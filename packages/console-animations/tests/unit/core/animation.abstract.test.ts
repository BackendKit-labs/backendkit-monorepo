import { describe, it, expect, vi } from 'vitest';
import { AbstractAnimation } from '../../../src/core/animation.abstract.js';
import { AnimationType, AnimationState, AnimationEvent } from '../../../src/types/animation-types.js';
import { AnimationConfig } from '../../../src/core/animation-config.interface.js';

class TestAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    return ['a', 'b', 'c'];
  }
}

describe('AbstractAnimation', () => {
  const defaultConfig: AnimationConfig = {
    type: AnimationType.SPINNER,
    speed: 80,
  };

  it('should create with default id and IDLE state', () => {
    const anim = new TestAnimation(defaultConfig);
    expect(anim.id).toBeDefined();
    expect(anim.id).toMatch(/^anim_/);
    expect(anim.type).toBe(AnimationType.SPINNER);
    expect(anim.state).toBe(AnimationState.IDLE);
  });

  it('should use provided id', () => {
    const anim = new TestAnimation({ ...defaultConfig, id: 'my-id' });
    expect(anim.id).toBe('my-id');
  });

  it('start() should transition to RUNNING and emit event', () => {
    const anim = new TestAnimation(defaultConfig);
    const handler = vi.fn();
    anim.on(AnimationEvent.START, handler);

    anim.start();

    expect(anim.state).toBe(AnimationState.RUNNING);
    expect(handler).toHaveBeenCalledWith(expect.objectContaining({ id: anim.id }));
  });

  it('stop() should transition to DONE and emit event', () => {
    const anim = new TestAnimation(defaultConfig);
    anim.start();
    const handler = vi.fn();
    anim.on(AnimationEvent.STOP, handler);

    anim.stop();

    expect(anim.state).toBe(AnimationState.DONE);
    expect(handler).toHaveBeenCalled();
  });

  it('pause() should transition to PAUSED', () => {
    const anim = new TestAnimation(defaultConfig);
    anim.start();

    anim.pause();

    expect(anim.state).toBe(AnimationState.PAUSED);
  });

  it('resume() should transition to RUNNING', () => {
    const anim = new TestAnimation(defaultConfig);
    anim.start();
    anim.pause();

    anim.resume();

    expect(anim.state).toBe(AnimationState.RUNNING);
  });

  it('destroy() should transition to DESTROYED', () => {
    const anim = new TestAnimation(defaultConfig);

    anim.destroy();

    expect(anim.state).toBe(AnimationState.DESTROYED);
  });

  it('nextFrame() should return frame with content when RUNNING and enough time passed', () => {
    const anim = new TestAnimation({ ...defaultConfig, speed: 1 });
    anim.start();

    const frame = anim.nextFrame(performance.now() + 10);

    expect(frame.content).toBeDefined();
    expect(frame.content).toBeTruthy();
    expect(frame.overwrite).toBe(true);
    expect(frame.timestamp).toBeGreaterThan(0);
  });

  it('nextFrame() should return empty frame if not enough time passed', () => {
    const anim = new TestAnimation({ ...defaultConfig, speed: 1000 });
    anim.start();

    const frame = anim.nextFrame(performance.now());

    expect(frame.content).toBe('');
    expect(frame.overwrite).toBe(false);
  });

  it('nextFrame() should return empty frame when not RUNNING', () => {
    const anim = new TestAnimation(defaultConfig);

    const frame = anim.nextFrame(performance.now());

    expect(frame.content).toBe('');
  });

  it('reset() should go back to IDLE', () => {
    const anim = new TestAnimation(defaultConfig);
    anim.start();
    anim.stop();

    anim.reset();

    expect(anim.state).toBe(AnimationState.IDLE);
    expect(anim['currentFrameIndex']).toBe(0);
  });

  it('should cycle through frames', () => {
    const anim = new TestAnimation({ ...defaultConfig, speed: 1 });
    anim.start();

    // Use a base timestamp and increment to simulate time passing
    const base = performance.now();
    const frame1 = anim.nextFrame(base + 10);
    const frame2 = anim.nextFrame(base + 20);
    const frame3 = anim.nextFrame(base + 30);
    const frame4 = anim.nextFrame(base + 40);

    expect(frame1.content).toContain('a');
    expect(frame2.content).toContain('b');
    expect(frame3.content).toContain('c');
    expect(frame4.content).toContain('a');
  });

  it('should emit STATE_CHANGE on transitions', () => {
    const anim = new TestAnimation(defaultConfig);
    const handler = vi.fn();
    anim.on(AnimationEvent.STATE_CHANGE, handler);

    anim.start();

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({ from: AnimationState.IDLE, to: AnimationState.RUNNING }),
    );
  });

  it('getConfig() should return a copy of config', () => {
    const anim = new TestAnimation(defaultConfig);
    const config = anim.getConfig();

    expect(config.type).toBe(AnimationType.SPINNER);
    expect(config.speed).toBe(80);
  });

  it('should apply prefix and suffix in frame content', () => {
    const anim = new TestAnimation({ ...defaultConfig, prefix: '> ', suffix: ' <', speed: 1 });
    anim.start();

    const frame = anim.nextFrame(performance.now() + 10);

    expect(frame.content).toContain('> ');
    expect(frame.content).toContain(' <');
  });
});
