import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('pdfmake')) {
            return 'pdfmake';
          }
          if (id.includes('recharts')) {
            return 'charts';
          }
          if (id.includes('leaflet') || id.includes('react-leaflet')) {
            return 'maps';
          }
          if (id.includes('@hello-pangea/dnd')) {
            return 'drag-drop';
          }
          if (id.includes('framer-motion')) {
            return 'motion';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'query';
          }
          if (id.includes('react-router-dom') || id.includes('@remix-run/router')) {
            return 'router';
          }
          if (
            id.includes('react-dom') ||
            id.includes('react/jsx-runtime') ||
            id.includes('/react/')
          ) {
            return 'react-core';
          }
          if (id.includes('@phosphor-icons')) {
            return 'icons';
          }
          if (id.includes('read-excel-file')) {
            return 'excel';
          }
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    }
  }
})
