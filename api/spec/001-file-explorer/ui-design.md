# UI Design: Server File Explorer

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 📁 File Explorer                              [⬆️ Upload] [➕]  │
├─────────────────────────────────────────────────────────────────┤
│ 📍 / > var > apps > myapp                    🔍 Search...      │
├──────────────────┬──────────────────────────────────────────────┤
│                  │                                              │
│  📁 Tree View    │   File List / Preview Area                   │
│                  │                                              │
│  ▼ 📁 var        │   Name          Size      Modified           │
│    ▼ 📁 apps     │   ─────────────────────────────────         │
│      ▶ 📁 app1   │   📁 config     -         Jan 6, 10:00      │
│      ▼ 📁 myapp  │   📄 app.json   2.1 KB    Jan 6, 09:30      │
│        📄 app.js │   🖼️ logo.png   45 KB     Jan 5, 14:20      │
│        📄 conf   │   📄 README.md  1.2 KB    Jan 4, 11:00      │
│    ▶ 📁 logs     │                                              │
│                  │                                              │
├──────────────────┴──────────────────────────────────────────────┤
│ 4 items | 48.3 KB total | 💾 250 GB free                        │
└─────────────────────────────────────────────────────────────────┘
```

## Components

### 1. Toolbar
- Upload button (opens file picker)
- New file/folder dropdown
- View mode toggle (list/grid/tree)
- Sort dropdown
- Refresh button

### 2. Breadcrumb Navigation
- Clickable path segments
- Home button (configured root)
- Copy path button

### 3. Sidebar Tree
- Collapsible folder tree
- Drag & drop reordering
- Right-click context menu
- Favorites/bookmarks section

### 4. File List/Grid
- Sortable columns (name, size, date, type)
- Multi-select with Ctrl/Shift
- Drag & drop to move/copy
- Double-click to open
- Right-click context menu
- Drop zone highlight on drag over

### 5. Preview Panel (Split View)
- Toggle on/off
- Auto-preview on select
- Editor for text files
- Image viewer with zoom
- Video/audio player
- Download button

### 6. Context Menu
```
┌─────────────────────┐
│ 📂 Open             │
│ 📝 Edit             │
│ ─────────────────── │
│ ✂️ Cut              │
│ 📋 Copy             │
│ 📄 Paste            │
│ ─────────────────── │
│ ✏️ Rename           │
│ 🗑️ Delete           │
│ ─────────────────── │
│ ⬇️ Download         │
│ 📤 Upload here      │
│ ─────────────────── │
│ 💻 Open Terminal    │
│ ℹ️ Properties       │
└─────────────────────┘
```

### 7. Upload Modal
```
┌─────────────────────────────────────────┐
│ Upload Files to /var/apps/myapp         │
├─────────────────────────────────────────┤
│  ┌─────────────────────────────────┐    │
│  │                                 │    │
│  │   📁 Drop files here            │    │
│  │      or click to browse         │    │
│  │                                 │    │
│  └─────────────────────────────────┘    │
│                                         │
│  📄 config.json        ✅ Uploaded      │
│  🖼️ image.png          ⏳ 45%           │
│  📄 data.xml           ⏳ Pending       │
│                                         │
│           [Cancel]  [Upload All]        │
└─────────────────────────────────────────┘
```

### 8. Editor View (Full Screen)
```
┌─────────────────────────────────────────────────────────────────┐
│ 📄 config.json                    [💾 Save] [✖️ Close] [⛶]     │
├─────────────────────────────────────────────────────────────────┤
│  1 │ {                                                          │
│  2 │   "name": "myapp",                                         │
│  3 │   "version": "1.0.0",                                      │
│  4 │   "port": 3000                                             │
│  5 │ }                                                          │
│    │                                                            │
├─────────────────────────────────────────────────────────────────┤
│ JSON | UTF-8 | LF | Ln 3, Col 12           [Format] [Validate]  │
└─────────────────────────────────────────────────────────────────┘
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Enter` | Open selected |
| `Delete` | Delete selected |
| `F2` | Rename |
| `Ctrl+C` | Copy |
| `Ctrl+X` | Cut |
| `Ctrl+V` | Paste |
| `Ctrl+A` | Select all |
| `Ctrl+S` | Save (in editor) |
| `Ctrl+F` | Search |
| `Ctrl+N` | New file |
| `Ctrl+Shift+N` | New folder |
| `Backspace` | Go to parent |
| `Esc` | Close modal/deselect |

## Drag & Drop Behavior

1. **Files from desktop → File list**: Upload to current folder
2. **Files from desktop → Folder in tree**: Upload to that folder
3. **File in list → Folder**: Move file to folder
4. **File in list → Folder (with Ctrl)**: Copy file to folder
5. **Folder in tree → Another folder**: Move folder
