import { defineConfig } from 'vitest/config'

// Pin NODE_ENV before Vitest resolves the config: the caller's shell may export NODE_ENV=production
// (Windows dev machines do), and deps that branch on it would otherwise see a production build.
if (process.env.VITEST) process.env.NODE_ENV = 'test'

export default defineConfig({
  test: {
    include: ['test/**/*.test.js'],
    globals: false,
    environment: 'node',
    pool: 'forks',
    isolate: true,
    reporters: ['default'],
    // Keep the suite independent of the caller's shell: fork owners run under NODE_ENV=production.
    env: { NODE_ENV: 'test' }
  }
})
