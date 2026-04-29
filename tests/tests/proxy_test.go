package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type ProxyRouteDto struct {
	ID         string `json:"id"`
	Name       string `json:"name"`
	TargetUrl  string `json:"targetUrl"`
	PathPrefix string `json:"pathPrefix"`
	IsEnabled  bool   `json:"isEnabled"`
}

type ProxySettingsDto struct {
	ID             string `json:"id"`
	BaseDomainType string `json:"baseDomainType"`
	PortRangeStart int    `json:"portRangeStart"`
	PortRangeEnd   int    `json:"portRangeEnd"`
}

func TestProxyRouteCRUD(t *testing.T) {
	ctx := context.Background()

	// Create
	var created ProxyRouteDto
	err := apiClient.Post(ctx, "/api/proxy-routes", map[string]interface{}{
		"name":       "test-proxy-route",
		"targetUrl":  "http://localhost:9000",
		"pathPrefix": "/test",
		"isEnabled":  true,
	}, &created)
	require.NoError(t, err)
	assert.Equal(t, "test-proxy-route", created.Name)
	assert.Equal(t, "http://localhost:9000", created.TargetUrl)
	assert.NotEmpty(t, created.ID)

	// List
	var routes []ProxyRouteDto
	err = apiClient.Get(ctx, "/api/proxy-routes", &routes)
	require.NoError(t, err)
	found := false
	for _, r := range routes {
		if r.ID == created.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Created proxy route should appear in list")

	// Get by ID
	var fetched ProxyRouteDto
	err = apiClient.Get(ctx, "/api/proxy-routes/"+created.ID, &fetched)
	require.NoError(t, err)
	assert.Equal(t, created.ID, fetched.ID)

	// Update
	var updated ProxyRouteDto
	err = apiClient.Put(ctx, "/api/proxy-routes/"+created.ID, map[string]interface{}{
		"name":       "test-proxy-route-updated",
		"targetUrl":  "http://localhost:9001",
		"pathPrefix": "/updated",
		"isEnabled":  false,
	}, &updated)
	require.NoError(t, err)

	// Delete
	err = apiClient.Delete(ctx, "/api/proxy-routes/"+created.ID)
	require.NoError(t, err)

	// Verify deleted
	var routesAfter []ProxyRouteDto
	err = apiClient.Get(ctx, "/api/proxy-routes", &routesAfter)
	require.NoError(t, err)
	for _, r := range routesAfter {
		assert.NotEqual(t, created.ID, r.ID)
	}
}

func TestProxySettings(t *testing.T) {
	ctx := context.Background()

	// GET proxy settings — should always return something (auto-created)
	var settings ProxySettingsDto
	err := apiClient.Get(ctx, "/api/proxy-settings", &settings)
	require.NoError(t, err)
	// Default values
	assert.NotEmpty(t, settings.ID)
	assert.NotZero(t, settings.PortRangeStart)
	assert.NotZero(t, settings.PortRangeEnd)
}

func TestProxyServerIP(t *testing.T) {
	ctx := context.Background()

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/api/proxy-settings/server-ip", &result)
	require.NoError(t, err)

	ip, ok := result["ip"].(string)
	require.True(t, ok, "server-ip response should have an 'ip' string field")
	assert.NotEmpty(t, ip)
}
