import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative asset paths, so the build works under any GitHub Pages path
  // (e.g. https://<user>.github.io/keu/). Routing uses the URL hash.
  base: './',
})
