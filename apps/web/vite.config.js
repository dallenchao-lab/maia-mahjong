import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { coachHandler } from './api/coach.js'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // Serve the coach API route during local `vite dev`
    {
      name: 'api-coach-dev',
      configureServer(server) {
        server.middlewares.use('/api/coach', coachHandler)
      }
    }
  ],
})
