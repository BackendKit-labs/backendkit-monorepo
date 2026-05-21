import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
    'stores/sql': 'src/persistence/sql-adapter.ts',
    'stores/redis': 'src/persistence/redis-store.ts',
    'locks/redis': 'src/lock/redis-lock.ts',
    'cli/index': 'src/cli/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: false,
  treeshake: true,
  outDir: 'dist',
  target: 'node18',
  platform: 'node',
  esbuildOptions(options) {
    options.keepNames = true;
  },
});
