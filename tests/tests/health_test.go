package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHealthCheck(t *testing.T) {
	ctx := context.Background()

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/health", &result)
	require.NoError(t, err)

	status, ok := result["status"].(string)
	require.True(t, ok, "health response should have a 'status' string field")
	assert.Equal(t, "healthy", status)

	_, hasDB := result["database"]
	assert.True(t, hasDB, "health response should include database field")
}
