import { Color } from '../types/color.types.js';

const NAMED_COLORS: Record<string, string> = {
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37',
  gray: '90',
  bold: '1',
  dim: '2',
  italic: '3',
  underline: '4',
};

export class ColorManager {
  apply(text: string, color?: Color): string {
    if (!color || !text) return text;

    const code = NAMED_COLORS[color.toLowerCase()];
    if (code) {
      return `\u001B[${code}m${text}\u001B[0m`;
    }

    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return `\u001B[38;2;${r};${g};${b}m${text}\u001B[0m`;
      }
    }

    if (color.startsWith('\u001B')) {
      return `${color}${text}\u001B[0m`;
    }

    return text;
  }
}
