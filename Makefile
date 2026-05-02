.PHONY: build build-linux build-linux-arm build-mac build-mac-arm build-windows build-all \
        build-go-linux build-go-linux-arm build-go-windows build-go-all \
        build-dotnet-windows \
        build-cli build-cli-linux build-cli-windows build-cli-all \
        clean dev test

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "1.0.0")

# ── Go API server builds ──────────────────────────────────────

build-go-linux: ## Build Go API server — Linux amd64 (.tar.gz + .deb)
	./packaging/scripts/build-go-api-linux.sh $(VERSION)

build-go-linux-arm: ## Build Go API server — Linux amd64 + arm64 (.tar.gz)
	./packaging/scripts/build-go-api-linux.sh $(VERSION) --arm64

build-go-linux-no-deb: ## Build Go API server — Linux amd64, no .deb
	./packaging/scripts/build-go-api-linux.sh $(VERSION) --no-deb

build-go-windows: ## Build Go API server — Windows amd64 (.zip)
	./packaging/scripts/build-go-api-windows.sh $(VERSION)

build-go-all: build-go-linux build-go-windows ## Build Go API server for all platforms

# ── CLI builds ────────────────────────────────────────────────

build-cli: ## Build CLI for current platform
	cd cli && go build -o build/mc ./cmd/mc

build-cli-linux: ## Build CLI — Linux amd64 .deb
	./packaging/scripts/build-cli-deb.sh

build-cli-windows: ## Build CLI — Windows amd64 .zip
	./packaging/scripts/build-cli-windows.sh

build-cli-all: ## Build CLI for all platforms
	./packaging/scripts/build-all-cli.sh

# ── Full release builds ───────────────────────────────────────

build: build-go-linux build-cli-linux ## Default: build Go API + CLI for Linux

build-all: build-go-all build-dotnet-windows build-cli-all ## Build Go API + .NET API (Windows) + CLI for all platforms

# ── Legacy .NET single-binary builds (kept for reference) ─────

build-linux: ## [legacy] .NET single-file binary for Linux x64
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh linux-x64

build-linux-arm: ## [legacy] .NET single-file binary for Linux ARM64
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh linux-arm64

build-mac: ## [legacy] .NET single-file binary for macOS Intel
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh osx-x64

build-mac-arm: ## [legacy] .NET single-file binary for macOS Apple Silicon
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh osx-arm64

build-dotnet-windows: ## Build .NET API server — Windows x64 (.zip + PowerShell installer)
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-dotnet-windows.sh $(VERSION)

build-windows: ## [legacy] .NET single-file binary for Windows x64 (raw binary, no packaging)
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh win-x64

# ── Development ──────────────────────────────────────────────

dev-api: ## Run API in development mode
	cd api && dotnet run --project Innovatek.Parallel.MiniCluster.Api --urls "http://0.0.0.0:5147"

dev-ui: ## Run UI dev server
	cd ui && npm run dev

# ── Testing ──────────────────────────────────────────────────

test-api: ## Run backend tests
	cd api && dotnet test

test-ui: ## Run frontend tests
	cd ui && npx vitest run

test: test-api test-ui ## Run all tests

# ── Cleanup ──────────────────────────────────────────────────

clean: ## Remove build artifacts
	rm -rf build/single-binary
	rm -rf ui/build
	rm -rf api/Innovatek.Parallel.MiniCluster.Api/wwwroot

# ── Help ─────────────────────────────────────────────────────

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-18s\033[0m %s\n", $$1, $$2}'
