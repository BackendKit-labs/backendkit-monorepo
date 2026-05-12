import { Color } from '../types/color.types.js';

const NAMED_COLORS: Record<string, string> = {
  black: '30',
  red: '31',
  green: '32',
  yellow: '33',
  blue: '34',
  magenta: '35',
  cyan: '36',
  white: '37',
  gray: '90',
  grey: '90',
  redBright: '91',
  greenBright: '92',
  yellowBright: '93',
  blueBright: '94',
  magentaBright: '95',
  cyanBright: '96',
  whiteBright: '97',
  bold: '1',
  dim: '2',
  italic: '3',
  underline: '4',
};

const ESC = '';

export class ColorManager {
  apply(text: string, color?: Color): string {
    if (!color || !text) return text;

    const code = NAMED_COLORS[color];
    if (code) {
      return `${ESC}[${code}m${text}${ESC}[0m`;
    }

    if (color.startsWith('#')) {
      const hex = color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
        return `${ESC}[38;2;${r};${g};${b}m${text}${ESC}[0m`;
      }
    }

    if (color.startsWith(ESC)) {
      return `${color}${text}${ESC}[0m`;
    }

    return text;
  }
}
