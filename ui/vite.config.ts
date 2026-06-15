import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";

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
  resolve: {
    alias: {
      '@hivemind/grid': path.resolve('/home/younan/src/innovatek/HiveMind/packages/react/grid/dist/index.js'),
      '@hivemind/shared': path.resolve('/home/younan/src/innovatek/HiveMind/packages/react/shared/dist/index.js'),
    },
  },
  build: {
    sourcemap: false,
  },
  optimizeDeps: {
    force: true,
    include: ['@hivemind/grid', '@hivemind/shared'],
    esbuildOptions: {
      sourcemap: false,
      alias: {
        '@hivemind/grid': '/home/younan/src/innovatek/HiveMind/packages/react/grid/dist/index.js',
        '@hivemind/shared': '/home/younan/src/innovatek/HiveMind/packages/react/shared/dist/index.js',
      },
    },
  },
  server: {
    host: "::",
    watch: {
      usePolling: true,
      interval: 1000,
      ignored: ['/home/younan/src/innovatek/HiveMind/**'],
    },
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:2016',
        changeOrigin: true,
        secure: false,
        timeout: 120000,
      },
      '/loghub': {
        target: 'http://127.0.0.1:2016',
        changeOrigin: true,
        ws: true,
        secure: false,
      },
      '/terminalhub': {
        target: 'http://127.0.0.1:2016',
        changeOrigin: true,
        ws: true,
        secure: false,
      }
    }
  }
});
