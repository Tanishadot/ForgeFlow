import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Proxy API calls to backend
      '/api': 'http://localhost:8000',
      '/explain': 'http://localhost:8000',
      '/simulate': 'http://localhost:8000',
      '/copilot': 'http://localhost:8000'
    }
  }
})
