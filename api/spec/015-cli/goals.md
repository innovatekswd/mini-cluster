# MiniCluster CLI: Goals & Vision

> **Status:** 📋 Spec Draft  
> **Phase:** 11 - CLI & DevOps Tooling  
> **Priority:** 🟡 HIGH  
> **Estimated Effort:** 6-8 weeks  
> **Author:** MiniCluster Team  
> **Date:** 2026-02-04

---

## Executive Summary

The MiniCluster CLI (`minicluster` or `mc`) is a command-line interface that brings infrastructure-as-code principles to MiniCluster. It enables DevOps teams, CI/CD pipelines, and power users to manage applications, services, and deployments without relying on the web UI.

**Key Architecture Decision:** The CLI is a **thin HTTP client** that calls the MiniCluster API. It contains no business logic—all process management, validation, and orchestration happens server-side. This means:
- CLI can run anywhere (your laptop, CI server, etc.)
- MiniCluster API must be running on the target machine
- Zero code duplication between CLI (Go) and API (.NET)

---

## Vision Statement

> **"Enable complete MiniCluster control from the terminal, making automation first-class and deployments painless."**

The CLI should feel as natural and powerful as `kubectl` for Kubernetes or `docker` for containers, but optimized for MiniCluster's native process orchestration model.

---

## Strategic Goals

### 1. DevOps-First Automation

**Objective:** Make MiniCluster the easiest orchestration platform to automate.

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **CI/CD Integration** | Seamless integration with GitHub Actions, GitLab CI, Azure DevOps, Jenkins | Works out-of-box with major CI platforms |
| **Scriptable Output** | All commands produce machine-parseable output | JSON/YAML output for all commands |
| **Predictable Exit Codes** | Standardized exit codes for automation | All exit codes documented and consistent |
| **Idempotent Operations** | Commands can be safely re-run | No side effects from repeated execution |
| **Non-Interactive Mode** | Full functionality without prompts | `--yes` flag skips all confirmations |

**Key Scenarios:**
- Deploy new version on every git push
- Automated health checks in CI pipeline
- Scheduled rollback if metrics degrade
- Bulk service updates across environments

---

### 2. Zero-Configuration Developer Experience

**Objective:** Get developers productive in under 5 minutes.

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **Quick Start** | No config needed for basic usage | `mc app list` works immediately |
| **Smart Defaults** | Sensible defaults for all options | 80% of use cases covered by defaults |
| **Auto-Discovery** | Auto-detect local MiniCluster server | Works on localhost:5147 by default |
| **Helpful Errors** | Clear, actionable error messages | Every error includes suggested fix |
| **Built-in Help** | Comprehensive `--help` on every command | All options documented inline |

**Key Scenarios:**
- Developer runs `mc` on new machine and starts working
- Error message tells exactly what to fix
- Tab completion suggests valid options

---

### 3. Zero-Downtime Deployments

**Objective:** Make production deployments safe and reliable.

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **Blue-Green Deployments** | Seamless version switching | Zero downtime during deploys |
| **Health Check Verification** | Verify new version before switching | Auto-rollback on health failure |
| **Rolling Updates** | Update multi-service apps gradually | One service at a time by default |
| **Instant Rollback** | One-command rollback to previous | `mc deploy rollback` in <5 seconds |
| **Deployment History** | Track all deployments with metadata | Full audit trail available |

**Key Scenarios:**
- Deploy v2.0, health check fails, automatic rollback to v1.9
- Roll out update to 10 services with 30s delay between each
- Rollback to version from 3 deployments ago

---

### 4. Configuration as Code

**Objective:** Manage entire MiniCluster state through version-controlled files.

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **Declarative Config** | Define desired state in YAML/JSON | Apply files to achieve state |
| **Export/Import** | Extract current state to files | Round-trip config without loss |
| **Diff Support** | Compare file config vs running state | Show changes before applying |
| **Template Variables** | Support variable substitution | Environment-specific configs |
| **Dry Run** | Validate without applying | Preview all changes first |

**Key Scenarios:**
- Store entire MiniCluster config in git
- Promote staging config to production
- Review config changes in PR before deploying

---

### 5. Operational Visibility

**Objective:** Provide complete insight into system and service health.

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **Real-time Logs** | Stream logs from terminal | `mc service logs -f` like `tail -f` |
| **Live Metrics** | Show CPU/memory in real-time | `mc system metrics --watch` |
| **Status Dashboards** | Summarized health status | Clear visual representation |
| **Batch Status** | Check multiple services at once | `mc app status my-app` shows all |
| **Format Options** | Human and machine-readable output | Table, JSON, YAML, quiet modes |

**Key Scenarios:**
- Tail logs across multiple services
- Watch memory usage spike in real-time
- Get JSON status for monitoring integration

---

### 6. Cross-Platform Consistency

**Objective:** Same CLI experience on Windows, Linux, and macOS.

| Goal | Description | Success Criteria |
|------|-------------|------------------|
| **Native Binaries** | No runtime dependencies | Single executable download |
| **Consistent Behavior** | Same commands work everywhere | No platform-specific quirks |
| **Shell Completion** | Autocomplete for major shells | Bash, Zsh, PowerShell, Fish |
| **Path Handling** | Correct path handling per OS | Forward/backslash agnostic |
| **Color Support** | Detect terminal capabilities | Auto-disable colors when piped |

**Key Scenarios:**
- Windows admin manages Linux MiniCluster
- Same scripts run in Windows CI and Linux CI
- PowerShell and Bash both supported

---

## Non-Goals (Explicitly Deferred)

| Non-Goal | Reason |
|----------|--------|
| GUI/TUI Interface | Web UI covers interactive use |
| Plugin System for CLI | Keep CLI simple, plugins are server-side |
| Multi-Cluster Logic in v1 | Design for it now (--context flag), implement later |
| Custom Scripting Language | Use standard shells (bash, powershell) |
| Built-in Monitoring | Use existing tools (Prometheus, etc.) |
| Direct Process Management | CLI calls API; never manages processes directly |

---

## Target Users

### Primary Users

| User | Needs | Feature Priority |
|------|-------|------------------|
| **DevOps Engineer** | Automate deployments, manage infrastructure | CI/CD integration, declarative config |
| **SRE / Platform Engineer** | Maintain reliability, handle incidents | Zero-downtime deploy, logs, metrics |
| **Backend Developer** | Quick service restarts, log checking | Simple commands, fast feedback |

### Secondary Users

| User | Needs | Feature Priority |
|------|-------|------------------|
| **CI/CD Pipeline** | Automated deployment jobs | Exit codes, JSON output |
| **Monitoring System** | Health status integration | Parseable status output |
| **Security Auditor** | Audit trail review | Export configs, history |

---

## Success Metrics

### Adoption Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| CLI Downloads | 1,000 in first month | Download tracking |
| Daily Active Users | 30% of MiniCluster users | Telemetry (opt-in) |
| CI/CD Integrations | 50 documented pipelines | Community examples |

### Quality Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Command Success Rate | >99% | Error tracking |
| Deploy Success Rate | >98% | Rollback frequency |
| P95 Command Latency | <500ms | Performance tracking |

### User Experience Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Time to First Deploy | <10 minutes | User studies |
| Documentation Coverage | 100% of commands | Doc audit |
| GitHub Issues (bugs) | <10 open issues | Issue tracking |

---

## Why Go for CLI, .NET for Backend (Hybrid Approach)

This is the right architecture choice:

| Component | Technology | Why |
|-----------|------------|-----|
| **API Server** | .NET | YARP, SignalR, EF Core, Windows-first |
| **CLI Tool** | Go | Small binary, fast startup, cross-compile |

**The CLI is just an HTTP client.** It doesn't duplicate backend logic:

| What | In CLI? | In API? |
|------|---------|--------|
| DTOs/Models | Auto-generated from OpenAPI | C# classes |
| Process Management | ❌ No | ✅ Yes |
| Business Logic | ❌ No | ✅ Yes |
| Database Access | ❌ No | ✅ Yes |
| Validation | Basic input only | Full validation |

---

## Competitive Analysis

### CLI Design Inspirations

| Tool | What to Learn | What to Avoid |
|------|---------------|---------------|
| **kubectl** | Resource model, apply/delete pattern | Verbosity, steep learning curve |
| **docker** | Simplicity, intuitive commands | Inconsistent subcommands |
| **gh (GitHub)** | Modern UX, interactive prompts | Too many prompts for automation |
| **fly.io flyctl** | Great DX, fast deploys | Some commands too magical |
| **heroku** | Simple deploy workflow | Vendor lock-in patterns |

### Differentiation

| Competitor | MiniCluster CLI Advantage |
|------------|---------------------------|
| kubectl | Simpler model, no YAML complexity |
| Docker Compose | Native process support, better Windows |
| Podman | Easier setup, no daemon required |
| Custom scripts | Standardized, cross-platform, documented |

---

## Constraints & Requirements

### Technical Constraints
- Must work with existing MiniCluster API (no API changes required for v1)
- Must support authentication (JWT tokens, API keys)
- Binary size should be <50MB
- No external runtime dependencies

### Compatibility Requirements
- Windows 10/11, Windows Server 2016+
- Linux (major distros: Ubuntu 18+, Debian 10+, CentOS 7+, RHEL 7+)
- macOS 10.15+
- ARM64 and AMD64 architectures

### Security Requirements
- Credentials stored securely (OS keychain where available)
- Support environment variable-based auth (for CI/CD)
- No credentials in command history (prompt for sensitive values)
- HTTPS by default for remote servers

---

## Roadmap Overview

### Phase 1: Foundation (Weeks 1-2)
- Project setup (Go or .NET Global Tool)
- Basic commands: `app list`, `service list`, `help`, `version`
- Configuration file support
- Authentication (token-based)

### Phase 2: Core Operations (Weeks 3-4)
- Full CRUD for apps and services
- Service control (start/stop/restart)
- Log streaming
- Status and metrics commands

### Phase 3: Deployment (Weeks 5-6)
- Blue-green deployment command
- Health check integration
- Rollback command
- Deployment history

### Phase 4: Config & Polish (Weeks 7-8)
- Export/import configuration
- Batch operations
- Shell completion
- Documentation and examples

---

## Open Questions

1. **Go vs .NET for CLI implementation?**
   - Go: Smaller binaries, faster startup, established CLI ecosystem (Cobra)
   - .NET: Consistent with backend, shared code/DTOs, .NET global tool distribution
   
2. **Should we support interactive mode (TUI)?**
   - Pro: Better DX for exploration
   - Con: Complexity, maintenance burden
   
3. **How to handle secrets in config files?**
   - Environment variable references
   - External secret provider integration
   - Encrypted values in config
   
4. **What's the minimum API version requirement?**
   - CLI should specify which MiniCluster API version it supports

---

## References

- [CLI_SPECIFICATION.md](../CLI_SPECIFICATION.md) - Detailed command specification
- [005-reliability-orchestration](../005-reliability-orchestration/) - Health checks, restart policies
- [007-app-versioning](../007-app-versioning/) - Deployment strategies
- [010-multi-node-cluster](../010-multi-node-cluster/) - Future multi-cluster support

---

## Next Steps

1. ✅ Define goals and vision (this document)
2. 📋 Complete design specification (next)
3. 📋 Implementation planning
4. 📋 Begin Phase 1 development
