package tests

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

type CronJobDto struct {
	ID             string `json:"id"`
	Name           string `json:"name"`
	Description    string `json:"description"`
	CronExpression string `json:"cronExpression"`
	Timezone       string `json:"timezone"`
	Action         string `json:"action"`
	IsEnabled      bool   `json:"isEnabled"`
}

func TestCronJobCRUD(t *testing.T) {
	ctx := context.Background()

	// Create
	var created CronJobDto
	err := apiClient.Post(ctx, "/api/cron", map[string]interface{}{
		"name":           "test-cron-crud",
		"description":    "Test cron job",
		"cronExpression": "0 * * * *",
		"action":         "Start",
		"isEnabled":      false,
	}, &created)
	require.NoError(t, err)
	assert.Equal(t, "test-cron-crud", created.Name)
	assert.Equal(t, "0 * * * *", created.CronExpression)
	assert.NotEmpty(t, created.ID)

	// List
	var jobs []CronJobDto
	err = apiClient.Get(ctx, "/api/cron", &jobs)
	require.NoError(t, err)
	found := false
	for _, j := range jobs {
		if j.ID == created.ID {
			found = true
			break
		}
	}
	assert.True(t, found, "Created cron job should appear in list")

	// Get by ID
	var fetched CronJobDto
	err = apiClient.Get(ctx, "/api/cron/"+created.ID, &fetched)
	require.NoError(t, err)
	assert.Equal(t, created.ID, fetched.ID)

	// Update — toggle enabled
	var updated CronJobDto
	err = apiClient.Put(ctx, "/api/cron/"+created.ID, map[string]interface{}{
		"name":           "test-cron-crud",
		"cronExpression": "0 */2 * * *",
		"action":         "Start",
		"isEnabled":      true,
	}, &updated)
	require.NoError(t, err)

	// Delete
	err = apiClient.Delete(ctx, "/api/cron/"+created.ID)
	require.NoError(t, err)

	// Verify deleted
	var jobsAfter []CronJobDto
	err = apiClient.Get(ctx, "/api/cron", &jobsAfter)
	require.NoError(t, err)
	for _, j := range jobsAfter {
		assert.NotEqual(t, created.ID, j.ID)
	}
}

func TestCronJobInvalidExpression(t *testing.T) {
	ctx := context.Background()

	err := apiClient.Post(ctx, "/api/cron", map[string]interface{}{
		"name":           "bad-cron",
		"cronExpression": "not-a-cron",
		"action":         "Start",
		"isEnabled":      false,
	}, nil)
	require.Error(t, err)
	assert.Contains(t, err.Error(), "400", "Should reject invalid cron expression")
}
