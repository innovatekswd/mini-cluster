// Package api provides the HTTP client for MiniCluster API
package api

import (
	"archive/zip"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"sync"
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

// UploadFile uploads a file to the server
func (c *Client) UploadFile(ctx context.Context, file io.Reader, fileName, folder string) (map[string]interface{}, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file field
	part, err := writer.CreateFormFile("File", fileName)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = io.Copy(part, file)
	if err != nil {
		return nil, fmt.Errorf("failed to copy file content: %w", err)
	}

	// Add folder field
	err = writer.WriteField("Folder", folder)
	if err != nil {
		return nil, fmt.Errorf("failed to write folder field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	url := c.baseURL + "/api/files/upload"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("User-Agent", "minicluster-cli/1.0")

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	if c.debug {
		fmt.Printf("[DEBUG] POST %s\n", url)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if c.debug {
		fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
	}

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		return nil, parseAPIError(resp.StatusCode, respBody)
	}

	// Parse response
	var result map[string]interface{}
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return result, nil
}

// DownloadFile downloads a file from the server
func (c *Client) DownloadFile(ctx context.Context, folder, fileName string) (io.ReadCloser, error) {
	// Build URL with query parameters
	params := url.Values{}
	params.Add("folder", folder)
	params.Add("fileName", fileName)

	url := c.baseURL + "/api/files/download?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("User-Agent", "minicluster-cli/1.0")

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	if c.debug {
		fmt.Printf("[DEBUG] GET %s\n", url)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}

	if c.debug {
		fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		resp.Body.Close()
		return nil, parseAPIError(resp.StatusCode, respBody)
	}

	// Return the response body as a reader
	return resp.Body, nil
}

// DownloadFolder downloads a folder as a zip and extracts it to the destination
func (c *Client) DownloadFolder(ctx context.Context, folder, destPath string) error {
	// Build URL with query parameters (no fileName means download folder as zip)
	params := url.Values{}
	params.Add("folder", folder)

	url := c.baseURL + "/api/files/download?" + params.Encode()

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("User-Agent", "minicluster-cli/1.0")

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	if c.debug {
		fmt.Printf("[DEBUG] GET %s\n", url)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if c.debug {
		fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		respBody, _ := io.ReadAll(resp.Body)
		return parseAPIError(resp.StatusCode, respBody)
	}

	// Read the zip file into memory
	zipData, err := io.ReadAll(resp.Body)
	if err != nil {
		return fmt.Errorf("failed to read zip data: %w", err)
	}

	// Extract the zip file
	zipReader, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return fmt.Errorf("failed to read zip archive: %w", err)
	}

	// Extract all files
	for _, file := range zipReader.File {
		if err := extractZipFile(file, destPath); err != nil {
			return fmt.Errorf("failed to extract %s: %w", file.Name, err)
		}
	}

	return nil
}

// extractZipFile extracts a single file from a zip archive
func extractZipFile(file *zip.File, destPath string) error {
	// Construct the full path
	fullPath := filepath.Join(destPath, file.Name)

	// Check for directory traversal
	if !strings.HasPrefix(fullPath, filepath.Clean(destPath)+string(filepath.Separator)) {
		return fmt.Errorf("illegal file path: %s", file.Name)
	}

	if file.FileInfo().IsDir() {
		// Create directory
		return os.MkdirAll(fullPath, file.Mode())
	}

	// Create parent directories
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}

	// Extract file
	srcFile, err := file.Open()
	if err != nil {
		return err
	}
	defer srcFile.Close()

	destFile, err := os.OpenFile(fullPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, file.Mode())
	if err != nil {
		return err
	}
	defer destFile.Close()

	_, err = io.Copy(destFile, srcFile)
	return err
}

// FileSystemItem represents a file or directory on the server
type FileSystemItem struct {
	Name     string    `json:"name"`
	Type     string    `json:"type"` // "file" or "directory"
	Size     int64     `json:"size"`
	Modified time.Time `json:"modified"`
	Path     string    `json:"path"`
}

// ListFilesResponse represents the response from the list endpoint
type ListFilesResponse struct {
	Folder string           `json:"folder"`
	Items  []FileSystemItem `json:"items"`
}

// ListFiles lists files and directories in a folder
func (c *Client) ListFiles(ctx context.Context, folder string) (*ListFilesResponse, error) {
	params := url.Values{}
	params.Add("folder", folder)

	path := "/api/files/list?" + params.Encode()

	var result ListFilesResponse
	if err := c.Get(ctx, path, &result); err != nil {
		return nil, err
	}

	return &result, nil
}

// ProgressCallback is called during file upload/download to report progress
type ProgressCallback func(current, total int64)

// progressReader wraps an io.Reader and calls a callback with progress updates
type progressReader struct {
	reader   io.Reader
	total    int64
	current  int64
	callback ProgressCallback
	mu       sync.Mutex
}

func (pr *progressReader) Read(p []byte) (int, error) {
	n, err := pr.reader.Read(p)
	if n > 0 {
		pr.mu.Lock()
		pr.current += int64(n)
		if pr.callback != nil {
			pr.callback(pr.current, pr.total)
		}
		pr.mu.Unlock()
	}
	return n, err
}

// UploadFileWithProgress uploads a file and reports progress
func (c *Client) UploadFileWithProgress(ctx context.Context, file io.Reader, fileName, folder string, fileSize int64, progress ProgressCallback) (map[string]interface{}, error) {
	// Wrap reader with progress tracking
	progressFile := &progressReader{
		reader:   file,
		total:    fileSize,
		callback: progress,
	}

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Add file field
	part, err := writer.CreateFormFile("File", fileName)
	if err != nil {
		return nil, fmt.Errorf("failed to create form file: %w", err)
	}

	_, err = io.Copy(part, progressFile)
	if err != nil {
		return nil, fmt.Errorf("failed to copy file content: %w", err)
	}

	// Add folder field
	err = writer.WriteField("Folder", folder)
	if err != nil {
		return nil, fmt.Errorf("failed to write folder field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	url := c.baseURL + "/api/files/upload"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("User-Agent", "minicluster-cli/1.0")

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	if c.debug {
		fmt.Printf("[DEBUG] POST %s\n", url)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if c.debug {
		fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
	}

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		return nil, parseAPIError(resp.StatusCode, respBody)
	}

	// Parse response
	var result map[string]interface{}
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return result, nil
}

// UploadMultipleFiles uploads multiple files to the same folder
func (c *Client) UploadMultipleFiles(ctx context.Context, files []string, folder string, progress ProgressCallback) (map[string]interface{}, error) {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Calculate total size for progress
	var totalSize int64
	for _, filePath := range files {
		info, err := os.Stat(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to stat %s: %w", filePath, err)
		}
		totalSize += info.Size()
	}

	var currentSize int64

	// Add files
	for _, filePath := range files {
		file, err := os.Open(filePath)
		if err != nil {
			return nil, fmt.Errorf("failed to open %s: %w", filePath, err)
		}
		defer file.Close()

		fileName := filepath.Base(filePath)
		part, err := writer.CreateFormFile("Files", fileName)
		if err != nil {
			return nil, fmt.Errorf("failed to create form file: %w", err)
		}

		// Copy with progress
		if progress != nil {
			fileInfo, _ := file.Stat()
			pr := &progressReader{
				reader:   file,
				total:    totalSize,
				current:  currentSize,
				callback: progress,
			}
			_, err = io.Copy(part, pr)
			currentSize += fileInfo.Size()
		} else {
			_, err = io.Copy(part, file)
		}

		if err != nil {
			return nil, fmt.Errorf("failed to copy file content: %w", err)
		}
	}

	// Add folder field
	err := writer.WriteField("Folder", folder)
	if err != nil {
		return nil, fmt.Errorf("failed to write folder field: %w", err)
	}

	err = writer.Close()
	if err != nil {
		return nil, fmt.Errorf("failed to close multipart writer: %w", err)
	}

	// Create request
	url := c.baseURL + "/api/files/upload-multiple"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, url, body)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	// Set headers
	req.Header.Set("Content-Type", writer.FormDataContentType())
	req.Header.Set("User-Agent", "minicluster-cli/1.0")

	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}

	if c.debug {
		fmt.Printf("[DEBUG] POST %s\n", url)
	}

	// Execute request
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if c.debug {
		fmt.Printf("[DEBUG] Response: %d %s\n", resp.StatusCode, resp.Status)
	}

	// Read response body
	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	// Check for error status codes
	if resp.StatusCode >= 400 {
		return nil, parseAPIError(resp.StatusCode, respBody)
	}

	// Parse response
	var result map[string]interface{}
	if len(respBody) > 0 {
		if err := json.Unmarshal(respBody, &result); err != nil {
			return nil, fmt.Errorf("failed to parse response: %w", err)
		}
	}

	return result, nil
}
