import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'nestjs/index': 'src/nestjs/index.ts',
  },
  format: ['esm', 'cjs'],
  target: 'node18',
  platform: 'node',
  dts: true,
  sourcemap: true,
  clean: true,
  splitting: false,
  external: [
    '@backendkit-labs/result',
    '@backendkit-labs/observability',
    '@nestjs/common',
    '@nestjs/core',
    'rxjs',
  ],
});
