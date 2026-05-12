/**
 * @description Ejemplo de flujo asincrono con AnimationManager.run().
 * Muestra como envolver una tarea async con una animacion
 * que se detiene automaticamente al completar o fallar.
 * Ejecutar con: npx tsx examples/async-workflow.ts
 */

import { AnimationManager, AnimationType } from '../src/index.js';

const manager = new AnimationManager();

// ── Simula una tarea asincrona ──
async function simulateTask(name: string, durationMs: number, shouldFail = false): Promise<string> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      if (shouldFail) {
        reject(new Error(`Error en ${name}`));
      } else {
        resolve(`${name} completada exitosamente`);
      }
    }, durationMs);
  });
}

// ── Tarea exitosa con animacion ──
async function runSuccessfulTask(): Promise<void> {
  console.log('Iniciando tarea exitosa...');

  const result = await manager.run(
    {
      type: AnimationType.DOTS,
      text: 'Procesando datos',
      color: 'green',
      speed: 120,
    },
    () => simulateTask('Tarea exitosa', 3000),
  );

  console.log(`\nResultado: ${result}`);
}

// ── Tarea fallida con animacion ──
async function runFailingTask(): Promise<void> {
  console.log('\nIniciando tarea que fallara...');

  try {
    await manager.run(
      {
        type: AnimationType.SPINNER,
        color: 'red',
        speed: 80,
        prefix: '  Ejecutando... ',
      },
      () => simulateTask('Tarea fallida', 2000, true),
    );
  } catch (error) {
    console.log(`\nError capturado: ${(error as Error).message}`);
    console.log('La animacion se detuvo automaticamente al fallar.');
  }
}

// ── Ejecutar secuencia ──
async function main(): Promise<void> {
  console.log('=== Flujo asincrono con AnimationManager.run() ===\n');

  await runSuccessfulTask();
  await runFailingTask();

  manager.destroyAll();
  console.log('\n=== Ejemplo completado ===');
}

main().catch(console.error);
