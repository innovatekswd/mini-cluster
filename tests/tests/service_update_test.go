package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Service Update (PUT /api/services/{id}) ──────────────────────────────────

// TestServiceUpdate verifies that a service's mutable fields can be updated
// via PUT and the changes are reflected on subsequent GET.
func TestServiceUpdate(t *testing.T) {
	ctx := context.Background()

	body := map[string]interface{}{
		"name":           "test-svc-update",
		"executablePath": "echo",
		"arguments":      "original",
		"description":    "before update",
	}
	var created ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", body, &created))
	defer apiClient.Delete(ctx, "/api/services/"+created.ID) //nolint:errcheck

	// Apply update
	update := map[string]interface{}{
		"name":           "test-svc-update",
		"executablePath": "echo",
		"arguments":      "updated-args",
		"description":    "after update",
		"workingDirectory": "/tmp",
	}
	err := apiClient.Put(ctx, "/api/services/"+created.ID, update, nil)
	require.NoError(t, err, "PUT /api/services/{id} must succeed")

	// Verify
	var got ServiceDto
	require.NoError(t, apiClient.Get(ctx, "/api/services/"+created.ID, &got))
	assert.Equal(t, "after update", got.Description)
	assert.Equal(t, "updated-args", got.Arguments)
	assert.Equal(t, "/tmp", got.WorkingDirectory)
}

// TestServiceUpdateName verifies that renaming a service (changing the name
// field) still allows retrieval by the new name.
func TestServiceUpdatePreservesID(t *testing.T) {
	ctx := context.Background()

	var created ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-svc-rename-src",
		"executablePath": "echo",
	}, &created))
	defer apiClient.Delete(ctx, "/api/services/"+created.ID) //nolint:errcheck

	err := apiClient.Put(ctx, "/api/services/"+created.ID, map[string]interface{}{
		"name":           "test-svc-rename-src",
		"executablePath": "echo",
		"description":    "renamed",
	}, nil)
	require.NoError(t, err)

	// ID must remain stable
	var got ServiceDto
	require.NoError(t, apiClient.Get(ctx, "/api/services/"+created.ID, &got))
	assert.Equal(t, created.ID, got.ID, "service ID must not change after update")
}

// TestServiceUpdateNotFound verifies that updating a non-existent service
// returns a 404-equivalent error.
func TestServiceUpdateNotFound(t *testing.T) {
	ctx := context.Background()
	err := apiClient.Put(ctx, "/api/services/does-not-exist-id", map[string]interface{}{
		"name":           "x",
		"executablePath": "x",
	}, nil)
	require.Error(t, err, "updating non-existent service must return error")
	assert.Contains(t, err.Error(), "404", "error must mention 404")
}

// ─── Service Statuses (GET /api/services/statuses) ───────────────────────────

type statusEntry struct {
	ID     string `json:"id"`
	Status string `json:"status"`
}

// TestServiceStatuses verifies that GET /api/services/statuses returns a map
// (or array) that includes at least the services we have registered.
func TestServiceStatuses(t *testing.T) {
	ctx := context.Background()

	// Create two services
	var svc1, svc2 ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name": "test-statuses-a", "executablePath": "echo",
	}, &svc1))
	require.NoError(t, apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name": "test-statuses-b", "executablePath": "echo",
	}, &svc2))
	defer apiClient.Delete(ctx, "/api/services/"+svc1.ID) //nolint:errcheck
	defer apiClient.Delete(ctx, "/api/services/"+svc2.ID) //nolint:errcheck

	// GET statuses — the API returns a map[id]status or similar
	var statuses map[string]interface{}
	err := apiClient.Get(ctx, "/api/services/statuses", &statuses)
	require.NoError(t, err, "GET /api/services/statuses must succeed")
	assert.NotNil(t, statuses)

	// Both services should appear
	_, hasSvc1 := statuses[svc1.ID]
	_, hasSvc2 := statuses[svc2.ID]
	assert.True(t, hasSvc1, "statuses must include svc1 id=%s", svc1.ID)
	assert.True(t, hasSvc2, "statuses must include svc2 id=%s", svc2.ID)
}

// TestServiceStatusesContainsStopped verifies that a freshly created service
// has "Stopped" status in the statuses endpoint.
func TestServiceStatusesContainsStopped(t *testing.T) {
	ctx := context.Background()

	var svc ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name": "test-statuses-stopped", "executablePath": "echo",
	}, &svc))
	defer apiClient.Delete(ctx, "/api/services/"+svc.ID) //nolint:errcheck

	var statuses map[string]interface{}
	require.NoError(t, apiClient.Get(ctx, "/api/services/statuses", &statuses))

	entry, ok := statuses[svc.ID]
	require.True(t, ok, "service must appear in statuses map")
	// Accept both string "Stopped" and object with status field
	switch v := entry.(type) {
	case string:
		assert.Equal(t, "Stopped", v)
	case map[string]interface{}:
		assert.Equal(t, "Stopped", v["status"])
	}
}

// ─── App Update (PUT /api/apps/{id}) ─────────────────────────────────────────

type AppDto struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

// TestAppUpdate verifies that an app's fields can be changed via PUT.
func TestAppUpdate(t *testing.T) {
	ctx := context.Background()

	var created AppDto
	require.NoError(t, apiClient.Post(ctx, "/api/apps", map[string]interface{}{
		"name":        "test-app-update",
		"description": "original",
		"color":       "#FF0000",
	}, &created))
	defer apiClient.Delete(ctx, "/api/apps/"+created.ID) //nolint:errcheck

	err := apiClient.Put(ctx, "/api/apps/"+created.ID, map[string]interface{}{
		"name":        "test-app-update",
		"description": "updated description",
		"color":       "#00FF00",
	}, nil)
	require.NoError(t, err, "PUT /api/apps/{id} must succeed")

	var got AppDto
	require.NoError(t, apiClient.Get(ctx, "/api/apps/"+created.ID, &got))
	assert.Equal(t, "updated description", got.Description)
	assert.Equal(t, "#00FF00", got.Color)
}

// TestAppUpdateNotFound verifies a 404 when updating non-existent app.
func TestAppUpdateNotFound(t *testing.T) {
	ctx := context.Background()
	err := apiClient.Put(ctx, "/api/apps/non-existent-id", map[string]interface{}{
		"name": "x",
	}, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}
