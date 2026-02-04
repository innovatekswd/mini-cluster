# API Design: Server File Explorer

## Base Path
```
/api/explorer
```

## Endpoints

### Directory Operations

#### List Directory
```http
GET /api/explorer/list?path={path}&sort={field}&order={asc|desc}
```
Response:
```json
{
  "path": "/var/apps",
  "parent": "/var",
  "items": [
    {
      "name": "config.json",
      "type": "file",
      "size": 1024,
      "modified": "2026-01-06T10:00:00Z",
      "permissions": "rw-r--r--",
      "extension": "json",
      "mimeType": "application/json"
    },
    {
      "name": "logs",
      "type": "directory",
      "modified": "2026-01-06T09:00:00Z",
      "permissions": "rwxr-xr-x",
      "itemCount": 15
    }
  ],
  "totalItems": 2
}
```

#### Create Directory
```http
POST /api/explorer/mkdir
Body: { "path": "/var/apps/new-folder" }
```

### File Operations

#### Get File Content
```http
GET /api/explorer/file?path={path}
```
- Returns raw content with appropriate Content-Type
- For text files: UTF-8 encoded text
- For binary: application/octet-stream

#### Get File Info
```http
GET /api/explorer/file/info?path={path}
```
Response:
```json
{
  "name": "config.json",
  "path": "/var/apps/config.json",
  "size": 1024,
  "modified": "2026-01-06T10:00:00Z",
  "created": "2026-01-01T08:00:00Z",
  "permissions": "rw-r--r--",
  "owner": "www-data",
  "group": "www-data",
  "mimeType": "application/json",
  "encoding": "utf-8",
  "isReadable": true,
  "isWritable": true
}
```

#### Save File
```http
PUT /api/explorer/file?path={path}
Content-Type: text/plain | application/json | etc.
Body: <file content>
```

#### Create File
```http
POST /api/explorer/file
Body: { "path": "/var/apps/new-file.txt", "content": "" }
```

#### Delete File/Folder
```http
DELETE /api/explorer/delete?path={path}&recursive={true|false}
```

#### Rename/Move
```http
POST /api/explorer/move
Body: { "source": "/var/apps/old.txt", "destination": "/var/apps/new.txt" }
```

#### Copy
```http
POST /api/explorer/copy
Body: { "source": "/var/apps/file.txt", "destination": "/var/backup/file.txt" }
```

### Upload/Download

#### Upload Files
```http
POST /api/explorer/upload?path={targetFolder}
Content-Type: multipart/form-data
Body: files[]
```

#### Download File
```http
GET /api/explorer/download?path={path}
```
- Returns file with Content-Disposition: attachment

#### Download Folder as ZIP
```http
GET /api/explorer/download/zip?path={folderPath}
```

### Search

#### Search Files
```http
GET /api/explorer/search?path={basePath}&query={pattern}&recursive={true}&type={file|dir|all}
```
Response:
```json
{
  "results": [
    { "path": "/var/apps/config.json", "type": "file", "match": "config" }
  ],
  "totalResults": 1
}
```

### Thumbnails

#### Get Image Thumbnail
```http
GET /api/explorer/thumbnail?path={imagePath}&width={w}&height={h}
```

### Terminal Integration

#### Execute Command in Directory
```http
POST /api/explorer/exec
Body: { "path": "/var/apps", "command": "ls -la" }
```
Response:
```json
{
  "stdout": "total 8\ndrwxr-xr-x...",
  "stderr": "",
  "exitCode": 0
}
```

## WebSocket Events

### File Watcher (Optional)
```
ws://host/api/explorer/watch?path={path}
```
Events:
- `file:created` - New file/folder created
- `file:modified` - File content changed
- `file:deleted` - File/folder deleted
- `file:renamed` - File/folder renamed

## Error Responses
```json
{
  "error": "ACCESS_DENIED",
  "message": "Path is outside allowed directories",
  "path": "/etc/passwd"
}
```

Error Codes:
- `ACCESS_DENIED` - Path not allowed
- `NOT_FOUND` - File/folder doesn't exist
- `ALREADY_EXISTS` - File/folder already exists
- `INVALID_PATH` - Malformed path
- `FILE_TOO_LARGE` - Exceeds size limit
- `OPERATION_FAILED` - Generic failure
