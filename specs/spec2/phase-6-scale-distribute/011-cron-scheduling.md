# 011: Cron Scheduling

**Status:** 📋 Spec Ready (0% Complete)  
**Phase:** 6 - Scale & Distribute  
**Priority:** 🟢 MEDIUM  
**Effort:** 2 weeks  
**Original Spec:** [../spec/011-cron-scheduling/spec.md](../../spec/011-cron-scheduling/spec.md)

---

## Summary

Run apps and services on cron schedules with dependency chains and missed schedule handling. Essential for batch jobs, maintenance tasks, and automated operations.

## Key Features ⬜

### 1. Cron-Based Scheduling (1 week)
- ⬜ **Cron expressions** - Standard cron syntax
- ⬜ **Target selection** - Apps, services, or groups
- ⬜ **Actions** - Start, run, restart, stop
- ⬜ **Timezone support** - Schedule in local or UTC time
- ⬜ **Preview** - See next 10 run times
- ⬜ **Enable/disable schedules** - Temporarily pause

### 2. Dependency Chains (3 days)
- ⬜ **Job A runs after Job B** - Sequential execution
- ⬜ **Wait for completion** - Don't start next until previous finishes
- ⬜ **Conditional execution** - Run only if previous succeeded
- ⬜ **Parallel execution** - Start multiple jobs at once

### 3. Missed Schedule Handling (2 days)
- ⬜ **Run immediately** - Execute missed job ASAP
- ⬜ **Skip** - Don't run missed jobs
- ⬜ **Run latest only** - If multiple missed, run once
- ⬜ **Alert on miss** - Notify when schedule missed

### 4. Run History (2 days)
- ⬜ Track every execution
- ⬜ Exit code and output capture
- ⬜ Duration and performance metrics
- ⬜ Success/failure statistics
- ⬜ Error logs per run

### 5. Advanced Features (2 days)
- ⬜ **One-time schedules** - Run at specific time, then delete
- ⬜ **Retry on failure** - Auto-retry with backoff
- ⬜ **Timeout** - Kill job if runs too long
- ⬜ **Concurrency** - Allow/prevent overlapping runs

## Why This Matters

**Without Scheduling:**
- ❌ Manual execution required
- ❌ Windows Task Scheduler (separate tool)
- ❌ No visibility into job history
- ❌ Hard to coordinate dependent jobs

**With Scheduling:**
- ✅ Automated batch operations
- ✅ Maintenance windows
- ✅ Data processing pipelines
- ✅ Full job history and auditing

## Example Use Cases

### Daily Backup Job
```cron
0 2 * * * - Run backup.exe at 2:00 AM daily
Target: backup-service
Action: run
On Failure: Retry 3 times, alert admin
Output: Captured in run history
```

### Data Processing Pipeline
```
Job Chain:
1. 0 1 * * * - Extract data (extract-service)
   ↓ (wait for completion)
2. Run transformation (transform-service)
   ↓ (wait for completion)
3. Load into database (load-service)
   ↓ (on success)
4. Send report email (notify-service)
```

### Maintenance Window
```cron
0 3 * * 0 - Every Sunday at 3:00 AM
Target: all-apps (group)
Action: restart
Purpose: Weekly maintenance restart
```

### Hourly Health Check
```cron
0 * * * * - Every hour
Target: monitoring-service
Action: run health-check.exe
Timeout: 5 minutes
Alert if fails 3 times in a row
```

## Technical Design

### Database Schema
```sql
-- Schedules
CREATE TABLE Schedules (
  Id INTEGER PRIMARY KEY,
  Name VARCHAR(255),
  CronExpression VARCHAR(100), -- "0 2 * * *"
  TargetType VARCHAR(20), -- App, Service, Group
  TargetId INTEGER,
  Action VARCHAR(20), -- Start, Run, Restart, Stop
  Enabled BOOLEAN DEFAULT 1,
  Timezone VARCHAR(50),
  MissedSchedulePolicy VARCHAR(20), -- RunImmediately, Skip, RunLatest
  MaxRetries INT DEFAULT 0,
  TimeoutSeconds INT,
  AllowConcurrent BOOLEAN DEFAULT 0
);

-- Schedule runs
CREATE TABLE ScheduleRuns (
  Id INTEGER PRIMARY KEY,
  ScheduleId INTEGER,
  ScheduledAt DATETIME,
  StartedAt DATETIME,
  CompletedAt DATETIME,
  Status VARCHAR(20), -- Success, Failure, Timeout, Skipped
  ExitCode INT,
  Output TEXT,
  Error TEXT,
  Duration INT, -- milliseconds
  FOREIGN KEY (ScheduleId) REFERENCES Schedules(Id)
);

-- Dependencies
CREATE TABLE ScheduleDependencies (
  ScheduleId INTEGER,
  DependsOnScheduleId INTEGER,
  WaitForCompletion BOOLEAN DEFAULT 1,
  OnlyIfSuccess BOOLEAN DEFAULT 1,
  FOREIGN KEY (ScheduleId) REFERENCES Schedules(Id),
  FOREIGN KEY (DependsOnScheduleId) REFERENCES Schedules(Id)
);
```

### API Endpoints
```
GET    /api/schedules                - List all schedules
POST   /api/schedules                - Create schedule
PUT    /api/schedules/:id            - Update schedule
DELETE /api/schedules/:id            - Delete schedule
POST   /api/schedules/:id/enable     - Enable schedule
POST   /api/schedules/:id/disable    - Disable schedule
POST   /api/schedules/:id/run-now    - Execute immediately
GET    /api/schedules/:id/runs       - Run history
GET    /api/schedules/:id/next-runs  - Preview next execution times
```

## Implementation Phases

| Phase | Features | Weeks |
|-------|----------|-------|
| 1 | Cron expressions & basic scheduling | 1 |
| 2 | Dependency chains | 3 days |
| 3 | Missed schedule policies | 2 days |
| 4 | Run history & output capture | 2 days |
| 5 | Advanced features (retry, timeout) | 2 days |
| 6 | UI for schedule management | 3 days |

**Total:** 2 weeks

## Cron Expression Examples

| Expression | Description |
|------------|-------------|
| `0 2 * * *` | Every day at 2:00 AM |
| `0 */6 * * *` | Every 6 hours |
| `0 0 * * 0` | Every Sunday at midnight |
| `0 9 1 * *` | First day of month at 9:00 AM |
| `*/5 * * * *` | Every 5 minutes |
| `0 0 1 1 *` | January 1st at midnight (annually) |

## Dependencies

- **Required:** 008 Hierarchical Apps (target apps, services, groups)
- **Recommended:** 010 Multi-Node Cluster (schedule across nodes)

## Related Features

- **Works with:** 005 Reliability (restart policies vs scheduled restarts)
- **Enhanced by:** 013 Analytics (job performance metrics)

---

For complete details, see the [full cron scheduling spec](../../spec/011-cron-scheduling/spec.md).
