package tests

import (
	"context"
	"fmt"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── DTOs ─────────────────────────────────────────────────────────────────

type ContainerConfig struct {
	ID               uint    `json:"id"`
	ServiceID        string  `json:"serviceId"`
	Image            string  `json:"image"`
	Tag              string  `json:"tag"`
	Registry         string  `json:"registry"`
	PullPolicy       string  `json:"pullPolicy"`
	ContainerID      string  `json:"containerId"`
	ContainerName    string  `json:"containerName"`
	Ports            string  `json:"ports"`
	NetworkMode      string  `json:"networkMode"`
	Volumes          string  `json:"volumes"`
	MemoryLimitBytes int64   `json:"memoryLimitBytes"`
	CpuLimit         float64 `json:"cpuLimit"`
	Entrypoint       string  `json:"entrypoint"`
	Privileged       bool    `json:"privileged"`
	ReadOnly         bool    `json:"readOnly"`
	RemoveOnStop     bool    `json:"removeOnStop"`
}

type ContainerRuntimeInfo struct {
	Available     bool   `json:"available"`
	ServerVersion string `json:"serverVersion"`
}

// ─── Runtime endpoint ─────────────────────────────────────────────────────

func TestContainerRuntime(t *testing.T) {
	var info ContainerRuntimeInfo
	err := apiClient.Get(context.Background(), "/api/containers/runtime", &info)
	// The endpoint may return 503 when Docker is not configured — that's fine
	if err != nil {
		if strings.Contains(err.Error(), "503") || strings.Contains(err.Error(), "unavailable") {
			t.Skip("Docker runtime not available — skipping container tests")
		}
		require.NoError(t, err)
	}
	// If we got here the runtime is available
	assert.True(t, info.Available)
}

// ─── ContainerConfig CRUD ─────────────────────────────────────────────────

func TestContainerConfigCRUD(t *testing.T) {
	ctx := context.Background()

	// Create a service to attach config to
	svcPayload := map[string]interface{}{
		"name":        "test-container-config-svc",
		"description": "test container config CRUD",
		// ExecutablePath empty: container service
	}
	var svc ServiceDto
	err := apiClient.Post(ctx, "/api/services", svcPayload, &svc)
	require.NoError(t, err)
	require.NotEmpty(t, svc.ID)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/services/"+svc.ID)
	})

	// PUT — create container config
	cfg := map[string]interface{}{
		"image":        "nginx",
		"tag":          "1.25-alpine",
		"pullPolicy":   "IfNotPresent",
		"networkMode":  "bridge",
		"removeOnStop": true,
	}
	var created ContainerConfig
	err = apiClient.Put(ctx, fmt.Sprintf("/api/services/%s/container", svc.ID), cfg, &created)
	require.NoError(t, err)
	assert.Equal(t, "nginx", created.Image)
	assert.Equal(t, "1.25-alpine", created.Tag)
	assert.Equal(t, "IfNotPresent", created.PullPolicy)
	assert.True(t, created.RemoveOnStop)

	// GET — read back
	var fetched ContainerConfig
	err = apiClient.Get(ctx, fmt.Sprintf("/api/services/%s/container", svc.ID), &fetched)
	require.NoError(t, err)
	assert.Equal(t, "nginx", fetched.Image)

	// PUT — update
	cfg["tag"] = "latest"
	var updated ContainerConfig
	err = apiClient.Put(ctx, fmt.Sprintf("/api/services/%s/container", svc.ID), cfg, &updated)
	require.NoError(t, err)
	assert.Equal(t, "latest", updated.Tag)

	// DELETE
	err = apiClient.Delete(ctx, fmt.Sprintf("/api/services/%s/container", svc.ID))
	require.NoError(t, err)

	// GET after delete should be 404
	var gone ContainerConfig
	err = apiClient.Get(ctx, fmt.Sprintf("/api/services/%s/container", svc.ID), &gone)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}

// ─── Stats returns 409 when no container running ──────────────────────────

func TestContainerStatsNoContainer(t *testing.T) {
	ctx := context.Background()

	// Create service + container config
	svcPayload := map[string]interface{}{
		"name":        "test-container-stats-svc",
		"description": "test container stats",
	}
	var svc ServiceDto
	err := apiClient.Post(ctx, "/api/services", svcPayload, &svc)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/services/"+svc.ID)
	})

	cfg := map[string]interface{}{"image": "nginx", "tag": "latest"}
	_ = apiClient.Put(ctx, fmt.Sprintf("/api/services/%s/container", svc.ID), cfg, nil)

	// Stats should fail because container is not running
	err = apiClient.Get(ctx, fmt.Sprintf("/api/services/%s/container/stats", svc.ID), nil)
	assert.Error(t, err)
	// Expect 409 or 404 (no container ID) — either is acceptable
}

// ─── Image list endpoint ──────────────────────────────────────────────────

func TestImagesList(t *testing.T) {
	// Detect if Docker is available first
	var info ContainerRuntimeInfo
	err := apiClient.Get(context.Background(), "/api/containers/runtime", &info)
	if err != nil || !info.Available {
		t.Skip("Docker runtime not available — skipping image list test")
	}

	var images []map[string]interface{}
	err = apiClient.Get(context.Background(), "/api/images", &images)
	require.NoError(t, err)
	// Images can be empty but endpoint should succeed
	assert.NotNil(t, images)
}

// ─── CLI container commands ───────────────────────────────────────────────

func TestCLIContainerRuntime(t *testing.T) {
	result := testEnv.RunCLI("container", "runtime", "-o", "json")
	// May fail if Docker not configured — treat 503 as skip
	if result.ExitCode != 0 {
		if strings.Contains(result.Stderr, "unavailable") || strings.Contains(result.Stderr, "503") {
			t.Skip("Docker runtime not available")
		}
		t.Fatalf("unexpected error: %s", result.Stderr)
	}
	assert.Contains(t, result.Stdout, "available")
}

func TestCLIContainerConfigSetGet(t *testing.T) {
	ctx := context.Background()

	svcPayload := map[string]interface{}{
		"name":        "test-cli-container-cfg",
		"description": "CLI container config test",
	}
	var svc ServiceDto
	err := apiClient.Post(ctx, "/api/services", svcPayload, &svc)
	require.NoError(t, err)
	t.Cleanup(func() {
		_ = apiClient.Delete(ctx, "/api/services/"+svc.ID)
	})

	// Set via CLI
	result := testEnv.RunCLI("container", "config", "set", "test-cli-container-cfg",
		"--image", "alpine", "--tag", "3.18")
	assert.Equal(t, 0, result.ExitCode, result.Stderr)
	assert.Contains(t, result.Stdout, "saved")

	// Get via CLI
	result = testEnv.RunCLI("container", "config", "get", "test-cli-container-cfg", "-o", "json")
	assert.Equal(t, 0, result.ExitCode, result.Stderr)
	assert.Contains(t, result.Stdout, "alpine")
}
