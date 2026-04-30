package services

import (
	"context"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"

	dockertypes "github.com/docker/docker/api/types"
	"github.com/docker/docker/api/types/container"
	"github.com/docker/docker/api/types/filters"
	"github.com/docker/docker/api/types/image"
	"github.com/docker/docker/api/types/network"
	dockervolume "github.com/docker/docker/api/types/volume"
	"github.com/docker/docker/client"
	"github.com/docker/go-connections/nat"
	"github.com/innovatek/minicluster/internal/models"
)

// ─── Types ──────────────────────────────────────────────────────────────────

// ContainerInfo is a minimal runtime snapshot of a container.
type ContainerInfo struct {
	ID         string
	Name       string
	State      string // running | exited | created | paused | removing | dead
	ExitCode   int
	StartedAt  time.Time
	FinishedAt *time.Time
	ImageID    string
}

// ContainerStats holds a single resource-usage snapshot.
type ContainerStats struct {
	CPUPercent  float64
	MemoryUsage int64
	MemoryLimit int64
	NetworkRxB  int64
	NetworkTxB  int64
	BlockReadB  int64
	BlockWriteB int64
}

// ImageInfo describes a locally available image.
type ImageInfo struct {
	ID          string
	RepoTags    []string
	SizeBytes   int64
	CreatedUnix int64
}

// RuntimeInfo describes the Docker/Podman daemon.
type RuntimeInfo struct {
	Name         string // "Docker" | "Podman"
	Version      string
	APIVersion   string
	OSType       string
	Architecture string
}

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

// ExecResult holds the output of a container exec.
type ExecResult struct {
	ExitCode int
	Stdout   string
	Stderr   string
}

// ─── Interface ──────────────────────────────────────────────────────────────

// IContainerService is the execution-driver contract. Both Docker and
// Podman (which exposes a Docker-compatible REST API) satisfy it.
type IContainerService interface {
	// Image management
	PullImage(ctx context.Context, image string, onProgress func(string)) error
	ImageExists(ctx context.Context, image string) (bool, error)
	ListImages(ctx context.Context) ([]ImageInfo, error)
	RemoveImage(ctx context.Context, imageName string, force bool) error

	// Container lifecycle
	CreateContainer(ctx context.Context, cfg *models.ContainerConfig, envVars map[string]string) (string, error)
	StartContainer(ctx context.Context, containerID string) error
	StopContainer(ctx context.Context, containerID string, timeoutSecs int) error
	RemoveContainer(ctx context.Context, containerID string, force bool) error
	WaitContainer(ctx context.Context, containerID string) (int, error)

	// Observation
	GetStatus(ctx context.Context, containerID string) (*ContainerInfo, error)
	GetStats(ctx context.Context, containerID string) (*ContainerStats, error)
	StreamLogs(ctx context.Context, containerID string, follow bool) (io.ReadCloser, error)
	Exec(ctx context.Context, containerID string, cmd []string) (*ExecResult, error)

	// Volume management
	ListVolumes(ctx context.Context) ([]VolumeInfo, error)
	CreateVolume(ctx context.Context, name string, labels map[string]string) (*VolumeInfo, error)
	RemoveVolume(ctx context.Context, name string, force bool) error

	// Network management
	ListNetworks(ctx context.Context) ([]NetworkInfo, error)
	CreateNetwork(ctx context.Context, name string, driver string, labels map[string]string) (*NetworkInfo, error)
	RemoveNetwork(ctx context.Context, networkID string) error

	// Runtime info
	Ping(ctx context.Context) error
	Info(ctx context.Context) (*RuntimeInfo, error)
}

// ─── Docker implementation ──────────────────────────────────────────────────

// DockerService implements IContainerService using the Docker SDK.
// It is also compatible with Podman when Podman's Docker-compatible
// socket is configured.
type DockerService struct {
	cli *client.Client
}

// NewDockerService creates a DockerService. socketPath is optional;
// pass "" to use the platform default socket.
func NewDockerService(socketPath string) (*DockerService, error) {
	opts := []client.Opt{
		client.WithAPIVersionNegotiation(),
	}
	if socketPath != "" {
		opts = append(opts, client.WithHost("unix://"+socketPath))
	}
	cli, err := client.NewClientWithOpts(opts...)
	if err != nil {
		return nil, fmt.Errorf("create docker client: %w", err)
	}
	return &DockerService{cli: cli}, nil
}

// Ping checks connectivity to the daemon.
func (d *DockerService) Ping(ctx context.Context) error {
	_, err := d.cli.Ping(ctx)
	return err
}

// Info returns daemon version information.
func (d *DockerService) Info(ctx context.Context) (*RuntimeInfo, error) {
	v, err := d.cli.ServerVersion(ctx)
	if err != nil {
		return nil, err
	}
	info, err := d.cli.Info(ctx)
	if err != nil {
		return nil, err
	}
	name := "Docker"
	if strings.Contains(strings.ToLower(v.Version), "podman") {
		name = "Podman"
	}
	return &RuntimeInfo{
		Name:         name,
		Version:      v.Version,
		APIVersion:   v.APIVersion,
		OSType:       info.OSType,
		Architecture: info.Architecture,
	}, nil
}

// PullImage pulls an image, streaming progress lines to onProgress.
func (d *DockerService) PullImage(ctx context.Context, imageName string, onProgress func(string)) error {
	reader, err := d.cli.ImagePull(ctx, imageName, image.PullOptions{})
	if err != nil {
		return fmt.Errorf("pull image %s: %w", imageName, err)
	}
	defer reader.Close()

	decoder := json.NewDecoder(reader)
	for {
		var msg map[string]any
		if err := decoder.Decode(&msg); err != nil {
			if err == io.EOF {
				break
			}
			return err
		}
		if status, ok := msg["status"].(string); ok {
			progress, _ := msg["progress"].(string)
			line := status
			if progress != "" {
				line = status + " " + progress
			}
			if onProgress != nil {
				onProgress(line)
			}
		}
		if errMsg, ok := msg["error"].(string); ok {
			return fmt.Errorf("pull error: %s", errMsg)
		}
	}
	return nil
}

// ImageExists returns true if the image is already present locally.
func (d *DockerService) ImageExists(ctx context.Context, imageName string) (bool, error) {
	_, _, err := d.cli.ImageInspectWithRaw(ctx, imageName)
	if err != nil {
		if client.IsErrNotFound(err) {
			return false, nil
		}
		return false, err
	}
	return true, nil
}

// ListImages returns all locally available images.
func (d *DockerService) ListImages(ctx context.Context) ([]ImageInfo, error) {
	imgs, err := d.cli.ImageList(ctx, image.ListOptions{})
	if err != nil {
		return nil, err
	}
	out := make([]ImageInfo, 0, len(imgs))
	for _, img := range imgs {
		out = append(out, ImageInfo{
			ID:          img.ID,
			RepoTags:    img.RepoTags,
			SizeBytes:   img.Size,
			CreatedUnix: img.Created,
		})
	}
	return out, nil
}

// RemoveImage removes a local image.
func (d *DockerService) RemoveImage(ctx context.Context, imageName string, force bool) error {
	_, err := d.cli.ImageRemove(ctx, imageName, image.RemoveOptions{Force: force, PruneChildren: false})
	return err
}

// CreateContainer creates (but does not start) a container from ContainerConfig.
// It returns the new container's ID.
func (d *DockerService) CreateContainer(ctx context.Context, cfg *models.ContainerConfig, envVars map[string]string) (string, error) {
	imageRef := cfg.Image
	if cfg.Tag != "" && cfg.Tag != "latest" {
		imageRef = cfg.Image + ":" + cfg.Tag
	} else if cfg.Tag == "latest" {
		imageRef = cfg.Image + ":latest"
	}

	// Build env slice
	env := make([]string, 0, len(envVars))
	for k, v := range envVars {
		env = append(env, k+"="+v)
	}

	// Parse port bindings
	portBindings := nat.PortMap{}
	exposedPorts := nat.PortSet{}
	var portMappings []models.PortMapping
	if cfg.Ports != "" {
		_ = json.Unmarshal([]byte(cfg.Ports), &portMappings)
	}
	for _, pm := range portMappings {
		proto := pm.Protocol
		if proto == "" {
			proto = "tcp"
		}
		containerPort := nat.Port(fmt.Sprintf("%d/%s", pm.ContainerPort, proto))
		exposedPorts[containerPort] = struct{}{}
		hostIP := pm.HostIP
		if hostIP == "" {
			hostIP = "0.0.0.0"
		}
		portBindings[containerPort] = append(portBindings[containerPort], nat.PortBinding{
			HostIP:   hostIP,
			HostPort: fmt.Sprintf("%d", pm.HostPort),
		})
	}

	// Parse volume mounts
	var volumeMounts []models.VolumeMount
	if cfg.Volumes != "" {
		_ = json.Unmarshal([]byte(cfg.Volumes), &volumeMounts)
	}
	binds := make([]string, 0, len(volumeMounts))
	for _, vm := range volumeMounts {
		bind := vm.Source + ":" + vm.Target
		if vm.ReadOnly {
			bind += ":ro"
		}
		binds = append(binds, bind)
	}

	// Parse labels
	labels := map[string]string{"managed-by": "minicluster"}
	if cfg.Labels != "" {
		_ = json.Unmarshal([]byte(cfg.Labels), &labels)
		labels["managed-by"] = "minicluster"
	}

	containerName := cfg.ContainerName

	var resources container.Resources
	if cfg.MemoryLimitBytes != nil {
		resources.Memory = *cfg.MemoryLimitBytes
	}
	if cfg.CpuLimit != nil {
		resources.NanoCPUs = int64(*cfg.CpuLimit * 1e9)
	}

	hostCfg := &container.HostConfig{
		PortBindings:   portBindings,
		Binds:          binds,
		NetworkMode:    container.NetworkMode(cfg.NetworkMode),
		Privileged:     cfg.Privileged,
		ReadonlyRootfs: cfg.ReadOnly,
		Resources:      resources,
		RestartPolicy:  container.RestartPolicy{Name: "no"}, // MiniCluster manages restarts
	}

	networkCfg := &network.NetworkingConfig{}

	resp, err := d.cli.ContainerCreate(ctx,
		&container.Config{
			Image:        imageRef,
			Env:          env,
			ExposedPorts: exposedPorts,
			Labels:       labels,
			User:         cfg.User,
			WorkingDir:   cfg.WorkingDir,
		},
		hostCfg,
		networkCfg,
		nil,
		containerName,
	)
	if err != nil {
		return "", fmt.Errorf("create container: %w", err)
	}
	return resp.ID, nil
}

// StartContainer starts an already-created container.
func (d *DockerService) StartContainer(ctx context.Context, containerID string) error {
	return d.cli.ContainerStart(ctx, containerID, container.StartOptions{})
}

// StopContainer sends SIGTERM then waits up to timeoutSecs before SIGKILL.
func (d *DockerService) StopContainer(ctx context.Context, containerID string, timeoutSecs int) error {
	timeout := timeoutSecs
	return d.cli.ContainerStop(ctx, containerID, container.StopOptions{Timeout: &timeout})
}

// RemoveContainer removes a stopped (or force-removes a running) container.
func (d *DockerService) RemoveContainer(ctx context.Context, containerID string, force bool) error {
	return d.cli.ContainerRemove(ctx, containerID, container.RemoveOptions{Force: force})
}

// WaitContainer blocks until the container exits and returns its exit code.
func (d *DockerService) WaitContainer(ctx context.Context, containerID string) (int, error) {
	statusCh, errCh := d.cli.ContainerWait(ctx, containerID, container.WaitConditionNotRunning)
	select {
	case err := <-errCh:
		return -1, err
	case status := <-statusCh:
		return int(status.StatusCode), nil
	case <-ctx.Done():
		return -1, ctx.Err()
	}
}

// GetStatus returns a lightweight runtime snapshot.
func (d *DockerService) GetStatus(ctx context.Context, containerID string) (*ContainerInfo, error) {
	info, err := d.cli.ContainerInspect(ctx, containerID)
	if err != nil {
		if client.IsErrNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	ci := &ContainerInfo{
		ID:      info.ID,
		Name:    strings.TrimPrefix(info.Name, "/"),
		State:   info.State.Status,
		ImageID: info.Image,
	}
	if info.State != nil {
		ci.ExitCode = info.State.ExitCode
		if t, err := time.Parse(time.RFC3339Nano, info.State.StartedAt); err == nil {
			ci.StartedAt = t
		}
		if info.State.FinishedAt != "" && info.State.FinishedAt != "0001-01-01T00:00:00Z" {
			if t, err := time.Parse(time.RFC3339Nano, info.State.FinishedAt); err == nil {
				ci.FinishedAt = &t
			}
		}
	}
	return ci, nil
}

// GetStats returns a single resource-usage snapshot (non-streaming).
func (d *DockerService) GetStats(ctx context.Context, containerID string) (*ContainerStats, error) {
	resp, err := d.cli.ContainerStats(ctx, containerID, false)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var raw dockertypes.StatsJSON
	if err := json.NewDecoder(resp.Body).Decode(&raw); err != nil {
		return nil, err
	}

	// CPU %
	cpuDelta := float64(raw.CPUStats.CPUUsage.TotalUsage) - float64(raw.PreCPUStats.CPUUsage.TotalUsage)
	sysDelta := float64(raw.CPUStats.SystemUsage) - float64(raw.PreCPUStats.SystemUsage)
	numCPU := float64(len(raw.CPUStats.CPUUsage.PercpuUsage))
	if numCPU == 0 {
		numCPU = 1
	}
	var cpuPct float64
	if sysDelta > 0 {
		cpuPct = (cpuDelta / sysDelta) * numCPU * 100.0
	}

	// Network I/O
	var rxBytes, txBytes int64
	for _, n := range raw.Networks {
		rxBytes += int64(n.RxBytes)
		txBytes += int64(n.TxBytes)
	}

	// Block I/O
	var blkRead, blkWrite int64
	for _, bio := range raw.BlkioStats.IoServiceBytesRecursive {
		switch bio.Op {
		case "Read":
			blkRead += int64(bio.Value)
		case "Write":
			blkWrite += int64(bio.Value)
		}
	}

	return &ContainerStats{
		CPUPercent:  cpuPct,
		MemoryUsage: int64(raw.MemoryStats.Usage),
		MemoryLimit: int64(raw.MemoryStats.Limit),
		NetworkRxB:  rxBytes,
		NetworkTxB:  txBytes,
		BlockReadB:  blkRead,
		BlockWriteB: blkWrite,
	}, nil
}

// StreamLogs returns a ReadCloser of multiplexed container log output.
// The caller is responsible for closing the reader.
// Use ReadDockerLogStream to parse the Docker multiplexing header.
func (d *DockerService) StreamLogs(ctx context.Context, containerID string, follow bool) (io.ReadCloser, error) {
	return d.cli.ContainerLogs(ctx, containerID, container.LogsOptions{
		ShowStdout: true,
		ShowStderr: true,
		Follow:     follow,
		Timestamps: false,
	})
}

// Exec runs a command inside a running container and returns its output.
func (d *DockerService) Exec(ctx context.Context, containerID string, cmd []string) (*ExecResult, error) {
	execID, err := d.cli.ContainerExecCreate(ctx, containerID, dockertypes.ExecConfig{
		Cmd:          cmd,
		AttachStdout: true,
		AttachStderr: true,
	})
	if err != nil {
		return nil, fmt.Errorf("exec create: %w", err)
	}

	resp, err := d.cli.ContainerExecAttach(ctx, execID.ID, dockertypes.ExecStartCheck{})
	if err != nil {
		return nil, fmt.Errorf("exec attach: %w", err)
	}
	defer resp.Close()

	var stdout, stderr strings.Builder
	if _, err := io.Copy(io.MultiWriter(&stdout, &stderr), resp.Reader); err != nil && err != io.EOF {
		return nil, err
	}

	inspect, err := d.cli.ContainerExecInspect(ctx, execID.ID)
	if err != nil {
		return nil, err
	}

	return &ExecResult{
		ExitCode: inspect.ExitCode,
		Stdout:   stdout.String(),
		Stderr:   stderr.String(),
	}, nil
}

// ─── Volume management ──────────────────────────────────────────────────────

func (d *DockerService) ListVolumes(ctx context.Context) ([]VolumeInfo, error) {
	resp, err := d.cli.VolumeList(ctx, dockervolume.ListOptions{})
	if err != nil {
		return nil, err
	}
	volumes := make([]VolumeInfo, len(resp.Volumes))
	for i, v := range resp.Volumes {
		volumes[i] = VolumeInfo{
			Name:       v.Name,
			Driver:     v.Driver,
			Mountpoint: v.Mountpoint,
			Labels:     v.Labels,
			CreatedAt:  v.CreatedAt,
		}
	}
	return volumes, nil
}

func (d *DockerService) CreateVolume(ctx context.Context, name string, labels map[string]string) (*VolumeInfo, error) {
	v, err := d.cli.VolumeCreate(ctx, dockervolume.CreateOptions{
		Name:   name,
		Labels: labels,
	})
	if err != nil {
		return nil, err
	}
	return &VolumeInfo{
		Name:       v.Name,
		Driver:     v.Driver,
		Mountpoint: v.Mountpoint,
		Labels:     v.Labels,
		CreatedAt:  v.CreatedAt,
	}, nil
}

func (d *DockerService) RemoveVolume(ctx context.Context, name string, force bool) error {
	return d.cli.VolumeRemove(ctx, name, force)
}

// ─── Network management ─────────────────────────────────────────────────────

func (d *DockerService) ListNetworks(ctx context.Context) ([]NetworkInfo, error) {
	nets, err := d.cli.NetworkList(ctx, dockertypes.NetworkListOptions{})
	if err != nil {
		return nil, err
	}
	result := make([]NetworkInfo, len(nets))
	for i, n := range nets {
		result[i] = NetworkInfo{
			ID:     n.ID,
			Name:   n.Name,
			Driver: n.Driver,
			Scope:  n.Scope,
			Labels: n.Labels,
		}
	}
	return result, nil
}

func (d *DockerService) CreateNetwork(ctx context.Context, name string, driver string, labels map[string]string) (*NetworkInfo, error) {
	if driver == "" {
		driver = "bridge"
	}
	resp, err := d.cli.NetworkCreate(ctx, name, dockertypes.NetworkCreate{
		Driver: driver,
		Labels: labels,
	})
	if err != nil {
		return nil, err
	}
	return &NetworkInfo{
		ID:     resp.ID,
		Name:   name,
		Driver: driver,
		Labels: labels,
	}, nil
}

func (d *DockerService) RemoveNetwork(ctx context.Context, networkID string) error {
	return d.cli.NetworkRemove(ctx, networkID)
}

// ─── Helper: Docker log stream demultiplexer ────────────────────────────────

// DockerLogFrame is a single frame from the Docker log multiplexing protocol.
type DockerLogFrame struct {
	IsStderr bool
	Data     []byte
}

// ReadDockerLogStream reads frames from a Docker multiplexed log stream.
// Docker prepends each line with an 8-byte header:
//
//	[0]   stream type: 1=stdout, 2=stderr
//	[1-3] reserved (zeros)
//	[4-7] uint32 big-endian payload size
func ReadDockerLogStream(r io.Reader) (DockerLogFrame, error) {
	header := make([]byte, 8)
	if _, err := io.ReadFull(r, header); err != nil {
		return DockerLogFrame{}, err
	}
	streamType := header[0]
	size := binary.BigEndian.Uint32(header[4:8])
	data := make([]byte, size)
	if _, err := io.ReadFull(r, data); err != nil {
		return DockerLogFrame{}, err
	}
	return DockerLogFrame{
		IsStderr: streamType == 2,
		Data:     data,
	}, nil
}

// ─── Auto-detect helper ─────────────────────────────────────────────────────

// filterArgs is a helper to avoid an unused import warning on the filters package.
var _ = filters.NewArgs
