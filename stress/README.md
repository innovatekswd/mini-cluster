# MiniCluster Stress Testing

Load and stress tests for the MiniCluster API using [k6](https://k6.io).

## Prerequisites

```bash
# Install k6 (Linux)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" \
  | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Or on macOS
brew install k6
```

## Running Tests

Start the API first (either backend):

```bash
# Go backend
cd api-go && go run ./cmd/server

# .NET backend
cd api && dotnet run --project Innovatek.Parallel.MiniCluster.Api
```

Then run a scenario:

```bash
cd stress

# Run against Go (default: localhost:5000)
k6 run scripts/auth.js
k6 run scripts/api-read.js
k6 run scripts/services.js
k6 run scripts/metrics.js
k6 run scripts/concurrent-ops.js
k6 run scripts/spike.js

# Run against .NET
BASE_URL=http://localhost:5147 k6 run scripts/api-read.js

# Soak test (10 minutes)
k6 run --duration 10m scripts/api-read.js

# Save results to JSON for analysis
k6 run --out json=results-$(date +%s).json scripts/api-read.js
```

## Scenarios

| Script | Focus | VUs | Duration |
|--------|-------|-----|----------|
| `auth.js` | Login flood, rate limit detection | 50 | ~2m |
| `api-read.js` | Dashboard read throughput (batch GET) | 200 peak | ~4m |
| `services.js` | Service CRUD + start/stop lifecycle | 40 peak | ~2.5m |
| `metrics.js` | Concurrent metrics polling (gopsutil load) | 150 peak | ~3m |
| `concurrent-ops.js` | Realistic mixed read/write traffic | 150 peak | ~3m |
| `spike.js` | Sudden burst to 300 VUs, recovery check | 300 spike | ~2m |

## Thresholds

Each script defines `thresholds` that fail the run if violated:

- **p95 response times** — most endpoints must respond in <300–500ms at p95
- **Error rate** — overall HTTP failures must stay below 5–10%
- **Missing fields** — `metrics.js` counts responses missing `cpuUsagePercent` etc.

## Interpreting Results

k6 prints a summary after each run. Key metrics to watch:

```
✓ http_req_duration....: avg=45ms   min=12ms   med=38ms   max=1.2s  p(90)=89ms  p(95)=123ms
✓ http_req_failed......: 0.12%      ✓ 0/838 (0.12%)
✗ service_create_ms....: p(95)=850ms  [THRESHOLD EXCEEDED]
```

A `✗` means a threshold was breached — investigate the specific endpoint.

## What We're Stress-Testing

1. **Auth under load** — confirms rate limiting works and token issuance scales
2. **Read throughput** — the dashboard makes 5 parallel requests per user; 100 users = 500 req/s
3. **DB write contention** — SQLite has a single write lock; concurrent CRUD surfaces lock waits
4. **gopsutil collection** — reading /proc files under high concurrency can be slow
5. **Process manager** — starting/stopping many services simultaneously tests lock contention in the exec layer
6. **Spike recovery** — after a sudden burst the API should recover, not stay degraded

## CI Integration

Add to your pipeline (after integration tests pass):

```yaml
- name: Stress test (Go backend)
  run: |
    cd api-go && go run ./cmd/server &
    sleep 3
    cd stress && k6 run --quiet scripts/api-read.js
```
