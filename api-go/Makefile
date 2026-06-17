BINARY   := minicluster-api
CMD      := ./cmd/server
VERSION  ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
GIT_COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
BUILD_TIME ?= $(shell date -u +"%Y-%m-%dT%H:%M:%SZ")
LDFLAGS  := -ldflags "-X main.version=$(VERSION) -X main.gitCommit=$(GIT_COMMIT) -X main.buildTime=$(BUILD_TIME) -s -w"
GOFLAGS  :=

# Output directories
OUT_DIR  := ../build/api-go
OUT_LINUX  := $(OUT_DIR)/linux-amd64/$(BINARY)
OUT_WIN    := $(OUT_DIR)/windows-amd64/$(BINARY).exe

.PHONY: all build run clean test lint tidy linux windows

all: build

## build: build for the current platform
build:
	go build $(LDFLAGS) -o $(OUT_DIR)/$(BINARY) $(CMD)
	@echo "Built $(OUT_DIR)/$(BINARY)"

## run: run in development mode (auth bypass off, verbose logging)
run:
	go run $(CMD)

## linux: cross-compile for Linux amd64
linux:
	@mkdir -p $(OUT_DIR)/linux-amd64
	GOOS=linux GOARCH=amd64 go build $(LDFLAGS) -o $(OUT_LINUX) $(CMD)
	@echo "Built $(OUT_LINUX)"

## windows: cross-compile for Windows amd64
windows:
	@mkdir -p $(OUT_DIR)/windows-amd64
	GOOS=windows GOARCH=amd64 go build $(LDFLAGS) -o $(OUT_WIN) $(CMD)
	@echo "Built $(OUT_WIN)"

## test: run all tests
test:
	go test ./... -race -count=1

## lint: run golangci-lint (install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest)
lint:
	golangci-lint run ./...

## tidy: tidy and vendor dependencies
tidy:
	go mod tidy

## clean: remove build outputs
clean:
	rm -rf $(OUT_DIR)

## help: list available targets
help:
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## //'
