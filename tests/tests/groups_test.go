package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type GroupDto struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Color       string `json:"color"`
}

func TestGroupCRUD(t *testing.T) {
	ctx := context.Background()

	// Create
	var created GroupDto
	err := apiClient.Post(ctx, "/api/groups", map[string]interface{}{
		"name":        "test-group-crud",
		"description": "Test group",
		"color":       "#ff0000",
	}, &created)
	require.NoError(t, err)
	assert.Equal(t, "test-group-crud", created.Name)
	assert.NotEmpty(t, created.ID)

	// List
	var groups []GroupDto
	err = apiClient.Get(ctx, "/api/groups", &groups)
	require.NoError(t, err)
	found := false
	for _, g := range groups {
		if g.ID == created.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Created group should appear in list")

	// Get by ID
	var fetched GroupDto
	err = apiClient.Get(ctx, "/api/groups/"+created.ID, &fetched)
	require.NoError(t, err)
	assert.Equal(t, created.ID, fetched.ID)

	// Tree
	var tree []GroupDto
	err = apiClient.Get(ctx, "/api/groups/tree", &tree)
	require.NoError(t, err)

	// Update
	var updated GroupDto
	err = apiClient.Put(ctx, "/api/groups/"+created.ID, map[string]interface{}{
		"name":        "test-group-crud-updated",
		"description": "Updated group",
		"color":       "#00ff00",
	}, &updated)
	require.NoError(t, err)

	// Delete
	err = apiClient.Delete(ctx, "/api/groups/"+created.ID)
	require.NoError(t, err)

	// Verify deleted
	var groupsAfter []GroupDto
	err = apiClient.Get(ctx, "/api/groups", &groupsAfter)
	require.NoError(t, err)
	for _, g := range groupsAfter {
		assert.NotEqual(t, created.ID, g.ID)
	}
}

func TestGroupServiceMembership(t *testing.T) {
	ctx := context.Background()

	// Use a simple struct to avoid EnvironmentVars type mismatch across backends
	type ServiceRef struct {
		ID   string `json:"id"`
		Name string `json:"name"`
	}

	// Create a service to add to the group
	var svc ServiceRef
	err := apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           "test-svc-for-group",
		"executablePath": "echo",
		"arguments":      "hi",
	}, &svc)
	require.NoError(t, err)

	// Create a group
	var group GroupDto
	err = apiClient.Post(ctx, "/api/groups", map[string]interface{}{
		"name": "test-group-members",
	}, &group)
	require.NoError(t, err)

	// Add service to group
	err = apiClient.Post(ctx, "/api/groups/"+group.ID+"/services/"+svc.ID, nil, nil)
	require.NoError(t, err)

	// List services in group — should contain our service
	var services []ServiceRef
	err = apiClient.Get(ctx, "/api/groups/"+group.ID+"/services", &services)
	require.NoError(t, err)
	found := false
	for _, s := range services {
		if s.ID == svc.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Service should be in group")

	// Adding same service again should be idempotent (no error)
	err = apiClient.Post(ctx, "/api/groups/"+group.ID+"/services/"+svc.ID, nil, nil)
	require.NoError(t, err)

	// Remove service from group
	err = apiClient.Delete(ctx, "/api/groups/"+group.ID+"/services/"+svc.ID)
	require.NoError(t, err)

	// Verify removed
	var servicesAfter []ServiceRef
	err = apiClient.Get(ctx, "/api/groups/"+group.ID+"/services", &servicesAfter)
	require.NoError(t, err)
	for _, s := range servicesAfter {
		assert.NotEqual(t, svc.ID, s.ID, "Service should have been removed from group")
	}

	// Cleanup
	_ = apiClient.Delete(ctx, "/api/groups/"+group.ID)
	_ = apiClient.Delete(ctx, "/api/services/"+svc.ID)
}
