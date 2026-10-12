import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';

// SWC (not esbuild) so NestJS decorator metadata — and therefore dependency injection — works in tests.
export default defineConfig({
  plugins: [tsconfigPaths(), swc.vite({ module: { type: 'es6' } })],
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
    env: {
      DATABASE_URL: 'postgresql://mac@localhost:5432/nexus_test?schema=public',
      NODE_ENV: 'test',
      GEMINI_API_KEY: '', // tests use the non-AI fallbacks so results are predictable
      JWT_ACCESS_SECRET: 'test-secret',
      PLATFORM_FEE_BP: '1500',
      SQUAD_SECRET_KEY: 'sandbox_test_key',
    },
  },
});
