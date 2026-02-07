# MiniCluster Mission

> **Make bare-metal and VM infrastructure as easy to operate as managed cloud — without giving up ownership.**

---

## What We Do

We build a self-hosted application platform that eliminates the gap between "deploy one app" and "manage a fleet."

---

## How We Do It

### 1. Ship a single binary that does everything

No Docker dependency. No external databases. No companion services to install.
One binary contains the process manager, reverse proxy, identity system, config service, registry, and control plane.

### 2. Reveal complexity only when needed

A user running one app on one server should never see clustering UI.
A team managing 50 servers should never be told to install a different tool.
The platform grows with the user — same binary, same CLI, same mental model.

### 3. Own the package format

`.mcpkg` is our unit of deployment. It bundles the app, its manifest, health checks, env vars, and runtime requirements into a single artifact. Like `.deb` for Ubuntu or `.rpm` for Red Hat — but for MiniCluster.

### 4. Use open standards

OIDC for identity. REST for APIs. OpenAPI for documentation. Standard protocols mean users can plug MiniCluster into existing infrastructure instead of replacing it.

### 5. Build in public, ship in stages

Stage 1 (Runtime) ships as a PM2 killer. Stage 2 (Platform) emerges for teams growing beyond one server. Stage 3 (Fleet) adds scaling for organizations. Each stage is a complete product.

---

## What We Don't Do

- **We don't compete with Kubernetes at scale.** 1000-replica deployments, GPU workloads, and multi-cloud federation belong to Kubernetes. We own the space below that.
- **We don't require containers.** Native processes are first-class. Containers are an optional runtime type, not a prerequisite.
- **We don't lock users in.** Standard protocols, open package format, exported configs. If you leave, you take your data.
- **We don't target enterprises first.** We start with solo devs and small teams, and grow into enterprise features (OIDC, SSO, audit logs) as the platform matures.

---

## Success Looks Like

- A developer installs MiniCluster and has their first app running in **under 10 minutes**
- A team adds a second server with **one command** and zero reconfiguration
- An organization scales from 5 to 50 servers **without switching tools**
- The `.mcpkg` format becomes how people distribute server-side applications
- Community plugin developers choose MiniCluster as their distribution platform
