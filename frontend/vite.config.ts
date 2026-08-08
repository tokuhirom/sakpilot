/// <reference types="vitest/config" />
import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ はPlaywright管轄(npm run test:e2e)なのでvitestからは除外する
    exclude: ['node_modules/**', 'e2e/**'],
  },
})
