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
	PullAlways       PullPolicy = "Always"
	PullIfNotPresent PullPolicy = "IfNotPresent"
	PullNever        PullPolicy = "Never"
)

// ComponentType is the type of a component in a v2 manifest
type ComponentType string

const (
	ComponentContainer ComponentType = "container"
	ComponentProcess   ComponentType = "process"
)

// DependsOnCondition describes what state a dependency must reach
type DependsOnCondition string

const (
	ConditionRunning  DependsOnCondition = "running"
	ConditionHealthy  DependsOnCondition = "healthy"
	ConditionComplete DependsOnCondition = "complete"
)

// DependsOn expresses a startup dependency on another component
type DependsOn struct {
	Component string             `json:"component"`
	Condition DependsOnCondition `json:"condition"`
}

// AcquireTarget describes how to obtain a binary on a specific platform
type AcquireTarget struct {
	Provider   string            `json:"provider"`
	Package    string            `json:"package"`
	Version    string            `json:"version"`
	Repository string            `json:"repository"`
	Key        string            `json:"key"`
	Tap        string            `json:"tap"`
	Formula    string            `json:"formula"`
	Checksum   string            `json:"checksum"`
	URLs       map[string]string `json:"urls"`
	Checksums  map[string]string `json:"checksums"`
	Extract    struct {
		Binary string `json:"binary"`
	} `json:"extract"`
}

// AcquireConfig maps platform identifiers to acquisition strategies
type AcquireConfig struct {
	Windows  *AcquireTarget `json:"windows"`
	LinuxDeb *AcquireTarget `json:"linux-deb"`
	LinuxRPM *AcquireTarget `json:"linux-rpm"`
	Macos    *AcquireTarget `json:"macos"`
	Direct   *AcquireTarget `json:"direct"`
}

// ComponentEnvVar is an env var declaration in a v2 component
type ComponentEnvVar struct {
	Default       string `json:"default"`
	Description   string `json:"description"`
	Required      bool   `json:"required"`
	Secret        bool   `json:"secret"`
	FromComponent string `json:"fromComponent"`
	EnvVar        string `json:"envVar"`
}

// ComponentPort declares a port mapping for a component
type ComponentPort struct {
	Host      int    `json:"host"`
	Container int    `json:"container"`
	Protocol  string `json:"protocol"`
	Expose    bool   `json:"expose"`
}

// ComponentVolume declares a volume mount for a component
type ComponentVolume struct {
	Type     string `json:"type"` // volume | bind | tmpfs
	Source   string `json:"source"`
	Target   string `json:"target"`
	ReadOnly bool   `json:"readOnly"`
}

// ComponentHealthCheck describes a per-component health probe
type ComponentHealthCheck struct {
	Type     string   `json:"type"` // http | tcp | exec
	Path     string   `json:"path"`
	Port     int      `json:"port"`
	Command  []string `json:"command"`
	Interval string   `json:"interval"` // e.g. "10s"
	Timeout  string   `json:"timeout"`
	Retries  int      `json:"retries"`
}

// Component is a single deployable unit in a v2 manifest
type Component struct {
	Name          string               `json:"name"`
	Type          ComponentType        `json:"type"`
	// container fields
	Image      string     `json:"image"`
	Registry   string     `json:"registry"`
	PullPolicy PullPolicy `json:"pullPolicy"`
	// process fields
	Bundled    bool          `json:"bundled"`
	BinaryPath string        `json:"binaryPath"`
	Acquire    *AcquireConfig `json:"acquire"`
	Command    string        `json:"command"`
	Arguments  string        `json:"arguments"`
	// common
	Env           map[string]ComponentEnvVar `json:"env"`
	Ports         []ComponentPort            `json:"ports"`
	Volumes       []ComponentVolume          `json:"volumes"`
	HealthCheck   *ComponentHealthCheck      `json:"healthCheck"`
	DependsOn     []DependsOn               `json:"dependsOn"`
	RestartPolicy string                     `json:"restartPolicy"`
}

// Runtime describes the execution model (v1 only)
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

// VolumeDeclaration declares a named volume used by the package
type VolumeDeclaration struct {
	Name        string `json:"name"`
	Description string `json:"description"`
}

// Manifest is the manifest.json schema.
// SchemaVersion "2.0" uses Components; anything else (or absent) is v1 with Runtime.
type Manifest struct {
	SchemaVersion string `json:"schemaVersion"`
	Name          string `json:"name"`
	Version       string `json:"version"`
	Description   string `json:"description"`
	Author        string `json:"author"`
	License       string `json:"license"`
	Tags          []string `json:"tags"`

	// v1 fields
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

	// v2 fields
	Components []Component         `json:"components"`
	Volumes    []VolumeDeclaration `json:"volumes"`
}

// IsV2 returns true when the manifest uses the v2 components schema.
func (m *Manifest) IsV2() bool {
	return m.SchemaVersion == "2.0" || len(m.Components) > 0
}

// Validate checks required fields and format constraints.
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

	if m.IsV2() {
		return m.validateV2()
	}
	return m.validateV1()
}

func (m *Manifest) validateV1() error {
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

func (m *Manifest) validateV2() error {
	if len(m.Components) == 0 {
		return fmt.Errorf("schemaVersion 2.0 requires at least one component")
	}
	names := make(map[string]bool, len(m.Components))
	for i, c := range m.Components {
		if c.Name == "" {
			return fmt.Errorf("components[%d].name is required", i)
		}
		if names[c.Name] {
			return fmt.Errorf("components[%d].name %q is not unique", i, c.Name)
		}
		names[c.Name] = true
		switch c.Type {
		case ComponentContainer:
			if c.Image == "" {
				return fmt.Errorf("components[%q].image is required for type container", c.Name)
			}
		case ComponentProcess:
			if !c.Bundled && c.Acquire == nil && c.Command == "" {
				return fmt.Errorf("components[%q]: process component must have bundled=true, acquire, or command", c.Name)
			}
		case "":
			return fmt.Errorf("components[%q].type is required (container|process)", c.Name)
		default:
			return fmt.Errorf("components[%q].type %q is not supported", c.Name, c.Type)
		}
	}
	// Validate dependsOn references
	for _, c := range m.Components {
		for _, dep := range c.DependsOn {
			if !names[dep.Component] {
				return fmt.Errorf("components[%q].dependsOn references unknown component %q", c.Name, dep.Component)
			}
		}
	}
	// Cycle detection
	if err := detectCycles(m.Components); err != nil {
		return err
	}
	return nil
}

// detectCycles returns an error if the dependsOn graph has a cycle.
func detectCycles(components []Component) error {
	type color int
	const (
		white color = iota
		gray
		black
	)
	idx := make(map[string]int, len(components))
	for i, c := range components {
		idx[c.Name] = i
	}
	colors := make([]color, len(components))

	var dfs func(name string) error
	dfs = func(name string) error {
		i, ok := idx[name]
		if !ok {
			return nil
		}
		if colors[i] == gray {
			return fmt.Errorf("dependsOn cycle detected at component %q", name)
		}
		if colors[i] == black {
			return nil
		}
		colors[i] = gray
		for _, dep := range components[i].DependsOn {
			if err := dfs(dep.Component); err != nil {
				return err
			}
		}
		colors[i] = black
		return nil
	}
	for _, c := range components {
		if err := dfs(c.Name); err != nil {
			return err
		}
	}
	return nil
}

// TopologicalOrder returns component names in start order (dependencies first).
// Components at the same depth can start in parallel.
func (m *Manifest) TopologicalOrder() ([][]string, error) {
	if !m.IsV2() {
		return [][]string{{m.Name}}, nil
	}
	// Kahn's algorithm
	inDegree := make(map[string]int, len(m.Components))
	edges := make(map[string][]string, len(m.Components))
	for _, c := range m.Components {
		if _, ok := inDegree[c.Name]; !ok {
			inDegree[c.Name] = 0
		}
		for _, dep := range c.DependsOn {
			edges[dep.Component] = append(edges[dep.Component], c.Name)
			inDegree[c.Name]++
		}
	}
	var levels [][]string
	for len(inDegree) > 0 {
		var level []string
		for name, deg := range inDegree {
			if deg == 0 {
				level = append(level, name)
			}
		}
		if len(level) == 0 {
			return nil, fmt.Errorf("dependency cycle detected")
		}
		levels = append(levels, level)
		for _, name := range level {
			delete(inDegree, name)
			for _, next := range edges[name] {
				inDegree[next]--
			}
		}
	}
	return levels, nil
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
