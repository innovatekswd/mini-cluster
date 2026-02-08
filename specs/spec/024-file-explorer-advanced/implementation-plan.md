# Implementation Plan: File Explorer Advanced — Phase 2

> **Last Updated:** 2026-02-08  
> **Total Effort:** 8–10 weeks  
> **Team:** 1 full-stack developer  
> **Branch:** `feature/explorer-phase-2`

---

## Sprint Breakdown

### Sprint 1: Content Search + Grid View (Weeks 1–2)

#### Week 1 — Content Search
| Day | Task | Effort |
|-----|------|--------|
| 1 | Backend: `ContentSearchService` — recursive grep with regex, file pattern filter, size limit | 6h |
| 1 | Backend: `GET /api/explorer/search-content` endpoint | 2h |
| 2 | Backend: SignalR streaming — `ExplorerHub.SearchContent()` with cancellation | 6h |
| 2 | Backend: Unit tests for ContentSearchService (10 tests) | 2h |
| 3 | Frontend: `ContentSearchPanel` component — search form, toggles (regex, case, word) | 6h |
| 3 | Frontend: File pattern filter input | 2h |
| 4 | Frontend: Search results display — grouped by file, line numbers, highlighted matches | 6h |
| 4 | Frontend: Click result → open file in editor at line | 2h |
| 5 | Frontend: SignalR integration for streaming results, cancel button, search history | 6h |
| 5 | Integration testing + keyboard shortcut (Ctrl+Shift+F) | 2h |

**Deliverable:** Full content search with streaming results

#### Week 2 — Grid View + Thumbnails
| Day | Task | Effort |
|-----|------|--------|
| 1 | Backend: `ThumbnailService` — ImageSharp thumbnail generation + file cache | 6h |
| 1 | Backend: `GET /api/explorer/thumbnail` endpoint with caching headers | 2h |
| 2 | Frontend: `GridView` + `GridCard` components | 6h |
| 2 | Frontend: IntersectionObserver lazy thumbnail loading | 2h |
| 3 | Frontend: View toggle (list ↔ grid), persist preference | 4h |
| 3 | Frontend: Selection, context menu, double-click in grid view | 4h |
| 4 | Backend: NuGet `SixLabors.ImageSharp` for cross-platform thumbnails | 2h |
| 4 | Frontend: Responsive grid columns (2–6 based on width) | 3h |
| 4 | Unit tests for ThumbnailService | 3h |
| 5 | Polish: drag-drop upload in grid view, empty states, loading skeletons | 6h |
| 5 | Testing across file types (folders, images, text, binary) | 2h |

**Deliverable:** Grid view with image thumbnails

---

### Sprint 2: Tree Sidebar + Favorites + Diff (Weeks 3–4)

#### Week 3 — Tree Sidebar + Favorites
| Day | Task | Effort |
|-----|------|--------|
| 1 | Frontend: `TreeSidebar` component — recursive tree nodes, lazy loading | 8h |
| 2 | Frontend: Tree interactions — expand/collapse, navigate, highlight current | 6h |
| 2 | Frontend: Resizable sidebar divider | 2h |
| 3 | Backend: `FavoriteService` + EF Core `UserFavorite` entity + migration | 6h |
| 3 | Backend: CRUD endpoints for favorites | 2h |
| 4 | Frontend: `FavoritesDropdown` — list, add, remove, reorder | 6h |
| 4 | Frontend: Favorites section in tree sidebar | 2h |
| 5 | Frontend: Tree sidebar context menu, toggle shortcut (Ctrl+\) | 4h |
| 5 | Integration testing + persistence | 4h |

**Deliverable:** Tree sidebar + bookmarks

#### Week 4 — File Diff + Compare
| Day | Task | Effort |
|-----|------|--------|
| 1 | Frontend: `DiffViewer` component wrapping Monaco DiffEditor (lazy-loaded) | 8h |
| 2 | Frontend: Compare workflow — select 2 files → "Compare" action | 4h |
| 2 | Frontend: Side-by-side / inline toggle, next/prev change navigation | 4h |
| 3 | Frontend: Context menu "Compare With..." + toolbar button | 4h |
| 3 | Frontend: Keyboard shortcut Ctrl+D | 2h |
| 3 | Polish: header with filenames, stats (additions/deletions) | 2h |
| 4 | Backend: Git diff endpoint `GET /api/explorer/git/diff` | 4h |
| 4 | Backend: Git status endpoint `GET /api/explorer/git/status` | 4h |
| 5 | Frontend: `GitStatusBadge` component, branch indicator in status bar | 6h |
| 5 | Testing: diff viewer edge cases (empty files, binary, large files) | 2h |

**Deliverable:** File comparison + git status indicators

---

### Sprint 3: Batch Rename + File Watcher + Markdown (Weeks 5–6)

#### Week 5 — Batch Rename + File Watcher
| Day | Task | Effort |
|-----|------|--------|
| 1 | Backend: `BatchRenameService` — find/replace, sequential, prefix/suffix, case | 6h |
| 1 | Backend: Preview + execute endpoints | 2h |
| 2 | Frontend: `BatchRenameModal` — mode selector, options form, live preview table | 8h |
| 3 | Frontend: Conflict detection, dry-run display, error handling | 6h |
| 3 | Backend: Unit tests for all 4 rename modes | 2h |
| 4 | Backend: `FileWatcherService` using `FileSystemWatcher` + SignalR push | 6h |
| 4 | Backend: Debouncing (500ms), single-directory limit, dispose on disconnect | 2h |
| 5 | Frontend: `LiveModeIndicator` — toggle in toolbar, event handling | 4h |
| 5 | Frontend: Real-time list updates (add/remove/rename rows), highlight flash | 4h |

**Deliverable:** Batch rename + live file watching

#### Week 6 — Markdown Preview + Permissions Editor
| Day | Task | Effort |
|-----|------|--------|
| 1 | Frontend: `MarkdownPreview` component — `react-markdown` + `remark-gfm` | 6h |
| 1 | Frontend: Split view toggle (editor / split / preview) | 2h |
| 2 | Frontend: Code block syntax highlighting (rehype-highlight) | 4h |
| 2 | Frontend: Scroll sync between editor and preview | 4h |
| 3 | Backend: `GET /api/explorer/permissions` with available owners/groups | 4h |
| 3 | Backend: `PUT /api/explorer/permissions` with validation | 4h |
| 4 | Frontend: `PermissionsEditor` — checkbox grid, octal input, owner/group dropdowns | 8h |
| 5 | Frontend: Recursive option, batch permissions, Linux-only detection | 4h |
| 5 | Backend: Unit tests for permissions service | 4h |

**Deliverable:** Markdown preview + permissions editor

---

### Sprint 4: Sharing + Symlinks + Disk Usage (Weeks 7–8)

#### Week 7 — File Sharing + Symlinks
| Day | Task | Effort |
|-----|------|--------|
| 1 | Backend: `SharedLink` entity + EF migration + `SharedLinkService` | 6h |
| 1 | Backend: CRUD endpoints + public download endpoint (no auth) | 2h |
| 2 | Backend: Token generation, expiry handling, password hashing, download counting | 6h |
| 2 | Backend: Background cleanup service for expired links | 2h |
| 3 | Frontend: `ShareLinkModal` — expiry picker, max downloads, password, copy link | 6h |
| 3 | Frontend: Active shares management page (list, revoke) | 2h |
| 4 | Backend: Symlink endpoints — create, resolve | 4h |
| 4 | Frontend: `SymlinkDialog` — target path picker, link name | 4h |
| 5 | Frontend: Symlink indicators on file rows (→ icon, broken link warning) | 4h |
| 5 | Unit tests for SharedLinkService + symlink operations | 4h |

**Deliverable:** File sharing links + symlink management

#### Week 8 — Disk Usage + Tabs
| Day | Task | Effort |
|-----|------|--------|
| 1 | Backend: `DiskUsageService` — recursive size calculation with caching | 6h |
| 1 | Backend: `GET /api/explorer/disk-usage` endpoint | 2h |
| 2 | Frontend: `DiskUsageModal` — horizontal bar chart (Recharts), drilldown | 6h |
| 2 | Frontend: Top files table, stats, export CSV | 2h |
| 3 | Frontend: `TabBar` component — open, close, switch, dirty indicator | 8h |
| 4 | Frontend: Tab persistence (sessionStorage), max tabs, pin tabs | 6h |
| 4 | Frontend: Ctrl+W, Ctrl+Tab shortcuts, middle-click close | 2h |
| 5 | Integration testing: all features together | 4h |
| 5 | Performance profiling + optimization | 4h |

**Deliverable:** Disk usage analyzer + file tabs

---

### Sprint 5: Polish + Integration (Weeks 9–10)

#### Week 9 — Drag & Drop Move + Polish
| Day | Task | Effort |
|-----|------|--------|
| 1 | Frontend: Internal drag-and-drop (HTML5 drag API) — file rows draggable | 6h |
| 1 | Frontend: Drop target detection, Ctrl+drag for copy | 2h |
| 2 | Frontend: Drag ghost, highlight indicators, multi-select drag | 6h |
| 2 | Frontend: Confirmation dialog, undo notification | 2h |
| 3 | Frontend: Works in grid view + list view | 4h |
| 3 | Update all context menus with new actions | 4h |
| 4 | Update keyboard shortcuts hook with all new bindings | 4h |
| 4 | Update barrel exports (`index.ts`) | 2h |
| 4 | Responsive testing: mobile/tablet layout adjustments | 2h |
| 5 | Accessibility audit: ARIA labels, focus management, screen reader | 8h |

#### Week 10 — Testing + Documentation
| Day | Task | Effort |
|-----|------|--------|
| 1 | Backend: comprehensive unit tests — aim for 80% coverage on new services | 8h |
| 2 | Frontend: component tests for critical modals (ContentSearch, BatchRename, DiskUsage) | 8h |
| 3 | End-to-end testing: full workflows across features | 6h |
| 3 | Performance testing: large directories (10,000+ files), large searches | 2h |
| 4 | Bug fixes from testing | 8h |
| 5 | Final commit, changelog update, spec status update | 4h |
| 5 | Demo preparation | 4h |

---

## Dependencies & Prerequisites

### NuGet Packages (Backend)
| Package | Purpose | Version |
|---------|---------|---------|
| SixLabors.ImageSharp | Thumbnail generation | Latest |
| _(no new packages for other features)_ | | |

### npm Packages (Frontend)
| Package | Purpose | Version |
|---------|---------|---------|
| react-markdown | Markdown rendering | Latest |
| remark-gfm | GitHub-flavored markdown | Latest |
| rehype-highlight | Code block syntax highlighting | Latest |
| _(Monaco DiffEditor already included in monaco-editor)_ | | |

### Database Migrations
1. `AddUserFavorites` — `UserFavorites` table
2. `AddSharedLinks` — `SharedLinks` table

### Infrastructure
- FileSystemWatcher: built into .NET (no extra deps)
- SignalR: already in use (LogHub, TerminalHub)
- Thumbnail cache directory: auto-created at `{DataDir}/.minicluster/thumbnails/`

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| FileSystemWatcher misses events on some Linux filesystems | Fallback to polling + manual refresh button |
| Large directory content search is slow | Stream results via SignalR, limit max file size, add cancel |
| Thumbnail generation degrades performance | Async generation, queue with concurrency limit, cache aggressively |
| Git CLI not installed on server | Feature detection: hide git UI if `git --version` fails |
| Permissions editor on Windows | Detect OS, hide permissions UI on Windows |
| Breaking existing explorer UX | All new features are opt-in (toggle panels, modals) |

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Content search: first result latency | < 500ms (1000 files) |
| Grid view: thumbnail load time | < 200ms per image |
| Tree sidebar: expand latency | < 100ms |
| File watcher: event to UI latency | < 1s |
| All existing tests pass | 100% |
| New backend test coverage | ≥ 80% |
| Zero regressions in Phase 1 features | ✅ |

---

## Feature Flag Rollout

All new features gated behind `ExplorerOptions` configuration:

```json
{
  "Explorer": {
    "EnableContentSearch": true,
    "EnableGridView": true,
    "EnableTreeSidebar": true,
    "EnableFileWatcher": true,
    "EnableFileSharing": true,
    "EnablePermissionsEditor": true,
    "EnableGitIntegration": true,
    "ThumbnailCacheDir": ".minicluster/thumbnails",
    "MaxSearchFileSizeMB": 10,
    "MaxSearchResults": 500,
    "SharedLinkMaxExpiryDays": 30
  }
}
```

This allows per-feature opt-in and easy disable if issues arise in production.
