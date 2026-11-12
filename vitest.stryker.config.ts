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
    },
  }),
)
