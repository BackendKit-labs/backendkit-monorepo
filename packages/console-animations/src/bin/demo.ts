import { AnimationManager } from '../manager/animation-manager.js';
import { AnimationType } from '../types/animation-types.js';
import { Presets } from '../presets/index.js';
import { ProgressBarAnimation } from '../animations/progress-bar.animation.js';
import type { AnimationConfig } from '../core/animation-config.interface.js';

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

async function demo(): Promise<void> {
  const manager = new AnimationManager();

  process.stdout.write('\n  @backendkit-labs/console-animations\n\n');

  const items: Array<{ config: AnimationConfig; label: string }> = [
    { config: Presets.install(),  label: 'install' },
    { config: Presets.build(),    label: 'build' },
    { config: Presets.deploy(),   label: 'deploy' },
    { config: Presets.connect(),  label: 'connect' },
    { config: Presets.migrate(),  label: 'migrate' },
    { config: Presets.encrypt(),  label: 'encrypt' },
    { config: Presets.scan(),     label: 'scan' },
    { config: Presets.stream(),   label: 'stream' },
    {
      config: { type: AnimationType.PULSE, color: 'magentaBright', prefix: '  pulse   ' },
      label: 'pulse',
    },
    {
      config: { type: AnimationType.BOUNCING_BALL, color: 'yellow', prefix: '  bounce  ' },
      label: 'bouncing-ball',
    },
    {
      config: { type: AnimationType.STARS, color: 'cyanBright', prefix: '  stars   ' },
      label: 'stars',
    },
    {
      config: { type: AnimationType.FUTURISTA, color: 'blueBright', prefix: '  futurista ' },
      label: 'futurista',
    },
    {
      config: { type: AnimationType.TYPING, text: 'npm install', color: 'white', prefix: '  typing  ' },
      label: 'typing',
    },
  ];

  for (const { config, label } of items) {
    const anim = manager.start(config);
    await sleep(1500);
    manager.succeed(anim.id, label);
    await sleep(80);
  }

  process.stdout.write('\n');
  const barConfig: AnimationConfig = { ...Presets.download('Downloading package', 30), width: 25 };
  const bar = manager.start(barConfig);
  for (let i = 0; i <= 30; i++) {
    const barAnim = manager.get(bar.id);
    if (barAnim instanceof ProgressBarAnimation) {
      barAnim.setProgress(i);
    }
    await sleep(60);
  }
  manager.succeed(bar.id, 'package downloaded');

  process.stdout.write('\n  npm install @backendkit-labs/console-animations\n\n');
  process.exit(0);
}

demo().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
