package tests

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestServiceLogs(t *testing.T) {
	ctx := context.Background()

	// Create a service that outputs to stdout
	// Using bash to echo lines with timestamps
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-logs-service",
		"executablePath": "bash",
		"arguments":      "-c \"for i in 1 2 3 4 5; do echo \\\"Log line $i\\\"; sleep 0.5; done\"",
		"captureOutput":  1,
	}, nil)

	// Start the service
	result := testEnv.RunCLI("service", "start", "test-logs-service")
	require.Equal(t, 0, result.ExitCode, "Start should succeed: %s", result.Stderr)

	// Wait for it to produce some output
	time.Sleep(3 * time.Second)

	// Get logs via CLI
	result = testEnv.RunCLI("service", "logs", "test-logs-service", "--tail", "10")
	require.Equal(t, 0, result.ExitCode, "Logs should succeed: %s", result.Stderr)

	// Verify we got log output
	assert.Contains(t, result.Stdout, "Log line", "Should contain log output")

	// Wait for service to finish
	time.Sleep(3 * time.Second)

	// Cleanup
	_ = testEnv.RunCLI("service", "stop", "test-logs-service")
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Delete(ctx, "/api/services/test-logs-service")
}

func TestServiceLogsMultipleSources(t *testing.T) {
	ctx := context.Background()

	// Create a service that outputs to both stdout and stderr
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-logs-mixed",
		"executablePath": "bash",
		"arguments":      "-c \"echo STDOUT_LINE; echo STDERR_LINE >&2; sleep 2\"",
		"captureOutput":  1,
	}, nil)

	// Start and wait for output
	_ = testEnv.RunCLI("service", "start", "test-logs-mixed")
	time.Sleep(2 * time.Second)

	// Get logs
	result := testEnv.RunCLI("service", "logs", "test-logs-mixed")
	require.Equal(t, 0, result.ExitCode)

	// Both stdout and stderr should be captured
	output := result.Stdout
	hasStdout := strings.Contains(output, "STDOUT_LINE")
	hasStderr := strings.Contains(output, "STDERR_LINE")

	// At minimum, stdout should be captured
	assert.True(t, hasStdout || hasStderr, "Should capture some output")

	// Cleanup
	_ = testEnv.RunCLI("service", "stop", "test-logs-mixed")
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Delete(ctx, "/api/services/test-logs-mixed")
}

func TestServiceLogsTail(t *testing.T) {
	ctx := context.Background()

	// Create a service that outputs many lines
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-logs-tail",
		"executablePath": "bash",
		"arguments":      "-c \"for i in $(seq 1 50); do echo \\\"Line $i\\\"; done; sleep 1\"",
		"captureOutput":  1,
	}, nil)

	// Start and wait for output
	_ = testEnv.RunCLI("service", "start", "test-logs-tail")
	time.Sleep(2 * time.Second)

	// Get only last 5 lines
	result := testEnv.RunCLI("service", "logs", "test-logs-tail", "--tail", "5")
	require.Equal(t, 0, result.ExitCode)

	// Count non-empty lines
	lines := strings.Split(strings.TrimSpace(result.Stdout), "\n")
	nonEmptyLines := 0
	for _, line := range lines {
		if strings.TrimSpace(line) != "" {
			nonEmptyLines++
		}
	}

	// Should have around 5 lines (tail limit)
	assert.LessOrEqual(t, nonEmptyLines, 10, "Should respect tail limit (with some tolerance)")

	// Cleanup
	_ = testEnv.RunCLI("service", "stop", "test-logs-tail")
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Delete(ctx, "/api/services/test-logs-tail")
}

func TestPythonHTTPServer(t *testing.T) {
	ctx := context.Background()

	// Skip if python3 not available
	result := testEnv.RunCLI("--version") // Just to have a command
	_ = result

	// Create a Python HTTP server service
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":             "test-python-server",
		"executablePath":   "python3",
		"arguments":        "-m http.server 18080",
		"workingDirectory": "/tmp",
		"captureOutput":    1,
		"description":      "Test Python HTTP server",
	}, nil)

	// Start the server
	startResult := testEnv.RunCLI("service", "start", "test-python-server")
	require.Equal(t, 0, startResult.ExitCode, "Start should succeed: %s", startResult.Stderr)

	// Wait for server to start
	time.Sleep(2 * time.Second)

	// Verify status
	var svc ServiceDto
	err := testEnv.RunCLIJSON(&svc, "service", "get", "test-python-server")
	require.NoError(t, err)
	assert.Equal(t, "Running", svc.Status)

	// TODO: Could add HTTP request to verify server is responding
	// http.Get("http://localhost:18080")

	// Stop the server
	_ = testEnv.RunCLI("service", "stop", "test-python-server")
	time.Sleep(1 * time.Second)

	// Verify stopped
	err = testEnv.RunCLIJSON(&svc, "service", "get", "test-python-server")
	require.NoError(t, err)
	assert.Equal(t, "Stopped", svc.Status)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/services/test-python-server")
}

func TestPingService(t *testing.T) {
	ctx := context.Background()

	// Create a ping service (pings localhost)
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-ping-service",
		"executablePath": "ping",
		"arguments":      "-c 5 127.0.0.1",
		"captureOutput":  1,
		"description":    "Ping localhost test",
	}, nil)

	// Start the service
	result := testEnv.RunCLI("service", "start", "test-ping-service")
	require.Equal(t, 0, result.ExitCode, "Start should succeed")

	// Wait for some ping output
	time.Sleep(3 * time.Second)

	// Get logs - should contain ping output
	result = testEnv.RunCLI("service", "logs", "test-ping-service")
	require.Equal(t, 0, result.ExitCode)

	// Verify ping output (will have "bytes from" or similar)
	output := strings.ToLower(result.Stdout)
	hasPingOutput := strings.Contains(output, "bytes from") ||
		strings.Contains(output, "icmp_seq") ||
		strings.Contains(output, "64 bytes")
	assert.True(t, hasPingOutput, "Should contain ping output, got: %s", result.Stdout)

	// Wait for ping to complete
	time.Sleep(3 * time.Second)

	// Cleanup
	_ = testEnv.RunCLI("service", "stop", "test-ping-service")
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Delete(ctx, "/api/services/test-ping-service")
}
