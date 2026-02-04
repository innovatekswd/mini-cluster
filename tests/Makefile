.PHONY: test test-verbose test-apps test-services test-logs deps clean

# Default test run
test: deps
	@echo "Running integration tests..."
	go test -v ./tests -timeout 5m

# Verbose test run (shows CLI commands)
test-verbose: deps
	VERBOSE=1 go test -v ./tests -timeout 5m

# Run only app tests
test-apps: deps
	go test -v ./tests -run TestApp -timeout 2m

# Run only service tests
test-services: deps
	go test -v ./tests -run TestService -timeout 3m

# Run only log tests
test-logs: deps
	go test -v ./tests -run TestLog -timeout 3m

# Run only ping/http tests
test-real: deps
	go test -v ./tests -run "TestPing|TestPython" -timeout 3m

# Install dependencies
deps:
	go mod tidy

# Ensure CLI is built
build-cli:
	cd ../minicluster-cli && go build -o build/mc ./cmd/mc

# Clean test data
clean:
	rm -rf .testdata

# Run with coverage
test-coverage: deps
	go test -v ./tests -coverprofile=coverage.out -timeout 5m
	go tool cover -html=coverage.out -o coverage.html

# Quick smoke test
smoke: deps
	go test -v ./tests -run "TestAppCreate|TestServiceStartStop" -timeout 2m
