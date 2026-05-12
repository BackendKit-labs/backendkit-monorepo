import { Color } from '../types/color.types.js';

export interface Frame {
  content: string;
  color?: Color;
  overwrite: boolean;
  multiline: boolean;
  timestamp: number;
}
