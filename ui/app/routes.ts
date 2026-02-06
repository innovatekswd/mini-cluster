import { index, route, type RouteConfig } from "@react-router/dev/routes";

// Root-level routes use MainLayout as their wrapper
// Path-based routing: /dashboard/:appName?/:serviceName?
export default [
  route("login", "routes/login.tsx"), // Login page (public)
  index("routes/home.tsx"), // Dashboard/Home page at root
  route("apps", "routes/apps.tsx"), // Applications management
  // Dashboard with optional path segments - single route file handles all variations
  route("dashboard/:appName?/:serviceName?", "routes/dashboard.tsx"),
  route("services", "routes/services.tsx"),
  route("infrastructure", "routes/infrastructure.tsx"), // Phase 5: Dual-view (Machines/Apps)
  route("envs", "routes/settings/environments.tsx"), // Environments
  route("files", "routes/files.tsx"),
  route("explorer", "routes/explorer.tsx"), // Server File Explorer
  route("settings", "routes/settings.tsx"),
  route("monitor", "routes/monitor.tsx"), // Task Manager / System Monitor
  route("terminal", "routes/terminal.tsx"), // PTY Terminal / REPL
  route("proxy", "routes/proxy.tsx"), // Reverse Proxy Management
] satisfies RouteConfig;
