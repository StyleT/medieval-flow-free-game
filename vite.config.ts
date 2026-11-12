import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // The pxl skill (dev tool, untracked) ships its own node:test suites.
  test: { exclude: [...configDefaults.exclude, '.claude/**', 'art/**'] },
})
