export class CursorManager {
  hide(): void {
    process.stdout.write('\u001B[?25l');
  }

  show(): void {
    process.stdout.write('\u001B[?25h');
  }

  moveUp(lines: number = 1): void {
    if (lines > 0) {
      process.stdout.write(`\u001B[${lines}A`);
    }
  }

  clearLine(): void {
    process.stdout.write('\u001B[2K\u001B[0G');
  }

  savePosition(): void {
    process.stdout.write('\u001B[s');
  }

  restorePosition(): void {
    process.stdout.write('\u001B[u');
  }
}
