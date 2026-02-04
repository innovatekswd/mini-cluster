package tests

import (
	"context"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// App DTO for JSON parsing
type AppDto struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
}

type AppWithStats struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	ServiceCount int    `json:"serviceCount"`
	RunningCount int    `json:"runningCount"`
}

func TestAppCreate(t *testing.T) {
	ctx := context.Background()

	// Create app via CLI
	result := testEnv.RunCLI("app", "create", "test-app-create", "--description", "Test app for creation")
	require.Equal(t, 0, result.ExitCode, "CLI should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "Created app")

	// Verify via API
	var apps []AppWithStats
	err := apiClient.Get(ctx, "/api/apps", &apps)
	require.NoError(t, err)

	var found *AppWithStats
	for i := range apps {
		if apps[i].Name == "test-app-create" {
			found = &apps[i]
			break
		}
	}
	require.NotNil(t, found, "App should exist in API response")
	assert.Equal(t, "Test app for creation", found.Description)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/apps/test-app-create")
}

func TestAppList(t *testing.T) {
	ctx := context.Background()

	// Create a test app
	_ = testEnv.RunCLI("app", "create", "test-app-list", "--description", "For list test")

	// List apps via CLI
	result := testEnv.RunCLI("app", "list")
	require.Equal(t, 0, result.ExitCode, "CLI should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "test-app-list")

	// Test JSON output
	var apps []AppWithStats
	err := testEnv.RunCLIJSON(&apps, "app", "list")
	require.NoError(t, err)
	require.NotEmpty(t, apps)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/apps/test-app-list")
}

func TestAppGet(t *testing.T) {
	ctx := context.Background()

	// Create a test app
	_ = testEnv.RunCLI("app", "create", "test-app-get", "--description", "For get test", "--icon", "🧪", "--color", "#ff0000")

	// Get app by name
	var app AppDto
	err := testEnv.RunCLIJSON(&app, "app", "get", "test-app-get")
	require.NoError(t, err)

	assert.Equal(t, "test-app-get", app.Name)
	assert.Equal(t, "For get test", app.Description)
	assert.Equal(t, "🧪", app.Icon)
	assert.Equal(t, "#ff0000", app.Color)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/apps/test-app-get")
}

func TestAppGetByName(t *testing.T) {
	ctx := context.Background()

	// Create a test app with spaces
	_ = testEnv.RunCLI("app", "create", "My Test App", "--description", "Test with spaces")

	// Get app by name (with spaces)
	var app AppDto
	err := testEnv.RunCLIJSON(&app, "app", "get", "My Test App")
	require.NoError(t, err)
	assert.Equal(t, "My Test App", app.Name)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/apps/My Test App")
}

func TestAppClone(t *testing.T) {
	ctx := context.Background()

	// Create a test app
	_ = testEnv.RunCLI("app", "create", "test-app-clone", "--description", "Original app")

	// Clone the app
	result := testEnv.RunCLI("app", "clone", "test-app-clone")
	require.Equal(t, 0, result.ExitCode, "CLI should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "Cloned app")

	// Verify clone exists
	var apps []AppWithStats
	err := apiClient.Get(ctx, "/api/apps", &apps)
	require.NoError(t, err)

	cloneCount := 0
	for _, a := range apps {
		if strings.HasPrefix(a.Name, "test-app-clone") {
			cloneCount++
		}
	}
	assert.GreaterOrEqual(t, cloneCount, 2, "Should have original and clone")

	// Cleanup
	for _, a := range apps {
		if strings.HasPrefix(a.Name, "test-app-clone") {
			_ = apiClient.Delete(ctx, "/api/apps/"+a.ID)
		}
	}
}

func TestAppDelete(t *testing.T) {
	ctx := context.Background()

	// Create a test app
	_ = testEnv.RunCLI("app", "create", "test-app-delete", "--description", "To be deleted")

	// Delete the app (with --yes to skip confirmation)
	result := testEnv.RunCLI("app", "delete", "test-app-delete", "--yes")
	require.Equal(t, 0, result.ExitCode, "CLI should succeed: %s", result.Stderr)
	assert.Contains(t, result.Stdout, "Deleted")

	// Verify it's gone
	var apps []AppWithStats
	err := apiClient.Get(ctx, "/api/apps", &apps)
	require.NoError(t, err)

	for _, a := range apps {
		assert.NotEqual(t, "test-app-delete", a.Name, "App should be deleted")
	}
}

func TestAppNotFound(t *testing.T) {
	// Try to get non-existent app
	result := testEnv.RunCLI("app", "get", "non-existent-app-12345")
	assert.NotEqual(t, 0, result.ExitCode, "Should fail for non-existent app")
}
