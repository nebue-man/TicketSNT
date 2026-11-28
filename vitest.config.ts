import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    environment: 'node',
    passWithNoTests: true,
    // Database tests build an in-memory Postgres with every migration (~1-5 s);
    // run in parallel, they compete for CPU, so 5 s is too tight.
    testTimeout: 30_000,
  },
})
