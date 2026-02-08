# UI Design: File Explorer Advanced — Phase 2

> **Last Updated:** 2026-02-08  
> **Framework:** React 19, TailwindCSS, Monaco Editor, Recharts

---

## Layout Evolution

### Current Layout (Phase 1)
```
┌──────────────────────────────────────────────────────┐
│  Toolbar: [Home] [Back] [Address Bar    ] [Search] ⚙ │
├──────────────────────────────────────────────────────┤
│                                     │                │
│  File List                          │  Preview Panel │
│  ┌──────────────────────────────┐   │  (Monaco/Media)│
│  │ Name        Size    Modified │   │                │
│  │ 📁 config   —       Jan 5   │   │                │
│  │ 📄 app.js   12 KB   Jan 8   │   │                │
│  │ 🖼 logo.png 45 KB   Jan 3   │   │                │
│  └──────────────────────────────┘   │                │
│                                     │                │
├──────────────────────────────────────────────────────┤
│  Status Bar: 15 items | 3 selected | 📋 Clipboard   │
├──────────────────────────────────────────────────────┤
│  Terminal Panel (collapsible)                        │
└──────────────────────────────────────────────────────┘
```

### Phase 2 Layout
```
┌──────────────────────────────────────────────────────────────┐
│  Toolbar: [Home][Back] [Address Bar        ] [🔍][📊][≡/⊞] ⚙│
│           [Favorites ▾] [Live 🟢]                             │
├─────────┬────────────────────────────────────┬───────────────┤
│         │  Tab Bar: [app.js ●] [.env] [+]   │               │
│  Tree   ├────────────────────────────────────┤  Preview /    │
│ Sidebar │                                    │  Diff Panel   │
│         │  File List / Grid View             │               │
│ 📁 /var │  ┌──────────────────────────────┐  │  Monaco Editor│
│  📁 apps│  │ Name    [M] Size    Modified │  │  or           │
│   📁 api│  │ 📁 config   —       Jan 5   │  │  Diff Viewer  │
│   📁 ui │  │ 📄 app.js M 12 KB   Jan 8   │  │  or           │
│  📁 logs│  │ 🖼 logo.png 45 KB   Jan 3   │  │  MD Preview   │
│         │  │ 📄 .env  A  1 KB    Jan 9   │  │               │
│ ★ Favs  │  └──────────────────────────────┘  │               │
│  App Cfg│                                    │               │
│  Logs   │  OR (Grid View):                   │               │
│         │  ┌─────┬─────┬─────┬─────┐        │               │
│         │  │ 🖼  │ 🖼  │ 🖼  │ 📄  │        │               │
│         │  │logo │hero │bg   │conf │        │               │
│         │  │45KB │120K │80KB │1KB  │        │               │
│         │  └─────┴─────┴─────┴─────┘        │               │
├─────────┴────────────────────────────────────┴───────────────┤
│  Status: 15 items | 3 selected | Branch: main (2 modified)  │
├──────────────────────────────────────────────────────────────┤
│  Terminal Panel                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## New Components

### 1. ContentSearchPanel
**Location:** Slides down below toolbar (like VS Code search)

```
┌──────────────────────────────────────────────────┐
│ 🔍 [Search in files...        ] [.*] [Aa] [Cc]  │
│    [Filter: *.json, *.yaml    ] [Cancel]         │
├──────────────────────────────────────────────────┤
│ 12 results in 340 files (230ms)                  │
│                                                  │
│ 📄 /var/apps/api/.env                            │
│   14: DATABASE_URL=postgres://localhost:5432/mydb │
│   18: DATABASE_POOL=10                           │
│                                                  │
│ 📄 /var/apps/api/config.json                     │
│    5: "database": "postgres://..."               │
│                                                  │
│ [Load more...]                                   │
└──────────────────────────────────────────────────┘

Icons: [.*] = regex toggle, [Aa] = case sensitive, [Cc] = whole word
```

**Behavior:**
- `Ctrl+Shift+F` opens panel
- Escape closes panel
- Click result → opens file at line in editor
- Highlighted matches in result text
- Grouped by file with collapsible sections

---

### 2. TreeSidebar
**Location:** Left panel, resizable divider

```
┌─────────────┐
│ EXPLORER     │
│ ▾ 📁 /var    │
│   ▾ 📁 apps │
│     ▸ 📁 api│ ← current dir highlighted
│     ▸ 📁 ui │
│   ▸ 📁 logs │
│   ▸ 📁 tmp  │
│              │
│ ★ FAVORITES  │
│   📁 App Cfg │
│   📁 Logs    │
│   📄 .env    │
└─────────────┘
```

**Interactions:**
- Single-click: navigate main panel
- Right-click: context menu (New Folder, Rename, Delete)
- Arrow keys: navigate tree
- Enter: expand/collapse
- Favorites section below tree, separated by divider
- Draggable resize handle on right edge

---

### 3. GridView
**Location:** Replaces file list when grid mode is active

```
┌─────────┬─────────┬─────────┬─────────┐
│  ┌───┐  │  ┌───┐  │  ┌───┐  │  ┌───┐  │
│  │ 🖼│  │  │ 🖼│  │  │ 📁│  │  │ 📄│  │
│  │   │  │  │   │  │  │   │  │  │   │  │
│  └───┘  │  └───┘  │  └───┘  │  └───┘  │
│ logo.png│ hero.jpg│ assets/ │ conf.js │
│  45 KB  │ 120 KB  │ 12 items│  1 KB   │
│ ✓ selected       │         │         │
└─────────┴─────────┴─────────┴─────────┘
```

**Card Design:**
- 160×140px cards (responsive)
- Image files: actual thumbnail (128×128)
- Folders: large folder emoji + item count
- Other files: large emoji icon matching FileIcon
- Bottom: filename (truncated) + size
- Selected: blue border + checkmark
- Hover: slight scale + shadow

---

### 4. DiffViewer
**Location:** Replaces preview panel content

```
┌─────────────────────────────────────────────┐
│ Comparing: config.prod.json ↔ config.dev.json│
│ [Side-by-side] [Inline] [← Prev] [Next →]  │
├─────────────────────┬───────────────────────┤
│ config.prod.json    │ config.dev.json       │
│  1  {               │  1  {                 │
│  2    "port": 443   │  2    "port": 3000    │ ← yellow
│  3    "ssl": true   │  3    "ssl": false    │ ← yellow
│  4    "db": "prod"  │  4    "db": "dev"     │ ← yellow
│  5  }               │  5    "debug": true   │ ← green
│                     │  6  }                 │
└─────────────────────┴───────────────────────┘
```

Uses `MonacoDiffEditor` component (lazy-loaded like Monaco).

---

### 5. BatchRenameModal
**Location:** Modal overlay

```
┌──────────────────────────────────────────────┐
│ Batch Rename (12 files)                   ✕  │
├──────────────────────────────────────────────┤
│ Mode: [Find & Replace ▾]                    │
│                                              │
│ Find:    [log                ]  [.*] regex   │
│ Replace: [archive            ]               │
│                                              │
│ Preview:                                     │
│ ┌────────────────────────────────────────┐   │
│ │ log_001.txt  →  archive_001.txt       │   │
│ │ log_002.txt  →  archive_002.txt       │   │
│ │ log_003.txt  →  archive_003.txt       │   │
│ │ summary.log  →  summary.archive  ⚠️   │   │
│ └────────────────────────────────────────┘   │
│                                              │
│ ⚠️ 1 conflict detected                      │
│                                              │
│               [Cancel]  [Rename 12 Files]    │
└──────────────────────────────────────────────┘
```

---

### 6. DiskUsageModal
**Location:** Modal overlay with chart

```
┌──────────────────────────────────────────────┐
│ Disk Usage: /var/apps (5.0 GB)            ✕  │
├──────────────────────────────────────────────┤
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ ████████████████████░░░░░░░░░░░░░░░ │    │
│  │ uploads (3.0 GB, 60%)               │    │
│  │ ██████████░░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │ logs (1.2 GB, 24%)                  │    │
│  │ ████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │ config (0.5 GB, 10%)               │    │
│  │ ██░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ │    │
│  │ other (0.3 GB, 6%)                 │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  Top Files:                                  │
│  1. uploads/backup.tar.gz ........... 1.0 GB │
│  2. logs/app-2026-01.log ........... 450 MB  │
│  3. uploads/db-dump.sql ............ 380 MB  │
│                                              │
│  Stats: 12,450 files | 340 folders           │
│                                              │
│                    [Refresh]  [Export CSV]    │
└──────────────────────────────────────────────┘
```

---

### 7. ShareLinkModal
**Location:** Modal overlay

```
┌──────────────────────────────────────────────┐
│ Share: error.log (2.4 MB)                 ✕  │
├──────────────────────────────────────────────┤
│                                              │
│ Expires in: [24 hours ▾]                     │
│ Max downloads: [5        ] (0 = unlimited)   │
│ Password: [          ] (optional)            │
│                                              │
│ ┌────────────────────────────────────────┐   │
│ │ https://mc.example.com/api/explorer/   │   │
│ │ shared/eyJhbGciOi...                   │   │
│ └────────────────────────────────────────┘   │
│                        [📋 Copy Link]        │
│                                              │
│               [Cancel]  [Create Link]        │
└──────────────────────────────────────────────┘
```

---

### 8. MarkdownPreview
**Location:** Right side of PreviewPanel for `.md` files

```
┌───────────────────────┬───────────────────────┐
│ Monaco Editor         │ Rendered Preview       │
│                       │                        │
│ # My Project          │ My Project             │
│                       │ ═══════════            │
│ A **bold** statement. │ A bold statement.      │
│                       │                        │
│ ```js                 │ ┌──────────────────┐   │
│ const x = 1;          │ │ const x = 1;     │   │
│ ```                   │ └──────────────────┘   │
│                       │                        │
│ - [x] Done            │ ☑ Done                 │
│ - [ ] Todo            │ ☐ Todo                 │
└───────────────────────┴───────────────────────┘
        [Editor] [Split] [Preview]
```

---

## Updated Toolbar

```
┌────────────────────────────────────────────────────────────────┐
│ [🏠][←][→] [/var/apps/config________________] [🔍▾][📊][≡|⊞] │
│ [★ Favorites ▾] [Live 🟢] [📁 Tree]                    [⛶]   │
└────────────────────────────────────────────────────────────────┘

🔍▾ = dropdown with "File Name" / "File Contents" toggle
📊 = Disk Usage
≡|⊞ = List/Grid view toggle
★ = Favorites dropdown
🟢 = Live mode indicator (green=watching, gray=off)
📁 = Toggle tree sidebar
⛶ = Fullscreen
```

---

## Updated Context Menu

```
For Files:
┌─────────────────────────┐
│ ✏️  Edit                 │
│ 👁  Preview              │
│ ───────────────────────  │
│ 📋  Copy                 │
│ ✂️  Cut                  │
│ 📝  Rename               │
│ 🔗  Create Symlink       │  ← NEW
│ ───────────────────────  │
│ 🔀  Compare With...      │  ← NEW
│ 🔎  Search in File       │  ← NEW
│ ───────────────────────  │
│ 📦  Compress...          │
│ 🔗  Share Link...        │  ← NEW
│ ⬇️  Download             │
│ ───────────────────────  │
│ ★  Add to Favorites     │  ← NEW
│ 🔐  Permissions...       │  ← NEW
│ ℹ️  Properties           │
│ 🗑  Delete               │
└─────────────────────────┘

For Directories:
┌─────────────────────────┐
│ 📂  Open                 │
│ 💻  Open Terminal Here   │
│ ───────────────────────  │
│ 📋  Copy                 │
│ ✂️  Cut                  │
│ 📝  Rename               │
│ 🔗  Create Symlink       │  ← NEW
│ ───────────────────────  │
│ 🔎  Search in Folder     │  ← NEW
│ 📊  Disk Usage...        │  ← NEW
│ 📝  Batch Rename...      │  ← NEW  (when multi-selected)
│ ───────────────────────  │
│ 📦  Compress...          │
│ ───────────────────────  │
│ ★  Add to Favorites     │  ← NEW
│ 🔐  Permissions...       │  ← NEW
│ ℹ️  Properties           │
│ 🗑  Delete               │
└─────────────────────────┘

For Archives (additional):
│ 📦  Extract...           │
│ 🔍  Browse Archive       │
```

---

## New Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+Shift+F` | Content search panel |
| `Ctrl+D` | Compare selected files (2 files selected) |
| `Ctrl+B` | Toggle favorites panel |
| `Ctrl+\` | Toggle tree sidebar |
| `Ctrl+G` | Toggle grid/list view |
| `Ctrl+L` | Toggle live mode |
| `Ctrl+W` | Close current tab |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `F3` | Batch rename (multi-selected) |

---

## Color Scheme for Git Status

| Status | Color | Indicator |
|--------|-------|-----------|
| Modified | `text-orange-400` | M |
| Added/Untracked | `text-green-400` | A / U |
| Deleted | `text-red-400` | D |
| Renamed | `text-blue-400` | R |
| Staged | Left border `border-l-2 border-green-500` | — |
| Conflicted | `text-red-600 font-bold` | C |

---

## Component Inventory (New)

| Component | File | Type |
|-----------|------|------|
| ContentSearchPanel | `ContentSearchPanel.tsx` | Panel |
| TreeSidebar | `TreeSidebar.tsx` | Panel |
| GridView | `GridView.tsx` | View |
| GridCard | `GridCard.tsx` | Sub-component |
| DiffViewer | `DiffViewer.tsx` | Panel |
| BatchRenameModal | `BatchRenameModal.tsx` | Modal |
| DiskUsageModal | `DiskUsageModal.tsx` | Modal |
| ShareLinkModal | `ShareLinkModal.tsx` | Modal |
| PermissionsEditor | `PermissionsEditor.tsx` | Modal |
| MarkdownPreview | `MarkdownPreview.tsx` | Panel |
| TabBar | `TabBar.tsx` | Component |
| FavoritesDropdown | `FavoritesDropdown.tsx` | Dropdown |
| GitStatusBadge | `GitStatusBadge.tsx` | Inline |
| SymlinkDialog | `SymlinkDialog.tsx` | Modal |
| LiveModeIndicator | `LiveModeIndicator.tsx` | Inline |

Total: **15 new components** added to existing 14 = **29 components** total.
