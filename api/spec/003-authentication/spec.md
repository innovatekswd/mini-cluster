# Feature 003: Authentication System

## Overview
Add authentication to MiniCluster to secure the API and UI from unauthorized access.

## Recommendation Summary

For a local/internal tool like MiniCluster, I recommend **Option A: Simple JWT with Local Users** as the best balance of security, simplicity, and maintainability.

---

## Options Analyzed

### Option A: Simple JWT with Local Users (⭐ RECOMMENDED)
**How it works:**
- Users stored in a local SQLite table or JSON file
- Password hashing with bcrypt/Argon2
- JWT tokens for API authentication
- Refresh token support for session management

**Pros:**
- Simple to implement (~2-3 days)
- No external dependencies
- Works offline
- Full control over user management
- Standard JWT works with any HTTP client

**Cons:**
- Need to manage user passwords
- No SSO/enterprise integration

**Implementation:**
```
POST /api/auth/login     → Returns JWT + Refresh Token
POST /api/auth/refresh   → Refresh JWT using refresh token
POST /api/auth/logout    → Invalidate refresh token
GET  /api/auth/me        → Get current user info
```

---

### Option B: API Key Authentication
**How it works:**
- Generate API keys stored in database
- Pass key via header `X-API-Key` or query param
- Optional: scoped permissions per key

**Pros:**
- Very simple to implement (~1 day)
- Easy for programmatic access
- No session management needed

**Cons:**
- Less secure (keys are long-lived)
- No built-in expiration
- Not ideal for browser-based UI

**Best for:** API-only access, CLI tools, automation

---

### Option C: Cookie-based Sessions
**How it works:**
- Traditional session cookie after login
- Session stored in memory or database
- HttpOnly, Secure, SameSite cookies

**Pros:**
- Simple for browser-based apps
- Automatic CSRF protection with SameSite
- No token management in frontend

**Cons:**
- Stateful (need session storage)
- Harder for API clients
- CORS complexity

---

### Option D: OAuth2/OIDC with External Provider
**How it works:**
- Integrate with Google, Microsoft, GitHub, etc.
- Or self-hosted Keycloak/Auth0

**Pros:**
- Enterprise-ready
- SSO support
- No password management

**Cons:**
- Overkill for local tool
- Requires internet (unless self-hosted)
- Complex setup

---

## Recommended Implementation Plan (Option A)

### Phase 1: Backend Authentication
1. **User Model & Storage**
   - Add `Users` table: Id, Username, Email, PasswordHash, Role, CreatedAt
   - Add `RefreshTokens` table: Id, UserId, Token, ExpiresAt, IsRevoked

2. **Auth Endpoints**
   ```csharp
   [ApiController]
   [Route("api/auth")]
   public class AuthController
   {
       POST /login      - Validate credentials, return JWT + refresh token
       POST /refresh    - Exchange refresh token for new JWT
       POST /logout     - Revoke refresh token
       GET  /me         - Get current user (requires auth)
   }
   ```

3. **JWT Configuration**
   - Access token: 15-30 min expiry
   - Refresh token: 7 days expiry
   - Secret key in appsettings (or environment variable)

4. **Middleware**
   - Add `[Authorize]` attribute to protected endpoints
   - Allow anonymous for: login, health check, SignalR negotiate

### Phase 2: Frontend Authentication
1. **Login Page**
   - Simple username/password form
   - Store JWT in memory (not localStorage for security)
   - Store refresh token in HttpOnly cookie (optional) or memory

2. **Auth Context**
   - React context for auth state
   - Auto-refresh token before expiry
   - Redirect to login on 401

3. **Protected Routes**
   - Wrap routes with auth check
   - Show login if not authenticated

### Phase 3: User Management (Optional)
1. **Admin Features**
   - Create/edit/delete users
   - Reset passwords
   - View active sessions

2. **Initial Setup**
   - First-run setup wizard
   - Create admin user on first launch

---

## Security Considerations

1. **Password Storage**: Use bcrypt with cost factor 12+
2. **JWT Secret**: Minimum 256-bit key, stored securely
3. **HTTPS**: Recommend HTTPS even for local (self-signed cert)
4. **Rate Limiting**: Add to login endpoint (5 attempts/minute)
5. **Audit Logging**: Log login attempts (success/failure)

---

## Database Schema

```sql
CREATE TABLE Users (
    Id TEXT PRIMARY KEY,
    Username TEXT UNIQUE NOT NULL,
    Email TEXT,
    PasswordHash TEXT NOT NULL,
    Role TEXT DEFAULT 'User',  -- 'Admin', 'User', 'ReadOnly'
    IsActive INTEGER DEFAULT 1,
    CreatedAt TEXT NOT NULL,
    LastLoginAt TEXT
);

CREATE TABLE RefreshTokens (
    Id TEXT PRIMARY KEY,
    UserId TEXT NOT NULL,
    Token TEXT UNIQUE NOT NULL,
    ExpiresAt TEXT NOT NULL,
    IsRevoked INTEGER DEFAULT 0,
    CreatedAt TEXT NOT NULL,
    RevokedAt TEXT,
    FOREIGN KEY (UserId) REFERENCES Users(Id)
);
```

---

## Configuration

```json
// appsettings.json
{
  "Authentication": {
    "Enabled": true,
    "JwtSecret": "your-256-bit-secret-key-here",
    "JwtIssuer": "MiniCluster",
    "JwtAudience": "MiniCluster",
    "AccessTokenExpiryMinutes": 30,
    "RefreshTokenExpiryDays": 7,
    "AllowAnonymousInDevelopment": false
  }
}
```

---

## Timeline Estimate

| Phase | Task | Estimate |
|-------|------|----------|
| 1 | User model & database | 2 hours |
| 1 | Auth endpoints | 4 hours |
| 1 | JWT middleware | 2 hours |
| 1 | Protect existing endpoints | 1 hour |
| 2 | Login page UI | 3 hours |
| 2 | Auth context & token management | 3 hours |
| 2 | Protected routes | 2 hours |
| 3 | User management (optional) | 4 hours |
| | **Total** | **~2-3 days** |

---

## Questions to Consider

1. **Single user or multi-user?** 
   - Single user: Simpler, just need password
   - Multi-user: Need user management

2. **Role-based access?**
   - Admin: Full access
   - User: Can manage apps, view logs
   - ReadOnly: View only

3. **Remember me?**
   - Longer refresh token for "remember me"
   - 30 days vs 7 days

4. **Disable auth for development?**
   - Environment flag to bypass auth

---

## Next Steps

1. Confirm Option A is acceptable
2. Decide on single-user vs multi-user
3. Decide on roles needed
4. Proceed with Phase 1 implementation
