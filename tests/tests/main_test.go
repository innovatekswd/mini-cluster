// Package tests contains integration tests for MiniCluster
package tests

import (
	"context"
	"os"
	"testing"

	"github.com/innovatek/tests/testutil"
)

var testEnv *testutil.TestEnv
var apiClient *testutil.APIClient

func TestMain(m *testing.M) {
	ctx := context.Background()

	// Setup test environment
	testEnv = testutil.DefaultEnv()
	if err := testEnv.Setup(ctx); err != nil {
		panic("Failed to setup test env: " + err.Error())
	}

	// Start API server (or use existing)
	if err := testEnv.StartAPIServer(ctx); err != nil {
		panic("Failed to start API server: " + err.Error())
	}

	apiClient = testutil.NewAPIClient(testEnv.APIServerURL)
	// Set auth token from testEnv
	apiClient.AuthToken = testEnv.AuthToken

	// Run tests
	code := m.Run()

	// Cleanup
	// Note: Don't stop server if it was already running
	// testEnv.Cleanup()

	os.Exit(code)
}
