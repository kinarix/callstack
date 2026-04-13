import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const tauriConf = JSON.parse(readFileSync(resolve(__dirname, '../src-tauri/tauri.conf.json'), 'utf-8'));
const appVersion = tauriConf.version ?? process.env.npm_package_version ?? '0.0.0';

export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {                                                                                       
      output: {
        manualChunks(id) {                                                                                 
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react';
          }
          if (id.includes('@codemirror') || id.includes('@uiw/react-codemirror') || id.includes('@lezer'))
    {
            return 'codemirror';
          }
        },
      },
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
  clearScreen: false,
})
