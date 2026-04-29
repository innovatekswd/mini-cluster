// Package manifest defines the MiniCluster package manifest format and validation.
package manifest

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"regexp"
)

var validName = regexp.MustCompile(`^[a-z0-9][a-z0-9\-]{0,63}$`)
var validSemver = regexp.MustCompile(`^\d+\.\d+(\.\d+)?(-[a-zA-Z0-9.\-]+)?$`)

// RuntimeType describes how the package runs
type RuntimeType string

const (
	RuntimeProcess RuntimeType = "process"
	RuntimeDocker  RuntimeType = "docker"
	RuntimeScript  RuntimeType = "script"
)

// PullPolicy for docker runtime
type PullPolicy string

const (
	PullAlways      PullPolicy = "Always"
	PullIfNotPresent PullPolicy = "IfNotPresent"
	PullNever       PullPolicy = "Never"
)

// Runtime describes the execution model
type Runtime struct {
	Type             RuntimeType `json:"type"`
	Command          string      `json:"command"`
	Arguments        string      `json:"arguments"`
	WorkingDirectory string      `json:"workingDirectory"`
	Shell            bool        `json:"shell"`

	// Docker-specific
	Image      string     `json:"image"`
	Tag        string     `json:"tag"`
	Registry   string     `json:"registry"`
	PullPolicy PullPolicy `json:"pullPolicy"`
}

// EnvVar declares an environment variable with optional default
type EnvVar struct {
	Default     string `json:"default"`
	Description string `json:"description"`
	Required    bool   `json:"required"`
}

// HealthCheck describes how to check if the app is alive
type HealthCheck struct {
	Type            string `json:"type"` // http|tcp|command
	Path            string `json:"path"`
	Port            int    `json:"port"`
	IntervalSeconds int    `json:"intervalSeconds"`
	TimeoutSeconds  int    `json:"timeoutSeconds"`
	Retries         int    `json:"retries"`
	StartPeriod     int    `json:"startPeriodSeconds"`
	Command         string `json:"command"`
}

// Port declared by the package
type Port struct {
	Name     string `json:"name"`
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	Expose   bool   `json:"expose"`
}

// Scripts holds lifecycle hook file paths (relative to package root)
type Scripts struct {
	PreInstall  string `json:"preInstall"`
	PostInstall string `json:"postInstall"`
	PreStart    string `json:"preStart"`
	HealthCheck string `json:"healthCheck"`
}

// Resources declares optional resource requirements
type Resources struct {
	MinMemoryMB int `json:"minMemoryMB"`
	MaxMemoryMB int `json:"maxMemoryMB"`
	MinDiskMB   int `json:"minDiskMB"`
}

// MiniclusterMeta holds MiniCluster-specific metadata
type MiniclusterMeta struct {
	MinVersion string `json:"minVersion"`
}

// Manifest is the manifest.json schema
type Manifest struct {
	Name        string            `json:"name"`
	Version     string            `json:"version"`
	Description string            `json:"description"`
	Author      string            `json:"author"`
	Runtime     Runtime           `json:"runtime"`
	Ports       []Port            `json:"ports"`
	HealthCheck *HealthCheck      `json:"healthCheck"`
	Env         map[string]EnvVar `json:"env"`
	Scripts     Scripts           `json:"scripts"`
	Resources   Resources         `json:"resources"`
	Labels      map[string]string `json:"labels"`
	Platform    struct {
		OS   []string `json:"os"`
		Arch []string `json:"arch"`
	} `json:"platform"`
	Minicluster MiniclusterMeta `json:"minicluster"`
}

// Validate checks required fields and format constraints
func (m *Manifest) Validate() error {
	if m.Name == "" {
		return fmt.Errorf("manifest.name is required")
	}
	if !validName.MatchString(m.Name) {
		return fmt.Errorf("manifest.name must be lowercase alphanumeric + hyphens, got %q", m.Name)
	}
	if m.Version == "" {
		return fmt.Errorf("manifest.version is required")
	}
	if !validSemver.MatchString(m.Version) {
		return fmt.Errorf("manifest.version must be semver (e.g. 1.2.3), got %q", m.Version)
	}

	// Runtime type validation
	switch m.Runtime.Type {
	case RuntimeProcess, RuntimeScript:
		if m.Runtime.Command == "" {
			return fmt.Errorf("runtime.command is required for type %q", m.Runtime.Type)
		}
	case RuntimeDocker:
		if m.Runtime.Image == "" {
			return fmt.Errorf("runtime.image is required for type %q", m.Runtime.Type)
		}
	case "":
		return fmt.Errorf("runtime.type is required (process|docker|script)")
	default:
		return fmt.Errorf("runtime.type %q is not supported (process|docker|script)", m.Runtime.Type)
	}

	return nil
}

// DefaultEnvJSON returns environment variables from manifest defaults as a JSON map string.
// Existing envVarsJSON is merged — manifest defaults only fill gaps.
func (m *Manifest) DefaultEnvJSON() string {
	env := make(map[string]string)
	for k, v := range m.Env {
		if v.Default != "" {
			env[k] = v.Default
		}
	}
	if len(env) == 0 {
		return "{}"
	}
	b, _ := json.Marshal(env)
	return string(b)
}

// ParseFromZIP reads and parses manifest.json from an open zip.Reader.
func ParseFromZIP(zr *zip.Reader) (*Manifest, error) {
	for _, f := range zr.File {
		if f.Name == "manifest.json" {
			rc, err := f.Open()
			if err != nil {
				return nil, fmt.Errorf("cannot open manifest.json: %w", err)
			}
			defer rc.Close()
			data, err := io.ReadAll(rc)
			if err != nil {
				return nil, fmt.Errorf("cannot read manifest.json: %w", err)
			}
			var m Manifest
			if err := json.Unmarshal(data, &m); err != nil {
				return nil, fmt.Errorf("manifest.json parse error: %w", err)
			}
			return &m, nil
		}
	}
	return nil, fmt.Errorf("manifest.json not found in package")
}

// ParseFromBytes parses manifest.json from raw ZIP bytes
func ParseFromBytes(data []byte) (*Manifest, error) {
	zr, err := zip.NewReader(bytes.NewReader(data), int64(len(data)))
	if err != nil {
		return nil, fmt.Errorf("invalid ZIP: %w", err)
	}
	return ParseFromZIP(zr)
}
