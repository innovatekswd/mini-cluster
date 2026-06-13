import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const installHookSourceMap = JSON.stringify({
  version: 3,
  file: "installHook.js",
  sources: ["installHook.js"],
  sourcesContent: [""],
  names: [],
  mappings: "",
});

function installHookSourceMapFix() {
  return {
    name: "install-hook-sourcemap-fix",
    configureServer(server: any) {
      server.middlewares.use((req: any, res: any, next: any) => {
        if (req.url === "/installHook.js.map") {
          res.statusCode = 200;
          res.setHeader("Content-Type", "application/json");
          res.setHeader("Cache-Control", "no-cache");
          res.end(installHookSourceMap);
          return;
        }
        next();
      });
    },
  };
}

export default defineConfig({
  plugins: [installHookSourceMapFix(), tailwindcss(), reactRouter(), tsconfigPaths()],
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    force: true,
    esbuildOptions: {
      sourcemap: false,
    },
  },
  server: {
    host: "::",
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5147',
        changeOrigin: true,
        secure: false,
        timeout: 120000,
      },
      '/loghub': {
        target: 'http://127.0.0.1:5147',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      '/terminalhub': {
        target: 'http://127.0.0.1:5147',
        changeOrigin: true,
        ws: true,
        secure: false,
      }
    }
  }
});
