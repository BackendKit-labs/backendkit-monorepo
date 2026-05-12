export enum AnimationType {
  SPINNER = 'spinner',
  DOTS = 'dots',
  PROGRESS_BAR = 'progress-bar',
  WORM = 'worm',
  STARS = 'stars',
  PARTICLES = 'particles',
  WAVES = 'waves',
  PULSE = 'pulse',
  MATRIX = 'matrix',
  FIRE = 'fire',
  TYPING = 'typing',
  SNAKE = 'snake',
  BOUNCING_BALL = 'bouncing-ball',
  RAIN = 'rain',
  CYBERPUNK = 'cyberpunk',
  HACKER = 'hacker',
  FUTURISTA = 'futurista',
}

export enum AnimationState {
  IDLE = 'idle',
  RUNNING = 'running',
  PAUSED = 'paused',
  DONE = 'done',
  ERROR = 'error',
  DESTROYED = 'destroyed',
}

export enum AnimationEvent {
  START = 'start',
  STOP = 'stop',
  PAUSE = 'pause',
  RESUME = 'resume',
  DESTROY = 'destroy',
  STATE_CHANGE = 'state-change',
  FRAME = 'frame',
  ERROR = 'error',
  COMPLETE = 'complete',
}
