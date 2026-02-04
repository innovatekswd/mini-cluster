# Feature 015: MiniCluster CLI

> **Status:** 📋 Spec Ready  
> **Phase:** 11 - CLI & DevOps Tooling  
> **Priority:** 🟡 HIGH  
> **Estimated Effort:** 6-8 weeks  
> **Author:** MiniCluster Team  
> **Date:** 2026-02-04

---

## Overview

The MiniCluster CLI (`minicluster` or `mc`) is a command-line interface for managing applications, services, and deployments in MiniCluster. It enables DevOps automation, CI/CD integration, configuration-as-code workflows, and zero-downtime deployments—all from the terminal.

---

## Key Architecture Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| **CLI is a thin client** | HTTP calls only | No business logic in CLI; all process management is server-side |
| **Language** | Go | Smaller binary (~15MB), faster startup (<50ms), cross-compile |
| **DTOs** | OpenAPI generation | Auto-generate Go models from Swagger spec; zero duplication |
| **Multi-context** | Design now, implement later | `--context` flag ready from v1; forward-compatible |
| **Config file** | CLI settings only | `config.yaml` stores connection/auth, NOT app configuration |

**What the CLI does NOT do:**
- ❌ Directly manage processes (always calls API)
- ❌ Store application configurations (that's `mc config export/import`)
- ❌ Duplicate business logic from backend
- ❌ Require runtime dependencies (single binary)

---

## Related Documents

| Document | Description |
|----------|-------------|
| [goals.md](goals.md) | Strategic goals, vision, and success metrics |
| [design.md](design.md) | Technical design, architecture, and implementation details |
| [implementation-plan.md](implementation-plan.md) | Go implementation plan with phases, tasks, and code samples |
| [../CLI_SPECIFICATION.md](../CLI_SPECIFICATION.md) | Detailed command reference and examples |

---

## Business Value

| Problem | Solution |
|---------|----------|
| Manual deployments through UI are slow and error-prone | Scripted, repeatable deployments via CLI |
| CI/CD integration requires custom API scripts | Native CLI with standardized exit codes and JSON output |
| Configuration drift between environments | Export/import configs as version-controlled YAML |
| Risky production deployments | Zero-downtime blue-green deployments with automatic rollback |
| Limited visibility during incidents | Real-time log streaming and metrics from terminal |

### Target Users

| User | Primary Needs |
|------|---------------|
| **DevOps Engineer** | Automate deployments, manage infrastructure as code |
| **SRE / Platform Engineer** | Handle incidents, maintain reliability, monitor health |
| **Backend Developer** | Quick service restarts, log tailing, status checks |
| **CI/CD Pipeline** | Automated deployments with predictable exit codes |

### Success Metrics

- **Adoption:** 30% of active MiniCluster users use CLI within 3 months
- **Reliability:** 99% command success rate, <5% rollback frequency
- **Performance:** P95 command latency <500ms for network operations
- **Time savings:** Reduce deployment time by 50% vs UI-based workflow

---

## Key Features

### Feature 1: App & Service Management
Full CRUD operations for apps and services via CLI.

**User Story:**
> As a DevOps engineer, I want to create and manage services from the command line so that I can automate infrastructure setup.

**Acceptance Criteria:**
- [ ] List, get, create, update, delete apps
- [ ] List, get, create, update, delete services
- [ ] Start, stop, restart services
- [ ] Assign/unassign services to apps
- [ ] Support JSON/YAML output formats

### Feature 2: Log Streaming
Stream service logs in real-time from the terminal.

**User Story:**
> As an SRE, I want to tail logs from multiple services so that I can debug production issues quickly.

**Acceptance Criteria:**
- [ ] Stream logs with `mc service logs -f`
- [ ] Filter logs by time range (`--since`, `--until`)
- [ ] Show last N lines (`--tail`)
- [ ] Support log level coloring
- [ ] Work with SignalR/SSE for real-time streaming

### Feature 3: Zero-Downtime Deployments
Blue-green and rolling deployment strategies.

**User Story:**
> As a DevOps engineer, I want to deploy new versions without downtime so that users are never affected by deployments.

**Acceptance Criteria:**
- [ ] Blue-green deployment command
- [ ] Health check verification before traffic switch
- [ ] Automatic rollback on health check failure
- [ ] Deployment history tracking
- [ ] Manual rollback command

### Feature 4: Configuration as Code
Export/import configurations as YAML/JSON files.

**User Story:**
> As a platform engineer, I want to version control my MiniCluster configuration so that I can track changes and roll back if needed.

**Acceptance Criteria:**
- [ ] Export app/service configs to YAML
- [ ] Import configs with dry-run option
- [ ] Diff file config vs running state
- [ ] Support variable substitution in configs
- [ ] Validate configs before applying

### Feature 5: CI/CD Integration
First-class support for automation pipelines.

**User Story:**
> As a DevOps engineer, I want to integrate MiniCluster with GitHub Actions so that deployments happen automatically on merge.

**Acceptance Criteria:**
- [ ] Standardized exit codes for all commands
- [ ] JSON output for machine parsing
- [ ] Non-interactive mode (`--yes` flag)
- [ ] Environment variable configuration
- [ ] Token-based authentication

---

## Technical Summary

### Technology Stack
| Component | Technology |
|-----------|------------|
| Language | Go 1.21+ |
| CLI Framework | Cobra + Viper |
| HTTP Client | Native Go with retry logic |
| Output | tablewriter, encoding/json, yaml.v3 |

### Key Design Decisions

1. **Go over .NET** - Smaller binaries (~15MB vs ~50MB), faster startup (<50ms vs ~300ms), better CLI ecosystem (Cobra)

2. **Cobra/Viper** - Industry standard for Go CLIs, used by kubectl, docker, gh

3. **Configuration hierarchy** - Flags > Env vars > Project config > User config > Defaults

4. **Output formats** - Default table for humans, JSON/YAML for machines, quiet for scripting

### Architecture

```
minicluster-cli/
├── cmd/                  # Command definitions
│   ├── root.go          # Root command, global flags
│   ├── app.go           # mc app [subcommand]
│   ├── service.go       # mc service [subcommand]
│   ├── deploy.go        # mc deploy [subcommand]
│   └── ...
├── internal/
│   ├── api/             # API client
│   ├── config/          # Configuration management
│   ├── output/          # Output formatting
│   └── util/            # Utilities
└── main.go
```

---

## Implementation Phases

| Phase | Features | Effort | Dependencies |
|-------|----------|--------|--------------|
| 1 | Foundation: project setup, config, auth, basic commands | 2 weeks | None |
| 2 | Core Operations: full CRUD, service control, logs | 2 weeks | Phase 1 |
| 3 | Deployment: blue-green, health checks, rollback | 2 weeks | Phase 2 |
| 4 | Polish: config import/export, batch ops, completion | 2 weeks | Phase 3 |

**Total Estimated Effort:** 6-8 weeks

### Phase 1: Foundation (Weeks 1-2)

**Goal:** Working CLI skeleton with basic commands

**Tasks:**
1. Project setup (Go modules, Makefile, CI)
2. Root command with global flags
3. Configuration file support (Viper)
4. Authentication (JWT token)
5. Basic commands: `version`, `help`, `login`
6. API client foundation

**Deliverables:**
- `mc version` shows version
- `mc login` authenticates and stores token
- `mc app list` returns data from API

### Phase 2: Core Operations (Weeks 3-4)

**Goal:** Complete resource management

**Tasks:**
1. App commands: list, get, create, update, delete
2. Service commands: list, get, create, update, delete
3. Service control: start, stop, restart
4. Log streaming with `--follow`
5. Status and metrics commands
6. Output formatters (table, JSON, YAML, quiet)

**Deliverables:**
- Full app/service CRUD
- Log tailing works
- JSON output usable in scripts

### Phase 3: Deployment (Weeks 5-6)

**Goal:** Zero-downtime deployment capabilities

**Tasks:**
1. Blue-green deployment command
2. Health check integration
3. Automatic rollback logic
4. Deployment status tracking
5. Rollback command
6. Deployment history

**Deliverables:**
- `mc deploy blue-green` works end-to-end
- Automatic rollback on failure
- `mc deploy rollback` reverts changes

### Phase 4: Polish (Weeks 7-8)

**Goal:** Production-ready CLI

**Tasks:**
1. Configuration export/import
2. Config diff command
3. Batch operations
4. Shell completion (bash, zsh, fish, powershell)
5. Documentation and examples
6. Release automation

**Deliverables:**
- Full configuration-as-code workflow
- Shell completions installable
- Published release binaries

---

## API Requirements

The CLI requires these API endpoints (most already exist):

| Endpoint | Method | Status |
|----------|--------|--------|
| `/api/apps` | GET/POST | ✅ Exists |
| `/api/apps/{id}` | GET/PUT/DELETE | ✅ Exists |
| `/api/services` | GET/POST | ✅ Exists |
| `/api/services/{id}` | GET/PUT/DELETE | ✅ Exists |
| `/api/services/{id}/start` | POST | ✅ Exists |
| `/api/services/{id}/stop` | POST | ✅ Exists |
| `/api/services/{id}/logs` | GET | ✅ Exists |
| `/api/services/{id}/logs/stream` | GET (SSE) | ⚠️ May need enhancement |
| `/api/metrics/current` | GET | ✅ Exists |
| `/api/metrics/system` | GET | ✅ Exists |
| `/api/deploy` | POST | ❌ New (for deployment tracking) |
| `/api/deploy/{id}/status` | GET | ❌ New |
| `/api/deploy/{id}/rollback` | POST | ❌ New |

---

## Security Considerations

- All API calls use HTTPS in production
- JWT tokens stored in OS keychain where available
- Credentials never logged or included in error messages
- Support for environment variable authentication (CI/CD)
- Input validation on all user inputs

---

## Testing Strategy

### Unit Tests
- Command parsing and validation
- Output formatting
- Configuration loading
- Error handling

### Integration Tests
- Full command execution against test API
- Deployment workflow end-to-end
- Authentication flows

### Manual Testing
- Cross-platform verification (Windows, Linux, macOS)
- Shell completion behavior
- CI/CD integration examples

---

## Distribution

| Method | Platform |
|--------|----------|
| Direct download | All (GitHub Releases) |
| Homebrew | macOS, Linux |
| Scoop | Windows |
| APT | Debian/Ubuntu |
| RPM | RHEL/CentOS |
| Docker | Container environments |

---

## Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API changes break CLI | Medium | High | Version negotiation, clear error on mismatch |
| Go expertise limited | Low | Medium | Well-documented code, team learning |
| Adoption slower than expected | Medium | Medium | Good docs, examples, video tutorials |
| Platform-specific bugs | Medium | Low | CI matrix testing all platforms |

---

## Open Questions

1. **Go vs .NET:** Go is recommended. Should we also ship a .NET global tool?
2. **TUI mode:** Should we include an interactive terminal UI (like k9s)?
3. **Plugin support:** Allow CLI plugins for custom commands?

---

## References

- [Goals Document](goals.md)
- [Design Document](design.md)
- [CLI Specification](../CLI_SPECIFICATION.md)
- [Cobra Documentation](https://cobra.dev/)
- [kubectl Design Principles](https://kubernetes.io/docs/reference/kubectl/)

---

## Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-02-04 | Initial spec created | MiniCluster Team |
