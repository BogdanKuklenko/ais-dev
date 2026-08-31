import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        output: {
          // Function form (object form of manualChunks is gone in later Vite).
          // Split vendor so a UI-string change does not re-download React/PDF/xlsx.
          manualChunks(id: string) {
            const n = id.replace(/\\/g, '/');
            if (!n.includes('/node_modules/')) return undefined;
            if (n.includes('/react-dom/') || n.includes('/react/') || n.includes('/scheduler/')) {
              return 'vendor-react';
            }
            if (n.includes('jspdf') || n.includes('html2canvas') || n.includes('purify')) {
              return 'vendor-pdf';
            }
            if (n.includes('lucide-react') || n.includes('/motion/') || n.includes('framer-motion')) {
              return 'vendor-ui';
            }
            if (n.includes('/xlsx/')) return 'vendor-xlsx';
            return 'vendor';
          },
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
