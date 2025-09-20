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
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react") || id.includes("react-dom")) {
              return "react-vendor";
            }
            if (id.includes("react-router")) {
              return "router-vendor";
            }
            if (id.includes("@headlessui") || id.includes("@heroicons")) {
              return "ui-vendor";
            }
            if (id.includes("@mantine") || id.includes("@radix-ui")) {
              return "ui-components";
            }
            if (id.includes("axios") || id.includes("i18next")) {
              return "utils-vendor";
            }
            if (id.includes("@react-google-maps") || id.includes("mapbox")) {
              return "maps-vendor";
            }
            return "vendor";
          }
          if (id.includes("/pages/")) {
            const pageName = id.split("/pages/")[1].split("/")[0];
            return `page-${pageName}`;
          }
          if (id.includes("/components/")) {
            const componentName = id.split("/components/")[1].split("/")[0];
            return `component-${componentName}`;
          }
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