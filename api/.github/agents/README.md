# MiniCluster Agent Guide

## Quick Start

### Using the Feature Implementation Agent

The agent helps you implement features following MiniCluster's spec-driven development process.

---

## 🚀 Starting a New Feature

### Step 1: Pick a Feature from spec2/

Look at [spec2/INDEX.md](../../spec2/INDEX.md) and choose a feature based on:
- **Priority** (🔴 CRITICAL first)
- **Dependencies** (all required features must be ✅)
- **Your capacity** (check effort estimate)

### Step 2: Activate the Agent

In Copilot Chat, simply ask:
```
@spec-implementer I want to implement [feature name]
```

**Examples:**
- `@spec-implementer I want to implement Authentication`
- `@spec-implementer I want to implement Hierarchical Apps`
- `@spec-implementer Start feature 008`

### Step 3: Follow Agent Guidance

The agent will:
1. ✅ Verify spec is complete
2. ✅ Check dependencies are met
3. ✅ Create proper feature branch
4. ✅ Guide through implementation phases
5. ✅ Help with testing
6. ✅ Update status tracking
7. ✅ Prepare pull request

---

## 🎯 Common Scenarios

### Scenario 1: Implementing Top Priority Feature

**You:**
> @spec-implementer What's the next priority feature I should work on?

**Agent:**
> Based on spec2/INDEX.md, the top priority features are:
> 1. 🔴 003 Authentication (2 weeks) - Complete API keys & RBAC
> 2. 🔴 008 Hierarchical Apps (3-4 weeks) - Apps, services, groups
> 3. 🔴 005 Reliability (12-16 weeks) - Auto-restart, health checks
>
> Would you like to start with 003 Authentication?

### Scenario 2: Check If Ready to Start

**You:**
> @spec-implementer Can I start implementing Service-Level Versioning?

**Agent:**
> ❌ BLOCKED: Feature 009 has unmet dependencies
> 
> Required:
> - 008 Hierarchical Apps (Not Started)
> - 007 App Versioning (Not Started)
>
> Please implement dependencies first, or choose another feature.

### Scenario 3: Create Feature Branch

**You:**
> @spec-implementer Create branch for Hierarchical Apps

**Agent:**
> ✅ Creating feature branch
>
> ```bash
> git checkout main
> git pull origin main
> git checkout -b feature/008-hierarchical-apps
> ```
>
> Branch created: feature/008-hierarchical-apps
> Status updated: 008 → 🚧 In Progress

### Scenario 4: Review Implementation Phase

**You:**
> @spec-implementer What should I implement in Phase 1 of Hierarchical Apps?

**Agent:**
> Phase 1: Database Schema (2 days)
>
> Tasks:
> 1. Add ParentAppId, GroupId columns to Apps table
> 2. Create Services table
> 3. Create Groups table
> 4. Create migration script
> 5. Add foreign key constraints
> 6. Create indexes
>
> Files to modify:
> - Data/AppDbContext.cs
> - Entities/App.cs (add new properties)
> - Entities/Service.cs (new)
> - Entities/Group.cs (new)
> - Migrations/YYYYMMDD_008_HierarchicalApps.cs (new)
>
> Ready to start?

### Scenario 5: Update Progress

**You:**
> @spec-implementer Phase 1 complete, update status

**Agent:**
> ✅ Updating status
>
> Files updated:
> - spec2/phase-5-hierarchy-organization/008-hierarchical-apps.md
>   - Phase 1: Database schema ✅ (was ⬜)
>   - Completion: 14% (1/7 phases)
>
> - spec2/INDEX.md
>   - Status: 🚧 In Progress (updated progress bar)
>
> Next: Phase 2 - Apps as composites (1 week)
> Ready to continue?

---

## 📋 Agent Commands

### Feature Selection
```
@spec-implementer What should I work on next?
@spec-implementer Show feature priorities
@spec-implementer Check if [feature] is ready
```

### Spec Verification
```
@spec-implementer Check spec for [feature]
@spec-implementer Is [feature] spec complete?
@spec-implementer What dependencies does [feature] need?
```

### Branch Management
```
@spec-implementer Create branch for [feature]
@spec-implementer What's the branch name for [feature]?
```

### Implementation Guidance
```
@spec-implementer Start implementing [feature]
@spec-implementer What's in Phase 1 of [feature]?
@spec-implementer Show me the API endpoints for [feature]
@spec-implementer What files do I need to modify?
```

### Status Updates
```
@spec-implementer Update status for [feature]
@spec-implementer Mark Phase X complete
@spec-implementer What's the completion % for [feature]?
```

### Testing
```
@spec-implementer What tests do I need for [feature]?
@spec-implementer Review test coverage
@spec-implementer Run test checklist
```

### Pull Request
```
@spec-implementer Prepare PR for [feature]
@spec-implementer Generate PR description
@spec-implementer What should I include in PR?
```

---

## 🛠️ Workflow Example

### Full Implementation Flow

```
1️⃣ Choose Feature
   You: @spec-implementer What should I work on next?
   Agent: Recommends feature based on priority & dependencies

2️⃣ Verify Spec
   Agent: Automatically checks spec completeness
   Agent: Verifies dependencies are met

3️⃣ Create Branch
   Agent: Creates feature/NNN-feature-name branch
   Agent: Updates status to 🚧 In Progress

4️⃣ Implement Phase 1
   You: Make code changes
   You: Write tests
   You: Commit with proper message

5️⃣ Update Progress
   You: @spec-implementer Phase 1 complete
   Agent: Updates spec2/ tracking files

6️⃣ Repeat for Remaining Phases
   (Steps 4-5 for each phase)

7️⃣ Final Testing
   Agent: Runs testing checklist
   You: Verify all tests pass

8️⃣ Prepare PR
   Agent: Generates PR template with all details
   You: Create PR and request review

9️⃣ Mark Complete
   After PR merged:
   You: @spec-implementer Mark [feature] complete
   Agent: Updates status to ✅ Complete
```

---

## 📊 Status Icons Reference

| Icon | Status | Meaning |
|------|--------|---------|
| ✅ | Complete | 100% implemented, tested, merged |
| 🔶 | Partial | Some components done, others pending |
| 🚧 | In Progress | Currently being developed |
| 📋 | Spec Ready | Spec complete, not started |
| 💡 | Planned | Identified but spec incomplete |
| 📄 | Reference | Documentation only |

---

## ✅ Pre-Implementation Checklist

Before starting ANY feature, ensure:

- [ ] Feature spec exists in spec2/
- [ ] Detailed spec exists in spec/
- [ ] All dependencies are ✅ or 🔶
- [ ] Business value is clear
- [ ] Technical design is detailed
- [ ] Database schema defined
- [ ] API endpoints documented
- [ ] Implementation phases defined
- [ ] Test strategy planned
- [ ] Effort estimate reasonable

**If any item is missing, update the spec first!**

---

## 🚫 Common Mistakes to Avoid

### ❌ Don't Start Without Spec
```
Bad:  "I'll just start coding and figure it out"
Good: "@spec-implementer Check spec for [feature]"
```

### ❌ Don't Skip Dependencies
```
Bad:  "I'll implement it anyway, we don't need those features"
Good: "@spec-implementer What dependencies does [feature] need?"
```

### ❌ Don't Use Wrong Branch Names
```
Bad:  feature/my-cool-feature
Good: feature/008-hierarchical-apps
```

### ❌ Don't Skip Testing
```
Bad:  "Tests can come later"
Good: "@spec-implementer What tests do I need for [feature]?"
```

### ❌ Don't Forget Status Updates
```
Bad:  Complete feature but don't update spec2/
Good: "@spec-implementer Update status for [feature]"
```

---

## 🎓 Best Practices

### 1. Read the Spec First
Always read both:
- `spec2/phase-N/NNN-feature-name.md` (summary)
- `spec/NNN-feature-name/spec.md` (detailed)

### 2. Follow Phases
Don't skip ahead. Complete phases in order.

### 3. Test as You Go
Write tests for each phase, not all at the end.

### 4. Commit Frequently
Small, focused commits with clear messages.

### 5. Update Status Regularly
After completing each phase, update tracking.

### 6. Ask Questions
If spec is unclear, ask agent or update spec.

### 7. Document Changes
If you deviate from spec, document why.

---

## 🆘 When Agent Can't Help

The agent is powerful but has limits. Get human help when:

- Spec is fundamentally flawed
- Major architectural decisions needed
- Security vulnerabilities discovered
- Performance issues severe
- Breaking changes to public APIs
- Merge conflicts complex
- Production incidents

---

## 📖 Further Reading

- [spec2/INDEX.md](../../spec2/INDEX.md) - Full roadmap
- [spec2/README.md](../../spec2/README.md) - Spec organization
- [spec/000-template/spec-template.md](../../spec/000-template/spec-template.md) - Spec template
- [.github/agents/spec-implementer.agent.md](spec-implementer.agent.md) - Agent details

---

## 💬 Feedback & Improvements

If you find issues with the agent or have suggestions:

1. Document the scenario
2. Propose improvement
3. Update agent configuration
4. Test with real feature
5. Share learnings with team

---

**Remember:** The agent is your guide, but YOU are the developer. Use your judgment, ask questions, and improve the process as you go!
