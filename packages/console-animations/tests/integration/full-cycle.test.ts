import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationManager } from '../../src/manager/animation-manager.js';
import { AnimationType } from '../../src/types/animation-types.js';

describe('Full Cycle Integration', () => {
  let manager: AnimationManager;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    manager = new AnimationManager();
  });

  afterEach(() => {
    manager.destroyAll();
    writeSpy.mockRestore();
  });

  it('should start and stop spinner without errors', async () => {
    const anim = manager.start({ type: AnimationType.SPINNER, speed: 50 });

    expect(anim).toBeDefined();
    expect(anim.state).toBe('running');

    // Wait for some frames
    await new Promise((resolve) => setTimeout(resolve, 150));

    manager.stop(anim.id);

    expect(anim.state).toBe('done');
    expect(writeSpy).toHaveBeenCalled();
  });

  it('should run multiple animations simultaneously', async () => {
    const anim1 = manager.start({ type: AnimationType.SPINNER, speed: 50 });
    const anim2 = manager.start({ type: AnimationType.DOTS, speed: 50 });

    expect(manager.getAll()).toHaveLength(2);

    await new Promise((resolve) => setTimeout(resolve, 100));

    manager.stop(anim1.id);
    manager.stop(anim2.id);

    expect(anim1.state).toBe('done');
    expect(anim2.state).toBe('done');
  });

  it('should run async task with animation', async () => {
    const task = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return 'done';
    };

    const result = await manager.run({ type: AnimationType.SPINNER, speed: 50 }, task);

    expect(result).toBe('done');
    expect(manager.getAll()).toHaveLength(0);
  });

  it('should handle destroyAll gracefully', () => {
    manager.start({ type: AnimationType.SPINNER, speed: 50 });
    manager.start({ type: AnimationType.DOTS, speed: 50 });
    manager.start({ type: AnimationType.WORM, speed: 50 });

    expect(manager.getAll()).toHaveLength(3);

    manager.destroyAll();

    expect(manager.getAll()).toHaveLength(0);
  });
});
