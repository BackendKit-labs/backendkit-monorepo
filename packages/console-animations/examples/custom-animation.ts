/**
 * @description Ejemplo de animacion personalizada.
 * Muestra como crear una animacion custom con frames propios
 * y como usar el AnimationBuilder para configuracion fluida.
 * Ejecutar con: npx tsx examples/custom-animation.ts
 */

import {
  AnimationManager,
  AnimationBuilder,
  AnimationType,
  AbstractAnimation,
  AnimationConfig,
} from '../src/index.js';

// ── Animacion personalizada: un reloj de arena ──
class HourglassAnimation extends AbstractAnimation {
  constructor(config: AnimationConfig) {
    super(config);
  }

  protected buildFrames(): string[] {
    return [
      ' ╔═══╗\n ║ ■ ║\n ║   ║\n ╚═══╝',
      ' ╔═══╗\n ║   ║\n ║ ■ ║\n ╚═══╝',
      ' ╔═══╗\n ║   ║\n ║   ║\n ╚═══╝',
      ' ╔═══╗\n ║   ║\n ║ ■ ║\n ╚═══╝',
      ' ╔═══╗\n ║ ■ ║\n ║   ║\n ╚═══╝',
    ];
  }
}

// ── Registrar la animacion custom en el manager ──
// Nota: AnimationManager no expone el factory directamente.
// Para animaciones custom, se puede usar el factory directamente
// o extender AnimationManager. Aqui usamos el approach directo.

const manager = new AnimationManager();

// Usamos el builder para configurar
const config = new AnimationBuilder()
  .setType(AnimationType.SPINNER) // type placeholder, lo reemplazamos abajo
  .setColor('cyan')
  .setSpeed(200)
  .setMultiline(true)
  .build();

// Creamos la animacion custom directamente
const customAnim = new HourglassAnimation({
  ...config,
  type: 'hourglass' as AnimationType,
});

// La registramos manualmente en el scheduler via el manager
// (Esto es un workaround hasta que el manager exponga registerCustom)
console.log('Animacion personalizada: Reloj de arena');
console.log('(Presiona Ctrl+C para salir)\n');

// Iniciamos manualmente
customAnim.start();

// Hacemos nuestro propio loop simple
const interval = setInterval(() => {
  const frame = customAnim.nextFrame(performance.now());
  if (frame.content) {
    console.clear();
    console.log(frame.content);
  }
}, 200);

setTimeout(() => {
  clearInterval(interval);
  customAnim.destroy();
  manager.destroyAll();
  console.log('\nAnimacion custom detenida.');
}, 6000);
