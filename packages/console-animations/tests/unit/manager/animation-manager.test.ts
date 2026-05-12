import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationManager } from '../../../src/manager/animation-manager.js';
import { AnimationType, AnimationState } from '../../../src/types/animation-types.js';

describe('AnimationManager', () => {
  let manager: AnimationManager;

  beforeEach(() => {
    manager = new AnimationManager();
  });

  afterEach(() => {
    manager.destroyAll();
  });

  it('start() should create and register an animation', () => {
    const anim = manager.start({ type: AnimationType.SPINNER, speed: 1000 });

    expect(anim.id).toBeDefined();
    expect(anim.state).toBe(AnimationState.RUNNING);
    expect(manager.get(anim.id)).toBe(anim);
  });

  it('stop() should stop the animation', () => {
    const anim = manager.start({ type: AnimationType.SPINNER, speed: 1000 });

    manager.stop(anim.id);

    expect(anim.state).toBe(AnimationState.DONE);
  });

  it('pause() and resume() should work', () => {
    const anim = manager.start({ type: AnimationType.SPINNER, speed: 1000 });

    manager.pause(anim.id);
    expect(anim.state).toBe(AnimationState.PAUSED);

    manager.resume(anim.id);
    expect(anim.state).toBe(AnimationState.RUNNING);
  });

  it('destroyAll() should clean everything', () => {
    manager.start({ type: AnimationType.SPINNER, speed: 1000 });
    manager.start({ type: AnimationType.DOTS, speed: 1000 });

    manager.destroyAll();

    expect(manager.getAll()).toHaveLength(0);
  });

  it('getAll() should return all animations', () => {
    const anim1 = manager.start({ type: AnimationType.SPINNER, speed: 1000 });
    const anim2 = manager.start({ type: AnimationType.DOTS, speed: 1000 });

    const all = manager.getAll();

    expect(all).toHaveLength(2);
    expect(all).toContain(anim1);
    expect(all).toContain(anim2);
  });

  it('run() should execute task and stop animation', async () => {
    const task = vi.fn().mockResolvedValue('result');

    const result = await manager.run({ type: AnimationType.SPINNER, speed: 1000 }, task);

    expect(result).toBe('result');
    expect(task).toHaveBeenCalled();
  });

  it('run() should stop animation on task error', async () => {
    const task = vi.fn().mockRejectedValue(new Error('fail'));

    await expect(manager.run({ type: AnimationType.SPINNER, speed: 1000 }, task)).rejects.toThrow('fail');
  });

  it('getByType() should filter by type', () => {
    manager.start({ type: AnimationType.SPINNER, speed: 1000 });
    manager.start({ type: AnimationType.DOTS, speed: 1000 });
    manager.start({ type: AnimationType.SPINNER, speed: 1000 });

    const spinners = manager.getByType(AnimationType.SPINNER);

    expect(spinners).toHaveLength(2);
  });
});
