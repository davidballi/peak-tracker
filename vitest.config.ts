import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.test.ts'],
    alias: {
      '@tauri-apps/plugin-sql': path.resolve(__dirname, 'src/__mocks__/@tauri-apps/plugin-sql.ts'),
    },
  },
})
