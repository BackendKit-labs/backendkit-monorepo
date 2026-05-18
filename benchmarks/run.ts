/**
 * Runs all benchmarks sequentially and prints results.
 * Usage: tsx run.ts
 */
import { run as runCB }         from './circuit-breaker/vs-opossum.bench.js';
import { run as runVsNeverthrow } from './result/vs-neverthrow.bench.js';
import { run as runVsTryCatch }   from './result/vs-trycatch.bench.js';

console.log('# BackendKit Labs — Benchmark Suite');
console.log(`Node ${process.version}  |  ${new Date().toISOString()}\n`);

console.log('\n## Circuit Breaker');
await runCB();

console.log('\n## Result — vs neverthrow');
await runVsNeverthrow();

console.log('\n## Result — vs try/catch');
await runVsTryCatch();
