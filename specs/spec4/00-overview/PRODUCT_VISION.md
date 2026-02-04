# MiniCluster Product Vision

> **Version:** 1.0  
> **Last Updated:** February 2, 2026

---

## Executive Summary

**MiniCluster** is a lightweight DevOps orchestration platform that provides Kubernetes-like capabilities without Kubernetes complexity. It's designed for organizations that need process orchestration, service management, and deployment automation but don't want or need full container orchestration.

---

## Target Market

### Primary Segments

#### 1. Windows-First Enterprises
Organizations running primarily Windows workloads who find Kubernetes cumbersome for their environment.

- **Pain Point:** Kubernetes is Linux-first, Windows containers are problematic
- **Solution:** Native process management with optional container support
- **Value:** Run .NET, Java, Node.js apps without containerization overhead

#### 2. Small DevOps Teams (1-10 people)
Teams without dedicated Kubernetes expertise who need orchestration capabilities.

- **Pain Point:** Kubernetes learning curve is 6-12 months
- **Solution:** Intuitive UI with sensible defaults
- **Value:** Production-ready in days, not months

#### 3. Edge & IoT Deployments
Resource-constrained environments where Kubernetes is overkill.

- **Pain Point:** K3s/MicroK8s still need 500MB+ RAM
- **Solution:** <100MB footprint, single binary
- **Value:** Deploy to Raspberry Pi, kiosks, retail devices

#### 4. SMBs (5-50 Servers)
Small-medium businesses with multiple servers but no dedicated ops team.

- **Pain Point:** Managing services across servers is manual
- **Solution:** Multi-node cluster with central dashboard
- **Value:** One person can manage 50+ servers

#### 5. Managed Service Providers (MSPs)
Companies managing infrastructure for multiple clients.

- **Pain Point:** Each client has different tools
- **Solution:** Standardized platform with tenant isolation
- **Value:** Consistent operations across all clients

---

## Competitive Positioning

### What MiniCluster IS
- ✅ Process & service orchestrator
- ✅ Deployment automation platform
- ✅ Configuration management system
- ✅ Multi-node cluster manager
- ✅ Plugin-extensible platform

### What MiniCluster IS NOT
- ❌ Container orchestrator (optional support, not primary)
- ❌ Kubernetes replacement for all use cases
- ❌ Cloud-native platform (targets Windows/on-prem)

### Competitive Matrix

| Feature | MiniCluster | Kubernetes | Docker Compose | Systemd | PM2 |
|---------|-------------|------------|----------------|---------|-----|
| Windows Support | ✅ Native | 🔶 Limited | 🔶 WSL2 | ❌ | ✅ |
| Learning Curve | Low | Very High | Low | Low | Low |
| Multi-Node | ✅ | ✅ | ❌ | ❌ | ❌ |
| UI Dashboard | ✅ | External | ❌ | ❌ | ✅ |
| Health Checks | ✅ | ✅ | ✅ | ✅ | ✅ |
| Blue-Green Deploy | ✅ | ✅ | ❌ | ❌ | 🔶 |
| Plugin System | ✅ | ✅ | ❌ | ❌ | ❌ |
| Resource Usage | Very Low | High | Low | Very Low | Very Low |
| Native Processes | ✅ | ❌ | ❌ | ✅ | ✅ |

---

## Value Proposition

### For Developers
> "Deploy and manage applications without learning Kubernetes"

- One-click deployments
- Instant rollback
- Real-time logs and metrics
- File explorer for configs

### For Operations
> "Manage dozens of servers from one dashboard"

- Central control plane
- Multi-node clusters
- Health monitoring
- Automated restart policies

### For Business
> "Reduce operational costs by 70%"

- No Kubernetes expertise needed ($150K+/year savings)
- 10x faster time to production
- Self-service for developers
- MSP-ready multi-tenancy

---

## Business Model

### Open Core
- **Free & Open Source:** Core platform, CLI, single-node
- **Commercial License:** Multi-node, enterprise features, support

### Revenue Streams

#### 1. Enterprise Edition
- Multi-node cluster (5+ nodes)
- RBAC with AD/LDAP integration
- Audit logging
- Priority support
- **Price:** $500/node/year

#### 2. Managed Cloud
- MiniCluster-as-a-Service
- Hosted control plane
- Per-node pricing
- **Price:** $99/node/month

#### 3. Plugin Marketplace
- 30% commission on paid plugins
- Developer ecosystem
- First-party premium plugins

#### 4. Professional Services
- Implementation consulting
- Custom plugin development
- Training and certification

---

## Technology Stack

| Component | Technology | Rationale |
|-----------|------------|-----------|
| Backend | ASP.NET Core 9 | Cross-platform, high performance, Windows native |
| Frontend | React + TypeScript | Modern, component-based, large ecosystem |
| Database | SQLite | Zero-config, embedded, sufficient for config |
| Telemetry | TimescaleDB (optional) | High-volume time-series for metrics |
| Proxy | YARP | Microsoft's reverse proxy, native .NET |
| Real-time | SignalR | WebSocket abstraction, auto-reconnect |
| CLI | .NET Global Tool | Same stack, easy distribution |

---

## Differentiators

### 1. Native Process-First
Unlike Kubernetes/Docker, MiniCluster treats native OS processes as first-class citizens. Containers are optional, not required.

### 2. Windows Excellence
Built with Windows in mind from day one. No WSL2 hacks, no Linux-first decisions.

### 3. Single Binary
The entire platform is one executable. No dependencies, no runtime requirements.

### 4. Intuitive Defaults
Works out of the box with sensible defaults. Progressive disclosure for advanced features.

### 5. Open Plugin Ecosystem
Third-party developers can extend both backend and frontend. Marketplace for distribution.

---

## Success Metrics

### Year 1 Goals
- 1,000+ GitHub stars
- 100+ production deployments
- 10+ community plugins
- 5+ enterprise customers

### Key Performance Indicators
- Time to first deployment: <30 minutes
- MTTR (Mean Time to Recovery): <5 minutes with auto-restart
- Learning curve: First app deployed in <1 hour
- Net Promoter Score: >50

---

## References

- Original spec: `../spec/000-product-positioning/spec.md`
- Business model: `../spec/000-product-positioning/business-model.md`
