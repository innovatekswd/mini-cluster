# API Design: File Explorer Advanced — Phase 2

> **Base Path:** `/api/explorer`  
> **Last Updated:** 2026-02-08

---

## 1. Content Search (Grep)

### Search File Contents
```http
GET /api/explorer/search-content?path={dirPath}&query={searchText}&regex={bool}&caseSensitive={bool}&filePattern={glob}&recursive={bool}&maxResults={int}&maxFileSizeMB={int}
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| path | string | required | Directory to search in |
| query | string | required | Search text or regex pattern |
| regex | bool | false | Treat query as regex |
| caseSensitive | bool | false | Case-sensitive matching |
| filePattern | string | `*` | Glob pattern filter (e.g., `*.json`) |
| recursive | bool | true | Search subdirectories |
| maxResults | int | 500 | Maximum matches to return |
| maxFileSizeMB | int | 10 | Skip files larger than this |

**Response:**
```json
{
  "query": "database_url",
  "directory": "/var/apps",
  "totalMatches": 12,
  "filesSearched": 340,
  "filesSkipped": 5,
  "elapsedMs": 230,
  "results": [
    {
      "filePath": "/var/apps/api/.env",
      "lineNumber": 14,
      "lineContent": "DATABASE_URL=postgres://localhost:5432/mydb",
      "matchStart": 0,
      "matchEnd": 12,
      "context": {
        "before": ["# Database configuration", ""],
        "after": ["DATABASE_POOL=10"]
      }
    }
  ]
}
```

### Stream Search Results (SignalR)
```
Hub: /hubs/explorer
Method: SearchContent(string path, string query, SearchOptions options)
Client receives: OnSearchResult(SearchMatch match)
Client receives: OnSearchComplete(SearchSummary summary)
Client sends: CancelSearch(string searchId)
```

---

## 2. Thumbnails

### Get Thumbnail
```http
GET /api/explorer/thumbnail?path={filePath}&size={int}
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| path | string | required | Path to image file |
| size | int | 128 | Thumbnail size in px (64, 128, 256) |

**Response:** `image/jpeg` binary stream (thumbnails always JPEG for consistency)

**Caching:** `Cache-Control: public, max-age=86400` + ETag based on file modified time

---

## 3. Favorites / Bookmarks

### List Favorites
```http
GET /api/explorer/favorites
```
**Response:**
```json
{
  "favorites": [
    {
      "id": "f1a2b3c4",
      "label": "App Configs",
      "path": "/var/apps/config",
      "type": "directory",
      "sortOrder": 0,
      "createdAt": "2026-02-08T10:00:00Z"
    }
  ]
}
```

### Add Favorite
```http
POST /api/explorer/favorites
```
**Body:**
```json
{
  "path": "/var/apps/config",
  "label": "App Configs"
}
```

### Update Favorite
```http
PUT /api/explorer/favorites/{id}
```
**Body:**
```json
{
  "label": "My Configs",
  "sortOrder": 2
}
```

### Delete Favorite
```http
DELETE /api/explorer/favorites/{id}
```

### Reorder Favorites
```http
PUT /api/explorer/favorites/reorder
```
**Body:**
```json
{
  "orderedIds": ["f1a2b3c4", "a5b6c7d8", "e9f0a1b2"]
}
```

---

## 4. Batch Rename

### Preview Batch Rename
```http
POST /api/explorer/batch-rename/preview
```
**Body:**
```json
{
  "paths": ["/var/apps/log1.txt", "/var/apps/log2.txt"],
  "mode": "findReplace",
  "options": {
    "find": "log",
    "replace": "archive",
    "regex": false,
    "caseSensitive": false
  }
}
```

**Modes & Options:**
| Mode | Options |
|------|---------|
| `findReplace` | `find`, `replace`, `regex`, `caseSensitive` |
| `sequential` | `prefix`, `suffix`, `start`, `step`, `padding` |
| `prefixSuffix` | `addPrefix`, `addSuffix`, `removePrefix`, `removeSuffix` |
| `caseChange` | `caseType` (`upper`, `lower`, `title`) |

**Response:**
```json
{
  "previews": [
    {
      "originalPath": "/var/apps/log1.txt",
      "newPath": "/var/apps/archive1.txt",
      "conflict": false
    }
  ],
  "conflicts": 0,
  "totalFiles": 2
}
```

### Execute Batch Rename
```http
POST /api/explorer/batch-rename/execute
```
Same body as preview. Response:
```json
{
  "success": true,
  "renamed": 48,
  "skipped": 2,
  "errors": [
    { "path": "/var/apps/log49.txt", "error": "Permission denied" }
  ]
}
```

---

## 5. File Watcher (SignalR)

### Hub Events
```
Hub: /hubs/explorer

Client sends: WatchDirectory(string path)
Client sends: UnwatchDirectory()

Server pushes: OnFileCreated(FileEvent event)
Server pushes: OnFileDeleted(FileEvent event)
Server pushes: OnFileRenamed(FileRenameEvent event)
Server pushes: OnFileChanged(FileEvent event)
```

**FileEvent:**
```json
{
  "path": "/var/apps/newfile.log",
  "name": "newfile.log",
  "type": "file",
  "timestamp": "2026-02-08T10:30:00Z"
}
```

---

## 6. Permissions Editor

### Get Permissions
```http
GET /api/explorer/permissions?path={path}
```
**Response:**
```json
{
  "path": "/var/apps/config.json",
  "octal": "644",
  "owner": { "read": true, "write": true, "execute": false },
  "group": { "read": true, "write": false, "execute": false },
  "other": { "read": true, "write": false, "execute": false },
  "ownerName": "www-data",
  "groupName": "www-data",
  "availableOwners": ["root", "www-data", "ubuntu"],
  "availableGroups": ["root", "www-data", "docker"]
}
```

### Set Permissions
```http
PUT /api/explorer/permissions
```
**Body:**
```json
{
  "path": "/var/apps/config.json",
  "octal": "755",
  "owner": "www-data",
  "group": "www-data",
  "recursive": false
}
```

---

## 7. Symlink Management

### Create Symlink
```http
POST /api/explorer/symlink
```
**Body:**
```json
{
  "targetPath": "/var/apps/config/production.json",
  "linkPath": "/var/apps/config/current.json"
}
```

### Resolve Symlink
```http
GET /api/explorer/symlink/resolve?path={linkPath}
```
**Response:**
```json
{
  "linkPath": "/var/apps/config/current.json",
  "targetPath": "/var/apps/config/production.json",
  "targetExists": true,
  "isDirectory": false
}
```

---

## 8. Disk Usage Analyzer

### Analyze Directory
```http
GET /api/explorer/disk-usage?path={dirPath}&depth={int}
```

**Parameters:**
| Param | Type | Default | Description |
|-------|------|---------|-------------|
| path | string | required | Directory to analyze |
| depth | int | 2 | Max depth for breakdown |

**Response:**
```json
{
  "path": "/var/apps",
  "totalSize": 5368709120,
  "totalFiles": 12450,
  "totalDirectories": 340,
  "largestFile": {
    "path": "/var/apps/uploads/backup.tar.gz",
    "size": 1073741824
  },
  "children": [
    {
      "name": "uploads",
      "path": "/var/apps/uploads",
      "size": 3221225472,
      "percentage": 60.0,
      "fileCount": 230,
      "children": []
    }
  ],
  "topFiles": [
    { "path": "/var/apps/uploads/backup.tar.gz", "size": 1073741824 }
  ],
  "cachedAt": "2026-02-08T10:30:00Z"
}
```

---

## 9. File Sharing / Quick Links

### Create Share Link
```http
POST /api/explorer/share
```
**Body:**
```json
{
  "filePath": "/var/apps/logs/error.log",
  "expiresIn": "24h",
  "maxDownloads": 5,
  "password": null
}
```
**Response:**
```json
{
  "id": "share_abc123",
  "token": "eyJhbGciOi...",
  "url": "http://localhost:5147/api/explorer/shared/eyJhbGciOi...",
  "expiresAt": "2026-02-09T10:30:00Z",
  "maxDownloads": 5,
  "downloadCount": 0
}
```

### Download Shared File (No Auth)
```http
GET /api/explorer/shared/{token}?password={optional}
```
Returns file stream. 401 if password required and not provided. 410 if expired.

### List Active Shares
```http
GET /api/explorer/shares
```

### Revoke Share
```http
DELETE /api/explorer/shares/{id}
```

---

## 10. Git Status

### Get Git Status
```http
GET /api/explorer/git/status?path={dirPath}
```
**Response:**
```json
{
  "isGitRepo": true,
  "branch": "main",
  "isDirty": true,
  "ahead": 2,
  "behind": 0,
  "files": [
    { "path": "src/config.json", "status": "modified", "staged": false },
    { "path": "src/new-file.ts", "status": "untracked", "staged": false },
    { "path": "src/deleted.ts", "status": "deleted", "staged": true }
  ]
}
```

### Get File Diff
```http
GET /api/explorer/git/diff?path={filePath}
```
**Response:**
```json
{
  "filePath": "/var/apps/src/config.json",
  "original": "{\n  \"port\": 3000\n}",
  "modified": "{\n  \"port\": 8080\n}",
  "diffStats": { "additions": 1, "deletions": 1 }
}
```

---

## Database Schema Additions

### UserFavorites (for Bookmarks)
```sql
CREATE TABLE UserFavorites (
  Id TEXT PRIMARY KEY,
  UserId TEXT NOT NULL,
  Label TEXT NOT NULL,
  Path TEXT NOT NULL,
  Type TEXT NOT NULL DEFAULT 'directory',
  SortOrder INTEGER NOT NULL DEFAULT 0,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE CASCADE
);
CREATE INDEX idx_favorites_user ON UserFavorites(UserId);
```

### SharedLinks (for File Sharing)
```sql
CREATE TABLE SharedLinks (
  Id TEXT PRIMARY KEY,
  Token TEXT NOT NULL UNIQUE,
  FilePath TEXT NOT NULL,
  CreatedByUserId TEXT NOT NULL,
  ExpiresAt DATETIME NOT NULL,
  MaxDownloads INTEGER,
  DownloadCount INTEGER NOT NULL DEFAULT 0,
  PasswordHash TEXT,
  CreatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (CreatedByUserId) REFERENCES Users(Id) ON DELETE CASCADE
);
CREATE INDEX idx_shared_token ON SharedLinks(Token);
CREATE INDEX idx_shared_expires ON SharedLinks(ExpiresAt);
```
