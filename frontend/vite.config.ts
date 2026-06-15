import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy API calls to backend
      '/api': 'http://127.0.0.1:8000',
      '/explain': 'http://127.0.0.1:8000',
      '/simulate': 'http://127.0.0.1:8000',
      '/copilot': 'http://127.0.0.1:8000'
    }
  }
})
