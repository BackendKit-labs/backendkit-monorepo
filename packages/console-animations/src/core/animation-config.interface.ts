import { AnimationType } from '../types/animation-types.js';
import { Color } from '../types/color.types.js';

export interface AnimationConfig {
  type: AnimationType;
  id?: string;
  text?: string;
  color?: Color;
  speed?: number;
  prefix?: string;
  suffix?: string;
  overwrite?: boolean;
  multiline?: boolean;
  frames?: string[];
  width?: number;
  total?: number;
  showEta?: boolean;
  custom?: Record<string, unknown>;
}
