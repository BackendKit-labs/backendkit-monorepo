import { defineConfig } from 'tsup';

export default defineConfig({
  entry:     { index: 'src/index.ts' },
  format:    ['esm', 'cjs'],
  dts:       true,
  splitting: false,
  sourcemap: true,
  clean:     true,
  minify:    false,
  treeshake: true,
  outDir:    'dist',
  target:    'node18',
  platform:  'node',
  external:  ['@opentelemetry/api'],
});
