package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type EnvironmentDto struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Slug        string `json:"slug"`
	Description string `json:"description"`
	Variables   string `json:"variables"`
	IsActive    bool   `json:"isActive"`
}

func TestEnvironmentCRUD(t *testing.T) {
	ctx := context.Background()

	// Create
	var created EnvironmentDto
	err := apiClient.Post(ctx, "/api/environments", map[string]interface{}{
		"name":        "test-env-crud",
		"description": "Test environment for CRUD",
		"variables":   "KEY=value\nOTHER=123",
	}, &created)
	require.NoError(t, err)
	assert.Equal(t, "test-env-crud", created.Name)
	assert.NotEmpty(t, created.ID)

	// List
	var envs []EnvironmentDto
	err = apiClient.Get(ctx, "/api/environments", &envs)
	require.NoError(t, err)
	found := false
	for _, e := range envs {
		if e.ID == created.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Created environment should appear in list")

	// Get by ID
	var fetched EnvironmentDto
	err = apiClient.Get(ctx, "/api/environments/"+created.ID, &fetched)
	require.NoError(t, err)
	assert.Equal(t, created.ID, fetched.ID)
	assert.Equal(t, "test-env-crud", fetched.Name)

	// Update
	var updated EnvironmentDto
	err = apiClient.Put(ctx, "/api/environments/"+created.ID, map[string]interface{}{
		"name":        "test-env-crud-updated",
		"description": "Updated description",
		"variables":   "KEY=newvalue",
	}, &updated)
	require.NoError(t, err)

	// Delete
	err = apiClient.Delete(ctx, "/api/environments/"+created.ID)
	require.NoError(t, err)

	// Verify deleted
	var envsAfter []EnvironmentDto
	err = apiClient.Get(ctx, "/api/environments", &envsAfter)
	require.NoError(t, err)
	for _, e := range envsAfter {
		assert.NotEqual(t, created.ID, e.ID, "Deleted environment should not appear")
	}
}

func TestEnvironmentActivate(t *testing.T) {
	ctx := context.Background()

	// Create an environment to activate
	var env EnvironmentDto
	err := apiClient.Post(ctx, "/api/environments", map[string]interface{}{
		"name":      "test-env-activate",
		"variables": "ACTIVE=true",
	}, &env)
	require.NoError(t, err)

	// Activate it
	err = apiClient.Post(ctx, "/api/environments/"+env.ID+"/activate", nil, nil)
	require.NoError(t, err)

	// Verify it's the active one
	var active EnvironmentDto
	err = apiClient.Get(ctx, "/api/environments/active", &active)
	require.NoError(t, err)
	assert.Equal(t, env.ID, active.ID)
	assert.True(t, active.IsActive)

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/environments/"+env.ID)
}

func TestEnvironmentNotFound(t *testing.T) {
	ctx := context.Background()

	err := apiClient.Get(ctx, "/api/environments/non-existent-id-12345", nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "404")
}
