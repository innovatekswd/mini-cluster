.PHONY: build build-linux build-mac build-mac-arm build-windows build-all clean dev test

VERSION ?= 1.0.0

# ── Single binary builds ─────────────────────────────────────

build: build-linux ## Default: build linux-x64

build-linux: ## Build self-contained binary for Linux x64
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh linux-x64

build-linux-arm: ## Build self-contained binary for Linux ARM64
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh linux-arm64

build-mac: ## Build self-contained binary for macOS Intel
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh osx-x64

build-mac-arm: ## Build self-contained binary for macOS Apple Silicon
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh osx-arm64

build-windows: ## Build self-contained binary for Windows x64
	MINICLUSTER_VERSION=$(VERSION) ./packaging/scripts/build-single-binary.sh win-x64

build-all: build-linux build-linux-arm build-mac build-mac-arm build-windows ## Build all platforms

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
