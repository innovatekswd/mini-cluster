import { index, route, type RouteConfig } from "@react-router/dev/routes";

// Root-level routes use MainLayout as their wrapper
// Spec 027 aligned routes - clean rename, no backward compatibility redirects
export default [
  route("login", "routes/login.tsx"), // Login page (public)
  // Persistent layout route — wraps all authenticated pages so Layout persists across navigation
  route("", "routes/app.tsx", [
    index("routes/home.tsx"), // Overview/Home page at root
    // Inspect group - machine-scoped: Overview, Files, Processes, Terminal
    route("inspect/:machineId?", "routes/inspect.tsx", [
      index("routes/inspect._index.tsx"), // Redirects to /inspect/local/overview
      route("overview", "routes/inspect.overview.tsx"), // Real-time operations overview
      route("cockpit", "routes/inspect.cockpit.tsx"), // Redirect /inspect/cockpit → /inspect/overview
      route("files/*", "routes/inspect.files.tsx"), // File Explorer (machine-scoped)
      route("processes", "routes/inspect.processes.tsx"), // Process Manager (machine-scoped)
      route("terminal", "routes/inspect.terminal.tsx"), // Terminal session (machine-scoped)
      route("history", "routes/inspect.history.tsx"), // Historical metrics
      route("events", "routes/inspect.events.tsx"), // System events log
    ]),
    route("apps", "routes/apps.tsx"), // Applications management
    route("apps/:appName?/:serviceName?", "routes/dashboard.tsx"), // App/Service workspace
    route("services", "routes/services.tsx"),
    route("machines", "routes/infrastructure.tsx"), // Machines/Infrastructure view
    route("envs", "routes/settings/environments.tsx"), // Environments
    route("explorer/:machineId?/*", "routes/explorer.tsx"), // Server File Explorer (multi-machine support)
    route("settings", "routes/settings.tsx"),
    route("terminal", "routes/terminal.tsx"), // PTY Terminal / REPL
    route("proxy", "routes/proxy.tsx"), // Reverse Proxy Management
    route("automation", "routes/scheduling.tsx"), // Automation/Cron
    route("hierarchy", "routes/hierarchy.tsx"), // App Hierarchy & Snapshots
  ]),
] satisfies RouteConfig;
