import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_AUTH_E2E_TEST_EMAIL': JSON.stringify(process.env.AUTH_E2E_TEST_EMAIL || ''),
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: false,
    restoreMocks: true,
  },
})
