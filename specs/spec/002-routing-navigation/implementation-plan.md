# Feature 002: Routing & Navigation - Implementation Plan

## Phase Overview

| Phase | Description | Effort |
|-------|-------------|--------|
| Phase 1 | Create MainLayout with Sidebar | 2-3 hours |
| Phase 2 | Breadcrumb Component | 1-2 hours |
| Phase 3 | 404 Page & Error Handling | 1 hour |
| Phase 4 | Page Titles & Meta | 30 min |
| Phase 5 | Keyboard Navigation | 1 hour |
| Phase 6 | Testing & Polish | 1-2 hours |

**Total Estimated Time: 6-9 hours**

---

## Phase 1: MainLayout with Sidebar

### Objective
Create a unified layout component with persistent sidebar navigation.

### Tasks

1. **Create `MainLayout.tsx` component**
   ```tsx
   // app/components/MainLayout.tsx
   - Wrap all route content
   - Include Header, Sidebar, Main content area
   - Handle sidebar collapse/expand state
   - Store sidebar preference in localStorage
   ```

2. **Create `Sidebar.tsx` component**
   ```tsx
   // app/components/Sidebar.tsx
   - Navigation items with icons
   - Active state based on current route
   - Collapse/expand toggle
   - Tooltips when collapsed
   ```

3. **Update routes to use MainLayout**
   ```tsx
   // app/routes.ts
   - Wrap all routes with layout route
   - Or use MainLayout in each page
   ```

4. **Refactor existing Layout.tsx**
   - Keep header logic
   - Move sidebar logic to new component
   - Ensure no breaking changes

### Files to Create/Modify
- `app/components/MainLayout.tsx` (new)
- `app/components/Sidebar.tsx` (new)
- `app/routes.ts` (modify)
- `app/routes/*.tsx` (modify to use layout)

### Acceptance Criteria
- [ ] Sidebar visible on all pages
- [ ] Active page highlighted
- [ ] Sidebar collapses/expands
- [ ] Preference saved in localStorage
- [ ] No layout shift on navigation

---

## Phase 2: Breadcrumb Component

### Objective
Create reusable breadcrumb navigation showing page hierarchy.

### Tasks

1. **Create `Breadcrumb.tsx` component**
   ```tsx
   // app/components/Breadcrumb.tsx
   interface BreadcrumbProps {
     items?: BreadcrumbItem[];  // Manual items
     // Or auto-generate from route
   }
   ```

2. **Create route metadata config**
   ```tsx
   // app/lib/routeConfig.ts
   export const routeMeta: Record<string, RouteMeta> = {
     '/': { title: 'Dashboard', breadcrumb: [] },
     '/apps': { title: 'Applications', breadcrumb: ['Applications'] },
     // ...
   };
   ```

3. **Add breadcrumb to header**
   - Position after logo
   - Responsive truncation for mobile

4. **Dynamic breadcrumbs for parameterized routes**
   - `/apps/:id` → `Apps > {App Name}`
   - Fetch app name if needed

### Files to Create/Modify
- `app/components/Breadcrumb.tsx` (new)
- `app/lib/routeConfig.ts` (new)
- `app/components/MainLayout.tsx` (modify)

### Acceptance Criteria
- [ ] Breadcrumb shows on all pages
- [ ] Click navigates to that level
- [ ] Current page not clickable
- [ ] Dynamic names for parameterized routes

---

## Phase 3: 404 Page & Error Handling

### Objective
Create styled 404 page and handle route errors gracefully.

### Tasks

1. **Create `NotFound.tsx` page**
   ```tsx
   // app/routes/not-found.tsx
   - Styled 404 message
   - "Go Home" button
   - "Go Back" button
   - Matches app theme
   ```

2. **Add catch-all route**
   ```tsx
   // app/routes.ts
   route("*", "routes/not-found.tsx")
   ```

3. **Improve ErrorBoundary in root.tsx**
   - Better styling for errors
   - Consistent with app theme
   - Clear action buttons

4. **Create "Not Found" states for resources**
   - App not found (invalid ID)
   - File not found
   - Generic resource not found component

### Files to Create/Modify
- `app/routes/not-found.tsx` (new)
- `app/components/NotFoundState.tsx` (new)
- `app/routes.ts` (modify)
- `app/root.tsx` (modify ErrorBoundary)

### Acceptance Criteria
- [ ] 404 page styled and matches theme
- [ ] "Go Home" navigates to dashboard
- [ ] "Go Back" uses browser history
- [ ] Invalid resource IDs show appropriate message

---

## Phase 4: Page Titles & Meta

### Objective
Update document title based on current route.

### Tasks

1. **Create `useDocumentTitle` hook**
   ```tsx
   // app/hooks/useDocumentTitle.ts
   function useDocumentTitle(title: string) {
     useEffect(() => {
       document.title = `MiniCluster - ${title}`;
     }, [title]);
   }
   ```

2. **Add titles to each route**
   - Dashboard: "Dashboard"
   - Apps: "Applications"
   - App Detail: "{App Name}"
   - Explorer: "File Explorer"
   - etc.

3. **Use route meta for titles**
   - Integrate with routeConfig.ts
   - Auto-apply in MainLayout

### Files to Create/Modify
- `app/hooks/useDocumentTitle.ts` (new)
- `app/routes/*.tsx` (modify each)
- `app/lib/routeConfig.ts` (modify)

### Acceptance Criteria
- [ ] Browser tab shows page title
- [ ] Title updates on navigation
- [ ] Dynamic titles for parameterized routes

---

## Phase 5: Keyboard Navigation

### Objective
Add keyboard shortcuts for quick navigation.

### Tasks

1. **Create `useNavigationShortcuts` hook**
   ```tsx
   // app/hooks/useNavigationShortcuts.ts
   - Alt+H → Dashboard
   - Alt+A → Apps
   - Alt+E → Explorer
   - Alt+T → Terminal
   - Alt+M → Monitor
   - Alt+S → Settings
   ```

2. **Add to MainLayout**
   - Global keyboard listener
   - Only active when not in input/editor

3. **Show shortcuts in tooltips**
   - Sidebar tooltips include shortcut
   - Optional: Help modal with all shortcuts

### Files to Create/Modify
- `app/hooks/useNavigationShortcuts.ts` (new)
- `app/components/MainLayout.tsx` (modify)
- `app/components/Sidebar.tsx` (modify tooltips)

### Acceptance Criteria
- [ ] Shortcuts work globally
- [ ] Disabled when typing in inputs
- [ ] Shortcuts shown in UI hints

---

## Phase 6: Testing & Polish

### Objective
Test all routes, fix issues, polish UX.

### Tasks

1. **Manual Testing Checklist**
   - [ ] Direct URL: `/` works
   - [ ] Direct URL: `/apps` works
   - [ ] Direct URL: `/apps/{valid-id}` works
   - [ ] Direct URL: `/apps/{invalid-id}` shows error
   - [ ] Direct URL: `/explorer` works
   - [ ] Direct URL: `/terminal` works
   - [ ] Direct URL: `/monitor` works
   - [ ] Direct URL: `/settings` works
   - [ ] Direct URL: `/invalid-route` shows 404
   - [ ] Browser back button works
   - [ ] Browser forward button works
   - [ ] Browser refresh maintains page
   - [ ] Logo click goes home
   - [ ] Sidebar navigation works
   - [ ] Breadcrumb navigation works
   - [ ] Keyboard shortcuts work
   - [ ] Active state highlights correctly

2. **Fix Any Issues Found**

3. **Polish**
   - Smooth transitions
   - Loading states
   - Focus management

4. **Documentation**
   - Update README with routes
   - Document keyboard shortcuts

### Files to Create/Modify
- Various fixes as needed
- `README.md` (update)

### Acceptance Criteria
- [ ] All tests pass
- [ ] No console errors
- [ ] Smooth user experience

---

## Implementation Order

```
Phase 1: MainLayout with Sidebar
    ├── Create MainLayout.tsx
    ├── Create Sidebar.tsx  
    └── Update routes
         │
         ▼
Phase 2: Breadcrumb Component
    ├── Create Breadcrumb.tsx
    ├── Create routeConfig.ts
    └── Integrate with MainLayout
         │
         ▼
Phase 3: 404 Page & Error Handling
    ├── Create NotFound page
    ├── Add catch-all route
    └── Improve ErrorBoundary
         │
         ▼
Phase 4: Page Titles
    ├── Create useDocumentTitle hook
    └── Add to all routes
         │
         ▼
Phase 5: Keyboard Navigation
    ├── Create useNavigationShortcuts
    └── Add to MainLayout
         │
         ▼
Phase 6: Testing & Polish
    ├── Test all routes
    ├── Fix issues
    └── Document
```

---

## Dependencies

### External Libraries
- None new required (using react-router already)

### Internal Dependencies
- Existing Layout.tsx patterns
- Existing route structure
- Context providers (LogProvider, etc.)

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Breaking existing pages | High | Incremental changes, test each route |
| Layout conflicts | Medium | Refactor carefully, keep existing Layout |
| Performance issues | Low | Lazy load routes, optimize renders |

---

## Definition of Done

- [ ] All routes accessible via direct URL
- [ ] Sidebar navigation working
- [ ] Breadcrumbs showing correctly
- [ ] 404 page styled
- [ ] Page titles updating
- [ ] Keyboard shortcuts functional
- [ ] Browser navigation (back/forward) working
- [ ] No regressions in existing functionality
- [ ] Code committed and pushed
