package tests

// route_regression_test.go — regression tests for route mismatches between
// the Go backend and what the React UI expects.
//
// Run against Go binary:
//   MINICLUSTER_API_URL=http://localhost:5000 go test -v ./tests -run TestRoute
//
// Run against .NET:
//   MINICLUSTER_API_URL=http://localhost:5147 go test -v ./tests -run TestRoute

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Apps route (case) ────────────────────────────────────────────────────────

// TestRouteAppsLowercase checks /api/apps (Go native path).
func TestRouteAppsLowercase(t *testing.T) {
	ctx := context.Background()

	var result []map[string]interface{}
	err := apiClient.Get(ctx, "/api/apps", &result)
	require.NoError(t, err, "/api/apps must not 404 — Go mount uses lowercase")
	assert.NotNil(t, result)
}

// TestRouteAppsPascalCase checks /api/Apps (.NET convention used by the UI).
func TestRouteAppsPascalCase(t *testing.T) {
	ctx := context.Background()

	var result []map[string]interface{}
	err := apiClient.Get(ctx, "/api/Apps", &result)
	require.NoError(t, err, "/api/Apps must not 404 — Go now aliases /Apps → /apps")
	assert.NotNil(t, result)
}

// ─── Environments route (/api/envs vs /api/environments) ─────────────────────

// TestRouteEnvs checks /api/envs (the path used by the UI service layer).
func TestRouteEnvs(t *testing.T) {
	ctx := context.Background()

	var result []map[string]interface{}
	err := apiClient.Get(ctx, "/api/envs", &result)
	require.NoError(t, err, "/api/envs must not 404 — Go now mounts /envs alias")
	assert.NotNil(t, result)
}

// TestRouteEnvsActive checks GET /api/envs/active.
// Creates a temporary environment to ensure the handler has data to return,
// then verifies the route resolves (not a chi routing-level 404).
func TestRouteEnvsActive(t *testing.T) {
	ctx := context.Background()

	// Ensure at least one environment exists so getActive can auto-activate it.
	envBody := map[string]interface{}{
		"name":        "test-active-env",
		"description": "regression test env",
	}
	var created map[string]interface{}
	_ = apiClient.Post(ctx, "/api/envs", envBody, &created)

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/api/envs/active", &result)
	require.NoError(t, err, "/api/envs/active must not 404 — Go route alias must forward to /active subroute")
	assert.NotNil(t, result)
}

// ─── Metrics field names ──────────────────────────────────────────────────────

// TestMetricsSystemFields verifies that /api/metrics/system returns the field
// names the React UI expects (matching .NET field naming).
func TestMetricsSystemFields(t *testing.T) {
	ctx := context.Background()

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/api/metrics/system", &result)
	require.NoError(t, err)

	// Must have cpuUsagePercent (not the old cpuPercent)
	_, hasCPU := result["cpuUsagePercent"]
	assert.True(t, hasCPU, "response must contain cpuUsagePercent (not cpuPercent)")

	// Must have memoryUsagePercent (not memoryPercent)
	_, hasMem := result["memoryUsagePercent"]
	assert.True(t, hasMem, "response must contain memoryUsagePercent (not memoryPercent)")

	// disks must be an array (can be empty)
	disks, hasDisks := result["disks"]
	assert.True(t, hasDisks, "response must contain a disks field")
	if hasDisks {
		_, isSlice := disks.([]interface{})
		assert.True(t, isSlice, "disks must be an array, not nil")
	}

	// networkInterfaces must be an array
	ifaces, hasIfaces := result["networkInterfaces"]
	assert.True(t, hasIfaces, "response must contain networkInterfaces field")
	if hasIfaces {
		_, isSlice := ifaces.([]interface{})
		assert.True(t, isSlice, "networkInterfaces must be an array, not nil")
	}
}

// TestMetricsSystemHistoryFields checks that the history endpoint returns rows
// with cpuUsagePercent (required by the React metrics charts).
func TestMetricsSystemHistoryFields(t *testing.T) {
	ctx := context.Background()

	var rows []map[string]interface{}
	err := apiClient.Get(ctx, "/api/metrics/system/history", &rows)
	require.NoError(t, err, "/api/metrics/system/history must respond 200")
	assert.NotNil(t, rows, "rows must not be nil (empty slice is fine)")

	if len(rows) > 0 {
		first := rows[0]
		_, ok := first["cpuUsagePercent"]
		assert.True(t, ok, "history rows must have cpuUsagePercent field")
	}
}
