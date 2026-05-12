import { AbstractAnimation } from '../core/animation.abstract.js';
import { AnimationConfig } from '../core/animation-config.interface.js';

const MATRIX_CHARS = 'ｦｧｨｩｪｫｬｭｮｯｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ01';

export class MatrixAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    const frames: string[] = [];
    for (let i = 0; i < 12; i++) {
      let line = '';
      for (let j = 0; j < 8; j++) {
        line += MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)];
      }
      frames.push(line);
    }
    return frames;
  }
}
