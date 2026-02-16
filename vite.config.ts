import { defineConfig } from "vite";
import type { Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

/**
 * Rewrites /app/* requests (without file extensions) to /app/index.html
 * so React Router handles client-side routing under the /app sub-path.
 */
function appSpaFallback(): Plugin {
  return {
    name: "app-spa-fallback",
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (req.url && req.url.startsWith("/app") && !path.extname(req.url)) {
          req.url = "/app/index.html";
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [appSpaFallback(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, "index.html"),
        app: path.resolve(__dirname, "app/index.html"),
      },
    },
  },
});
