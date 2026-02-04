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
        target: "http://127.0.0.1:5147",
        changeOrigin: true,
        secure: false
      },
      "/loghub": {
        target: "http://127.0.0.1:5147",
        changeOrigin: true,
        ws: true,
        secure: false
      },
      "/terminalhub": {
        target: "http://127.0.0.1:5147",
        changeOrigin: true,
        ws: true,
        secure: false
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS95b3VuYW4vaW5ub3ZhdGVrL3NyYy9taW5pLWNsdXN0ZXIvbWluaWNsdXN0ZXItdWlcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL3lvdW5hbi9pbm5vdmF0ZWsvc3JjL21pbmktY2x1c3Rlci9taW5pY2x1c3Rlci11aS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS95b3VuYW4vaW5ub3ZhdGVrL3NyYy9taW5pLWNsdXN0ZXIvbWluaWNsdXN0ZXItdWkvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyByZWFjdFJvdXRlciB9IGZyb20gXCJAcmVhY3Qtcm91dGVyL2Rldi92aXRlXCI7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSBcIkB0YWlsd2luZGNzcy92aXRlXCI7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHRzY29uZmlnUGF0aHMgZnJvbSBcInZpdGUtdHNjb25maWctcGF0aHNcIjtcblxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbdGFpbHdpbmRjc3MoKSwgcmVhY3RSb3V0ZXIoKSwgdHNjb25maWdQYXRocygpXSxcbiAgc2VydmVyOiB7XG4gICAgcHJveHk6IHtcbiAgICAgICcvYXBpJzoge1xuICAgICAgICB0YXJnZXQ6ICdodHRwOi8vMTI3LjAuMC4xOjUxNDcnLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgJy9sb2dodWInOiB7XG4gICAgICAgIHRhcmdldDogJ2h0dHA6Ly8xMjcuMC4wLjE6NTE0NycsXG4gICAgICAgIGNoYW5nZU9yaWdpbjogdHJ1ZSxcbiAgICAgICAgd3M6IHRydWUsXG4gICAgICAgIHNlY3VyZTogZmFsc2UsXG4gICAgICB9LFxuICAgICAgJy90ZXJtaW5hbGh1Yic6IHtcbiAgICAgICAgdGFyZ2V0OiAnaHR0cDovLzEyNy4wLjAuMTo1MTQ3JyxcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxuICAgICAgICB3czogdHJ1ZSxcbiAgICAgICAgc2VjdXJlOiBmYWxzZSxcbiAgICAgIH1cbiAgICB9XG4gIH1cbn0pOyJdLAogICJtYXBwaW5ncyI6ICI7QUFBb1YsU0FBUyxtQkFBbUI7QUFDaFgsT0FBTyxpQkFBaUI7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsT0FBTyxtQkFBbUI7QUFHMUIsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsU0FBUyxDQUFDLFlBQVksR0FBRyxZQUFZLEdBQUcsY0FBYyxDQUFDO0FBQUEsRUFDdkQsUUFBUTtBQUFBLElBQ04sT0FBTztBQUFBLE1BQ0wsUUFBUTtBQUFBLFFBQ04sUUFBUTtBQUFBLFFBQ1IsY0FBYztBQUFBLFFBQ2QsUUFBUTtBQUFBLE1BQ1Y7QUFBQSxNQUNBLFdBQVc7QUFBQSxRQUNULFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLElBQUk7QUFBQSxRQUNKLFFBQVE7QUFBQSxNQUNWO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQSxRQUNkLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLElBQUk7QUFBQSxRQUNKLFFBQVE7QUFBQSxNQUNWO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
