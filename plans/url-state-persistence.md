# URL-Based State Persistence Plan

**Goal**: Every page in the system persists its state via the URL — shareable, bookmarkable, survives browser clears.

---

## Executive Summary

Replace localStorage and volatile `useState` with URL-driven state across all pages. The URL becomes the single source of truth for navigation state.

---

## Pages Requiring URL Persistence

| # | Page | Current State | Target URL Pattern | Priority |
|---|------|--------------|-------------------|----------|
| 1 | Explorer | localStorage (`explorer:lastPath`) | `/explorer/*` (splat with encoded path) | High |
| 2 | Monitor | `useState("processes")` | `/monitor?tab=performance` | High |
| 3 | Apps workspace | URL params already | `/apps/:appName/:serviceName` | Done ✅ |
| 4 | History tab | `useState` for scope/time/bucket | `/monitor?tab=history&scope=machine&range=24h` | Medium |

---

## 1. Explorer: Splat Route with Encoded Path

### Route Definition

**File:** [`ui/app/routes.ts`](ui/app/routes.ts:16)

```typescript
// Change from:
route("explorer", "routes/explorer.tsx"),

// To:
route("explorer/*", "routes/explorer.tsx"),
```

The `/*` creates a splat route that captures everything after `/explorer/`. React Router exposes it via `useParams()` as `*` or via `useLocation()`.

### URL Encoding Strategy

File paths contain special characters that need encoding:
- Windows: `C:\Users\name` → `C%3A%5CUsers%5Cname`
- Linux: `/home/user` → `%2Fhome%2Fuser`

**Encoding on navigation:**
```typescript
const navigate = useNavigate();
const handleNavigate = (path: string) => {
  const encoded = encodeURIComponent(path);
  navigate(`/explorer/${encoded}`);
};
```

**Decoding on mount:**
```typescript
const location = useLocation();
const splatPath = location.pathname.replace('/explorer/', '');
const decodedPath = splatPath ? decodeURIComponent(splatPath) : '';
```

### ExplorerPage Changes

**File:** [`ui/app/components/Explorer/ExplorerPage.tsx`](ui/app/components/Explorer/ExplorerPage.tsx:80)

1. **Remove localStorage** (lines 85-90): Delete the `useEffect` that saves to `localStorage.setItem('explorer:lastPath', ...)`
2. **Read initial path from URL**: Use `useLocation()` to extract the splat segment and decode it
3. **Update URL on navigation**: Use `useNavigate()` to push new URL when user navigates to a directory
4. **Fallback**: If no path in URL, load roots and show root picker (current behavior)

### Explorer Route Wrapper

**File:** [`ui/app/routes/explorer.tsx`](ui/app/routes/explorer.tsx:1)

```typescript
import { useLocation, useNavigate } from 'react-router';
import { ExplorerPage } from '~/components/Explorer/ExplorerPage';

export default function Explorer() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Extract encoded path from URL
  const encodedPath = location.pathname.replace('/explorer/', '');
  const initialPath = encodedPath ? decodeURIComponent(encodedPath) : '';
  
  return (
    <div className="h-full">
      <ExplorerPage 
        initialPath={initialPath}
        onNavigate={(path) => {
          if (path) {
            navigate(`/explorer/${encodeURIComponent(path)}`, { replace: true });
          } else {
            navigate('/explorer', { replace: true });
          }
        }}
      />
    </div>
  );
}
```

### ExplorerPage Props

Add `initialPath` and `onNavigate` props to ExplorerPage:

```typescript
interface ExplorerPageProps {
  initialPath?: string;
  onNavigate?: (path: string) => void;
}
```

- `initialPath`: Used on mount to load the directory from URL (replaces localStorage restore)
- `onNavigate`: Called when user navigates to a directory (updates URL via replace)

### Why `replace: true`?

Using `replace` instead of `push` prevents polluting browser history with every directory navigation. Users can still use Back to return to the previous page.

---

## 2. Monitor: Query Parameter for Active Tab

### Route Definition (No Change Needed)

The route is already `/monitor`. We use query parameters.

### URL Pattern

```
/monitor                    → default to "processes" tab
/monitor?tab=performance    → performance tab with live charts
/monitor?tab=disks          → disks tab
/monitor?tab=network        → network tab
/monitor?tab=history        → history tab
```

### TaskManager Changes

**File:** [`ui/app/components/TaskManager.tsx`](ui/app/components/TaskManager.tsx:44)

1. **Read initial tab from URL**:
```typescript
const [searchParams, setSearchParams] = useSearchParams();
const initialTab = (searchParams.get('tab') as typeof activeTab) || 'processes';
const [activeTab, setActiveTab] = useState(initialTab);
```

2. **Update URL when tab changes**:
```typescript
const handleTabChange = (tab: typeof activeTab) => {
  setActiveTab(tab);
  setSearchParams({ tab }, { replace: true });
};
```

3. **Replace all `setActiveTab` calls** with `handleTabChange`

### Monitor Page Wrapper (Optional Enhancement)

The wrapper already passes through. No changes needed unless we want to add more query params.

---

## 3. History Tab: Query Parameter for Scope/Time/Bucket

### URL Pattern

```
/monitor?tab=history
/monitor?tab=history&scope=machine&range=24h&bucket=auto
/monitor?tab=history&scope=service&entity=api-service&range=7d
/monitor?tab=history&scope=directory&entity=logs&range=1h
```

### Implementation Strategy

HistoryTab already has complex state (scope, time range, bucket, metrics, comparison). Encoding ALL of this in the URL would create very long URLs.

**Recommendation: Hybrid Approach**
- Encode primary controls in URL: `scope`, `range`, `bucket`
- Keep secondary controls (metric selection, comparison mode) in component state
- This gives bookmarkable "starting points" without URL bloat

### HistoryTab Changes

**File:** [`ui/app/components/HistoryTab.tsx`](ui/app/components/HistoryTab.tsx:15)

```typescript
const [searchParams, setSearchParams] = useSearchParams();

// Read initial values from URL
const initialScope = searchParams.get('scope') as ScopeType || 'machine';
const initialRange = searchParams.get('range') as TimeRange || '24h';
const initialBucket = searchParams.get('bucket') as BucketSize || 'auto';

// When scope/range/bucket changes, update URL
useEffect(() => {
  const params = new URLSearchParams(searchParams);
  if (scope !== 'machine') params.set('scope', scope);
  if (range !== '24h') params.set('range', range);
  if (bucket !== 'auto') params.set('bucket', bucket);
  setSearchParams(params, { replace: true });
}, [scope, range, bucket]);
```

---

## 4. Future Pages (Lower Priority)

### Terminal

```
/terminal?path=/home/user
```

Could persist the current working directory. Low priority since terminal sessions are ephemeral.

### Machines

```
/machines?expanded=machine1,machine2
```

Could persist which machines are expanded. Low priority.

### Settings

```
/settings?tab=environments
```

Could persist the active settings section. Medium priority.

---

## Implementation Order

| Step | Task | Files |
|------|------|-------|
| 1 | Explorer splat route + URL encoding | `routes.ts`, `explorer.tsx`, `ExplorerPage.tsx` |
| 2 | Monitor tab query param | `TaskManager.tsx` |
| 3 | History tab query params | `HistoryTab.tsx` |
| 4 | Test all pages | Manual verification |

---

## Architecture Diagram

```mermaid
flowchart LR
    subgraph URL State
        A[/explorer/encoded-path]
        B[/monitor?tab=performance]
        C[/monitor?tab=history&scope=machine&range=24h]
    end
    
    subgraph Components
        D[ExplorerPage]
        E[TaskManager]
        F[HistoryTab]
    end
    
    A -->|decodeURIComponent| D
    B -->|searchParams.get tab| E
    C -->|searchParams.get scope/range| F
    
    D -->|onNavigate → encode| A
    E -->|setSearchParams| B
    F -->|setSearchParams| C
```

---

## Key Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Splat route for Explorer | Handles arbitrary path depth, Windows/Linux paths |
| 2 | URL encoding for paths | Colons, slashes, spaces are preserved |
| 3 | `replace: true` for Explorer nav | Prevents history pollution from directory navigation |
| 4 | Query params for Monitor tabs | Simple, standard, supports deep linking from KPI cards |
| 5 | Hybrid URL/state for History | Primary controls in URL, secondary in state |
| 6 | No localStorage fallback | URL is the single source of truth |

---

## Testing Checklist

- [ ] `/explorer` → shows root picker
- [ ] `/explorer/C%3A%5CUsers` → loads C:\Users directory
- [ ] Navigate in explorer → URL updates, Back button works
- [ ] `/monitor` → shows processes tab
- [ ] `/monitor?tab=performance` → shows performance tab with live charts
- [ ] Click tab in monitor → URL updates
- [ ] Share `/monitor?tab=performance` URL → opens correct tab
- [ ] `/monitor?tab=history&scope=machine&range=24h` → history tab loads with correct scope/time
