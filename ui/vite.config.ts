import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// KeySign UI. Localhost only on purpose: nothing about the demo should be
// reachable from the venue network. Change the port with --port.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, host: '127.0.0.1', strictPort: true },
})
