package tests

import (
	"context"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// Service DTO for JSON parsing
type ServiceDto struct {
	ID               string            `json:"id"`
	Name             string            `json:"name"`
	ExecutablePath   string            `json:"executablePath"`
	Arguments        string            `json:"arguments"`
	WorkingDirectory string            `json:"workingDirectory"`
	Description      string            `json:"description"`
	Status           string            `json:"status"`
	AppID            *string           `json:"appId"`
	AutoStart        bool              `json:"autoStart"`
	EnvironmentVars  map[string]string `json:"environmentVariables"`
}

func TestServiceCreate(t *testing.T) {
	ctx := context.Background()

	// Create service via API (CLI create not implemented yet, using API directly)
	service := map[string]interface{}{
		"name":           "test-service-create",
		"executablePath": "sleep",
		"arguments":      "10",
		"description":    "Test service for creation",
	}

	var created ServiceDto
	err := apiClient.Post(ctx, "/api/services", service, &created)
	require.NoError(t, err)
	assert.Equal(t, "test-service-create", created.Name)

	// Verify via CLI
	var svc ServiceDto
	err = testEnv.RunCLIJSON(&svc, "service", "get", "test-service-create")
	require.NoError(t, err)
	assert.Equal(t, "test-service-create", svc.Name)
	assert.Equal(t, "sleep", svc.ExecutablePath)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/services/test-service-create")
}

func TestServiceList(t *testing.T) {
	ctx := context.Background()

	// Create a test service
	service := map[string]interface{}{
		"name":           "test-service-list",
		"executablePath": "echo",
		"arguments":      "hello",
	}
	_ = apiClient.Post(ctx, "/api/services", service, nil)

	// List via CLI
	result := testEnv.RunCLI("service", "list")
	require.Equal(t, 0, result.ExitCode, "CLI should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "test-service-list")

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/services/test-service-list")
}

func TestServiceStartStop(t *testing.T) {
	ctx := context.Background()

	// Create a long-running service (sleep for 60 seconds)
	service := map[string]interface{}{
		"name":           "test-service-lifecycle",
		"executablePath": "sleep",
		"arguments":      "60",
		"description":    "Lifecycle test service",
	}
	var created ServiceDto
	err := apiClient.Post(ctx, "/api/services", service, &created)
	require.NoError(t, err)

	// Verify initial status is Stopped
	var svc ServiceDto
	err = testEnv.RunCLIJSON(&svc, "service", "get", "test-service-lifecycle")
	require.NoError(t, err)
	assert.Equal(t, "Stopped", svc.Status, "Initial status should be Stopped")

	// Start the service
	result := testEnv.RunCLI("service", "start", "test-service-lifecycle")
	require.Equal(t, 0, result.ExitCode, "Start should succeed: %s", result.Stderr)

	// Wait a moment for status to update
	time.Sleep(1 * time.Second)

	// Verify status is Running
	err = testEnv.RunCLIJSON(&svc, "service", "get", "test-service-lifecycle")
	require.NoError(t, err)
	assert.Equal(t, "Running", svc.Status, "Status should be Running after start")

	// Stop the service
	result = testEnv.RunCLI("service", "stop", "test-service-lifecycle")
	require.Equal(t, 0, result.ExitCode, "Stop should succeed: %s", result.Stderr)

	// Wait for stop
	time.Sleep(1 * time.Second)

	// Verify status is Stopped
	err = testEnv.RunCLIJSON(&svc, "service", "get", "test-service-lifecycle")
	require.NoError(t, err)
	assert.Equal(t, "Stopped", svc.Status, "Status should be Stopped after stop")

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/services/test-service-lifecycle")
}

func TestServiceRestart(t *testing.T) {
	ctx := context.Background()

	// Create and start a service
	service := map[string]interface{}{
		"name":           "test-service-restart",
		"executablePath": "sleep",
		"arguments":      "60",
	}
	_ = apiClient.Post(ctx, "/api/services", service, nil)

	// Start it first
	_ = testEnv.RunCLI("service", "start", "test-service-restart")
	time.Sleep(1 * time.Second)

	// Restart the service
	result := testEnv.RunCLI("service", "restart", "test-service-restart")
	require.Equal(t, 0, result.ExitCode, "Restart should succeed: %s", result.Stderr)

	// Wait for restart to complete
	time.Sleep(2 * time.Second)

	// Verify status is Running
	var svc ServiceDto
	err := testEnv.RunCLIJSON(&svc, "service", "get", "test-service-restart")
	require.NoError(t, err)
	assert.Equal(t, "Running", svc.Status, "Status should be Running after restart")

	// Cleanup
	_ = testEnv.RunCLI("service", "stop", "test-service-restart")
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Delete(ctx, "/api/services/test-service-restart")
}

func TestServiceStatus(t *testing.T) {
	ctx := context.Background()

	// Create services
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-status-1",
		"executablePath": "sleep",
		"arguments":      "60",
	}, nil)
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-status-2",
		"executablePath": "sleep",
		"arguments":      "60",
	}, nil)

	// Start one service
	_ = testEnv.RunCLI("service", "start", "test-status-1")
	time.Sleep(1 * time.Second)

	// Get status of single service
	result := testEnv.RunCLI("service", "status", "test-status-1")
	require.Equal(t, 0, result.ExitCode)
	assert.Contains(t, result.Stdout, "Running")

	// Get status of all services
	result = testEnv.RunCLI("service", "status")
	require.Equal(t, 0, result.ExitCode)
	assert.Contains(t, result.Stdout, "test-status-1")
	assert.Contains(t, result.Stdout, "test-status-2")

	// Cleanup
	_ = testEnv.RunCLI("service", "stop", "test-status-1")
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Delete(ctx, "/api/services/test-status-1")
	_ = apiClient.Delete(ctx, "/api/services/test-status-2")
}

func TestServiceClone(t *testing.T) {
	ctx := context.Background()

	// Create a service
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-service-clone",
		"executablePath": "echo",
		"arguments":      "original",
		"description":    "Original service",
	}, nil)

	// Clone it
	result := testEnv.RunCLI("service", "clone", "test-service-clone")
	require.Equal(t, 0, result.ExitCode, "Clone should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "Cloned")

	// Verify clone exists
	var services []ServiceDto
	err := apiClient.Get(ctx, "/api/services", &services)
	require.NoError(t, err)

	cloneCount := 0
	for _, s := range services {
		if strings.HasPrefix(s.Name, "test-service-clone") {
			cloneCount++
		}
	}
	assert.GreaterOrEqual(t, cloneCount, 2, "Should have original and clone")

	// Cleanup
	for _, s := range services {
		if strings.HasPrefix(s.Name, "test-service-clone") {
			_ = apiClient.Delete(ctx, "/api/services/"+s.ID)
		}
	}
}

func TestServiceDelete(t *testing.T) {
	ctx := context.Background()

	// Create a service
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-service-delete",
		"executablePath": "sleep",
		"arguments":      "1",
	}, nil)

	// Delete it
	result := testEnv.RunCLI("service", "delete", "test-service-delete", "--yes")
	require.Equal(t, 0, result.ExitCode, "Delete should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "Deleted")

	// Verify it's gone
	var services []ServiceDto
	_ = apiClient.Get(ctx, "/api/services", &services)
	for _, s := range services {
		assert.NotEqual(t, "test-service-delete", s.Name)
	}
}

func TestServiceWithApp(t *testing.T) {
	ctx := context.Background()

	// Create an app
	_ = testEnv.RunCLI("app", "create", "test-app-services", "--description", "App with services")

	// Get app ID
	var app AppDto
	_ = testEnv.RunCLIJSON(&app, "app", "get", "test-app-services")

	// Create service in the app
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-service-in-app",
		"executablePath": "sleep",
		"arguments":      "10",
		"appId":          app.ID,
	}, nil)

	// Verify app shows the service count
	var appWithStats AppWithStats
	_ = testEnv.RunCLIJSON(&appWithStats, "app", "get", "test-app-services")
	// Note: The get returns AppDto not AppWithStats, so check via list
	var apps []AppWithStats
	_ = apiClient.Get(ctx, "/api/apps", &apps)
	for _, a := range apps {
		if a.Name == "test-app-services" {
			assert.Equal(t, 1, a.ServiceCount, "App should have 1 service")
			break
		}
	}

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/services/test-service-in-app")
	_ = apiClient.Delete(ctx, "/api/apps/test-app-services")
}

func TestServiceByNameResolution(t *testing.T) {
	ctx := context.Background()

	// Create service with spaces in name
	_ = apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "My Test Service",
		"executablePath": "sleep",
		"arguments":      "60",
	}, nil)

	// Get by name with spaces
	var svc ServiceDto
	err := testEnv.RunCLIJSON(&svc, "service", "get", "My Test Service")
	require.NoError(t, err)
	assert.Equal(t, "My Test Service", svc.Name)

	// Start by name
	result := testEnv.RunCLI("service", "start", "My Test Service")
	require.Equal(t, 0, result.ExitCode)

	time.Sleep(1 * time.Second)

	// Stop by name
	result = testEnv.RunCLI("service", "stop", "My Test Service")
	require.Equal(t, 0, result.ExitCode)

	time.Sleep(500 * time.Millisecond)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/services/My Test Service")
}
