# MiniCluster CLI Makefile

BINARY_NAME := mc
VERSION := $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT := $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME := $(shell date -u '+%Y-%m-%dT%H:%M:%SZ')

# Go parameters
GOCMD := go
GOBUILD := $(GOCMD) build
GOTEST := $(GOCMD) test
GOGET := $(GOCMD) get
GOMOD := $(GOCMD) mod
GOFMT := $(GOCMD) fmt

# Build flags
LDFLAGS := -ldflags "-s -w \
	-X github.com/innovatek/minicluster-cli/internal/version.Version=$(VERSION) \
	-X github.com/innovatek/minicluster-cli/internal/version.GitCommit=$(GIT_COMMIT) \
	-X github.com/innovatek/minicluster-cli/internal/version.BuildTime=$(BUILD_TIME)"

# Directories
BUILD_DIR := build
DIST_DIR := dist

# Platforms
PLATFORMS := linux/amd64 linux/arm64 darwin/amd64 darwin/arm64 windows/amd64

.PHONY: all build clean test lint fmt deps help install uninstall

# Default target
all: clean build

# Build for current platform
build:
	@echo "Building $(BINARY_NAME) $(VERSION)..."
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/mc

# Build for all platforms
build-all:
	@echo "Building for all platforms..."
	@mkdir -p $(DIST_DIR)
	@for platform in $(PLATFORMS); do \
		OS=$${platform%/*}; \
		ARCH=$${platform#*/}; \
		OUTPUT=$(DIST_DIR)/$(BINARY_NAME)-$${OS}-$${ARCH}; \
		if [ "$$OS" = "windows" ]; then OUTPUT=$$OUTPUT.exe; fi; \
		echo "  Building $$OS/$$ARCH..."; \
		GOOS=$$OS GOARCH=$$ARCH $(GOBUILD) $(LDFLAGS) -o $$OUTPUT ./cmd/mc || exit 1; \
	done
	@echo "Done!"

# Install locally
install: build
	@echo "Installing $(BINARY_NAME) to /usr/local/bin..."
	@sudo cp $(BUILD_DIR)/$(BINARY_NAME) /usr/local/bin/$(BINARY_NAME)
	@sudo chmod +x /usr/local/bin/$(BINARY_NAME)
	@echo "Installed!"

# Uninstall
uninstall:
	@echo "Removing /usr/local/bin/$(BINARY_NAME)..."
	@sudo rm -f /usr/local/bin/$(BINARY_NAME)
	@echo "Uninstalled!"

# Run tests
test:
	@echo "Running tests..."
	$(GOTEST) -v -race ./...

# Run tests with coverage
test-coverage:
	@echo "Running tests with coverage..."
	$(GOTEST) -v -race -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Lint code
lint:
	@echo "Linting code..."
	@which golangci-lint > /dev/null || (echo "golangci-lint not installed" && exit 1)
	golangci-lint run ./...

# Format code
fmt:
	@echo "Formatting code..."
	$(GOFMT) ./...

# Tidy dependencies
deps:
	@echo "Tidying dependencies..."
	$(GOMOD) tidy

# Download dependencies
deps-download:
	@echo "Downloading dependencies..."
	$(GOMOD) download

# Clean build artifacts
clean:
	@echo "Cleaning..."
	@rm -rf $(BUILD_DIR) $(DIST_DIR)
	@rm -f coverage.out coverage.html

# Generate client from OpenAPI spec
generate-client:
	@echo "Generating API client from OpenAPI spec..."
	./scripts/generate-client.sh

# Check if everything builds
check: fmt lint test build
	@echo "All checks passed!"

# Development build (quick, no optimizations)
dev:
	$(GOBUILD) -o $(BUILD_DIR)/$(BINARY_NAME) ./cmd/mc

# Run the CLI (for testing)
run: build
	./$(BUILD_DIR)/$(BINARY_NAME) $(ARGS)

# Show version
version:
	@echo $(VERSION)

# Help
help:
	@echo "MiniCluster CLI Makefile"
	@echo ""
	@echo "Usage: make [target]"
	@echo ""
	@echo "Targets:"
	@echo "  build         Build for current platform"
	@echo "  build-all     Build for all platforms"
	@echo "  install       Install to /usr/local/bin"
	@echo "  uninstall     Remove from /usr/local/bin"
	@echo "  test          Run tests"
	@echo "  test-coverage Run tests with coverage report"
	@echo "  lint          Run linter"
	@echo "  fmt           Format code"
	@echo "  deps          Tidy dependencies"
	@echo "  clean         Remove build artifacts"
	@echo "  check         Run all checks (fmt, lint, test, build)"
	@echo "  dev           Quick development build"
	@echo "  run           Build and run (use ARGS='...' for arguments)"
	@echo "  version       Show version"
	@echo "  help          Show this help"
