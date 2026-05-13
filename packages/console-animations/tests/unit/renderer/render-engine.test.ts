import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RenderEngine } from '../../../src/renderer/render-engine.js';
import { Frame } from '../../../src/core/frame.type.js';

vi.mock('../../../src/utils/terminal.js', () => ({
  terminal: { isInteractive: true, supportsUnicode: true },
  symbols: { success: '✔', error: '✖', warning: '⚠', info: 'ℹ' },
}));

describe('RenderEngine', () => {
  let engine: RenderEngine;
  let writeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    writeSpy = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    engine = new RenderEngine();
  });

  afterEach(() => {
    engine.destroy();
    writeSpy.mockRestore();
  });

  it('render() should write to stdout', () => {
    const frame: Frame = {
      content: 'test',
      overwrite: false,
      multiline: false,
      timestamp: Date.now(),
    };

    engine.render(frame);

    expect(writeSpy).toHaveBeenCalledWith('test');
  });

  it('render() should apply color', () => {
    const frame: Frame = {
      content: 'hello',
      color: 'red',
      overwrite: false,
      multiline: false,
      timestamp: Date.now(),
    };

    engine.render(frame);

    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('\u001B[31m'));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('hello'));
    expect(writeSpy).toHaveBeenCalledWith(expect.stringContaining('\u001B[0m'));
  });

  it('enqueue() + flush() should write buffered frames', () => {
    const frame1: Frame = { content: 'a', overwrite: false, multiline: false, timestamp: Date.now() };
    const frame2: Frame = { content: 'b', overwrite: false, multiline: false, timestamp: Date.now() };

    engine.enqueue(frame1);
    engine.enqueue(frame2);
    engine.flush();

    expect(writeSpy).toHaveBeenCalledWith('a');
    expect(writeSpy).toHaveBeenCalledWith('b');
  });

  it('flush() with empty buffer should not write', () => {
    engine.flush();

    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('destroy() should show cursor', () => {
    engine.destroy();

    expect(writeSpy).toHaveBeenCalledWith('\u001B[?25h');
  });

  it('render() should not write after destroy', () => {
    engine.destroy();

    const frame: Frame = { content: 'x', overwrite: false, multiline: false, timestamp: Date.now() };
    engine.render(frame);

    // Only the destroy show() call
    expect(writeSpy).toHaveBeenCalledTimes(1);
  });
});
