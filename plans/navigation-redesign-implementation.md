# Navigation Redesign Implementation Plan

## Overview

This document outlines the implementation plan for redesigning the top navigation bar from a flat 10-icon row to a modern, grouped, and hierarchically organized navigation system with active tab highlighting.

## Current State

**File:** [`ui/app/components/Layout.tsx`](ui/app/components/Layout.tsx:126-215)

**Current Navigation (10 flat icons):**
1. Dashboard (`FaTachometerAlt`) → `/`
2. Applications (`FaCubes`) → `/apps`
3. Environments (`FaSlidersH`) → `/envs`
4. File Explorer (`FaFolder`) → `/explorer`
5. Terminal (`FaTerminal`) → `/terminal`
6. System Monitor (`FaDesktop`) → `/monitor`
7. Reverse Proxy (`FaGlobe`) → `/proxy`
8. Automation (`FaClock`) → `/automation`
9. Hierarchy (`FaSitemap`) → `/hierarchy`
10. Settings (`FaCog`) → `/settings`

**Problems:**
- No active tab highlighting
- Poor cognitive grouping (10 icons in flat row)
- Naming confusion (Dashboard vs Monitor vs Analytics)
- No visual hierarchy
- Horizontal-only layout

## Proposed State

### Navigation Groups (3 groups + Settings)

```
┌─────────────────────────────────────────────────────────────┐
│ [Logo] MiniCluster                                          │
│                                                             │
│ Group 1: OBSERVE         Group 2: OPERATE    Group 3: MANAGE│
│ ┌────────┐              ┌────────────┐      ┌────────────┐ │
│ │ 📊     │              │ 📦  📁     │      │ ⏰  🌐     │ │
│ │Observe │              │Apps  Files │      │Auto  Proxy │ │
│ └────────┘              │    💻      │      │    🌳      │ │
│                         │  Terminal  │      │  Hierarchy │ │
│                         └────────────┘      └────────────┘ │
│                                                             │
│ [System Metrics Bar]                    [Status] [User] [⚙️]│
└─────────────────────────────────────────────────────────────┘
```

### Observe Hub (Tab-based sub-navigation)

```
📊 Observe (top-level icon)
  ├─ 🏠 Cockpit (real-time operations view) — current `/`
  ├─ 📈 Analytics (historical trends) — current `/analytics`
  ├─ 🔍 Resources (CPU/Memory/Disk/Network) — current `/machines/local/resources`
  └─ 📋 Events (alerts & recent activity) — NEW consolidated view
```

## Implementation Tasks

### Task 1: Create NavigationBar Component

**File:** `ui/app/components/NavigationBar.tsx`

**Requirements:**
- Group navigation items into 3 logical groups: Observe, Operate, Manage
- Add visual separation between groups (subtle dividers or background colors)
- Implement active tab detection using `useLocation` hook
- Add hover tooltips for all navigation items
- Support responsive behavior (icons with labels on desktop, icons only on laptop)

**Structure:**
```typescript
interface NavItem {
  icon: ReactNode;
  label: string;
  to: string;
  description: string;
  group: 'observe' | 'operate' | 'manage';
}

const NAV_ITEMS: NavItem[] = [
  // Observe Group (Cyan/Blue)
  { icon: <FaChartLine />, label: 'Observe', to: '/observe', description: 'Monitoring & Analytics', group: 'observe' },
  
  // Operate Group (Green)
  { icon: <FaCubes />, label: 'Apps', to: '/apps', description: 'Application Portfolio', group: 'operate' },
  { icon: <FaFolder />, label: 'Files', to: '/explorer', description: 'File Explorer', group: 'operate' },
  { icon: <FaTerminal />, label: 'Terminal', to: '/terminal', description: 'Terminal Session', group: 'operate' },
  
  // Manage Group (Orange)
  { icon: <FaClock />, label: 'Automation', to: '/automation', description: 'Cron Jobs & Tasks', group: 'manage' },
  { icon: <FaGlobe />, label: 'Proxy', to: '/proxy', description: 'Reverse Proxy', group: 'manage' },
  { icon: <FaSitemap />, label: 'Hierarchy', to: '/hierarchy', description: 'App Hierarchy', group: 'manage' },
];
```

### Task 2: Implement Active Tab Highlighting

**Requirements:**
- Detect current route using `useLocation` hook
- Highlight active navigation item with:
  - Filled icon (vs outline)
  - Colored bottom border (2px)
  - Slightly brighter background
- Support nested active states (e.g., `/observe/analytics` highlights both "Observe" and "Analytics" tab)

**Implementation:**
```typescript
const location = useLocation();
const isActive = (path: string) => {
  if (path === '/') return location.pathname === '/';
  return location.pathname.startsWith(path);
};
```

### Task 3: Create Observe Hub Route

**File:** `ui/app/routes/observe.tsx`

**Requirements:**
- Tab-based sub-navigation within Observe section
- Tabs: Cockpit, Analytics, Resources, Events
- Default tab: Cockpit (current `/` page)
- URL structure: `/observe`, `/observe/analytics`, `/observe/resources`, `/observe/events`

**Structure:**
```typescript
const OBSERVE_TABS = [
  { id: 'cockpit', label: 'Cockpit', icon: <FaTachometerAlt />, path: '/observe' },
  { id: 'analytics', label: 'Analytics', icon: <FaChartLine />, path: '/observe/analytics' },
  { id: 'resources', label: 'Resources', icon: <FaDesktop />, path: '/observe/resources' },
  { id: 'events', label: 'Events', icon: <FaBell />, path: '/observe/events' },
];
```

### Task 4: Update Layout.tsx

**File:** `ui/app/components/Layout.tsx`

**Changes:**
- Replace flat icon row with new `NavigationBar` component
- Remove individual `<Link>` elements (lines 128-215)
- Import and render `NavigationBar` component
- Keep SystemMetricsBar, Status indicator, NotificationDropdown, and UserMenu

**Before:**
```typescript
<div className="flex items-center gap-2">
  <Link to="/" className="icon-btn"><FaTachometerAlt /></Link>
  <Link to="/apps" className="icon-btn"><FaCubes /></Link>
  // ... 8 more links
</div>
```

**After:**
```typescript
<NavigationBar />
```

### Task 5: Add Visual Styling

**File:** `ui/app/styles/navigation.css` (or extend existing CSS)

**Requirements:**
- Group separation: Subtle dividers or background color changes
- Color coding:
  - Observe: Cyan/Blue (`from-cyan-500 to-blue-600`)
  - Operate: Green (`from-emerald-500 to-green-600`)
  - Manage: Orange (`from-amber-500 to-orange-600`)
- Active state: Filled icon + bottom border + brighter background
- Hover state: Subtle background highlight + tooltip

**CSS Classes:**
```css
.nav-group-observe { @apply bg-cyan-500/10 border-cyan-500/20; }
.nav-group-operate { @apply bg-emerald-500/10 border-emerald-500/20; }
.nav-group-manage { @apply bg-amber-500/10 border-amber-500/20; }

.nav-item-active {
  @apply relative;
  &::after {
    content: '';
    @apply absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-cyan-400 to-blue-500;
  }
}
```

### Task 6: Implement Responsive Behavior

**Requirements:**
- **Desktop (1920px+):** Horizontal icons with labels
- **Laptop (1366px-1919px):** Icons only (no labels), hover for tooltip
- **Tablet (<1366px):** Move all navigation to slide-out sidebar (hamburger menu)

**Implementation:**
```typescript
const isDesktop = useMediaQuery('(min-width: 1920px)');
const isLaptop = useMediaQuery('(min-width: 1366px) and (max-width: 1919px)');
const isTablet = useMediaQuery('(max-width: 1365px)');
```

### Task 7: Route Configuration

**File:** `ui/app/routes.ts` (or wherever routes are defined)

**Changes:**
- Add `/observe` route (redirects to `/observe/cockpit`)
- Add `/observe/analytics` route (current `/analytics` page)
- Add `/observe/resources` route (current `/machines/local/resources`)
- Add `/observe/events` route (NEW page)
- Keep `/` as alias for `/observe/cockpit` (backward compatibility)

**Route Structure:**
```typescript
{
  path: '/observe',
  children: [
    { index: true, element: <Navigate to="/observe/cockpit" /> },
    { path: 'cockpit', element: <HomePage /> },
    { path: 'analytics', element: <AnalyticsPage /> },
    { path: 'resources', element: <ResourcesPage /> },
    { path: 'events', element: <EventsPage /> },
  ]
}
```

### Task 8: Testing & Validation

**Requirements:**
- Test active tab highlighting on all routes
- Test nested active states (e.g., `/observe/analytics`)
- Test responsive behavior on different screen sizes
- Test hover tooltips
- Test keyboard navigation (Tab, Enter)
- Test accessibility (ARIA labels, focus states)

## File Structure

```
ui/app/
├── components/
│   ├── NavigationBar.tsx (NEW)
│   └── Layout.tsx (MODIFIED)
├── routes/
│   ├── home.tsx (UNCHANGED - becomes /observe/cockpit)
│   ├── observe.tsx (NEW - tab container)
│   └── analytics.tsx (MOVED to /observe/analytics)
└── styles/
    └── navigation.css (NEW or extend existing)
```

## Implementation Sequence

1. **Create NavigationBar component** with grouped icons and active tab detection
2. **Update Layout.tsx** to use NavigationBar instead of flat icon row
3. **Add visual styling** for groups, active states, and hover effects
4. **Create /observe route** with tab-based sub-navigation
5. **Migrate routes** (`/analytics` → `/observe/analytics`, etc.)
6. **Test responsive behavior** on desktop, laptop, and tablet
7. **Validate accessibility** (ARIA labels, keyboard navigation, focus states)

## Acceptance Criteria

- [ ] Navigation items are grouped into 3 logical groups (Observe, Operate, Manage)
- [ ] Visual separation between groups (dividers or background colors)
- [ ] Active tab highlighting works correctly (filled icon + bottom border + brighter background)
- [ ] Nested active states work (e.g., `/observe/analytics` highlights both "Observe" and "Analytics")
- [ ] Hover tooltips appear for all navigation items
- [ ] Observe hub has tab-based sub-navigation (Cockpit, Analytics, Resources, Events)
- [ ] Responsive behavior works on desktop, laptop, and tablet
- [ ] Keyboard navigation works (Tab, Enter)
- [ ] Accessibility requirements met (ARIA labels, focus states)
- [ ] All existing routes still work (backward compatibility with `/` as alias for `/observe/cockpit`)

## Notes

- Keep `/` as alias for `/observe/cockpit` to maintain backward compatibility
- Use existing icons from `react-icons/fa` where possible
- Reuse existing components (SystemMetricsBar, NotificationDropdown, UserMenu)
- Consider using a tooltip library or custom tooltip component for hover effects
- Test with real users to validate the new navigation structure
