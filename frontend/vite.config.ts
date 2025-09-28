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
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    minify: false,
    chunkSizeWarningLimit: 3000,
    rollupOptions: {
      output: {
        entryFileNames: `assets/[name]-${Date.now()}.js`,
        chunkFileNames: `assets/[name]-${Date.now()}.js`,
        assetFileNames: `assets/[name]-${Date.now()}.[ext]`,
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["react-router-dom"],
          "ui-vendor": ["@headlessui/react", "@heroicons/react"],
          "mantine-vendor": ["@mantine/core", "@mantine/form", "@mantine/hooks"],
          "radix-vendor": ["@radix-ui/react-dialog", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          "utils-vendor": ["axios", "i18next", "react-i18next"],
          "maps-vendor": ["@react-google-maps/api", "@mapbox/mapbox-gl-geocoder"],
          "lucide-vendor": ["lucide-react"],
          "charts-vendor": ["recharts"],
          "framer-vendor": ["framer-motion"],
          "toast-vendor": ["react-hot-toast", "react-toastify"]
        }
      }
    }
  },
  base: "/",
  server: {
    port: 3000,
    host: true
  }
});
