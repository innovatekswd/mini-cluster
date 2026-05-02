package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

func createEnvVarTestService(t *testing.T) (id string, cleanup func()) {
	t.Helper()
	ctx := context.Background()
	body := map[string]interface{}{
		"name":           "test-env-svc",
		"executablePath": "sleep",
		"arguments":      "60",
	}
	var created ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", body, &created))
	return created.ID, func() {
		_ = apiClient.Delete(ctx, "/api/services/"+created.ID)
	}
}

// ─── Environment Variables ────────────────────────────────────────────────────

// TestServiceEnvVarsGetEmpty verifies that a freshly-created service returns
// an empty object (not null) for its env-var map.
func TestServiceEnvVarsGetEmpty(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	var envVars map[string]string
	err := apiClient.Get(ctx, "/api/services/"+id+"/env", &envVars)
	require.NoError(t, err, "GET /env must succeed on new service")
	assert.NotNil(t, envVars, "env vars map must not be nil")
}

// TestServiceEnvVarsPut verifies that environment variables can be set and
// retrieved via the PUT/GET /api/services/{id}/env endpoints.
func TestServiceEnvVarsPut(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	envVars := map[string]string{
		"MY_KEY":    "hello-world",
		"DB_HOST":   "localhost",
		"LOG_LEVEL": "debug",
	}
	err := apiClient.Put(ctx, "/api/services/"+id+"/env", envVars, nil)
	require.NoError(t, err, "PUT /env must succeed")

	var got map[string]string
	err = apiClient.Get(ctx, "/api/services/"+id+"/env", &got)
	require.NoError(t, err)
	assert.Equal(t, "hello-world", got["MY_KEY"])
	assert.Equal(t, "localhost", got["DB_HOST"])
	assert.Equal(t, "debug", got["LOG_LEVEL"])
}

// TestServiceEnvVarsOverwrite verifies that a second PUT replaces all vars
// (not merges them).
func TestServiceEnvVarsOverwrite(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	_ = apiClient.Put(ctx, "/api/services/"+id+"/env", map[string]string{
		"OLD_KEY": "old-value",
	}, nil)

	err := apiClient.Put(ctx, "/api/services/"+id+"/env", map[string]string{
		"NEW_KEY": "new-value",
	}, nil)
	require.NoError(t, err, "second PUT must succeed")

	var got map[string]string
	require.NoError(t, apiClient.Get(ctx, "/api/services/"+id+"/env", &got))
	assert.Equal(t, "new-value", got["NEW_KEY"], "new key must be present")
	_, hasOld := got["OLD_KEY"]
	assert.False(t, hasOld, "OLD_KEY must be gone after replacement PUT")
}

// TestServiceEnvVarsClearWithEmpty verifies that sending an empty map clears
// all environment variables.
func TestServiceEnvVarsClearWithEmpty(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	_ = apiClient.Put(ctx, "/api/services/"+id+"/env", map[string]string{"K": "V"}, nil)
	require.NoError(t, apiClient.Put(ctx, "/api/services/"+id+"/env", map[string]string{}, nil))

	var got map[string]string
	require.NoError(t, apiClient.Get(ctx, "/api/services/"+id+"/env", &got))
	assert.Empty(t, got, "env vars must be empty after clearing with {}")
}

// ─── Launch Arguments ─────────────────────────────────────────────────────────

type argsResponse struct {
	Arguments string `json:"arguments"`
}

// TestServiceArgsGet verifies that the initial arguments are returned.
func TestServiceArgsGet(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	var got argsResponse
	err := apiClient.Get(ctx, "/api/services/"+id+"/args", &got)
	require.NoError(t, err, "GET /args must succeed")
	// initial value was set to "60" in the fixture
	assert.Equal(t, "60", got.Arguments)
}

// TestServiceArgsPut verifies that launch arguments can be updated.
func TestServiceArgsPut(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	payload := map[string]string{"arguments": "--port 8080 --verbose"}
	err := apiClient.Put(ctx, "/api/services/"+id+"/args", payload, nil)
	require.NoError(t, err, "PUT /args must succeed")

	var got argsResponse
	require.NoError(t, apiClient.Get(ctx, "/api/services/"+id+"/args", &got))
	assert.Equal(t, "--port 8080 --verbose", got.Arguments)
}

// TestServiceArgsPutEmpty verifies that arguments can be cleared.
func TestServiceArgsPutEmpty(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createEnvVarTestService(t)
	defer cleanup()

	require.NoError(t, apiClient.Put(ctx, "/api/services/"+id+"/args", map[string]string{"arguments": ""}, nil))

	var got argsResponse
	require.NoError(t, apiClient.Get(ctx, "/api/services/"+id+"/args", &got))
	assert.Equal(t, "", got.Arguments, "arguments should be empty string after clearing")
}
