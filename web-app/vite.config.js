import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    proxy: {
      '/api': {
        target: 'https://yukpo-backend-376093909298.europe-west1.run.app',
        changeOrigin: true,
      },
      '/auth': {
        target: 'https://yukpo-backend-376093909298.europe-west1.run.app',
        changeOrigin: true,
      },
    },
  },
})
