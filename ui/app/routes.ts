import { index, route, type RouteConfig } from "@react-router/dev/routes";

// Root-level routes use MainLayout as their wrapper
// Spec 027 aligned routes - clean rename, no backward compatibility redirects
export default [
  route("login", "routes/login.tsx"), // Login page (public)
  // Persistent layout route — wraps all authenticated pages so Layout persists across navigation
  route("", "routes/app.tsx", [
    index("routes/home.tsx"), // Overview/Home page at root
    route("apps", "routes/apps.tsx"), // Applications management
    route("apps/:appName?/:serviceName?", "routes/dashboard.tsx"), // App/Service workspace (renamed from /dashboard)
    route("services", "routes/services.tsx"),
    route("machines", "routes/infrastructure.tsx"), // Machines/Infrastructure view (renamed from /infrastructure)
    route("envs", "routes/settings/environments.tsx"), // Environments
    route("files", "routes/files.tsx"),
    route("explorer/:machineId?/*", "routes/explorer.tsx"), // Server File Explorer (multi-machine support)
    route("settings", "routes/settings.tsx"),
    route("monitor/:tab?", "routes/monitor.tsx"), // Task Manager / System Monitor (tab as path segment)
    route("terminal", "routes/terminal.tsx"), // PTY Terminal / REPL
    route("proxy", "routes/proxy.tsx"), // Reverse Proxy Management
    route("automation", "routes/scheduling.tsx"), // Automation/Cron (renamed from /scheduling)
    route("hierarchy", "routes/hierarchy.tsx"), // App Hierarchy & Snapshots
  ]),
] satisfies RouteConfig;
