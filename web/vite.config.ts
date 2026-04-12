import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
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
