import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    minify: true,
    treeshake: true,
    outDir: 'dist',
    target: 'node18',
    platform: 'node',
  },
  {
    entry: ['src/bin/demo.ts'],
    format: ['esm'],
    splitting: false,
    sourcemap: false,
    clean: false,
    minify: false,
    outDir: 'dist/bin',
    target: 'node18',
    platform: 'node',
    banner: {
      js: '#!/usr/bin/env node',
    },
  },
]);
