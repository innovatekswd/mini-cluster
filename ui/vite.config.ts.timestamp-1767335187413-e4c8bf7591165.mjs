// vite.config.ts
import { reactRouter } from "file:///home/younan/innovatek/src/mini-cluster/minicluster-ui/node_modules/@react-router/dev/dist/vite.js";
import tailwindcss from "file:///home/younan/innovatek/src/mini-cluster/minicluster-ui/node_modules/@tailwindcss/vite/dist/index.mjs";
import { defineConfig } from "file:///home/younan/innovatek/src/mini-cluster/minicluster-ui/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///home/younan/innovatek/src/mini-cluster/minicluster-ui/node_modules/vite-tsconfig-paths/dist/index.js";
var vite_config_default = defineConfig({
  plugins: [tailwindcss(), reactRouter(), tsconfigPaths()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:5147",
        changeOrigin: true,
        secure: false
      },
      "/loghub": {
        target: "http://localhost:5147",
        changeOrigin: true,
        ws: true,
        // 👈 required for SignalR/WebSockets
        secure: false
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS95b3VuYW4vaW5ub3ZhdGVrL3NyYy9taW5pLWNsdXN0ZXIvbWluaWNsdXN0ZXItdWlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3lvdW5hbi9pbm5vdmF0ZWsvc3JjL21pbmktY2x1c3Rlci9taW5pY2x1c3Rlci11aS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS95b3VuYW4vaW5ub3ZhdGVrL3NyYy9taW5pLWNsdXN0ZXIvbWluaWNsdXN0ZXItdWkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyByZWFjdFJvdXRlciB9IGZyb20gXCJAcmVhY3Qtcm91dGVyL2Rldi92aXRlXCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcblxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MoKSwgcmVhY3RSb3V0ZXIoKSwgdHNjb25maWdQYXRocygpXSxcbiAgc2VydmVyOiB7XG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vbG9jYWxob3N0OjUxNDcnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgJy9sb2dodWInOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly9sb2NhbGhvc3Q6NTE0NycsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgd3M6IHRydWUsIC8vIFx1RDgzRFx1REM0OCByZXF1aXJlZCBmb3IgU2lnbmFsUi9XZWJTb2NrZXRzXG4gICAgICAgIHNlY3VyZTogZmFsc2VcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pO1xuXG5cblxuXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW9WLFNBQVMsbUJBQW1CO0FBQ2hYLE9BQU8saUJBQWlCO0FBQ3hCLFNBQVMsb0JBQW9CO0FBQzdCLE9BQU8sbUJBQW1CO0FBRzFCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxZQUFZLEdBQUcsWUFBWSxHQUFHLGNBQWMsQ0FBQztBQUFBLEVBQ3ZELFFBQVE7QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNMLFFBQVE7QUFBQSxRQUNOLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxXQUFXO0FBQUEsUUFDVCxRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxJQUFJO0FBQUE7QUFBQSxRQUNKLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
