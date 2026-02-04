# Implementation Plan: Server File Explorer

## Phase 1: Core API (Backend) ✅ COMPLETED
**Duration: 2-3 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Create `ExplorerController.cs`
   - List directory endpoint
   - Get file content endpoint
   - Get file info endpoint

2. [x] Create `ExplorerService.cs`
   - Path validation & security
   - File/folder enumeration
   - MIME type detection

3. [x] Configuration
   - Allowed root paths in appsettings.json
   - Blocked paths (system dirs)
   - Max file size limits

4. [x] Security middleware
   - Path traversal prevention
   - Whitelist validation

### Files Created
```
ControlCenter.Api/
├── Controllers/
│   └── ExplorerController.cs ✅
├── Services/
│   └── ExplorerService.cs ✅
├── Models/
│   └── Explorer/
│       ├── FileItem.cs ✅
│       └── FileOperationRequest.cs ✅
└── Configuration/
    └── ExplorerOptions.cs ✅
```

## Phase 2: File Operations (Backend) ✅ COMPLETED
**Duration: 2 days** | **Completed: 2026-01-06**

### Tasks
1. [x] CRUD operations
   - Create file/folder
   - Rename/move
   - Delete (with recursive)
   - Copy

2. [x] Upload handling
   - Multipart upload
   - Progress tracking

3. [x] Download handling
   - Single file download
   - Search files
   - Execute command in directory

### Files Created/Modified
```
ControlCenter.Api/
├── Controllers/
│   └── ExplorerController.cs ✅ (all endpoints)
└── Services/
    └── ExplorerService.cs ✅ (all methods)
```

## Phase 3: Basic UI (Frontend) ✅ COMPLETED
**Duration: 3-4 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Create Explorer page/route
2. [x] File list component
   - Table view with columns
   - Icon by file type
   - Selection handling

3. [x] Breadcrumb navigation
4. [x] Root paths selection
5. [x] Basic file operations
   - Open folder
   - Download file
   - Delete with confirmation

### Files Created
```
minicluster-ui/app/
├── routes/
│   └── explorer.tsx ✅
├── components/
│   └── Explorer/
│       └── ExplorerPage.tsx ✅ (includes FileRow, Breadcrumb, ContextMenu)
└── services/
    └── explorerService.ts ✅
```

## Phase 4: File Viewing (Frontend) ✅ COMPLETED
**Duration: 2-3 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Preview panel component
2. [x] Text file viewer (Monaco)
3. [x] Image viewer
4. [x] Video/audio player
5. [x] Syntax highlighting by extension

### Files Created
```
minicluster-ui/app/components/Explorer/
└── ExplorerPage.tsx ✅ (PreviewPanel included)
```

## Phase 5: File Editing (Frontend) ✅ COMPLETED
**Duration: 2 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Editor in preview panel
2. [x] Save functionality
3. [x] Dirty state tracking
4. [ ] Auto-save (optional) - deferred
5. [ ] Format/validate for JSON/XML - deferred

### Files to Modify
```
minicluster-ui/app/components/Explorer/
├── FileEditor.tsx (enhance existing or new)
└── viewers/
    └── TextViewer.tsx (add editing)
```

## Phase 6: Upload & Drag-Drop (Frontend) ✅ COMPLETED
**Duration: 2-3 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Upload modal/dropzone
2. [x] Drag & drop from desktop
3. [x] Progress indicators
4. [x] Multi-file upload queue
5. [x] New file/folder creation
6. [x] Rename functionality

### Files Created
```
minicluster-ui/app/components/Explorer/
├── UploadModal.tsx ✅
├── NewItemModal.tsx ✅
└── RenameModal.tsx ✅
```

## Phase 7: Context Menu & Advanced (Frontend) ✅ COMPLETED
**Duration: 2 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Right-click context menu ✅ (already implemented in ExplorerPage)
2. [x] Keyboard shortcuts (Delete, F2, Ctrl+C/X/V, Ctrl+A, F5, Ctrl+N, Ctrl+Shift+N, Backspace, Escape)
3. [x] Copy/cut/paste operations
4. [ ] Multi-select actions - partial (keyboard shortcuts work, batch delete works)
5. [x] Properties dialog

### Files Created
```
minicluster-ui/app/components/Explorer/
├── PropertiesDialog.tsx ✅
└── hooks/
    └── useKeyboardShortcuts.ts ✅
```

## Phase 8: Terminal Integration ✅ COMPLETED
**Duration: 1-2 days** | **Completed: 2026-01-06**

### Tasks
1. [x] "Open terminal here" action from context menu
2. [x] Terminal toolbar button for current directory
3. [x] Terminal panel with maximize/restore
4. [x] Quick terminal open/close toggle

### Files Created
```
minicluster-ui/app/components/Explorer/
└── TerminalPanel.tsx ✅
```

## Phase 9: Polish & Testing ✅ COMPLETED
**Duration: 2-3 days** | **Completed: 2026-01-06**

### Tasks
1. [x] Error handling & messages (error toast with dismiss)
2. [x] Loading states & skeletons (spinner during load)
3. [x] Empty states (folder icon with message)
4. [x] Clipboard visual feedback (status bar indicator, cut items dimmed)
5. [ ] Performance optimization (deferred - virtual scrolling for large dirs)
6. [ ] E2E testing (manual testing recommended)
7. [ ] Security testing (manual testing recommended)

---

## Total Estimated Time: 18-23 days

## Dependencies
- Monaco Editor (already installed)
- react-dropzone or native drag-drop
- JSZip (for client-side ZIP preview)

## Configuration (appsettings.json)
```json
{
  "Explorer": {
    "AllowedPaths": [
      "/var/apps",
      "/home/user/projects"
    ],
    "BlockedPaths": [
      "/etc",
      "/root",
      "/var/log"
    ],
    "MaxUploadSizeMB": 100,
    "MaxEditFileSizeMB": 10,
    "EnableTerminal": true
  }
}
```
