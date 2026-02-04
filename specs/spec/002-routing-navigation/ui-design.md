# Feature 002: Routing & Navigation - UI Design

## Navigation Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  HEADER                                                         │
│  ┌──────────┐  ┌──────────────────────────────┐  ┌───────────┐ │
│  │ Logo     │  │ Breadcrumb: Home > Apps      │  │ Actions   │ │
│  └──────────┘  └──────────────────────────────┘  └───────────┘ │
├─────────────────────────────────────────────────────────────────┤
│ ┌─────────┐  ┌──────────────────────────────────────────────┐  │
│ │SIDEBAR  │  │                                              │  │
│ │         │  │           MAIN CONTENT                       │  │
│ │ 🏠 Home │  │                                              │  │
│ │ 📦 Apps │  │                                              │  │
│ │ 📁 Files│  │                                              │  │
│ │ 💻 Term │  │                                              │  │
│ │ 📊 Mon  │  │                                              │  │
│ │ ⚙️ Set  │  │                                              │  │
│ │         │  │                                              │  │
│ └─────────┘  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Component Design

### 1. Sidebar Navigation

```tsx
// Sidebar items structure
const navItems = [
  { path: '/', icon: FaHome, label: 'Dashboard', exact: true },
  { path: '/apps', icon: FaCubes, label: 'Applications' },
  { path: '/explorer', icon: FaFolder, label: 'File Explorer' },
  { path: '/terminal', icon: FaTerminal, label: 'Terminal' },
  { path: '/monitor', icon: FaDesktop, label: 'System Monitor' },
  { path: '/settings', icon: FaCog, label: 'Settings' },
];
```

**States:**
- Default: `bg-transparent text-slate-400`
- Hover: `bg-slate-800/50 text-white`
- Active: `bg-cyan-500/10 text-cyan-400 border-l-2 border-cyan-500`

### 2. Breadcrumb Component

```tsx
interface BreadcrumbItem {
  label: string;
  path?: string;  // No path = current page (not clickable)
}

// Example usage
<Breadcrumb items={[
  { label: 'Home', path: '/' },
  { label: 'Applications', path: '/apps' },
  { label: 'My App' }  // Current page
]} />
```

**Visual Design:**
```
Home  >  Applications  >  My App
 ↑          ↑              ↑
link      link         current (text)
```

### 3. 404 Not Found Page

```
┌──────────────────────────────────────┐
│                                      │
│              ╭────────╮              │
│              │  404   │              │
│              ╰────────╯              │
│                                      │
│      Page Not Found                  │
│                                      │
│  The page you're looking for         │
│  doesn't exist or has been moved.    │
│                                      │
│   ┌──────────┐  ┌──────────┐        │
│   │ Go Home  │  │ Go Back  │        │
│   └──────────┘  └──────────┘        │
│                                      │
└──────────────────────────────────────┘
```

### 4. Page Titles

Each route should update the document title:

| Route | Title |
|-------|-------|
| `/` | MiniCluster - Dashboard |
| `/apps` | MiniCluster - Applications |
| `/apps/:id` | MiniCluster - {App Name} |
| `/explorer` | MiniCluster - File Explorer |
| `/terminal` | MiniCluster - Terminal |
| `/monitor` | MiniCluster - System Monitor |
| `/settings` | MiniCluster - Settings |
| `*` | MiniCluster - Page Not Found |

### 5. Main Layout Structure

```tsx
// MainLayout wraps all pages
<MainLayout>
  <Header>
    <Logo />          {/* Click → / */}
    <Breadcrumb />
    <Actions />
  </Header>
  
  <div className="flex">
    <Sidebar>
      <NavItems />
    </Sidebar>
    
    <main>
      <Outlet />      {/* Route content */}
    </main>
  </div>
</MainLayout>
```

## Interactions

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Alt + H` | Go to Home/Dashboard |
| `Alt + A` | Go to Applications |
| `Alt + E` | Go to Explorer |
| `Alt + T` | Go to Terminal |
| `Alt + M` | Go to Monitor |
| `Alt + S` | Go to Settings |
| `Alt + ←` | Go Back |

### Logo Click Behavior
- Single click: Navigate to dashboard
- Current page already dashboard: No action

### Sidebar Collapse
- Collapsed: Show icons only with tooltips
- Expanded: Show icons + labels
- Toggle button at bottom of sidebar
- Remember preference in localStorage

## Responsive Behavior

### Desktop (> 1024px)
- Sidebar always visible (collapsed or expanded)
- Full breadcrumb shown

### Tablet (768px - 1024px)
- Sidebar as overlay (hamburger toggle)
- Breadcrumb truncated

### Mobile (< 768px)
- Bottom navigation bar
- No sidebar
- Simplified breadcrumb (current page only)

## Animation & Transitions

### Page Transitions
- Fade in: `opacity 0→1, 150ms ease-out`
- Optional: Slide from right for forward navigation

### Sidebar Hover
- Background: `150ms ease`
- Text color: `100ms ease`

### Active Indicator
- Border slide in: `200ms ease-out`
