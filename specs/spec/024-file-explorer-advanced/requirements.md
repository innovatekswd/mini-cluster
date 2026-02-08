# Requirements: File Explorer Advanced — Phase 2

> **Last Updated:** 2026-02-08  
> **Status:** 📋 Spec Ready  
> **Depends on:** 001-file-explorer (✅ Complete)

---

## Tier 1 — High Impact (Weeks 1–4)

### 1. Content Search (Grep)
Search *inside* file contents — the single most important missing feature.

**User Story:**
> As a DevOps engineer, I want to search for a string across all files in a directory so that I can find configuration values, error messages, or code references without SSH.

**Acceptance Criteria:**
- [ ] Search bar with toggle between filename search and content search
- [ ] Plain text and regex mode toggle
- [ ] Recursive search within selected directory (or current directory)
- [ ] File type filter (e.g., `*.json`, `*.log`, `*.yaml`)
- [ ] Results show: file path, line number, matching line with highlighted match
- [ ] Click result → opens file in editor at the matching line
- [ ] Max results limit (default 500) to prevent runaway searches
- [ ] Case-sensitive toggle
- [ ] Cancel button for long-running searches
- [ ] Search history (last 10 searches persisted in localStorage)
- [ ] Configurable max file size to scan (default 10 MB, skip binaries)
- [ ] Server-side streaming of results via SignalR for real-time display

**Non-Functional:**
- Response time: first results within 500ms for typical directories
- Respect path security boundaries (allowlist/blocklist)
- Skip binary files automatically

---

### 2. Thumbnail / Grid View
Visual layout toggle that makes image-heavy directories immediately useful.

**User Story:**
> As a content manager, I want to see image thumbnails in a grid so that I can visually browse assets without opening each file.

**Acceptance Criteria:**
- [ ] Toggle button in toolbar: List View ↔ Grid View
- [ ] Grid view shows: thumbnail (128×128), filename, file size
- [ ] Thumbnails generated server-side for images (jpg, png, gif, webp, bmp, svg)
- [ ] Thumbnail caching on server (`.minicluster/thumbnails/` directory)
- [ ] Non-image files show large file-type icons in grid
- [ ] Grid is responsive: auto-adjust columns (2–6) based on container width
- [ ] Selection works in grid (click, Ctrl+click)
- [ ] Context menu works in grid
- [ ] Double-click opens file (same as list view)
- [ ] Persist view preference in localStorage
- [ ] Folders render as folder icon with item count overlay

**Performance:**
- Lazy-load thumbnails (IntersectionObserver)
- Max thumbnail generation: 50 per request
- Thumbnail generation timeout: 5s per image

---

### 3. File Diff / Compare
Side-by-side visual diff using Monaco's built-in diff editor.

**User Story:**
> As a developer, I want to compare two config files so that I can see exactly what changed between environments.

**Acceptance Criteria:**
- [ ] Select two files → "Compare" option in context menu and toolbar
- [ ] Opens Monaco DiffEditor in a modal or full-screen panel
- [ ] Side-by-side and inline diff toggle
- [ ] Additions (green), deletions (red), modifications (yellow) highlighting
- [ ] Navigation buttons: "Next Change" / "Previous Change"
- [ ] Header shows both filenames with sizes
- [ ] Read-only mode (no editing in diff view)
- [ ] Works for any text file type
- [ ] Close button returns to explorer
- [ ] Keyboard shortcut: select two files + `Ctrl+D` to compare

---

### 4. Favorites / Bookmarks
Quick-access pinned paths for frequently visited locations.

**User Story:**
> As an operator, I want to bookmark my most-used directories so that I can jump to them instantly instead of navigating every time.

**Acceptance Criteria:**
- [ ] "Add to Favorites" in context menu (directories and files)
- [ ] Favorites panel: collapsible sidebar section or dropdown in toolbar
- [ ] Each bookmark shows: custom label (editable), full path, icon
- [ ] Click bookmark → navigates to that path
- [ ] Drag to reorder favorites
- [ ] Remove from favorites (context menu or X button)
- [ ] Persisted server-side per user (SQLite `UserFavorites` table)
- [ ] Max 50 favorites per user
- [ ] Favorites pre-loaded on explorer mount (no extra click)
- [ ] Keyboard shortcut: `Ctrl+B` toggle favorites panel

---

### 5. Tree Sidebar
Collapsible directory tree for persistent navigation context.

**User Story:**
> As a sysadmin, I want a directory tree on the left side so that I can see the folder structure at a glance and navigate deep hierarchies quickly.

**Acceptance Criteria:**
- [ ] Left sidebar panel (250px default, resizable)
- [ ] Root nodes = configured allowed paths
- [ ] Click folder → expands/collapses children (lazy-loaded)
- [ ] Click folder → navigates main panel to that directory
- [ ] Current directory highlighted in tree
- [ ] Right-click context menu on tree items (New Folder, Rename, Delete)
- [ ] Toggle sidebar visibility (button + `Ctrl+\` shortcut)
- [ ] Persist expanded/collapsed state in localStorage
- [ ] Show file count badge on folders (optional, togglable)
- [ ] Smooth expand/collapse animations
- [ ] Tree auto-scrolls to keep current directory visible

---

## Tier 2 — Productivity Boosters (Weeks 5–7)

### 6. Batch Rename
Rename multiple files using patterns.

**User Story:**
> As a developer, I want to rename 50 log files at once using a pattern so that I don't waste time renaming them one by one.

**Acceptance Criteria:**
- [ ] Select multiple files → "Batch Rename" in context menu
- [ ] Rename modes:
  - **Find & Replace**: text or regex in filenames
  - **Sequential Numbering**: `prefix_{n}.ext` with configurable start, step, padding
  - **Prefix/Suffix**: add or remove prefix/suffix
  - **Case Change**: UPPER, lower, Title Case
- [ ] Live preview showing old name → new name for every file
- [ ] Conflict detection (warn if rename would overwrite existing file)
- [ ] Undo support (shows original names after completion)
- [ ] Dry-run mode (preview only, no changes)
- [ ] Summary dialog: "Renamed 48/50 files successfully, 2 skipped"

---

### 7. File Watcher / Live Refresh
Real-time file system updates via SignalR.

**User Story:**
> As an operator monitoring a deploy, I want to see new log files appear automatically so that I don't have to manually refresh.

**Acceptance Criteria:**
- [ ] Watch current directory for changes using `FileSystemWatcher`
- [ ] SignalR hub pushes events: Created, Deleted, Renamed, Changed
- [ ] UI updates file list in real-time (add/remove/update rows)
- [ ] Debounce: batch events within 500ms window
- [ ] Visual indicator: brief highlight on changed/new files (green flash)
- [ ] Toggle: "Live Mode" on/off in toolbar
- [ ] Auto-pause when user is editing a file (avoid disruption)
- [ ] Dispose watcher when navigating away
- [ ] Max watched directories: 1 (current directory only)
- [ ] Fallback: if FileSystemWatcher unavailable, show manual refresh button

---

### 8. Drag & Drop Move/Copy
Internal drag-and-drop for moving files between folders.

**User Story:**
> As a user, I want to drag files into a folder in the list to move them, so that file organization feels natural.

**Acceptance Criteria:**
- [ ] Drag file/folder rows within the file list
- [ ] Drop onto a folder row → moves file into that folder
- [ ] Hold `Ctrl` while dropping → copies instead of moves
- [ ] Visual feedback: drag ghost, drop target highlight (blue border)
- [ ] Multi-select drag: drag selected items together
- [ ] Invalid drop targets dimmed (e.g., dropping onto a file)
- [ ] Confirmation dialog for bulk moves (>5 items)
- [ ] Works in both list and grid view
- [ ] Undo notification: "Moved 3 files to /logs — Undo"

---

### 9. Markdown Preview
Live-rendered Markdown preview alongside the editor.

**User Story:**
> As a developer editing README files, I want to see the rendered Markdown in real-time so that I can verify formatting without switching tools.

**Acceptance Criteria:**
- [ ] Detect `.md` / `.markdown` files in preview panel
- [ ] Split view: Monaco editor (left) + rendered HTML (right)
- [ ] Render: headings, bold, italic, links, images, code blocks, tables, lists, blockquotes, horizontal rules
- [ ] Syntax-highlighted code blocks (using highlight.js or Prism)
- [ ] Scroll sync: scrolling editor scrolls preview proportionally
- [ ] Toggle between: Editor Only, Preview Only, Split
- [ ] GitHub-flavored Markdown (GFM) support: task lists, strikethrough, tables
- [ ] Relative image paths resolved against file location
- [ ] Mermaid diagram rendering (optional, via mermaid.js)

---

### 10. Permissions Editor
Visual chmod/chown editor for Linux file permissions.

**User Story:**
> As a sysadmin, I want to change file permissions from the UI so that I don't need to SSH into the server for routine permission fixes.

**Acceptance Criteria:**
- [ ] "Edit Permissions" in context menu and properties dialog
- [ ] Visual checkbox grid: Read/Write/Execute × Owner/Group/Other
- [ ] Numeric input (e.g., `755`) with auto-sync to checkboxes
- [ ] Owner and group dropdowns (populated from system)
- [ ] Recursive option for directories
- [ ] Preview: "chmod 755 /var/apps/config" before applying
- [ ] Apply button with confirmation
- [ ] Linux-only feature — hidden/disabled on Windows
- [ ] Batch permissions: apply to selected files

---

## Tier 3 — Power User (Weeks 8–10)

### 11. Symlink Management
Create, view, and resolve symbolic links.

**User Story:**
> As a sysadmin, I want to create and manage symlinks from the UI so that I can set up application configurations without terminal access.

**Acceptance Criteria:**
- [ ] "Create Symlink" in context menu
- [ ] Dialog: target path input + link name
- [ ] Symlink indicator on file rows (→ icon + target path tooltip)
- [ ] "Resolve Symlink" option → navigate to actual target
- [ ] "Remove Symlink" deletes link, not target
- [ ] Broken symlinks shown with warning icon (red)
- [ ] Works for both file and directory symlinks
- [ ] Linux/macOS only — hidden on Windows (or use junctions)

---

### 12. Disk Usage Analyzer
Visual breakdown of directory sizes.

**User Story:**
> As an operator, I want to see which folders are consuming the most disk space so that I can clean up before running out of storage.

**Acceptance Criteria:**
- [ ] "Analyze Disk Usage" in context menu (directories)
- [ ] Modal shows: treemap or horizontal bar chart of folder sizes
- [ ] Drill down: click a segment → zoom into that folder
- [ ] Stats: total size, file count, largest file, folder count
- [ ] Top 10 largest files table
- [ ] Async calculation with progress bar (large directories)
- [ ] Server-side recursive size calculation with caching
- [ ] Cache TTL: 5 minutes (option to refresh)
- [ ] Delete actions from within the analyzer
- [ ] Export report as JSON/CSV

---

### 13. File Sharing / Quick Links
Generate temporary download links for files.

**User Story:**
> As a team lead, I want to share a quick download link for a log file with a colleague who doesn't have MiniCluster access.

**Acceptance Criteria:**
- [ ] "Share Link" in context menu (files only)
- [ ] Generate time-limited token URL (1 hour, 24 hours, 7 days, custom)
- [ ] Optional: password-protected links
- [ ] Optional: download limit (1, 5, 10, unlimited)
- [ ] Copy link to clipboard button
- [ ] Manage active share links page (list, revoke)
- [ ] No authentication required to access shared link
- [ ] Server-side: `SharedLinks` table (token, filePath, expiresAt, downloadCount, maxDownloads, password)
- [ ] Endpoint: `GET /api/explorer/shared/{token}` → streams file
- [ ] Auto-cleanup expired links (background service)

---

### 14. Tabs (Multi-File)
Open multiple files/directories in tabs.

**User Story:**
> As a developer, I want to keep multiple files open in tabs so that I can switch between configs without re-navigating.

**Acceptance Criteria:**
- [ ] Tab bar below toolbar (horizontal, scrollable)
- [ ] Double-click file → opens in new tab
- [ ] Tab shows: filename, dirty indicator (dot), close button
- [ ] Middle-click tab → close
- [ ] Right-click tab → Close, Close Others, Close All, Close to Right
- [ ] `Ctrl+W` close current tab
- [ ] `Ctrl+Tab` cycle through tabs
- [ ] Unsaved changes: warn before closing dirty tab
- [ ] Tabs persist in sessionStorage (survive page refresh)
- [ ] Max 15 open tabs (oldest auto-closes when exceeded)
- [ ] Pin tabs (pinned tabs can't be closed accidentally)

---

### 15. Git Status Integration
Show git status indicators on files.

**User Story:**
> As a developer browsing a git repo, I want to see which files are modified, staged, or untracked so that I can review changes before committing.

**Acceptance Criteria:**
- [ ] Detect if current directory is inside a git repository
- [ ] File status indicators: Modified (M, orange), Added (A, green), Deleted (D, red), Untracked (U, gray), Renamed (R, blue)
- [ ] Status icon/badge beside filename in list and grid view
- [ ] Toolbar shows: branch name, dirty indicator
- [ ] "View Diff" in context menu → opens diff vs HEAD in Monaco DiffEditor
- [ ] Status refreshes on navigation and file changes
- [ ] Git operations NOT included (no commit/push) — view-only in this phase
- [ ] Disable gracefully if `git` not installed

---

## Non-Functional Requirements

### Performance
| Metric | Target |
|--------|--------|
| Content search: first result | < 500ms for directories under 1000 files |
| Thumbnail generation | < 200ms per image (cached thereafter) |
| Tree sidebar load | < 100ms per level expansion |
| Disk usage scan (1GB directory) | < 10s |
| File watcher event latency | < 1s from disk event to UI update |

### Security
- All new endpoints behind `[Authorize]`
- Content search respects path allowlist/blocklist
- Share links use cryptographically secure tokens (256-bit)
- Permissions editor validates current user's sudo/root access
- Thumbnail directory excluded from search

### Compatibility
- Permissions editor: Linux/macOS only (hidden on Windows)
- Symlink management: Linux/macOS (Windows uses junctions fallback)
- Git integration: requires `git` CLI on server PATH
- FileSystemWatcher: .NET native (works on all platforms)
- All other features: cross-platform

---

## Dependencies on Existing Features
| Feature | Depends On |
|---------|-----------|
| Content Search | ExplorerService (path validation), SignalR hub |
| Grid View | ExplorerController (new thumbnail endpoint) |
| File Diff | Monaco Editor (already lazy-loaded) |
| Favorites | Authentication (user identity for per-user storage) |
| File Watcher | SignalR infrastructure (LogHub pattern) |
| Permissions Editor | ExplorerService, PropertiesDialog |
| Git Integration | ExplorerService (exec command support) |
| Share Links | New DB table, background cleanup service |
