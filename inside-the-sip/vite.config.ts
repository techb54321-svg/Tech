import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'

// WebXR immersive sessions require a secure context (HTTPS), so we always
// serve over TLS via basic-ssl — even in dev. The cert is self-signed, so the
// Quest browser will show a one-time warning you must accept (see README).
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    // Bind to all interfaces so the headset can reach the dev machine over LAN.
    host: '0.0.0.0',
    port: 5173,
    https: {},
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    https: {},
  },
})
