import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { abiPlugin } from './vite-plugin-abi'

export default defineConfig({
  plugins: [react(), abiPlugin()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: Number(process.env.VITE_PORT) || 3000,
  },
})
