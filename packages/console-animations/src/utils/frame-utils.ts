let counter = 0;

export function generateId(): string {
  counter += 1;
  const random = Math.random().toString(36).substring(2, 7);
  return `anim_${random}_${counter}`;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function repeat(char: string, count: number): string {
  return char.repeat(Math.max(0, count));
}
