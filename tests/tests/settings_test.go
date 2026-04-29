package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type SettingsDto struct {
	ID                       string `json:"id"`
	MetricsCollectionEnabled bool   `json:"metricsCollectionEnabled"`
	MetricsIntervalSeconds   int    `json:"metricsIntervalSeconds"`
	Theme                    string `json:"theme"`
}

func TestGetSettings(t *testing.T) {
	ctx := context.Background()

	var settings SettingsDto
	err := apiClient.Get(ctx, "/api/settings", &settings)
	require.NoError(t, err)
	assert.NotEmpty(t, settings.ID)
	assert.NotZero(t, settings.MetricsIntervalSeconds)
}

func TestUpdateSettings(t *testing.T) {
	ctx := context.Background()

	// Get current settings first
	var current SettingsDto
	err := apiClient.Get(ctx, "/api/settings", &current)
	require.NoError(t, err)

	// Toggle theme
	newTheme := "light"
	if current.Theme == "light" {
		newTheme = "dark"
	}

	var updated SettingsDto
	err = apiClient.Put(ctx, "/api/settings", map[string]interface{}{
		"metricsCollectionEnabled": current.MetricsCollectionEnabled,
		"metricsIntervalSeconds":   current.MetricsIntervalSeconds,
		"theme":                    newTheme,
	}, &updated)
	require.NoError(t, err)

	// Restore original theme
	_ = apiClient.Put(ctx, "/api/settings", map[string]interface{}{
		"metricsCollectionEnabled": current.MetricsCollectionEnabled,
		"metricsIntervalSeconds":   current.MetricsIntervalSeconds,
		"theme":                    current.Theme,
	}, nil)
}

func TestSettingsIntervals(t *testing.T) {
	ctx := context.Background()

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/api/settings/intervals", &result)
	require.NoError(t, err)

	intervals, ok := result["intervals"].([]interface{})
	require.True(t, ok, "intervals response should have an 'intervals' array")
	assert.NotEmpty(t, intervals)
}
