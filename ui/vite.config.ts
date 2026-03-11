import { reactRouter } from "@react-router/dev/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";


export default defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
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