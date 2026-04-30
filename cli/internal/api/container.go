package api

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

// ContainerRuntimeInfo represents Docker daemon info
type ContainerRuntimeInfo struct {
	Available     bool   `json:"available"`
	ServerVersion string `json:"serverVersion"`
	OS            string `json:"os"`
	Arch          string `json:"arch"`
	TotalMemory   int64  `json:"totalMemory"`
	Containers    int    `json:"containers"`
	Images        int    `json:"images"`
}

// ImageInfo represents a Docker image
type ImageInfo struct {
	ID       string   `json:"id"`
	Tags     []string `json:"tags"`
	Size     int64    `json:"size"`
	Created  int64    `json:"created"`
	RepoTags []string `json:"repoTags"`
}

// ContainerConfig holds configuration for a container-type service
type ContainerConfig struct {
	ID              uint   `json:"id"`
	ServiceID       string `json:"serviceId"`
	Image           string `json:"image"`
	Tag             string `json:"tag"`
	Registry        string `json:"registry"`
	PullPolicy      string `json:"pullPolicy"`
	ContainerID     string `json:"containerId"`
	ContainerName   string `json:"containerName"`
	ImageID         string `json:"imageId"`
	Ports           string `json:"ports"`
	NetworkMode     string `json:"networkMode"`
	Volumes         string `json:"volumes"`
	MemoryLimitBytes int64 `json:"memoryLimitBytes"`
	CpuLimit        float64 `json:"cpuLimit"`
	Entrypoint      string `json:"entrypoint"`
	Command         string `json:"command"`
	User            string `json:"user"`
	WorkingDir      string `json:"workingDir"`
	Privileged      bool   `json:"privileged"`
	ReadOnly        bool   `json:"readOnly"`
	RemoveOnStop    bool   `json:"removeOnStop"`
	Labels          string `json:"labels"`
}

// ContainerStats holds runtime stats for a container
type ContainerStats struct {
	ServiceID   string  `json:"serviceId"`
	ContainerID string  `json:"containerId"`
	CPUPercent  float64 `json:"cpuPercent"`
	MemoryUsage uint64  `json:"memoryUsage"`
	MemoryLimit uint64  `json:"memoryLimit"`
	NetworkRx   uint64  `json:"networkRx"`
	NetworkTx   uint64  `json:"networkTx"`
	BlockRead   uint64  `json:"blockRead"`
	BlockWrite  uint64  `json:"blockWrite"`
}

// ExecResult holds the result of a container exec command
type ExecResult struct {
	ExitCode int    `json:"exitCode"`
	Stdout   string `json:"stdout"`
	Stderr   string `json:"stderr"`
}

// PullEvent is a single event from a PullImage ndjson stream
type PullEvent struct {
	Status         string `json:"status"`
	ProgressDetail struct {
		Current int64 `json:"current"`
		Total   int64 `json:"total"`
	} `json:"progressDetail"`
	Progress string `json:"progress"`
	ID       string `json:"id"`
	Error    string `json:"error"`
}

// GetContainerRuntime returns Docker runtime info
func (c *Client) GetContainerRuntime(ctx context.Context) (*ContainerRuntimeInfo, error) {
	var result ContainerRuntimeInfo
	if err := c.Get(ctx, "/api/containers/runtime", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListImages returns all local Docker images
func (c *Client) ListImages(ctx context.Context) ([]ImageInfo, error) {
	var result []ImageInfo
	if err := c.Get(ctx, "/api/images", &result); err != nil {
		return nil, err
	}
	return result, nil
}

// PullImage pulls a Docker image and streams progress events via callback
func (c *Client) PullImage(ctx context.Context, image string, callback func(PullEvent)) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, c.baseURL+"/api/images/pull", nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.token != "" {
		req.Header.Set("Authorization", "Bearer "+c.token)
	}
	q := req.URL.Query()
	q.Set("image", image)
	req.URL.RawQuery = q.Encode()

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 400 {
		body, _ := io.ReadAll(resp.Body)
		return parseAPIError(resp.StatusCode, body)
	}

	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var event PullEvent
		if err := json.Unmarshal(line, &event); err == nil && callback != nil {
			callback(event)
		}
	}
	return scanner.Err()
}

// RemoveImage removes a Docker image by name/tag
func (c *Client) RemoveImage(ctx context.Context, name string) error {
	return c.Delete(ctx, "/api/images/"+name)
}

// GetContainerConfig returns the container config for a service
func (c *Client) GetContainerConfig(ctx context.Context, serviceID string) (*ContainerConfig, error) {
	var result ContainerConfig
	if err := c.Get(ctx, "/api/services/"+serviceID+"/container", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// UpsertContainerConfig creates or updates the container config for a service
func (c *Client) UpsertContainerConfig(ctx context.Context, serviceID string, cfg *ContainerConfig) (*ContainerConfig, error) {
	var result ContainerConfig
	if err := c.Put(ctx, "/api/services/"+serviceID+"/container", cfg, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// DeleteContainerConfig removes the container config for a service
func (c *Client) DeleteContainerConfig(ctx context.Context, serviceID string) error {
	return c.Delete(ctx, "/api/services/"+serviceID+"/container")
}

// GetContainerStats returns live stats for a running container
func (c *Client) GetContainerStats(ctx context.Context, serviceID string) (*ContainerStats, error) {
	var result ContainerStats
	if err := c.Get(ctx, "/api/services/"+serviceID+"/container/stats", &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ExecContainer runs a command inside a running container
func (c *Client) ExecContainer(ctx context.Context, serviceID string, command []string) (*ExecResult, error) {
	body := map[string]interface{}{"command": command}
	var result ExecResult
	if err := c.Post(ctx, "/api/services/"+serviceID+"/container/exec", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ── Volume management ─────────────────────────────────────────────────────

// VolumeInfo describes a named volume.
type VolumeInfo struct {
	Name       string            `json:"name"`
	Driver     string            `json:"driver"`
	Mountpoint string            `json:"mountpoint"`
	Labels     map[string]string `json:"labels"`
	CreatedAt  string            `json:"createdAt"`
}

// NetworkInfo describes a Docker network.
type NetworkInfo struct {
	ID     string            `json:"id"`
	Name   string            `json:"name"`
	Driver string            `json:"driver"`
	Scope  string            `json:"scope"`
	Labels map[string]string `json:"labels"`
}

// ListVolumes returns all named volumes on the host.
func (c *Client) ListVolumes(ctx context.Context) ([]VolumeInfo, error) {
	var result []VolumeInfo
	if err := c.Get(ctx, "/api/volumes", &result); err != nil {
		return nil, err
	}
	return result, nil
}

// CreateVolume creates a named volume.
func (c *Client) CreateVolume(ctx context.Context, name string) (*VolumeInfo, error) {
	body := map[string]string{"name": name}
	var result VolumeInfo
	if err := c.Post(ctx, "/api/volumes", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveVolume removes a named volume.
func (c *Client) RemoveVolume(ctx context.Context, name string, force bool) error {
	path := "/api/volumes/" + name
	if force {
		path += "?force=true"
	}
	return c.Delete(ctx, path)
}

// ── Network management ────────────────────────────────────────────────────

// ListNetworks returns all Docker networks.
func (c *Client) ListNetworks(ctx context.Context) ([]NetworkInfo, error) {
	var result []NetworkInfo
	if err := c.Get(ctx, "/api/networks", &result); err != nil {
		return nil, err
	}
	return result, nil
}

// CreateNetwork creates a Docker network.
func (c *Client) CreateNetwork(ctx context.Context, name, driver string) (*NetworkInfo, error) {
	body := map[string]string{"name": name, "driver": driver}
	var result NetworkInfo
	if err := c.Post(ctx, "/api/networks", body, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// RemoveNetwork removes a Docker network by ID or name.
func (c *Client) RemoveNetwork(ctx context.Context, id string) error {
	return c.Delete(ctx, "/api/networks/"+id)
}
