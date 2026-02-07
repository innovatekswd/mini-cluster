# MiniCluster Vision

> **Ship to bare metal like you ship to the cloud.**

---

## The World We See

Infrastructure tooling is split into two extremes:

**The simple tools** — PM2, Supervisor, systemd — get you running in minutes but abandon you the moment you need a second server, a proxy, auth, or deployments. You outgrow them and face a painful migration.

**The complex tools** — Kubernetes, Nomad, Docker Swarm — solve everything but demand weeks of learning, YAML fluency, container expertise, and dedicated DevOps staff. Most teams don't have that.

There is nothing in between. Teams are forced to choose: stay simple and hit a wall, or adopt complexity they don't need yet and may never need.

---

## The World We're Building

A world where **infrastructure reveals itself as you need it**.

You start with one server and one command. You get a process manager, a reverse proxy, health checks, and a dashboard. It feels like PM2 — because that's all you need right now.

When you add a second server, identity, config, and registry appear — not as new tools, but as capabilities that were always built into the same binary. No migration. No new CLI. No retraining.

When you need to scale to 50 servers, auto-scaling provisions cloud VMs, deploys your apps, routes traffic, and scales to zero when idle. Still the same binary. Still the same `mc` command.

**The vision is the zero-migration path from process manager to platform runtime.**

---

## What This Means Concretely

1. **One binary** — installs in seconds, runs everywhere (Linux, macOS, Windows)
2. **Progressive disclosure** — features appear when needed, not before
3. **No containers required** — native processes are first-class citizens; containers are optional
4. **No YAML** — UI, CLI, and API; configuration is code only when you want it to be
5. **Self-hosted** — your servers, your data, your control
6. **Open** — plugin SDK, package format (.mcpkg), standard protocols (OIDC)

---

## The North Star

A solo developer on a $5 VPS and a 50-person team across 200 servers should both say:

*"I use MiniCluster."*

Same tool, same experience, different scale. That's the product.
