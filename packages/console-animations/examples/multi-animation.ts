/**
 * @description Ejemplo de multiples animaciones simultaneas.
 * Muestra como ejecutar varias animaciones en paralelo.
 * Ejecutar con: npx tsx examples/multi-animation.ts
 */

import { AnimationManager, AnimationType } from '../src/index.js';

const manager = new AnimationManager();

console.log('=== Multiples animaciones simultaneas ===\n');

// Iniciamos 3 animaciones en paralelo
const spinner = manager.start({
  type: AnimationType.SPINNER,
  color: 'cyan',
  speed: 80,
  prefix: '  Tarea 1: ',
});

const dots = manager.start({
  type: AnimationType.DOTS,
  text: 'Tarea 2',
  color: 'yellow',
  speed: 150,
});

const worm = manager.start({
  type: AnimationType.WORM,
  color: 'magenta',
  speed: 100,
  prefix: '  Tarea 3: ',
});

// Detenemos una por una en distintos tiempos
setTimeout(() => {
  manager.stop(spinner.id);
  console.log('\nTarea 1 completada.');
}, 2000);

setTimeout(() => {
  manager.stop(dots.id);
  console.log('\nTarea 2 completada.');
}, 3500);

setTimeout(() => {
  manager.stop(worm.id);
  console.log('\nTarea 3 completada.');
  manager.destroyAll();
  console.log('\n=== Todas las tareas completadas ===');
}, 5000);
