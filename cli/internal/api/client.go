// Package api provides the HTTP client for MiniCluster API
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// Client is the MiniCluster API client
type Client struct {
	baseURL    string
	httpClient *http.Client
	token      string
	debug      bool
}

// NewClient creates a new API client
func NewClient(baseURL, token string, timeout time.Duration, debug bool) *Client {
	if timeout == 0 {
		timeout = 30 * time.Second
	}
	return &Client{
		baseURL: strings.TrimSuffix(baseURL, "/"),
		httpClient: &http.Client{
			Timeout: timeout,
		},
		token: token,
		debug: debug,
	}
}

// SetToken updates the authentication token
func (c *Client) SetToken(token string) {
	c.token = token
}

// BaseURL returns the configured base URL
func (c *Client) BaseURL() string {
	return c.baseURL
}

// Do executes an HTTP request with authentication
func (c *Client) Do(ctx context.Context, method, path string, body, result interface{}) error {
	var bodyReader io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("failed to marshal request body: %w", err)
		}
		bodyReader = bytes.NewReader(jsonBody)
	}

	url := c.baseURL + path
	req, err := http.NewRequestWithContext(ctx, method, url, bodyReader)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "minicluster-cli/1.0")

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	if c.debug {
		fmt.Printf("[DEBUG] %s %s\n", method, url)
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if c.debug {
		fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
	}

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read response: %w", err)
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		return parseAPIError(resp.StatusCode, respBody)
	}

	// Parse response
	if result != nil && len(respBody) > 0 {
		if err := json.Unmarshal(respBody, result); err != nil {
			return fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return nil
}

// Get performs a GET request
func (c *Client) Get(ctx context.Context, path string, result interface{}) error {
	return c.Do(ctx, http.MethodGet, path, nil, result)
}

// Post performs a POST request
func (c *Client) Post(ctx context.Context, path string, body, result interface{}) error {
	return c.Do(ctx, http.MethodPost, path, body, result)
}

// Put performs a PUT request
func (c *Client) Put(ctx context.Context, path string, body, result interface{}) error {
	return c.Do(ctx, http.MethodPut, path, body, result)
}

// Delete performs a DELETE request
func (c *Client) Delete(ctx context.Context, path string) error {
	return c.Do(ctx, http.MethodDelete, path, nil, nil)
}

// APIError represents an error response from the API
type APIError struct {
	StatusCode int
	Message    string
	Details    string
}

func (e *APIError) Error() string {
	if e.Details != "" {
		return fmt.Sprintf("%s: %s", e.Message, e.Details)
	}
	return e.Message
}

// IsNotFound returns true if the error is a 404
func (e *APIError) IsNotFound() bool {
	return e.StatusCode == http.StatusNotFound
}

// IsUnauthorized returns true if the error is a 401
func (e *APIError) IsUnauthorized() bool {
	return e.StatusCode == http.StatusUnauthorized
}

// parseAPIError parses an error response from the API
func parseAPIError(statusCode int, body []byte) error {
	apiErr := &APIError{
		StatusCode: statusCode,
		Message:    http.StatusText(statusCode),
	}

	// Try to parse error details from response body
	var errResp struct {
		Message string `json:"message"`
		Error   string `json:"error"`
		Title   string `json:"title"`
		Detail  string `json:"detail"`
	}
	if json.Unmarshal(body, &errResp) == nil {
		if errResp.Message != "" {
			apiErr.Message = errResp.Message
		} else if errResp.Error != "" {
			apiErr.Message = errResp.Error
		} else if errResp.Title != "" {
			apiErr.Message = errResp.Title
		}
		if errResp.Detail != "" {
			apiErr.Details = errResp.Detail
		}
	}

	return apiErr
}

// HealthCheck checks if the API server is reachable
func (c *Client) HealthCheck(ctx context.Context) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/health", nil)
	if err != nil {
		return err
	}

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("server unreachable: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		return fmt.Errorf("server returned status %d", resp.StatusCode)
	}

	return nil
}
