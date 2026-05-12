import { AnimationType } from '../types/animation-types.js';
import type { AnimationConfig } from '../core/animation-config.interface.js';

export const Presets = {
  install: (text = 'Installing packages'): AnimationConfig => ({
    type: AnimationType.SPINNER,
    color: 'cyan',
    prefix: `  ${text} `,
    speed: 80,
  }),

  build: (text = 'Building'): AnimationConfig => ({
    type: AnimationType.DOTS,
    color: 'yellow',
    prefix: `  ${text} `,
    speed: 100,
  }),

  deploy: (text = 'Deploying'): AnimationConfig => ({
    type: AnimationType.WORM,
    color: 'magenta',
    prefix: `  ${text} `,
    speed: 60,
  }),

  download: (text = 'Downloading', total = 100): AnimationConfig => ({
    type: AnimationType.PROGRESS_BAR,
    color: 'cyan',
    prefix: `  ${text} `,
    width: 30,
    total,
    showEta: true,
  }),

  upload: (text = 'Uploading', total = 100): AnimationConfig => ({
    type: AnimationType.CYBERPUNK,
    color: 'green',
    prefix: `  ${text} `,
    total,
  }),

  connect: (text = 'Connecting'): AnimationConfig => ({
    type: AnimationType.PULSE,
    color: 'blue',
    prefix: `  ${text} `,
    speed: 120,
  }),

  migrate: (text = 'Running migrations'): AnimationConfig => ({
    type: AnimationType.SNAKE,
    color: 'yellow',
    prefix: `  ${text} `,
    speed: 80,
  }),

  encrypt: (text = 'Encrypting'): AnimationConfig => ({
    type: AnimationType.HACKER,
    color: 'greenBright',
    prefix: `  ${text} `,
    speed: 60,
  }),

  scan: (text = 'Scanning'): AnimationConfig => ({
    type: AnimationType.MATRIX,
    color: 'green',
    prefix: `  ${text} `,
    speed: 50,
  }),

  stream: (text = 'Streaming'): AnimationConfig => ({
    type: AnimationType.WAVES,
    color: 'cyan',
    prefix: `  ${text} `,
    speed: 80,
  }),
};
