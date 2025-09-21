import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  define: {
    global: 'globalThis',
  },
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        // Ajouter un timestamp pour forcer l'invalidation du cache
        entryFileNames: `assets/[name]-${Date.now()}.[hash].js`,
        chunkFileNames: `assets/[name]-${Date.now()}.[hash].js`,
        assetFileNames: `assets/[name]-${Date.now()}.[hash].[ext]`
      }
    }
  },
  base: "/",
  server: {
    port: 3000,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/auth': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/services': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
      '/healthz': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
      },
    },
  }
});