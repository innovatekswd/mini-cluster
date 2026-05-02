package tests

import (
	"context"
	"fmt"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

// ─── Helpers ─────────────────────────────────────────────────────────────────

// createAndRunService creates a short-lived service, starts it so at least one
// session (and log entries) are produced, then stops it.
// Returns the service ID and a cleanup function.
func createAndRunService(t *testing.T, name string) (id string, cleanup func()) {
	t.Helper()
	ctx := context.Background()

	var svc ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name":           name,
		"executablePath": "echo",
		"arguments":      fmt.Sprintf("log-test-%s", name),
	}, &svc))

	// Start + give it a moment so the session log record exists
	_ = apiClient.Post(ctx, fmt.Sprintf("/api/services/%s/exec/start", svc.ID), nil, nil)
	time.Sleep(500 * time.Millisecond)
	_ = apiClient.Post(ctx, fmt.Sprintf("/api/services/%s/exec/stop", svc.ID), nil, nil)
	time.Sleep(300 * time.Millisecond)

	return svc.ID, func() {
		_ = apiClient.Delete(ctx, "/api/services/"+svc.ID)
	}
}

// ─── GET /api/services/{id}/logs ─────────────────────────────────────────────

// TestLogsGetReturnsList verifies that GET /logs on a known service returns
// an array (even if empty for a never-started service).
func TestLogsGetReturnsList(t *testing.T) {
	ctx := context.Background()

	var svc ServiceDto
	require.NoError(t, apiClient.Post(ctx, "/api/services", map[string]interface{}{
		"name": "test-logs-get", "executablePath": "echo",
	}, &svc))
	defer apiClient.Delete(ctx, "/api/services/"+svc.ID) //nolint:errcheck

	var logs []map[string]interface{}
	err := apiClient.Get(ctx, "/api/services/"+svc.ID+"/logs", &logs)
	require.NoError(t, err, "GET /logs must succeed")
	assert.NotNil(t, logs, "logs array must not be nil")
}

// TestLogsGetTailParam verifies that the ?tail= query parameter is accepted
// without error (actual limiting verified by having > 0 logs).
func TestLogsGetTailParam(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createAndRunService(t, "test-logs-tail")
	defer cleanup()

	var logs []map[string]interface{}
	err := apiClient.Get(ctx, "/api/services/"+id+"/logs?tail=5", &logs)
	require.NoError(t, err, "GET /logs?tail=5 must succeed")
	assert.NotNil(t, logs)
}

// ─── GET /api/services/{id}/logs/search ──────────────────────────────────────

// TestLogsSearchReturnsPagedResult verifies the search endpoint returns a
// paged response with the expected shape.
func TestLogsSearchReturnsPagedResult(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createAndRunService(t, "test-logs-search")
	defer cleanup()

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/api/services/"+id+"/logs/search?page=1&pageSize=10", &result)
	require.NoError(t, err, "GET /logs/search must succeed")

	_, hasItems := result["items"]
	_, hasMeta := result["total"]
	assert.True(t, hasItems || hasMeta,
		"search result must have items or total field, got %v", result)
}

// TestLogsSearchLogTypeFilter verifies that the ?logType= filter is accepted.
func TestLogsSearchLogTypeFilter(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createAndRunService(t, "test-logs-logtype")
	defer cleanup()

	var result map[string]interface{}
	err := apiClient.Get(ctx, "/api/services/"+id+"/logs/search?logType=stdout", &result)
	require.NoError(t, err, "GET /logs/search?logType=stdout must succeed")
	assert.NotNil(t, result)
}

// TestLogsSearchTimeRangeFilter verifies RFC3339 from/to params are accepted.
func TestLogsSearchTimeRangeFilter(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createAndRunService(t, "test-logs-timerange")
	defer cleanup()

	from := time.Now().Add(-1 * time.Hour).UTC().Format(time.RFC3339)
	to := time.Now().Add(1 * time.Hour).UTC().Format(time.RFC3339)
	url := fmt.Sprintf("/api/services/%s/logs/search?from=%s&to=%s", id, from, to)

	var result map[string]interface{}
	err := apiClient.Get(ctx, url, &result)
	require.NoError(t, err, "GET /logs/search with time range must succeed")
	assert.NotNil(t, result)
}

// ─── GET /api/services/{id}/history ──────────────────────────────────────────

// TestLogsHistoryReturnsList verifies GET /history responds with an array.
func TestLogsHistoryReturnsList(t *testing.T) {
	ctx := context.Background()
	id, cleanup := createAndRunService(t, "test-logs-history")
	defer cleanup()

	var history []map[string]interface{}
	err := apiClient.Get(ctx, "/api/services/"+id+"/history", &history)
	require.NoError(t, err, "GET /history must succeed")
	assert.NotNil(t, history, "history must not be nil")
}

// ─── GET /api/logs/stats ─────────────────────────────────────────────────────

// TestLogsStats verifies that /api/logs/stats returns the expected counters.
func TestLogsStats(t *testing.T) {
	ctx := context.Background()

	var stats map[string]interface{}
	err := apiClient.Get(ctx, "/api/logs/stats", &stats)
	require.NoError(t, err, "GET /api/logs/stats must succeed")

	_, hasLogs := stats["logs"]
	_, hasSessions := stats["sessions"]
	_, hasActive := stats["activeSessions"]
	assert.True(t, hasLogs, "stats must have logs field")
	assert.True(t, hasSessions, "stats must have sessions field")
	assert.True(t, hasActive, "stats must have activeSessions field")
}

// ─── DELETE /api/logs/truncate ────────────────────────────────────────────────

// TestLogsTruncateRequiresConfirm verifies that omitting ?confirm=true is
// rejected with a 400.
func TestLogsTruncateRequiresConfirm(t *testing.T) {
	ctx := context.Background()
	err := apiClient.Delete(ctx, "/api/logs/truncate")
	require.Error(t, err, "DELETE /truncate without confirm=true must fail")
	assert.Contains(t, err.Error(), "400", "should return 400 not-confirmed")
}

// TestLogsTruncateWithConfirm verifies that DELETE /api/logs/truncate?confirm=true
// succeeds and returns a message.
// NOTE: this clears all logs in the test DB — run last or in an isolated suite.
func TestLogsTruncateWithConfirm(t *testing.T) {
	ctx := context.Background()

	resp, err := apiClient.DeleteWithQuery(ctx, "/api/logs/truncate", "confirm=true")
	require.NoError(t, err)
	defer resp.Body.Close()

	assert.Equal(t, 200, resp.StatusCode, "DELETE /truncate?confirm=true must return 200")
}
