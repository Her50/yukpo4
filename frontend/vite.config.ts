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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          "react-vendor": ["react", "react-dom"],
          "router-vendor": ["react-router-dom"],
          "ui-vendor": ["@headlessui/react", "@heroicons/react"],
          "ui-components": ["@mantine/core", "@mantine/form", "@radix-ui/react-dialog", "@radix-ui/react-tabs", "@radix-ui/react-tooltip"],
          "utils-vendor": ["axios", "i18next", "react-i18next"],
          "maps-vendor": ["@react-google-maps/api", "@mapbox/mapbox-gl-geocoder"]
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
