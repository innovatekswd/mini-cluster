# Authentication & Authorization

> **Version:** 1.0  
> **Status:** 🔶 Partially Implemented (JWT done, API Keys & RBAC pending)  
> **Priority:** HIGH  
> **Effort:** 3 weeks remaining

---

## Overview

Secure the MiniCluster API and UI with comprehensive authentication and authorization. Support multiple authentication methods for different use cases.

---

## Current State (✅ Implemented)

### JWT Authentication
- Login endpoint (`POST /api/auth/login`)
- Token generation with claims
- Token refresh mechanism
- Token validation middleware
- Logout with token invalidation
- Frontend AuthContext with auto-refresh

### User Management (Basic)
- Admin user creation on first run
- Password hashing (BCrypt)
- User entity in database

---

## Planned Features

### 1. API Keys (📋 1 week)

#### Use Cases
- CI/CD pipeline authentication
- Service-to-service communication
- CLI tool authentication
- Third-party integrations

#### API Key Entity
```csharp
public class ApiKey
{
    public Guid Id { get; set; }
    public string Name { get; set; }                // "CI/CD Pipeline"
    public string KeyHash { get; set; }             // SHA256 hash
    public string KeyPrefix { get; set; }           // First 8 chars for identification
    public Guid UserId { get; set; }                // Owner
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }        // null = never expires
    public DateTime? LastUsedAt { get; set; }
    public string[] Scopes { get; set; }            // ["apps:read", "services:*"]
    public bool IsActive { get; set; }
}
```

#### API Endpoints
```
POST   /api/auth/api-keys                 Create new API key
GET    /api/auth/api-keys                 List user's API keys
GET    /api/auth/api-keys/{id}            Get API key details
DELETE /api/auth/api-keys/{id}            Revoke API key
POST   /api/auth/api-keys/{id}/regenerate Regenerate API key
```

#### Key Format
```
mc_live_a1b2c3d4e5f6g7h8_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
│   │    │                │
│   │    │                └─ Random secret (32 chars)
│   │    └─ User prefix (16 chars, for identification)
│   └─ Environment (live/test)
└─ Prefix (always "mc")
```

#### Authentication Header
```
Authorization: Bearer mc_live_a1b2c3d4e5f6g7h8_xxxxxxxxxxxx
# OR
X-API-Key: mc_live_a1b2c3d4e5f6g7h8_xxxxxxxxxxxx
```

#### API Key Scopes
```
apps:read          - Read apps
apps:write         - Create/update apps
apps:delete        - Delete apps
services:read      - Read services
services:write     - Create/update services
services:control   - Start/stop/restart services
deploy:execute     - Execute deployments
admin:*            - All admin operations
*                  - Full access (superuser)
```

---

### 2. Role-Based Access Control (📋 2 weeks)

#### Built-in Roles

| Role | Description | Permissions |
|------|-------------|-------------|
| `Admin` | Full system access | `*` |
| `Operator` | Manage services, no user management | `apps:*`, `services:*`, `deploy:*` |
| `Developer` | Start/stop services, view logs | `services:control`, `services:read`, `apps:read` |
| `Viewer` | Read-only access | `*:read` |

#### Permission Model
```csharp
public class Role
{
    public Guid Id { get; set; }
    public string Name { get; set; }          // "Admin", "Operator"
    public string Description { get; set; }
    public string[] Permissions { get; set; } // ["apps:*", "services:control"]
    public bool IsBuiltIn { get; set; }       // Cannot delete built-in roles
}

public class UserRole
{
    public Guid UserId { get; set; }
    public Guid RoleId { get; set; }
    public Guid? ScopeId { get; set; }        // null = global, or specific app/group
    public string ScopeType { get; set; }     // "App", "Group", "Global"
}
```

#### Permission Checking
```csharp
// Attribute-based authorization
[Authorize(Policy = "RequireServiceControl")]
[HttpPost("{id}/start")]
public async Task<IActionResult> StartService(Guid id)

// Programmatic check
if (!await _authService.HasPermission(userId, "services:control", appId))
    return Forbid();
```

#### API Endpoints
```
GET    /api/roles                    List all roles
POST   /api/roles                    Create custom role (Admin only)
PUT    /api/roles/{id}               Update role
DELETE /api/roles/{id}               Delete custom role

GET    /api/users/{id}/roles         Get user's roles
POST   /api/users/{id}/roles         Assign role to user
DELETE /api/users/{id}/roles/{roleId}  Remove role from user
```

---

### 3. User Management UI (📋 included in RBAC)

#### Features
- User list with role badges
- Create/edit user form
- Role assignment multi-select
- Password reset
- Account disable/enable
- Last login tracking
- API key management per user

#### UI Components
```
/settings/users           - User list
/settings/users/new       - Create user
/settings/users/{id}      - User details
/settings/roles           - Role management
```

---

### 4. Audit Logging (📋 included in RBAC)

#### Audit Events
```csharp
public class AuditLog
{
    public Guid Id { get; set; }
    public DateTime Timestamp { get; set; }
    public Guid? UserId { get; set; }
    public string UserName { get; set; }
    public string Action { get; set; }         // "service.start", "app.delete"
    public string ResourceType { get; set; }   // "Service", "App"
    public Guid? ResourceId { get; set; }
    public string ResourceName { get; set; }
    public string IpAddress { get; set; }
    public string UserAgent { get; set; }
    public string Details { get; set; }        // JSON with additional context
    public bool Success { get; set; }
}
```

#### Audit Trail Query
```
GET /api/audit?from=2024-01-01&action=service.*&userId=xxx
```

---

### 5. Session Management (💡 Future)

- Active session list
- Remote session termination
- Session timeout configuration
- Remember device option
- Concurrent session limits

---

### 6. OAuth2/OIDC Integration (💡 Future)

- Azure AD integration
- Google Workspace
- Okta integration
- Custom OIDC provider
- SAML support (enterprise)

---

## Implementation Plan

### Phase 1: API Keys (Week 1)
1. Create ApiKey entity and migration
2. Implement key generation/hashing
3. Add authentication middleware for API keys
4. Create API endpoints
5. Add UI for API key management
6. Update CLI to use API keys

### Phase 2: RBAC (Week 2-3)
1. Create Role, UserRole entities
2. Implement permission checking service
3. Add authorization policies
4. Create role management API
5. Build user management UI
6. Implement audit logging
7. Add scoped permissions (per-app)

---

## Security Considerations

### API Key Security
- Keys are hashed (SHA256) before storage
- Full key shown only once at creation
- Keys have optional expiration
- Keys can be scoped to specific permissions
- Rate limiting per key

### Password Security
- BCrypt hashing with cost factor 12
- Minimum 8 characters
- Password history (no reuse)
- Account lockout after failed attempts

### Session Security
- HTTPS required
- HTTP-only cookies
- CSRF protection
- Short token lifetime (15 min) with refresh
- Secure token storage (localStorage with encryption)

---

## CLI Integration

```bash
# Login with username/password (interactive)
mc login

# Login with API key (non-interactive, CI/CD)
mc --token mc_live_xxxx app list

# Environment variable
export MC_AUTH_TOKEN=mc_live_xxxx
mc app list
```

---

## References

- Original spec: `../spec/003-authentication/spec.md`
- JWT implementation: `ControlCenter.Api/Services/AuthService.cs`
- Auth controller: `ControlCenter.Api/Controllers/AuthController.cs`
