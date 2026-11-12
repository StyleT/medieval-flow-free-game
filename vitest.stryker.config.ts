import { defineConfig, mergeConfig } from 'vitest/config'
import base from './vite.config.ts'

/**
 * Vitest config for Stryker only. Mutants live in src/engine and two pure audio modules, and their
 * own tests own that behaviour, so each mutant runs just those suites (about 1 s) instead of the
 * whole app suite with jsdom (about 11 s), which made a full run take over 15 minutes.
 */
export default mergeConfig(
  base,
  defineConfig({
    test: {
      include: ['src/engine/**/*.test.ts', 'src/audio/soundEvents.test.ts', 'src/audio/settings.test.ts'],
      environment: 'node',
      // Stryker's coverage instrumentation makes tests ~10x slower (more on CI runners), which pushed
      // generator tests past Vitest's 5 s default. Hung mutants are still cut off by Stryker's own
      // per-mutant timeout (`timeoutMS` plus a factor of each test's measured time).
      testTimeout: 60_000,
    },
  }),
)
