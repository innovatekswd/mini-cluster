# MiniCluster API - Changes Summary

## Overview
Enhanced error handling, optional URL validation, and structured export format.

---

## 1. Optional URL Validation ✅

### Backend Changes
- Created `OptionalUrlAttribute` custom validator
- Updated `CreateAppDto` and `UpdateAppDto` to use `[OptionalUrl]` instead of `[Url]`

### API Behavior
- **AccessLink** field is now optional (can be null or empty string)
- Non-empty URLs are validated (must be valid HTTP/HTTPS)
- Empty/null values are accepted without validation

### Frontend Impact
**No code changes required** - Frontend can send empty string or null for AccessLink.

---

## 2. Enhanced App Start Error Response ⚠️

### Endpoint
`POST /api/execution/start/{appId}`

### New Response Structure
```json
{
  "success": false,
  "errorMessage": "Process start failed",
  "errorDetails": "Detailed error message with actionable guidance"
}
```

### New `errorDetails` Field Provides
- File not found errors with full path
- Permission issues (with `chmod +x` suggestion on Linux)
- Invalid executable format errors
- Working directory errors
- Missing dependencies information
- Cross-platform error messages (Windows & Linux)

### Frontend Changes Required
**Update error display logic:**
```typescript
// OLD
if (!response.success) {
  showError(response.errorMessage);
}

// NEW - Show both fields
if (!response.success) {
  showError(response.errorMessage, response.errorDetails);
}
```

**Example error messages:**
- `"Permission denied: No execute permission for '/path/to/app'. Run: chmod +x '/path/to/app'"`
- `"File not found: '/path/to/app' does not exist."`
- `"Invalid executable format: '/path/to/app' cannot be executed (wrong architecture or corrupted)."`

---

## 3. Enhanced Export Configuration 📦

### Endpoint
`GET /api/import/export`

### New Response Structure
```json
{
  "version": "1.0",
  "exportedAt": "2026-01-02T10:48:27Z",
  "exportedBy": "system",
  "variableGroups": [...],
  "apps": [...],
  "metadata": {
    "totalApps": 5,
    "totalVariableGroups": 2
  }
}
```

### Frontend Changes Required
**Update export parsing:**
```typescript
// OLD
const { apps, variableGroups } = exportData;

// NEW
const { version, exportedAt, apps, variableGroups, metadata } = exportData;
```

**Display improvements:**
- Show export version and timestamp
- Display metadata counts
- Handle future version differences

---

## 4. Cross-Platform Support 🖥️

### Platform Detection
- Automatically detects Windows vs Linux
- Platform-specific error messages
- Linux users get `chmod` commands in error messages
- Windows users get Windows-specific guidance

### No Frontend Changes Required
Error messages are automatically tailored to the server's OS.

---

## Testing the Changes

### 1. Test Optional URL Validation
```bash
# Should succeed - empty URL
POST /api/apps
{
  "name": "Test App",
  "executablePath": "/usr/bin/ping",
  "accessLink": ""
}

# Should succeed - valid URL
POST /api/apps
{
  "name": "Test App",
  "executablePath": "/usr/bin/ping",
  "accessLink": "http://localhost:3000"
}

# Should fail - invalid URL
POST /api/apps
{
  "name": "Test App",
  "executablePath": "/usr/bin/ping",
  "accessLink": "not-a-url"
}
```

### 2. Test Enhanced Error Messages
```bash
# Create app with non-existent file
POST /api/apps
{
  "name": "Bad App",
  "executablePath": "/nonexistent/file"
}

# Try to start it
POST /api/execution/start/{appId}

# Response should include detailed errorDetails
```

### 3. Test Export
```bash
GET /api/import/export

# Response should have new structure with version, metadata
```

---

## Running the Updated API

```bash
# Navigate to project
cd /home/younan/innovatek/src/mini-cluster/minicluster-api

# Build
dotnet build

# Run
cd ControlCenter.Api
dotnet run
```

**Server URL:** `http://localhost:5147`

---

## Migration Notes

### Priority Changes
1. **High Priority:** Update error display to show `errorDetails` field
2. **Medium Priority:** Update export parsing to handle new structure
3. **Low Priority:** Update UI to display export metadata

### Backward Compatibility
- ✅ Optional URL: Fully backward compatible
- ⚠️ Error response: `errorDetails` is new field (check for null in old clients)
- ⚠️ Export format: Structure changed (old parsers will break)

---

## Files Modified

### New Files
- `ControlCenter.Api/Validation/OptionalUrlAttribute.cs`
- `ControlCenter.Api/DTOs/ConfigExportDto.cs`

### Modified Files
- `ControlCenter.Api/DTOs/CreateAppDto.cs`
- `ControlCenter.Api/DTOs/UpdateAppDto.cs`
- `ControlCenter.Api/Controllers/ImportController.cs`
- `ControlCenter.Api/Services/AppProcessManager.cs`
