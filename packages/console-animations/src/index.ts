export { AnimationManager } from './manager/animation-manager.js';
export { AnimationBuilder } from './builder/animation-builder.js';
export { AnimationFactory } from './factory/animation-factory.js';
export { AnimationRegistry } from './registry/animation-registry.js';
export { FrameScheduler } from './scheduler/frame-scheduler.js';
export { RenderEngine } from './renderer/render-engine.js';
export { CursorManager } from './renderer/cursor-manager.js';
export { ColorManager } from './renderer/color-manager.js';
export { EventEmitter } from './observer/event-emitter.js';
export { AbstractAnimation } from './core/animation.abstract.js';
export { AnimationType, AnimationState, AnimationEvent } from './types/animation-types.js';
export type { IAnimation, EventHandler } from './core/animation.interface.js';
export type { AnimationConfig } from './core/animation-config.interface.js';
export type { Frame } from './core/frame.type.js';
export type { Color, ColorFn } from './types/color.types.js';
export { generateId, clamp, repeat } from './utils/frame-utils.js';
export { terminal, symbols } from './utils/terminal.js';
export { Presets } from './presets/index.js';

// Re-export all animation classes for custom usage
export {
  SpinnerAnimation,
  DotsAnimation,
  ProgressBarAnimation,
  WormAnimation,
  StarsAnimation,
  ParticlesAnimation,
  WavesAnimation,
  PulseAnimation,
  MatrixAnimation,
  FireAnimation,
  TypingAnimation,
  SnakeAnimation,
  BouncingBallAnimation,
  RainAnimation,
  CyberpunkAnimation,
  HackerAnimation,
  FuturistaAnimation,
} from './animations/index.js';
