# Example: Implementing Authentication (Feature 003)

This walkthrough demonstrates using the MiniCluster Feature Implementation Agent to complete the Authentication feature.

---

## Current Status

**Feature:** 003 - Authentication  
**Status:** 🔶 Partial (40% complete)  
**Priority:** 🔴 CRITICAL  
**Remaining Effort:** 2 weeks  

**Completed:**
- ✅ JWT token authentication
- ✅ Login/logout UI
- ✅ Token refresh

**Remaining:**
- ⬜ API key management
- ⬜ RBAC (Role-Based Access Control)
- ⬜ User management UI

---

## Walkthrough

### Step 1: Check Readiness

**You:**
```
@spec-implementer I want to complete the Authentication feature
```

**Agent Response:**
```
🔍 Checking Feature: 003 - Authentication

✅ Spec found: spec2/phase-2-security/003-authentication.md
✅ Detailed spec: spec/003-authentication/spec.md
✅ Priority: 🔴 CRITICAL
✅ Current Status: 🔶 Partial (40%)
✅ Dependencies: None (foundational feature)

📋 Remaining Work:

Phase 1: API Key Management (1 week)
- [ ] Database schema (ApiKeys table)
- [ ] API key generation endpoint
- [ ] API key validation middleware
- [ ] API key management UI

Phase 2: RBAC & User Management (1 week)
- [ ] Define roles and permissions
- [ ] Implement permission checks
- [ ] User management UI
- [ ] Session management

🎯 Ready to proceed with Phase 1: API Key Management?
```

### Step 2: Create Branch

**You:**
```
@spec-implementer Yes, create the branch
```

**Agent Response:**
```
✅ Creating feature branch

Run these commands:
```bash
git checkout main
git pull origin main
git checkout -b feature/003-authentication-apikeys
```

📝 Branch naming: Since this is continuation work, you can use:
- feature/003-authentication-apikeys (focused on API keys)
OR
- feature/003-authentication (general continuation)

I recommend: feature/003-authentication-apikeys

Branch created successfully!
Status updated: spec2/phase-2-security/003-authentication.md
```

### Step 3: Implement Phase 1 - Database Schema

**You:**
```
@spec-implementer Show me the database schema for API keys
```

**Agent Response:**
```
📊 Database Schema: API Keys

According to spec/003-authentication/spec.md:

```sql
-- API Keys table
CREATE TABLE ApiKeys (
  Id INTEGER PRIMARY KEY AUTOINCREMENT,
  Name VARCHAR(255) NOT NULL,              -- Friendly name ("CI/CD Pipeline")
  KeyHash VARCHAR(512) NOT NULL,           -- Hashed key (never store plaintext!)
  KeyPrefix VARCHAR(20) NOT NULL,          -- First 8 chars for identification
  UserId INTEGER NOT NULL,                 -- Owner of the key
  Permissions TEXT,                        -- JSON array of permissions
  ExpiresAt DATETIME,                      -- NULL = never expires
  LastUsedAt DATETIME,                     -- Track usage
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  RevokedAt DATETIME,                      -- NULL = active
  FOREIGN KEY (UserId) REFERENCES Users(Id)
);

CREATE INDEX idx_apikeys_keyhash ON ApiKeys(KeyHash);
CREATE INDEX idx_apikeys_userid ON ApiKeys(UserId);
```

📝 Implementation checklist:
1. Add entity class: ControlCenter.Core/Entities/ApiKey.cs
2. Update DbContext: ControlCenter.Api/Data/AppDbContext.cs
3. Create migration: dotnet ef migrations add 003_ApiKeys
4. Apply migration: dotnet ef database update

Ready to implement?
```

**You implement the code...**

```csharp
// ControlCenter.Core/Entities/ApiKey.cs
namespace Innovatek.ControlCenter.Core.Entities
{
    public class ApiKey
    {
        public int Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string KeyHash { get; set; } = string.Empty;
        public string KeyPrefix { get; set; } = string.Empty;
        public int UserId { get; set; }
        public string? Permissions { get; set; }
        public DateTime? ExpiresAt { get; set; }
        public DateTime? LastUsedAt { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime? RevokedAt { get; set; }
        
        // Navigation properties
        public User? User { get; set; }
    }
}
```

### Step 4: Create Service

**You:**
```
@spec-implementer What service methods do I need for API key management?
```

**Agent Response:**
```
🔧 Service Interface: IApiKeyService

Based on the spec, implement these methods:

```csharp
public interface IApiKeyService
{
    // Generate new API key
    Task<Result<ApiKeyDto>> GenerateAsync(CreateApiKeyDto request);
    
    // List user's API keys
    Task<Result<List<ApiKeyDto>>> GetByUserAsync(int userId);
    
    // Validate API key (for middleware)
    Task<Result<ApiKeyValidationResult>> ValidateAsync(string apiKey);
    
    // Revoke API key
    Task<Result> RevokeAsync(int keyId, int userId);
    
    // Update API key metadata
    Task<Result> UpdateAsync(int keyId, UpdateApiKeyDto request);
}

public class ApiKeyDto
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string KeyPrefix { get; set; }  // Only show prefix, not full key
    public DateTime CreatedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public DateTime? LastUsedAt { get; set; }
    public bool IsActive => RevokedAt == null && (ExpiresAt == null || ExpiresAt > DateTime.UtcNow);
}

public class ApiKeyValidationResult
{
    public bool IsValid { get; set; }
    public int? UserId { get; set; }
    public string[]? Permissions { get; set; }
}
```

⚠️ Security Notes:
- NEVER return full API key after creation (only show once)
- Always hash keys before storing (use BCrypt or Argon2)
- Store prefix (first 8 chars) for user identification
- Validate permissions on every request

Ready to implement the service?
```

**You implement ApiKeyService.cs...**

### Step 5: Create API Endpoints

**You:**
```
@spec-implementer Show me the API endpoints for API keys
```

**Agent Response:**
```
🌐 API Endpoints: ApiKeysController

```csharp
[ApiController]
[Route("api/[controller]")]
[Authorize] // Require authentication
public class ApiKeysController : ControllerBase
{
    private readonly IApiKeyService _apiKeyService;
    
    // GET /api/apikeys
    // List current user's API keys
    [HttpGet]
    public async Task<ActionResult<List<ApiKeyDto>>> GetMyKeys()
    {
        var userId = GetCurrentUserId();
        var result = await _apiKeyService.GetByUserAsync(userId);
        return result.IsSuccess ? Ok(result.Value) : BadRequest(result.Error);
    }
    
    // POST /api/apikeys
    // Generate new API key
    [HttpPost]
    public async Task<ActionResult<GenerateApiKeyResponse>> Generate([FromBody] CreateApiKeyDto request)
    {
        var userId = GetCurrentUserId();
        request.UserId = userId;
        
        var result = await _apiKeyService.GenerateAsync(request);
        if (!result.IsSuccess) return BadRequest(result.Error);
        
        // ⚠️ IMPORTANT: Only return full key HERE, once
        return Ok(new GenerateApiKeyResponse
        {
            Id = result.Value.Id,
            Name = result.Value.Name,
            ApiKey = result.Value.FullKey, // Only time we show this!
            ExpiresAt = result.Value.ExpiresAt
        });
    }
    
    // DELETE /api/apikeys/:id
    // Revoke API key
    [HttpDelete("{id}")]
    public async Task<ActionResult> Revoke(int id)
    {
        var userId = GetCurrentUserId();
        var result = await _apiKeyService.RevokeAsync(id, userId);
        return result.IsSuccess ? NoContent() : BadRequest(result.Error);
    }
}
```

📝 Response Types:

```csharp
public class GenerateApiKeyResponse
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string ApiKey { get; set; }  // mk_xxxxxxxxxxxxx
    public DateTime? ExpiresAt { get; set; }
}

public class CreateApiKeyDto
{
    [Required]
    public string Name { get; set; }
    
    public DateTime? ExpiresAt { get; set; }
    
    public string[]? Permissions { get; set; }
}
```

Ready to implement?
```

**You implement the controller...**

### Step 6: Create Validation Middleware

**You:**
```
@spec-implementer How do I validate API keys in middleware?
```

**Agent Response:**
```
🔒 API Key Validation Middleware

Create: ControlCenter.Api/Middleware/ApiKeyAuthenticationMiddleware.cs

```csharp
public class ApiKeyAuthenticationMiddleware
{
    private readonly RequestDelegate _next;
    private const string API_KEY_HEADER = "X-API-Key";
    
    public async Task InvokeAsync(HttpContext context, IApiKeyService apiKeyService)
    {
        // Check for API key in header
        if (context.Request.Headers.TryGetValue(API_KEY_HEADER, out var apiKey))
        {
            var result = await apiKeyService.ValidateAsync(apiKey!);
            
            if (result.IsSuccess && result.Value.IsValid)
            {
                // Set user claims for authorization
                var claims = new List<Claim>
                {
                    new Claim(ClaimTypes.NameIdentifier, result.Value.UserId.ToString()),
                    new Claim("AuthType", "ApiKey")
                };
                
                // Add permission claims
                if (result.Value.Permissions != null)
                {
                    claims.AddRange(result.Value.Permissions.Select(p => 
                        new Claim("Permission", p)));
                }
                
                var identity = new ClaimsIdentity(claims, "ApiKey");
                context.User = new ClaimsPrincipal(identity);
            }
        }
        
        await _next(context);
    }
}
```

Register in Program.cs:
```csharp
app.UseMiddleware<ApiKeyAuthenticationMiddleware>();
app.UseAuthentication();
app.UseAuthorization();
```

Usage:
```http
GET /api/apps
X-API-Key: mk_abc123xyz789...
```

Ready to implement?
```

**You implement middleware...**

### Step 7: Create UI

**You:**
```
@spec-implementer What UI components do I need for API key management?
```

**Agent Response:**
```
🎨 UI Components for API Key Management

Create: minicluster-ui/app/routes/settings/api-keys.tsx

```tsx
export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newKey, setNewKey] = useState<NewApiKey | null>(null);
  
  // Load API keys on mount
  useEffect(() => {
    loadApiKeys();
  }, []);
  
  return (
    <div className="api-keys-page">
      <header>
        <h1>API Keys</h1>
        <button onClick={() => setShowCreateModal(true)}>
          Generate New Key
        </button>
      </header>
      
      {/* Show new key ONCE after generation */}
      {newKey && (
        <NewKeyAlert
          apiKey={newKey.key}
          onClose={() => setNewKey(null)}
        />
      )}
      
      {/* List existing keys */}
      <ApiKeyTable
        keys={keys}
        onRevoke={handleRevoke}
      />
      
      {/* Create modal */}
      {showCreateModal && (
        <CreateApiKeyModal
          onClose={() => setShowCreateModal(false)}
          onCreated={(key) => {
            setNewKey(key);
            loadApiKeys();
          }}
        />
      )}
    </div>
  );
}
```

Components needed:
1. ApiKeyTable - List keys with prefix, created date, expiry
2. CreateApiKeyModal - Form to generate new key
3. NewKeyAlert - ⚠️ Show full key once, copy to clipboard
4. ApiKeyRow - Individual key with revoke button

Ready to implement?
```

**You implement UI components...**

### Step 8: Write Tests

**You:**
```
@spec-implementer What tests do I need for API keys?
```

**Agent Response:**
```
🧪 Test Strategy for API Keys

**Unit Tests:**

1. ApiKeyService Tests
```csharp
[Fact]
public async Task GenerateAsync_CreatesKeyWithHash()
{
    // Arrange
    var service = CreateService();
    var request = new CreateApiKeyDto { Name = "Test Key" };
    
    // Act
    var result = await service.GenerateAsync(request);
    
    // Assert
    Assert.True(result.IsSuccess);
    Assert.NotNull(result.Value.FullKey);
    Assert.StartsWith("mk_", result.Value.FullKey);
    // Verify key is hashed in database
}

[Fact]
public async Task ValidateAsync_RejectsRevokedKey()
{
    // Test revoked keys don't validate
}

[Fact]
public async Task ValidateAsync_RejectsExpiredKey()
{
    // Test expired keys don't validate
}
```

2. Middleware Tests
```csharp
[Fact]
public async Task Middleware_AuthenticatesValidKey()
{
    // Test valid key sets user claims
}

[Fact]
public async Task Middleware_RejectsInvalidKey()
{
    // Test invalid key doesn't authenticate
}
```

**Integration Tests:**

```csharp
[Fact]
public async Task POST_ApiKeys_GeneratesKey()
{
    // Test /api/apikeys endpoint
}

[Fact]
public async Task GET_WithApiKey_ReturnsData()
{
    // Test using API key to access protected endpoint
}

[Fact]
public async Task DELETE_ApiKeys_RevokesKey()
{
    // Test revoking and key no longer works
}
```

Ready to write tests?
```

**You write tests...**

### Step 9: Update Status

**You:**
```
@spec-implementer Phase 1 complete (API Key Management)
```

**Agent Response:**
```
✅ Updating Status

Files updated:

1. spec2/phase-2-security/003-authentication.md
   - ✅ API key generation and validation
   - ✅ API key management
   - Completion: 70% (was 40%)

2. spec2/INDEX.md
   - Status: 🔶 Partial (70%)
   - Progress bar updated

📋 Remaining Work:
Phase 2: RBAC & User Management (1 week)
- [ ] Define roles and permissions
- [ ] Implement permission checks  
- [ ] User management UI
- [ ] Session management

Estimated time to complete: 1 week

Ready to continue with Phase 2?
```

### Step 10: Commit & Push

**You:**
```
git add .
git commit -m "[003] Add API key management

- Database schema for ApiKeys table
- ApiKeyService with generation and validation
- ApiKeysController with CRUD endpoints
- API key authentication middleware
- UI for API key management
- Unit and integration tests

Part of: feature/003-authentication-apikeys
Phase: 1/2 (API Key Management)
Completion: 70%"

git push origin feature/003-authentication-apikeys
```

### Step 11: Continue with Phase 2

**You:**
```
@spec-implementer Start Phase 2 - RBAC
```

**Agent continues guiding through RBAC implementation...**

### Step 12: Final PR

**You:**
```
@spec-implementer Generate PR description for Authentication
```

**Agent Response:**
```
📝 Pull Request Template

Title: [003] Authentication - Complete API Keys & RBAC

Description:
```markdown
## Feature: 003 - Authentication

**Spec Reference:** [spec2/phase-2-security/003-authentication.md](link)
**Priority:** 🔴 CRITICAL
**Completion:** 100% (was 40%)

### What's Implemented

✅ **API Key Management**
- API key generation with secure hashing
- API key validation middleware
- API key management UI
- Revocation and expiry support

✅ **Role-Based Access Control (RBAC)**
- Role definitions (Admin, Operator, ReadOnly)
- Permission system
- Authorization middleware
- Role assignment UI

✅ **User Management**
- User CRUD operations
- Role assignment
- Password management
- Session tracking

### Database Changes

New tables:
- `ApiKeys` - API key storage with hashing
- `Roles` - Role definitions
- `UserRoles` - User-role assignments

Migrations:
- `Migrations/20260130_003_ApiKeys.cs`
- `Migrations/20260130_003_Roles.cs`

### API Changes

New endpoints:
- `GET /api/apikeys` - List user's API keys
- `POST /api/apikeys` - Generate new key
- `DELETE /api/apikeys/:id` - Revoke key
- `GET /api/roles` - List roles
- `POST /api/users/:id/roles` - Assign role
- `GET /api/users` - User management (Admin only)

### UI Changes

New routes:
- `/settings/api-keys` - API key management
- `/settings/users` - User management (Admin only)

### Testing

- ✅ 15 unit tests added/passing
- ✅ 8 integration tests added/passing
- ✅ Manual testing completed
- ✅ Security review passed

### Documentation

- ✅ API docs updated (Swagger)
- ✅ spec2/ status updated
- ✅ Security best practices documented

### Dependencies Met

- ✅ None (foundational feature)

Closes #XXX
```

Ready to create PR?
```

---

## Outcome

✅ Authentication feature complete  
✅ All tests passing  
✅ Documentation updated  
✅ Status tracking current  
✅ Ready for production  

**Total Time:** 2 weeks (as estimated)  
**Status:** 🔶 → ✅

---

This example demonstrates the full workflow from partial implementation to completion using the agent's guidance at each step.
