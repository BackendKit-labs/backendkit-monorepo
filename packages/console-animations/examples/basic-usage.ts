/**
 * @description Ejemplo basico de uso de cursor-animation.
 * Muestra como iniciar, detener y controlar una animacion simple.
 * Ejecutar con: npx tsx examples/basic-usage.ts
 */

import { AnimationManager, AnimationType } from '../src/index.js';

const manager = new AnimationManager();

// ── Spinner simple ──
console.log('Spinner animado durante 3 segundos...');
const spinner = manager.start({
  type: AnimationType.SPINNER,
  color: 'cyan',
  speed: 80,
  prefix: '  Cargando... ',
});

setTimeout(() => {
  manager.stop(spinner.id);
  console.log('\nSpinner detenido.');
}, 3000);

// ── Dots con texto personalizado ──
setTimeout(() => {
  console.log('\nDots animados durante 2 segundos...');
  const dots = manager.start({
    type: AnimationType.DOTS,
    text: 'Procesando datos',
    color: 'yellow',
    speed: 120,
  });

  setTimeout(() => {
    manager.stop(dots.id);
    console.log('\nDots detenidos.');
  }, 2000);
}, 4000);

// ── Progress bar ──
setTimeout(() => {
  console.log('\nProgress bar animada...');
  const bar = manager.start({
    type: AnimationType.PROGRESS_BAR,
    color: 'green',
    speed: 100,
    width: 30,
    total: 100,
  });

  setTimeout(() => {
    manager.stop(bar.id);
    console.log('\nProgress bar detenida.');
    manager.destroyAll();
    console.log('\n--- Ejemplo completado ---');
  }, 3000);
}, 7000);
