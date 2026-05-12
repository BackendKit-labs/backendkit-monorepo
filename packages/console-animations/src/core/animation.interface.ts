import { AnimationState, AnimationEvent } from '../types/animation-types.js';
import { AnimationConfig } from './animation-config.interface.js';
import { Frame } from './frame.type.js';

export type EventHandler = (data: Record<string, unknown>) => void;

export interface IAnimation {
  readonly id: string;
  readonly type: string;
  readonly state: AnimationState;

  start(): void;
  stop(): void;
  pause(): void;
  resume(): void;
  destroy(): void;

  nextFrame(timestamp: number): Frame;

  reset(): void;

  on(event: AnimationEvent, handler: EventHandler): void;

  getConfig(): AnimationConfig;
}
