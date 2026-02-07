# 016 — Discovery & Services Architecture

> **Status:** 📋 Spec Ready  
> **Priority:** HIGH — Foundation for clustering, agent bootstrapping, and service federation  
> **Effort:** 2 weeks (discovery + well-known endpoints)  
> **Dependencies:** 010 Multi-Node Cluster (Phase 0-1 done)  
> **Last Updated:** February 7, 2026

---

## Overview

MiniCluster exposes three core services — **Identity**, **Config**, and **Registry** — discoverable via a standard well-known endpoint. This follows the OpenID Connect discovery pattern: clients connect to a single URL, discover all service endpoints, and self-configure.

By default, all three services run inside the same MiniCluster binary. They CAN be split into separate instances for scale or organizational reasons. The discovery endpoint makes this transparent.

```
┌─────────────────────────────────────────────────────────────┐
│                     MiniCluster Server                       │
│                     (single binary)                          │
│                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│   │   Identity   │  │    Config    │  │    Registry      │  │
│   │              │  │              │  │                  │  │
│   │  WHO can     │  │  WHAT should │  │  HOW to get      │  │
│   │  do things   │  │  run WHERE   │  │  the bits        │  │
│   │              │  │              │  │                  │  │
│   │ • OIDC       │  │ • App defs   │  │ • App bundles    │  │
│   │ • Users      │  │ • Env vars   │  │ • Versions       │  │
│   │ • Roles      │  │ • Desired    │  │ • Downloads      │  │
│   │ • JWT/JWKS   │  │   state      │  │ • Manifests      │  │
│   │ • API keys   │  │ • Labels     │  │                  │  │
│   └──────────────┘  └──────────────┘  └──────────────────┘  │
│                           │                                  │
│         GET /.well-known/minicluster-configuration           │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Design Principles

1. **One URL to rule them all.** An agent, CLI, or UI only needs the controller URL. Everything else is discovered.
2. **Same binary, same server (default).** No microservices overhead. All three services share the same process, port, and database.
3. **Splittable when needed.** Each service endpoint in discovery can point to a different URL. A large deployment could run Identity on a corporate OIDC provider, Registry on an S3-backed server, and Config on the controller.
4. **Standard over custom.** Identity follows OIDC. Discovery follows well-known URI convention (RFC 8615). Package format uses standard ZIP + JSON manifest.
5. **Pull over push.** Agents pull their desired state from Config, pull packages from Registry, and validate tokens from Identity. No push needed.

---

## Discovery Endpoint

### GET `/.well-known/minicluster-configuration`

```json
{
  "issuer": "https://controller.internal:5147",
  "version": "1.0.0",
  "cluster_name": "production",
  
  "identity_endpoint": "https://controller.internal:5147",
  "config_endpoint": "https://controller.internal:5147",
  "registry_endpoint": "https://controller.internal:5147",

  "openid_configuration": "https://controller.internal:5147/.well-known/openid-configuration",
  
  "api_endpoints": {
    "apps": "/api/apps",
    "services": "/api/services",
    "machines": "/api/machines",
    "cluster": "/api/cluster",
    "config": "/api/config",
    "registry": "/api/registry"
  },

  "realtime": {
    "log_hub": "/loghub",
    "terminal_hub": "/terminalhub"
  },

  "capabilities": [
    "identity",
    "config",
    "registry",
    "proxy",
    "terminal",
    "metrics"
  ]
}
```

### How Clients Use Discovery

```
                    Client (Agent / CLI / UI)
                              │
                              ▼
              GET /.well-known/minicluster-configuration
                              │
                 ┌────────────┼────────────┐
                 ▼            ▼            ▼
            Identity       Config      Registry
           endpoint       endpoint     endpoint
                 │            │            │
                 ▼            │            │
          Authenticate        │            │
          (OIDC flow)         │            │
              │ JWT           │            │
              ├───────────────▼            │
              │    Pull desired state      │
              │    GET /api/config/         │
              │    nodes/{id}/desired-state │
              │               │            │
              │               ▼            │
              │    New app or new version? │
              │               │            ▼
              │               │    Download package
              │               │    GET /api/registry/
              │               │    apps/{id}/download
              │               │            │
              │               ▼            ▼
              │         Apply locally
              │         Create apps, start services
              ▼
         All API calls include
         Authorization: Bearer {JWT}
```

---

## Agent Bootstrap Flow

```
┌───────────────────────────────────────────────────────────────┐
│                    AGENT BOOTSTRAP                            │
│                                                               │
│  1. Agent starts with ONE parameter:                          │
│     minicluster --agent --controller-url https://ctrl:5147    │
│                                                               │
│  2. Discovery                                                 │
│     GET https://ctrl:5147/.well-known/minicluster-config      │
│     → { identity_endpoint, config_endpoint, registry_endpoint}│
│                                                               │
│  3. Authenticate (OIDC Client Credentials)                    │
│     POST {identity}/connect/token                             │
│     { grant_type: client_credentials,                         │
│       client_id: "agent-prod-1",                              │
│       client_secret: "sk_agent_xxxx" }                        │
│     → { access_token: "eyJ...", expires_in: 3600 }            │
│                                                               │
│  4. Register / Announce                                       │
│     POST {config}/api/cluster/register                        │
│     Authorization: Bearer eyJ...                              │
│     { name, endpoint, systemInfo, labels }                    │
│     → { machineId: "guid" }                                   │
│                                                               │
│  5. Pull Desired State                                        │
│     GET {config}/api/config/nodes/{machineId}/desired-state   │
│     → { apps: [...], env_vars: {...} }                        │
│                                                               │
│  6. Download Packages (if new apps / new versions)            │
│     GET {registry}/api/registry/packages/{id}/download        │
│     → ZIP bundle with manifest.json + files                   │
│                                                               │
│  7. Apply — create apps, start services, report status        │
│                                                               │
│  8. Loop — heartbeat + poll for changes every 30s             │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## CLI Bootstrap Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    CLI BOOTSTRAP                              │
│                                                               │
│  1. First-time connection:                                    │
│     mc connect https://controller:5147                        │
│                                                               │
│  2. Discovery                                                 │
│     GET /.well-known/minicluster-configuration                │
│     CLI stores endpoints in ~/.minicluster/config.yaml        │
│                                                               │
│  3. Login                                                     │
│     mc login                                                  │
│     → OIDC Device Authorization Flow                          │
│     → Opens browser: {identity}/connect/device                │
│     → User approves, CLI polls for token                      │
│     → Token stored in ~/.minicluster/credentials              │
│                                                               │
│  4. All subsequent commands use discovered endpoints          │
│     mc apps list    → GET {config}/api/apps                   │
│     mc registry push → POST {registry}/api/registry/upload    │
│     mc cluster status → GET {config}/api/cluster/status       │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## UI Bootstrap Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    UI BOOTSTRAP                               │
│                                                               │
│  1. React app loads from MiniCluster static files             │
│                                                               │
│  2. On mount:                                                 │
│     GET /.well-known/minicluster-configuration                │
│     Store in React context / Zustand                          │
│                                                               │
│  3. Login                                                     │
│     OIDC Authorization Code + PKCE flow                       │
│     Redirect to {identity}/connect/authorize                  │
│     User logs in → redirect back with code                    │
│     Exchange code for tokens at {identity}/connect/token      │
│                                                               │
│  4. All API calls resolve endpoints from discovery            │
│     No hardcoded /api/* paths in the UI                       │
│     Services could be on different hosts                      │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## Service Separation Scenarios

### Default: Everything Together

```
minicluster-configuration:
  identity_endpoint: "https://myserver:5147"
  config_endpoint:   "https://myserver:5147"
  registry_endpoint: "https://myserver:5147"
```

One server, one port, one binary. This is 95% of deployments.

### Scaled: Shared Identity

```
minicluster-configuration:
  identity_endpoint: "https://identity.company.com"     ← corporate OIDC
  config_endpoint:   "https://minicluster.internal:5147" ← controller
  registry_endpoint: "https://minicluster.internal:5147" ← controller
```

Company already has Keycloak/Entra ID. MiniCluster trusts its tokens via JWKS validation.

### Large: Full Split

```
minicluster-configuration:
  identity_endpoint: "https://identity.company.com"
  config_endpoint:   "https://minicluster-ctrl.internal:5147"
  registry_endpoint: "https://registry.internal:5148"   ← S3-backed artifact store
```

Each service runs independently. Agents and CLI don't care — they discover and connect.

---

## Configuration (appsettings.json)

```json
{
  "Discovery": {
    "ClusterName": "production",
    "IdentityEndpoint": "",
    "ConfigEndpoint": "",
    "RegistryEndpoint": "",
    "Capabilities": ["identity", "config", "registry", "proxy", "terminal", "metrics"]
  }
}
```

When endpoints are empty, they default to the current server's URL (same-server mode).

---

## Implementation

### DiscoveryController

```csharp
[ApiController]
[AllowAnonymous]
[Route(".well-known")]
public class DiscoveryController : ControllerBase
{
    [HttpGet("minicluster-configuration")]
    public ActionResult GetConfiguration()
    {
        var baseUrl = $"{Request.Scheme}://{Request.Host}";

        return Ok(new
        {
            issuer = _options.IdentityEndpoint.OrDefault(baseUrl),
            version = GetVersion(),
            cluster_name = _options.ClusterName,
            identity_endpoint = _options.IdentityEndpoint.OrDefault(baseUrl),
            config_endpoint = _options.ConfigEndpoint.OrDefault(baseUrl),
            registry_endpoint = _options.RegistryEndpoint.OrDefault(baseUrl),
            openid_configuration = $"{_options.IdentityEndpoint.OrDefault(baseUrl)}/.well-known/openid-configuration",
            api_endpoints = new { ... },
            realtime = new { ... },
            capabilities = _options.Capabilities
        });
    }
}
```

### Acceptance Criteria

- [ ] `GET /.well-known/minicluster-configuration` returns valid discovery document
- [ ] All three service URLs default to same server when not configured
- [ ] Agent can bootstrap from discovery (authenticate → pull config → download packages)
- [ ] CLI can bootstrap from discovery (`mc connect <url>`)
- [ ] UI fetches discovery on mount and resolves all endpoints
- [ ] External identity provider works when `IdentityEndpoint` is set to external URL
- [ ] Discovery response includes `capabilities` list for feature negotiation

---

## Related Specs

| Spec | Relationship |
|------|-------------|
| [017 — Identity / OIDC](../017-identity-oidc/spec.md) | Identity service — OIDC endpoints, user management, JWKS |
| [018 — Config Service](../018-config-service/spec.md) | Config service — desired state, env vars, app definitions |
| [019 — Registry Service](../019-registry/spec.md) | Registry service — app packages, versions, downloads |
| [010 — Multi-Node Cluster](../010-multi-node-cluster/spec.md) | Cluster uses discovery for agent bootstrap |
