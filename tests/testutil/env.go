// Package testutil provides utilities for integration testing
package testutil

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

// TestEnv holds the test environment configuration
type TestEnv struct {
	APIServerURL  string
	APIServerProc *exec.Cmd
	CLIPath       string
	APIPath       string
	WorkDir       string
	Verbose       bool
	AuthToken     string // Authentication token for API calls
}

// DefaultEnv creates a TestEnv with default paths
func DefaultEnv() *TestEnv {
	baseDir := os.Getenv("MINICLUSTER_TEST_BASE")
	if baseDir == "" {
		// Assume we're in tests
		baseDir = filepath.Join("..", "")
	}

	return &TestEnv{
		APIServerURL: "http://localhost:5147",
		CLIPath:      filepath.Join(baseDir, "cli", "build", "mc"),
		APIPath:      filepath.Join(baseDir, "api"),
		WorkDir:      filepath.Join(baseDir, "tests", ".testdata"),
		Verbose:      os.Getenv("VERBOSE") == "1",
	}
}

// Setup initializes the test environment
func (e *TestEnv) Setup(ctx context.Context) error {
	// Create work directory
	if err := os.MkdirAll(e.WorkDir, 0755); err != nil {
		return fmt.Errorf("failed to create work dir: %w", err)
	}

	// Check CLI exists
	if _, err := os.Stat(e.CLIPath); os.IsNotExist(err) {
		return fmt.Errorf("CLI not found at %s - run 'make build' in minicluster-cli first", e.CLIPath)
	}

	return nil
}

// StartAPIServer starts the API server and waits for it to be ready
func (e *TestEnv) StartAPIServer(ctx context.Context) error {
	// Check if server is already running
	if e.IsServerRunning() {
		fmt.Println("API server already running, using existing instance")
		// Login even if server was already running
		if err := e.Login(ctx, "admin", "admin"); err != nil {
			fmt.Printf("Warning: Failed to login with default credentials: %v\n", err)
		}
		return nil
	}

	fmt.Println("Starting API server...")

	// Start the server using dotnet run
	e.APIServerProc = exec.CommandContext(ctx, "dotnet", "run",
		"--project", filepath.Join(e.APIPath, "Innovatek.Parallel.MiniCluster.Api", "Innovatek.Parallel.MiniCluster.Api.csproj"),
		"--urls", e.APIServerURL,
	)
	e.APIServerProc.Dir = e.APIPath

	// Capture output for debugging
	if e.Verbose {
		e.APIServerProc.Stdout = os.Stdout
		e.APIServerProc.Stderr = os.Stderr
	}

	if err := e.APIServerProc.Start(); err != nil {
		return fmt.Errorf("failed to start API server: %w", err)
	}

	// Wait for server to be ready
	if err := e.WaitForServer(ctx, 60*time.Second); err != nil {
		e.StopAPIServer()
		return err
	}

	fmt.Println("API server ready")

	// Login with default credentials
	if err := e.Login(ctx, "admin", "admin"); err != nil {
		fmt.Printf("Warning: Failed to login with default credentials: %v\n", err)
	}

	return nil
}

// WaitForServer waits for the API server to respond to health checks
func (e *TestEnv) WaitForServer(ctx context.Context, timeout time.Duration) error {
	deadline := time.Now().Add(timeout)
	healthURL := e.APIServerURL + "/health"

	for time.Now().Before(deadline) {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		resp, err := http.Get(healthURL)
		if err == nil {
			resp.Body.Close()
			if resp.StatusCode == http.StatusOK {
				return nil
			}
		}

		time.Sleep(500 * time.Millisecond)
	}

	return fmt.Errorf("server did not become ready within %v", timeout)
}

// IsServerRunning checks if the API server is responding
func (e *TestEnv) IsServerRunning() bool {
	resp, err := http.Get(e.APIServerURL + "/health")
	if err != nil {
		return false
	}
	resp.Body.Close()
	return resp.StatusCode == http.StatusOK
}

// StopAPIServer stops the API server
func (e *TestEnv) StopAPIServer() {
	if e.APIServerProc != nil && e.APIServerProc.Process != nil {
		fmt.Println("Stopping API server...")
		e.APIServerProc.Process.Kill()
		e.APIServerProc.Wait()
		e.APIServerProc = nil
	}
}

// Cleanup cleans up the test environment
func (e *TestEnv) Cleanup() {
	e.StopAPIServer()
	// Optionally clean up work dir
	// os.RemoveAll(e.WorkDir)
}

// Login authenticates with the API server and stores the token
func (e *TestEnv) Login(ctx context.Context, username, password string) error {
	loginURL := e.APIServerURL + "/api/auth/login"

	loginData := map[string]string{
		"username": username,
		"password": password,
	}

	data, err := json.Marshal(loginData)
	if err != nil {
		return fmt.Errorf("failed to marshal login data: %w", err)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", loginURL, bytes.NewReader(data))
	if err != nil {
		return fmt.Errorf("failed to create login request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return fmt.Errorf("failed to send login request: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("login failed with status %d: %s", resp.StatusCode, string(body))
	}

	var result struct {
		Success     bool   `json:"success"`
		AccessToken string `json:"accessToken"`
		Error       string `json:"error"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return fmt.Errorf("failed to parse login response: %w", err)
	}

	if !result.Success {
		return fmt.Errorf("login failed: %s", result.Error)
	}

	e.AuthToken = result.AccessToken
	if e.Verbose {
		fmt.Printf("Logged in successfully as %s\n", username)
	}

	return nil
}

// CLIResult holds the result of a CLI command
type CLIResult struct {
	Stdout   string
	Stderr   string
	ExitCode int
	Err      error
}

// RunCLI runs a CLI command and returns the result
func (e *TestEnv) RunCLI(args ...string) CLIResult {
	return e.RunCLIWithEnv(nil, args...)
}

// RunCLIWithEnv runs a CLI command with additional environment variables
func (e *TestEnv) RunCLIWithEnv(env map[string]string, args ...string) CLIResult {
	// Add server URL to args
	fullArgs := append([]string{"--server", e.APIServerURL}, args...)

	cmd := exec.Command(e.CLIPath, fullArgs...)

	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	// Set environment
	cmd.Env = os.Environ()

	// Add auth token if available
	if e.AuthToken != "" {
		cmd.Env = append(cmd.Env, fmt.Sprintf("MC_AUTH_TOKEN=%s", e.AuthToken))
	}

	for k, v := range env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", k, v))
	}

	if e.Verbose {
		fmt.Printf("Running: %s %s\n", e.CLIPath, strings.Join(fullArgs, " "))
	}

	err := cmd.Run()

	result := CLIResult{
		Stdout: stdout.String(),
		Stderr: stderr.String(),
		Err:    err,
	}

	if exitError, ok := err.(*exec.ExitError); ok {
		result.ExitCode = exitError.ExitCode()
	} else if err != nil {
		result.ExitCode = -1
	}

	if e.Verbose {
		fmt.Printf("Exit code: %d\n", result.ExitCode)
		if result.Stdout != "" {
			fmt.Printf("Stdout:\n%s\n", result.Stdout)
		}
		if result.Stderr != "" {
			fmt.Printf("Stderr:\n%s\n", result.Stderr)
		}
	}

	return result
}

// RunCLIJSON runs a CLI command with JSON output and parses the result
func (e *TestEnv) RunCLIJSON(v interface{}, args ...string) error {
	fullArgs := append(args, "-o", "json")
	result := e.RunCLI(fullArgs...)

	if result.ExitCode != 0 {
		return fmt.Errorf("CLI failed with exit code %d: %s", result.ExitCode, result.Stderr)
	}

	if err := json.Unmarshal([]byte(result.Stdout), v); err != nil {
		return fmt.Errorf("failed to parse JSON output: %w\nOutput: %s", err, result.Stdout)
	}

	return nil
}

// APIClient for direct API calls (useful for setup/verification)
type APIClient struct {
	BaseURL    string
	HTTPClient *http.Client
	AuthToken  string // Bearer token for authenticated requests
}

// NewAPIClient creates a new API client
func NewAPIClient(baseURL string) *APIClient {
	return &APIClient{
		BaseURL:    baseURL,
		HTTPClient: &http.Client{Timeout: 30 * time.Second},
	}
}

// Get performs a GET request
func (c *APIClient) Get(ctx context.Context, path string, result interface{}) error {
	req, err := http.NewRequestWithContext(ctx, "GET", c.BaseURL+path, nil)
	if err != nil {
		return err
	}

	// Add auth token if available
	if c.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.AuthToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

// Post performs a POST request
func (c *APIClient) Post(ctx context.Context, path string, body interface{}, result interface{}) error {
	var reqBody io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		reqBody = bytes.NewReader(data)
	}

	req, err := http.NewRequestWithContext(ctx, "POST", c.BaseURL+path, reqBody)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")

	// Add auth token if available
	if c.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.AuthToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(respBody))
	}

	if result != nil {
		return json.NewDecoder(resp.Body).Decode(result)
	}
	return nil
}

// Delete performs a DELETE request
func (c *APIClient) Delete(ctx context.Context, path string) error {
	req, err := http.NewRequestWithContext(ctx, "DELETE", c.BaseURL+path, nil)
	if err != nil {
		return err
	}

	// Add auth token if available
	if c.AuthToken != "" {
		req.Header.Set("Authorization", "Bearer "+c.AuthToken)
	}

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return fmt.Errorf("API error %d: %s", resp.StatusCode, string(body))
	}

	return nil
}
