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
    chunkSizeWarningLimit: 2000,
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vendor chunks - séparation optimisée
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
            if (id.includes("@mantine")) {
              return "mantine-vendor";
            }
            if (id.includes("@radix-ui")) {
              return "radix-vendor";
            }
            if (id.includes("axios")) {
              return "axios-vendor";
            }
            if (id.includes("i18next") || id.includes("react-i18next")) {
              return "i18n-vendor";
            }
            if (id.includes("@react-google-maps")) {
              return "google-maps-vendor";
            }
            if (id.includes("mapbox")) {
              return "mapbox-vendor";
            }
            if (id.includes("@react-oauth")) {
              return "oauth-vendor";
            }
            if (id.includes("classnames")) {
              return "utils-vendor";
            }
            return "vendor";
          }
          
          // Page-based chunks pour le code-splitting
          if (id.includes("/pages/")) {
            const pageName = id.split("/pages/")[1].split("/")[0];
            if (pageName === "dashboard") {
              return "dashboard-pages";
            }
            if (pageName === "admin") {
              return "admin-pages";
            }
            return `page-${pageName}`;
          }
          
          // Component chunks
          if (id.includes("/components/")) {
            const componentName = id.split("/components/")[1].split("/")[0];
            if (componentName === "forms") {
              return "forms-components";
            }
            if (componentName === "ui") {
              return "ui-components";
            }
            if (componentName === "auth") {
              return "auth-components";
            }
            return `component-${componentName}`;
          }
          
          // Services et hooks
          if (id.includes("/services/") || id.includes("/hooks/")) {
            return "services-hooks";
          }
          
          // Utils et contextes
          if (id.includes("/utils/") || id.includes("/context/")) {
            return "utils-context";
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