# MiniCluster Integration Tests

Integration tests for the MiniCluster platform, testing CLI commands against a real running API server.

## Prerequisites

1. **Build the CLI**:
   ```bash
   cd ../minicluster-cli
   go build -o build/mc ./cmd/mc
   ```

2. **API Server** - either:
   - Start manually: `cd ../minicluster-api && dotnet run --project Innovatek.Parallel.MiniCluster.Api`
   - Or let tests start it automatically

3. **Go 1.24+** installed

## Running Tests

```bash
# Run all tests (will start server if not running)
make test

# Run with verbose output
make test-verbose

# Run specific test
go test -v ./tests -run TestAppCreate

# Run only app tests
go test -v ./tests -run TestApp

# Run only service tests  
go test -v ./tests -run TestService

# Run with existing server (faster)
# Start server in another terminal first, then:
make test
```

## Test Categories

### App Tests (`app_test.go`)
- `TestAppCreate` - Create app via CLI
- `TestAppList` - List apps
- `TestAppGet` - Get app by name
- `TestAppGetByName` - Get app with spaces in name
- `TestAppClone` - Clone an app
- `TestAppDelete` - Delete an app
- `TestAppNotFound` - Error handling for missing app

### Service Tests (`service_test.go`)
- `TestServiceCreate` - Create service
- `TestServiceList` - List services
- `TestServiceStartStop` - Start/stop lifecycle
- `TestServiceRestart` - Restart service
- `TestServiceStatus` - Status command
- `TestServiceClone` - Clone service
- `TestServiceDelete` - Delete service
- `TestServiceWithApp` - Service in an app
- `TestServiceByNameResolution` - Name-based identification

### Log Tests (`logs_test.go`)
- `TestServiceLogs` - Basic log capture
- `TestServiceLogsMultipleSources` - Stdout/stderr capture
- `TestServiceLogsTail` - Tail option
- `TestPythonHTTPServer` - Real Python server service
- `TestPingService` - Ping command service

## Environment Variables

- `MINICLUSTER_TEST_BASE` - Base directory for projects (default: parent of this dir)
- `VERBOSE=1` - Enable verbose CLI output

## Project Structure

```
minicluster-integration-tests/
├── go.mod
├── Makefile
├── README.md
├── testutil/
│   └── env.go          # Test environment and helpers
└── tests/
    ├── main_test.go    # Test setup/teardown
    ├── app_test.go     # App CRUD tests
    ├── service_test.go # Service lifecycle tests
    └── logs_test.go    # Log capture tests
```

## Writing New Tests

```go
func TestMyFeature(t *testing.T) {
    ctx := context.Background()
    
    // Use CLI
    result := testEnv.RunCLI("app", "list")
    require.Equal(t, 0, result.ExitCode)
    
    // Parse JSON output
    var data []AppDto
    err := testEnv.RunCLIJSON(&data, "app", "list")
    require.NoError(t, err)
    
    // Use API directly for setup/verification
    err = apiClient.Post(ctx, "/api/apps", payload, &response)
    
    // Always cleanup
    defer apiClient.Delete(ctx, "/api/apps/test-app")
}
```
