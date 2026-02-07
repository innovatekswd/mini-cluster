# 017 — Identity Service (OpenID Connect)

> **Status:** 📋 Spec Ready  
> **Priority:** HIGH — Foundation for authentication across all clients  
> **Effort:** 3 weeks (OIDC integration + migration from custom JWT)  
> **Dependencies:** 003 Authentication (current custom JWT to be replaced)  
> **Last Updated:** February 7, 2026

---

## Overview

MiniCluster Identity is a **full OpenID Connect provider** built on [OpenIddict](https://openiddict.com/). It replaces the current custom JWT implementation with standards-based authentication. Every client — UI, CLI, agent, external integration — authenticates through OIDC flows.

```
┌───────────────────────────────────────────────────────────────┐
│                     Identity Service                          │
│                                                               │
│   ┌──────────────────────────────────────────────────────┐    │
│   │               OpenID Connect Provider                │    │
│   │               (OpenIddict on ASP.NET)                │    │
│   │                                                      │    │
│   │   Endpoints:                                         │    │
│   │   ├── /.well-known/openid-configuration              │    │
│   │   ├── /connect/authorize    (Auth Code + PKCE)       │    │
│   │   ├── /connect/token        (all grants)             │    │
│   │   ├── /connect/device       (Device Authorization)   │    │
│   │   ├── /connect/userinfo     (user claims)            │    │
│   │   ├── /connect/introspect   (token validation)       │    │
│   │   ├── /connect/revocation   (token revocation)       │    │
│   │   └── /.well-known/jwks     (public keys)            │    │
│   └──────────────────────────────────────────────────────┘    │
│                                                               │
│   ┌────────────────┐  ┌───────────────┐  ┌───────────────┐   │
│   │     Users      │  │  Applications │  │    Scopes     │   │
│   │                │  │  (OIDC        │  │               │   │
│   │ • admin        │  │   clients)    │  │ • openid      │   │
│   │ • operators    │  │               │  │ • profile     │   │
│   │ • viewers      │  │ • mc-ui       │  │ • mc:admin    │   │
│   │ • agents       │  │ • mc-cli      │  │ • mc:operator │   │
│   │                │  │ • agent-*     │  │ • mc:agent    │   │
│   │                │  │ • custom-*    │  │ • mc:read     │   │
│   └────────────────┘  └───────────────┘  └───────────────┘   │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## Why OIDC?

| Current (Custom JWT) | After (OIDC) |
|---|---|
| Custom login endpoint | Standard `/connect/token` |
| Manual token generation | OpenIddict handles it |
| No refresh tokens | Full refresh flow |
| No token revocation | Standard revocation endpoint |
| CLI uses raw API key or stored password | Device Authorization Flow |
| Agents use API key header | Client Credentials + JWT |
| No SSO possible | Federation-ready (external IdPs) |
| No JWKS endpoint | Standard JWKS for key rotation |

---

## Authentication Flows

### Flow 1: Authorization Code + PKCE (UI)

The standard browser-based OIDC flow. Used by the React UI.

```
┌────────┐                 ┌──────────────┐               ┌────────────┐
│   UI   │                 │   Identity   │               │   Config   │
│ (React)│                 │   Service    │               │   Service  │
└───┬────┘                 └──────┬───────┘               └─────┬──────┘
    │                              │                              │
    │  1. Generate PKCE pair       │                              │
    │     code_verifier + code_    │                              │
    │     challenge                │                              │
    │                              │                              │
    │  2. Redirect to /connect/    │                              │
    │     authorize?               │                              │
    │     response_type=code       │                              │
    │     &client_id=mc-ui         │                              │
    │     &code_challenge=xxx      │                              │
    │     &code_challenge_method=  │                              │
    │     S256                     │                              │
    │     &scope=openid profile    │                              │
    │     mc:admin                 │                              │
    │ ──────────────────────────>  │                              │
    │                              │                              │
    │  3. User logs in             │                              │
    │     (username + password)    │                              │
    │                              │                              │
    │  4. Redirect back with code  │                              │
    │ <──────────────────────────  │                              │
    │                              │                              │
    │  5. Exchange code for tokens │                              │
    │     POST /connect/token      │                              │
    │     { code, code_verifier }  │                              │
    │ ──────────────────────────>  │                              │
    │                              │                              │
    │  6. { access_token,          │                              │
    │       id_token,              │                              │
    │       refresh_token }        │                              │
    │ <──────────────────────────  │                              │
    │                              │                              │
    │  7. GET /api/apps            │                              │
    │     Authorization: Bearer    │                              │
    │     {access_token}           │                              │
    │ ─────────────────────────────────────────────────────────>  │
    │                              │                              │
    │  8. Validate JWT (JWKS)      │                              │
    │     Return data              │                              │
    │ <─────────────────────────────────────────────────────────  │
    │                              │                              │
```

### Flow 2: Client Credentials (Agents)

Machine-to-machine authentication. No user involved.

```
┌────────────┐                 ┌──────────────┐
│   Agent    │                 │   Identity   │
│ (server)   │                 │   Service    │
└─────┬──────┘                 └──────┬───────┘
      │                               │
      │  POST /connect/token          │
      │  {                            │
      │    grant_type:                 │
      │      client_credentials,      │
      │    client_id:                  │
      │      "agent-prod-01",         │
      │    client_secret:             │
      │      "sk_agent_xxxxx",        │
      │    scope:                     │
      │      "mc:agent"               │
      │  }                            │
      │ ───────────────────────────>  │
      │                               │
      │  {                            │
      │    access_token: "eyJ...",    │
      │    token_type: "Bearer",      │
      │    expires_in: 3600           │
      │  }                            │
      │ <───────────────────────────  │
      │                               │
      │  (repeat every ~50 min)       │
      │                               │
```

### Flow 3: Device Authorization (CLI)

Headless flow for terminal/SSH sessions. No browser redirect needed on the requesting device.

```
┌────────┐                 ┌──────────────┐            ┌─────────┐
│  CLI   │                 │   Identity   │            │ Browser │
│ (mc)   │                 │   Service    │            │ (user)  │
└───┬────┘                 └──────┬───────┘            └────┬────┘
    │                              │                         │
    │  1. POST /connect/device     │                         │
    │  { client_id: "mc-cli",      │                         │
    │    scope: "openid mc:admin" }│                         │
    │ ──────────────────────────>  │                         │
    │                              │                         │
    │  2. {                        │                         │
    │    device_code: "xxx",       │                         │
    │    user_code: "BRST-KXYZ",   │                         │
    │    verification_uri:         │                         │
    │      "https://ctrl:5147/     │                         │
    │       device",               │                         │
    │    interval: 5,              │                         │
    │    expires_in: 900           │                         │
    │  }                           │                         │
    │ <──────────────────────────  │                         │
    │                              │                         │
    │  3. Display to user:         │                         │
    │  ┌─────────────────────────┐ │                         │
    │  │  Visit:                 │ │                         │
    │  │  https://ctrl:5147/     │ │                         │
    │  │  device                 │ │                         │
    │  │                         │ │                         │
    │  │  Enter code:            │ │                         │
    │  │  BRST-KXYZ              │ │  4. User opens URL,    │
    │  └─────────────────────────┘ │     enters code,       │
    │                              │     logs in             │
    │                              │ <───────────────────── │
    │                              │                         │
    │  5. Poll token endpoint      │  6. Approve device     │
    │  POST /connect/token         │ <───────────────────── │
    │  { grant_type:               │                         │
    │    device_code, device_code } │                        │
    │ ──────────────────────────>  │                         │
    │                              │                         │
    │  7. { access_token,          │                         │
    │       refresh_token }        │                         │
    │ <──────────────────────────  │                         │
    │                              │                         │
    │  ✓ Logged in as admin@mc     │                         │
    │                              │                         │
```

---

## Scopes & Roles

### MiniCluster Scopes

| Scope | Description | Who gets it |
|-------|-------------|-------------|
| `openid` | Standard OIDC — subject claim | All |
| `profile` | Name, email claims | Users |
| `mc:admin` | Full access — all CRUD, cluster management, user management | Admin users |
| `mc:operator` | App management — create/update/delete apps and services | Operators |
| `mc:read` | Read-only access — view apps, services, logs | Viewers |
| `mc:agent` | Agent scope — register, heartbeat, pull config, pull packages | Agents (Client Credentials) |

### Role → Scope Mapping

```
Admin     → openid, profile, mc:admin, mc:operator, mc:read
Operator  → openid, profile, mc:operator, mc:read
Viewer    → openid, profile, mc:read
Agent     → mc:agent
```

### JWT Claims Example

```json
{
  "sub": "user-guid-here",
  "name": "Admin User",
  "email": "admin@company.com",
  "role": "Admin",
  "scope": "openid profile mc:admin mc:operator mc:read",
  "iss": "https://controller:5147",
  "aud": "minicluster",
  "iat": 1738870000,
  "exp": 1738873600,
  "jti": "unique-token-id"
}
```

---

## OIDC Clients (Applications)

Pre-registered clients that MiniCluster creates on first startup:

### mc-ui (React Frontend)

```
Client ID:     mc-ui
Client Type:   Public (no secret — SPA)
Grant Types:   authorization_code
PKCE:          Required (S256)
Redirect URIs: https://{server}/auth/callback
                http://localhost:5173/auth/callback   (dev)
Scopes:        openid, profile, mc:admin, mc:operator, mc:read
```

### mc-cli (Command-Line Tool)

```
Client ID:     mc-cli
Client Type:   Public (no secret — native)
Grant Types:   urn:ietf:params:oauth:grant-type:device_code
Scopes:        openid, profile, mc:admin, mc:operator, mc:read
```

### Agent Clients (Per-Agent)

```
Client ID:     agent-{machine-name}    (e.g., agent-prod-01)
Client Type:   Confidential (has secret)
Grant Types:   client_credentials
Scopes:        mc:agent
Secret:        Generated on agent registration, shown once
```

---

## OpenID Configuration (Standard Endpoint)

### GET `/.well-known/openid-configuration`

```json
{
  "issuer": "https://controller:5147",
  "authorization_endpoint": "https://controller:5147/connect/authorize",
  "token_endpoint": "https://controller:5147/connect/token",
  "userinfo_endpoint": "https://controller:5147/connect/userinfo",
  "device_authorization_endpoint": "https://controller:5147/connect/device",
  "introspection_endpoint": "https://controller:5147/connect/introspect",
  "revocation_endpoint": "https://controller:5147/connect/revocation",
  "jwks_uri": "https://controller:5147/.well-known/jwks",
  "end_session_endpoint": "https://controller:5147/connect/logout",
  
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "authorization_code",
    "client_credentials",
    "refresh_token",
    "urn:ietf:params:oauth:grant-type:device_code"
  ],
  "subject_types_supported": ["public"],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": [
    "openid", "profile", "email",
    "mc:admin", "mc:operator", "mc:read", "mc:agent"
  ],
  "token_endpoint_auth_methods_supported": [
    "client_secret_post",
    "none"
  ],
  "code_challenge_methods_supported": ["S256"],
  
  "x-minicluster-config": "https://controller:5147/api/config",
  "x-minicluster-registry": "https://controller:5147/api/registry",
  "x-minicluster-version": "1.0.0"
}
```

The `x-minicluster-*` extensions allow clients that speak standard OIDC to also discover MiniCluster-specific endpoints.

---

## User Management API

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/identity/users` | mc:admin | List all users |
| POST | `/api/identity/users` | mc:admin | Create user |
| GET | `/api/identity/users/{id}` | mc:admin | Get user details |
| PUT | `/api/identity/users/{id}` | mc:admin | Update user |
| DELETE | `/api/identity/users/{id}` | mc:admin | Delete user |
| POST | `/api/identity/users/{id}/reset-password` | mc:admin | Reset password |
| GET | `/api/identity/me` | any authenticated | Current user info |
| PUT | `/api/identity/me/password` | any authenticated | Change own password |

### DTOs

```csharp
// Create user
public record CreateUserDto(
    string Username,
    string Email,
    string Password,
    string Role  // Admin, Operator, Viewer
);

// User response
public record UserDto(
    Guid Id,
    string Username,
    string Email,
    string Role,
    DateTime CreatedAt,
    DateTime? LastLoginAt,
    bool IsActive
);
```

---

## Client Management API

### Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/identity/clients` | mc:admin | List OIDC clients |
| POST | `/api/identity/clients` | mc:admin | Register new client |
| GET | `/api/identity/clients/{id}` | mc:admin | Get client details |
| DELETE | `/api/identity/clients/{id}` | mc:admin | Remove client |
| POST | `/api/identity/clients/{id}/rotate-secret` | mc:admin | Rotate client secret |

### Agent Client Registration

When an agent registers via the cluster API, an OIDC client is automatically created:

```
Agent Registration
       │
       ▼
  POST /api/cluster/register
  { name: "prod-01", ... }
       │
       ▼
  1. Create OIDC client "agent-prod-01"
  2. Generate client_secret
  3. Create Machine entity
  4. Return { machineId, clientId, clientSecret }
       │
       ▼
  Agent stores client_id + client_secret
  Uses Client Credentials for all future auth
```

---

## Migration Path (Custom JWT → OIDC)

The migration is **backward-compatible**. Both systems work during transition.

```
Phase 1: Add OpenIddict alongside existing JWT
         ├── /connect/* endpoints active
         ├── /api/auth/login still works (deprecated)
         ├── Both token formats accepted
         └── UI gets flag: OIDC_ENABLED=true

Phase 2: Migrate CLI to Device Authorization
         ├── mc login → Device Authorization flow
         ├── mc connect → stores OIDC endpoints
         └── Old API key auth deprecated

Phase 3: Migrate Agents to Client Credentials
         ├── Agent registration creates OIDC client
         ├── Agents use /connect/token
         └── X-Agent-Api-Key middleware deprecated

Phase 4: Remove legacy auth
         ├── /api/auth/* endpoints removed
         ├── Old token format rejected
         └── API key middleware removed
```

---

## Data Model (OpenIddict + Custom)

```
┌──────────────────────┐     ┌──────────────────────┐
│ OpenIddictApplication│     │  OpenIddictToken      │
│ (OIDC Client)        │     │                       │
│                      │     │  Subject               │
│  ClientId            │────>│  Application           │
│  DisplayName         │     │  Type                  │
│  ClientSecret (hash) │     │  Status                │
│  Permissions         │     │  ExpirationDate        │
│  RedirectUris        │     └──────────────────────┘
│  Type (public/conf.) │
└──────────────────────┘     ┌──────────────────────┐
                             │ OpenIddictAuthorization│
┌──────────────────────┐     │                       │
│ OpenIddictScope      │     │  Subject               │
│                      │     │  Application           │
│  Name                │     │  Scopes                │
│  Description         │     │  Status                │
│  Resources           │     └──────────────────────┘
└──────────────────────┘

┌──────────────────────┐     ┌──────────────────────┐
│  User (MiniCluster)  │     │  UserRole (MiniCluster)│
│                      │     │                       │
│  Id (Guid)           │────>│  UserId                │
│  Username            │     │  Role                  │
│  Email               │     │  AssignedAt            │
│  PasswordHash        │     └──────────────────────┘
│  IsActive            │
│  CreatedAt           │
│  LastLoginAt         │
└──────────────────────┘
```

---

## Configuration (appsettings.json)

```json
{
  "Identity": {
    "Issuer": "",
    "SigningKey": "",
    "AccessTokenLifetime": "01:00:00",
    "RefreshTokenLifetime": "7.00:00:00",
    "DeviceCodeLifetime": "00:15:00",
    "RequireHttps": true,
    "AllowedOrigins": ["https://controller:5147"],
    "DefaultAdminUsername": "admin",
    "DefaultAdminPassword": ""
  }
}
```

- `Issuer`: Defaults to server URL if empty
- `SigningKey`: Auto-generated RSA key if empty, stored in data directory
- `DefaultAdminPassword`: If empty, generated on first startup and printed to console

---

## Key Rotation

```
┌──────────────────────────────────────────────────────────────┐
│                    Key Rotation                               │
│                                                               │
│  MiniCluster auto-manages signing keys:                       │
│                                                               │
│  data/                                                        │
│  └── keys/                                                    │
│      ├── signing-key-2026-01.json    (active)                 │
│      └── signing-key-2025-07.json    (still valid for verify) │
│                                                               │
│  JWKS endpoint (/.well-known/jwks) exposes ALL valid keys.    │
│  Tokens signed with old key are valid until they expire.      │
│  New tokens use the current key.                              │
│                                                               │
│  Rotation: Every 6 months (configurable).                     │
│  Old key kept for: token lifetime + 1 hour buffer.            │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## External Identity Provider

MiniCluster can delegate to an external OIDC provider instead of managing users itself.

```json
{
  "Identity": {
    "ExternalProvider": {
      "Enabled": true,
      "Authority": "https://login.company.com",
      "ClientId": "minicluster",
      "ClientSecret": "xxxx",
      "Scopes": ["openid", "profile", "email"],
      "RoleClaimType": "roles",
      "RoleMapping": {
        "mc-admin": "Admin",
        "mc-operator": "Operator",
        "mc-viewer": "Viewer"
      }
    }
  }
}
```

When external provider is enabled:
- MiniCluster does NOT issue tokens (no `/connect/authorize`)
- MiniCluster validates incoming JWTs against external provider's JWKS
- User management API is disabled (users are in external system)
- Agent Client Credentials still work (agents authenticate against MiniCluster)
- Discovery endpoint points `identity_endpoint` to external provider

---

## Acceptance Criteria

- [ ] OpenIddict installed and configured with SQLite storage
- [ ] `/.well-known/openid-configuration` returns valid OIDC discovery document
- [ ] `/.well-known/jwks` returns current signing keys
- [ ] Authorization Code + PKCE flow works for UI
- [ ] Client Credentials flow works for agents
- [ ] Device Authorization flow works for CLI
- [ ] Default `mc-ui` and `mc-cli` clients created on first startup
- [ ] Agent clients auto-created on cluster registration
- [ ] Custom scopes (`mc:admin`, `mc:operator`, `mc:read`, `mc:agent`) enforced
- [ ] User CRUD endpoints functional (admin only)
- [ ] Password hashing uses bcrypt/Argon2
- [ ] Refresh token rotation works
- [ ] Token revocation endpoint works
- [ ] Key rotation auto-manages signing keys
- [ ] External OIDC provider mode works (validate external JWTs)
- [ ] Migration path: old JWT tokens accepted during transition period
- [ ] First-startup admin password generated and printed to console

---

## Related Specs

| Spec | Relationship |
|------|-------------|
| [003 — Authentication](../003-authentication/spec.md) | Current auth — to be replaced by OIDC |
| [016 — Discovery](../016-discovery-services/spec.md) | Discovery endpoint includes OIDC configuration |
| [010 — Multi-Node Cluster](../010-multi-node-cluster/spec.md) | Agents use Client Credentials flow |
