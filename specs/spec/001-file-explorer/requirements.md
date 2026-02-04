# Requirements: Server File Explorer

## Core Features

### 1. File Browsing
- [x] Browse server filesystem with tree/list view
- [x] Navigate folders with breadcrumb navigation
- [x] Sort by name, size, date, type
- [x] Filter by file type/extension
- [x] Search files by name (recursive option)
- [x] Show file metadata (size, permissions, modified date)
- [x] Configurable root paths (security boundaries)

### 2. File Viewing
| File Type | View Mode | Edit |
|-----------|-----------|------|
| Text (.txt, .log, .md) | Monaco Editor | ✅ |
| Code (.json, .xml, .yaml, .ini, .conf) | Monaco + Syntax | ✅ |
| SVG | Preview + Source | ✅ |
| Images (.png, .jpg, .gif, .webp, .bmp) | Image Viewer | ❌ |
| Videos (.mp4, .webm, .mov) | Video Player | ❌ |
| Audio (.mp3, .wav, .ogg) | Audio Player | ❌ |
| PDF | PDF Viewer | ❌ |
| Binary | Hex View (optional) | ❌ |

### 3. File Operations
- [x] Create new file/folder
- [x] Rename file/folder
- [x] Delete file/folder (with confirmation)
- [x] Copy/Move files
- [x] Download single file
- [x] Download folder as ZIP
- [x] Upload files (multi-select)
- [x] Drag & drop upload to specific folder
- [x] Paste from clipboard (images)

### 4. Integrated Terminal
- [x] Open terminal at current directory
- [x] Run quick commands in context
- [x] View command output inline

### 5. Additional Features
- [x] File bookmarks/favorites
- [x] Recent files history
- [x] Keyboard shortcuts
- [x] Context menu (right-click)
- [x] Multi-select operations
- [x] File permissions viewer (Linux)
- [x] Disk usage indicator

## Security Requirements
- Configurable allowed paths (whitelist)
- Blocked paths (system directories)
- File size limits for upload/edit
- Rate limiting for operations
- Audit logging for file operations
- Authentication required

## Performance Requirements
- Lazy loading for large directories (500+ files)
- Chunked upload for large files
- Streaming download for large files
- Thumbnail caching for images
- Virtual scrolling for file lists
