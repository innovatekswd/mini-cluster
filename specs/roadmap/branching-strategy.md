# Git Branching Strategy

**Date:** January 31, 2026  
**Project:** MiniCluster  
**Strategy:** Gitflow (Adapted)

---

## Branch Structure

```
master (production)
  │
  └─→ develop (integration)
         │
         ├─→ feature/simple-app-tabs
         ├─→ feature/app-groups
         ├─→ feature/app-hierarchy
         │
         ├─→ bugfix/fix-auto-start
         ├─→ bugfix/signalr-reconnect
         │
         └─→ release/v1.1.0
```

---

## Branch Types

### 1. `master` (Production)

**Purpose:** Production-ready code only  
**Protected:** Yes  
**Merge From:** `release/*` branches only  
**Deploy Target:** Production servers

**Rules:**
- Every commit must be tagged with version: `v1.0.0`, `v1.1.0`, etc.
- No direct commits (merge via PR only)
- All tests must pass
- Requires approval from 2+ reviewers

**Current State:** `444ffb7` (pre-Phase 5, stable)

---

### 2. `develop` (Integration)

**Purpose:** Latest stable development code  
**Protected:** Yes  
**Merge From:** `feature/*`, `bugfix/*`  
**Merge To:** `release/*`  
**Deploy Target:** Staging environment

**Rules:**
- All features merge here first
- Must pass all tests
- Should be deployable at any time
- Requires 1+ reviewer approval

**Creation:**
```bash
# Create from current refactor work
git checkout feature/phase5-service-refactor
git checkout -b develop
git push -u origin develop
```

---

### 3. `feature/*` (New Features)

**Purpose:** Develop new features in isolation  
**Protected:** No  
**Branch From:** `develop`  
**Merge To:** `develop`  
**Lifetime:** Until feature complete or abandoned

**Naming Convention:**
- `feature/simple-app-tabs` - descriptive kebab-case
- `feature/app-groups`
- `feature/multi-host-support`

**Workflow:**
```bash
# Create feature branch
git checkout develop
git pull origin develop
git checkout -b feature/simple-app-tabs
git push -u origin feature/simple-app-tabs

# Work on feature (multiple commits)
git add .
git commit -m "Add AppCard component"
git push origin feature/simple-app-tabs

# Merge to develop when done
git checkout develop
git pull origin develop
git merge feature/simple-app-tabs
git push origin develop

# Delete feature branch
git branch -d feature/simple-app-tabs
git push origin --delete feature/simple-app-tabs
```

**Rules:**
- One feature per branch
- Keep branches short-lived (<2 weeks)
- Rebase regularly to stay up-to-date:
  ```bash
  git checkout feature/simple-app-tabs
  git fetch origin
  git rebase origin/develop
  ```

---

### 4. `bugfix/*` (Bug Fixes)

**Purpose:** Fix bugs found in `develop`  
**Protected:** No  
**Branch From:** `develop`  
**Merge To:** `develop`

**Naming Convention:**
- `bugfix/auto-start-not-working`
- `bugfix/signalr-memory-leak`

**Workflow:**
```bash
git checkout develop
git checkout -b bugfix/auto-start-not-working
# ... fix bug ...
git commit -m "Fix AutoStart not triggering on app launch"
git push origin bugfix/auto-start-not-working
# Create PR to develop
```

---

### 5. `hotfix/*` (Production Hotfixes)

**Purpose:** Emergency fixes for production  
**Protected:** No  
**Branch From:** `master`  
**Merge To:** `master` AND `develop`

**Naming Convention:**
- `hotfix/critical-crash-on-stop`
- `hotfix/security-vulnerability`

**Workflow:**
```bash
# Branch from master (production)
git checkout master
git pull origin master
git checkout -b hotfix/critical-crash-on-stop

# Fix the bug
git add .
git commit -m "Fix crash when stopping service with no PID"

# Merge to master (production)
git checkout master
git merge hotfix/critical-crash-on-stop
git tag v1.0.1
git push origin master --tags

# Merge to develop (propagate fix)
git checkout develop
git merge hotfix/critical-crash-on-stop
git push origin develop

# Delete hotfix branch
git branch -d hotfix/critical-crash-on-stop
```

---

### 6. `release/*` (Release Preparation)

**Purpose:** Prepare code for production release  
**Protected:** No  
**Branch From:** `develop`  
**Merge To:** `master` AND `develop`

**Naming Convention:**
- `release/v1.1.0`
- `release/v1.2.0`

**Workflow:**
```bash
# Create release branch
git checkout develop
git checkout -b release/v1.1.0

# Final polish (no new features!)
# - Update version numbers
# - Update CHANGELOG.md
# - Final testing
git commit -m "Bump version to 1.1.0"

# Merge to master (production)
git checkout master
git merge release/v1.1.0
git tag v1.1.0
git push origin master --tags

# Merge back to develop (in case of version bumps)
git checkout develop
git merge release/v1.1.0
git push origin develop

# Delete release branch
git branch -d release/v1.1.0
```

**Timeline:**
- Create when develop is feature-complete
- Duration: 1-3 days (QA testing)
- Only bugfixes allowed (no new features)

---

## Current Setup

### Initial Branch Creation

```bash
# 1. Create develop from refactor work
cd /home/younan/innovatek/src/mini-cluster/minicluster-api
git checkout feature/phase5-service-refactor
git pull origin feature/phase5-service-refactor
git checkout -b develop
git push -u origin develop

# 2. Create first feature branch
git checkout develop
git checkout -b feature/simple-app-tabs
git push -u origin feature/simple-app-tabs

# Frontend (separate repo)
cd /home/younan/innovatek/src/mini-cluster/minicluster-ui
git checkout feature/phase5-service-refactor
git checkout -b develop
git push -u origin develop
git checkout -b feature/simple-app-tabs
git push -u origin feature/simple-app-tabs
```

### Branch Status After Setup

| Branch | Status | Purpose |
|--------|--------|---------|
| `master` | `444ffb7` | Clean production baseline |
| `develop` | `f025e46` | Has Phase 5 refactor work |
| `feature/phase5-service-refactor` | `f025e46` | Can be deleted after develop created |
| `feature/simple-app-tabs` | New | Active development |

---

## Commit Message Convention

Use conventional commits format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, no logic change)
- `refactor:` - Code change that neither fixes bug nor adds feature
- `perf:` - Performance improvement
- `test:` - Add or update tests
- `chore:` - Build process, dependencies, etc.

### Examples

```bash
feat(apps): add AppCard component with service count

Displays app info in a card layout with:
- App name and description
- Service count badge
- Running services indicator
- Click to navigate to app detail

Closes #123

---

fix(signalr): prevent memory leak in subscription cleanup

The useEffect cleanup wasn't removing SignalR event handlers,
causing memory to grow with each component mount/unmount.

Added proper cleanup using connection.off() in useEffect return.

---

docs(spec3): add branching strategy documentation

---

chore(deps): upgrade React Router to v7.1.2
```

---

## Pull Request Process

### 1. Create PR
```bash
# Push feature branch
git push origin feature/simple-app-tabs

# Create PR on GitHub
# Title: "[Feature] Add Simple App Tabs"
# Description: Link to spec3/015-simple-app-tabs/spec.md
```

### 2. Code Review Checklist

**Reviewer checks:**
- [ ] Code matches spec
- [ ] Tests pass (unit + integration)
- [ ] No console errors
- [ ] Performance acceptable
- [ ] Documentation updated
- [ ] No merge conflicts with develop

### 3. Merge Strategy

**Feature → Develop:** Merge commit (preserve history)
```bash
git merge --no-ff feature/simple-app-tabs
```

**Develop → Master:** Fast-forward (clean history)
```bash
git merge --ff-only release/v1.1.0
```

---

## Version Numbering

**Semantic Versioning:** `MAJOR.MINOR.PATCH`

- `MAJOR` - Breaking changes (API incompatible)
- `MINOR` - New features (backward compatible)
- `PATCH` - Bug fixes (backward compatible)

### Current Roadmap

| Version | Features | Target Date |
|---------|----------|-------------|
| `v1.0.0` | Pre-Phase 5 (current master) | ✅ Jan 2026 |
| `v1.1.0` | Phase 5 refactor + Simple App Tabs | Feb 15, 2026 |
| `v1.2.0` | App Groups | Mar 1, 2026 |
| `v1.3.0` | App Hierarchy | Mar 31, 2026 |

---

## Emergency Procedures

### Rollback Production

```bash
# If v1.1.0 has critical bug
git checkout master
git revert HEAD  # Safe: creates new commit
git push origin master

# Or hard rollback (dangerous!)
git reset --hard v1.0.0
git push origin master --force-with-lease
```

### Recover Deleted Branch

```bash
# Find commit hash
git reflog

# Recreate branch
git checkout -b feature/simple-app-tabs <commit-hash>
```

---

## Best Practices

### ✅ DO

- Commit often (small, logical chunks)
- Write descriptive commit messages
- Keep feature branches short-lived
- Rebase before merging to develop
- Delete merged branches
- Tag production releases
- Document breaking changes in CHANGELOG.md

### ❌ DON'T

- Commit directly to master or develop
- Force-push to shared branches
- Merge broken code
- Leave stale branches (>1 month old)
- Mix multiple features in one branch
- Skip code review

---

## Cleanup Schedule

### Weekly
```bash
# Delete merged feature branches
git branch --merged develop | grep -v "develop\|master" | xargs git branch -d
git fetch --prune  # Remove remote tracking branches
```

### Monthly
```bash
# Archive old release branches to tags
git tag release/v1.0.0-archive release/v1.0.0
git branch -d release/v1.0.0
```

---

## Tools

### Useful Git Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  # Show branch tree
  tree = log --graph --oneline --all --decorate

  # Quick status
  st = status -sb

  # Undo last commit (keep changes)
  undo = reset HEAD~1 --soft

  # Clean merged branches
  cleanup = !git branch --merged | grep -v "\\*\\|master\\|develop" | xargs -n 1 git branch -d

  # Current branch name
  current = rev-parse --abbrev-ref HEAD

  # Push current branch
  publish = !git push -u origin $(git current)
```

### GitHub CLI

```bash
# Create PR from command line
gh pr create --base develop --head feature/simple-app-tabs \
  --title "Add Simple App Tabs" \
  --body "Implements spec3/015-simple-app-tabs/spec.md"

# Check PR status
gh pr status

# Merge PR
gh pr merge --merge
```

---

## Related Documents

- [spec3/README.md](../README.md) - Evolution strategy
- [spec3/EVOLUTION_ROADMAP.md](../EVOLUTION_ROADMAP.md) - Feature timeline
- [spec3/015-simple-app-tabs/spec.md](../015-simple-app-tabs/spec.md) - Current feature spec

---

**Status:** Ready to implement. Next: Create `develop` and `feature/simple-app-tabs` branches.
