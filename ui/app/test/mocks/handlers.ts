import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

// Mock data
export const mockApps = [
  {
    id: "app-1",
    name: "Test App 1",
    status: "Running",
    command: "node",
    args: "server.js",
    workingDirectory: "/apps/test1",
  },
  {
    id: "app-2",
    name: "Test App 2",
    status: "Stopped",
    command: "python",
    args: "main.py",
    workingDirectory: "/apps/test2",
  },
];

export const mockMachines = [
  {
    id: "machine-1",
    name: "Server 1",
    hostname: "server1.local",
    status: "Online",
  },
  {
    id: "machine-2",
    name: "Server 2",
    hostname: "server2.local",
    status: "Offline",
  },
];

export const mockProxyRoutes = [
  {
    id: 1,
    name: "API Gateway",
    sourcePath: "/api",
    targetUrl: "http://localhost:3001",
    isEnabled: true,
    isHealthy: true,
  },
];

// API handlers
export const handlers = [
  // Apps
  http.get("/api/services", () => {
    return HttpResponse.json(mockApps);
  }),

  http.get("/api/services/:id", ({ params }) => {
    const app = mockApps.find((a) => a.id === params.id);
    if (!app) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(app);
  }),

  http.get("/api/services/:id/exec/status", ({ params }) => {
    const app = mockApps.find((a) => a.id === params.id);
    return HttpResponse.json({ status: app?.status ?? "Unknown" });
  }),

  http.post("/api/services/:id/exec/:action", ({ params }) => {
    return HttpResponse.json({ success: true });
  }),

  // Machines
  http.get("/api/machines", () => {
    return HttpResponse.json(mockMachines);
  }),

  http.get("/api/machines/:id", ({ params }) => {
    const machine = mockMachines.find((m) => m.id === params.id);
    if (!machine) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(machine);
  }),

  // Proxy
  http.get("/api/proxy/routes", () => {
    return HttpResponse.json(mockProxyRoutes);
  }),

  http.get("/api/proxy/settings", () => {
    return HttpResponse.json({
      defaultTimeout: 30000,
      maxRetries: 3,
    });
  }),

  // Health
  http.get("/api/health", () => {
    return HttpResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
    });
  }),
];

// Create server instance for tests
export const server = setupServer(...handlers);
