import { Frame } from '../core/frame.type.js';
import { CursorManager } from './cursor-manager.js';
import { ColorManager } from './color-manager.js';
import { terminal } from '../utils/terminal.js';

export class RenderEngine {
  private cursorManager: CursorManager;
  private colorManager: ColorManager;
  private buffer: Frame[] = [];
  private destroyed: boolean = false;

  constructor() {
    this.cursorManager = new CursorManager();
    this.colorManager = new ColorManager();
  }

  render(frame: Frame): void {
    if (this.destroyed || !terminal.isInteractive) return;
    const colored = this.colorManager.apply(frame.content, frame.color);
    if (frame.overwrite) {
      this.cursorManager.moveUp(1);
      this.cursorManager.clearLine();
    }
    process.stdout.write(colored);
    if (!frame.overwrite) {
      process.stdout.write('\n');
    }
  }

  renderFinal(symbol: string, symbolColor: string, text: string): void {
    if (this.destroyed) return;
    const coloredSymbol = this.colorManager.apply(symbol, symbolColor);
    if (terminal.isInteractive) {
      process.stdout.write('\r\x1b[2K');
    }
    process.stdout.write(`${coloredSymbol} ${text}\n`);
  }

  enqueue(frame: Frame): void {
    if (this.destroyed) return;
    this.buffer.push(frame);
  }

  flush(): void {
    if (this.destroyed || this.buffer.length === 0) return;
    const frames = this.buffer;
    this.buffer = [];
    for (const frame of frames) {
      this.render(frame);
    }
  }

  destroy(): void {
    this.destroyed = true;
    this.cursorManager.show();
    this.buffer = [];
  }
}
