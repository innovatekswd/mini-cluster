// Package config handles CLI configuration management
package config

import (
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/innovatek/minicluster-cli/internal/auth"
	"github.com/spf13/viper"
)

// Config represents the full configuration file structure
type Config struct {
	Server         ServerConfig   `yaml:"server" mapstructure:"server"`
	Auth           AuthConfig     `yaml:"auth" mapstructure:"auth"`
	Output         OutputConfig   `yaml:"output" mapstructure:"output"`
	Defaults       DefaultsConfig `yaml:"defaults" mapstructure:"defaults"`
	Contexts       []Context      `yaml:"contexts" mapstructure:"contexts"`
	CurrentContext string         `yaml:"current-context" mapstructure:"current-context"`
}

// ServerConfig holds server connection settings
type ServerConfig struct {
	URL      string        `yaml:"url" mapstructure:"url"`
	Timeout  time.Duration `yaml:"timeout" mapstructure:"timeout"`
	Insecure bool          `yaml:"insecure" mapstructure:"insecure"`
}

// AuthConfig holds authentication settings
type AuthConfig struct {
	Token    string `yaml:"token" mapstructure:"token"`
	Username string `yaml:"username" mapstructure:"username"`
	Password string `yaml:"password" mapstructure:"password"`
	APIKey   string `yaml:"api-key" mapstructure:"api-key"`
}

// OutputConfig holds output formatting settings
type OutputConfig struct {
	Format     string `yaml:"format" mapstructure:"format"`
	Color      string `yaml:"color" mapstructure:"color"`
	Timestamps bool   `yaml:"timestamps" mapstructure:"timestamps"`
}

// DefaultsConfig holds default behavior settings
type DefaultsConfig struct {
	Wait    bool          `yaml:"wait" mapstructure:"wait"`
	Timeout time.Duration `yaml:"timeout" mapstructure:"timeout"`
	Confirm bool          `yaml:"confirm" mapstructure:"confirm"`
}

// Context represents a named configuration context
type Context struct {
	Name   string       `yaml:"name" mapstructure:"name"`
	Server ServerConfig `yaml:"server" mapstructure:"server"`
	Auth   AuthConfig   `yaml:"auth" mapstructure:"auth"`
}

// ActiveConfig is a flattened configuration for the current context
type ActiveConfig struct {
	Context   string
	ServerURL string
	Token     string
	Timeout   time.Duration
	Insecure  bool
}

// GetActiveConfig returns the effective configuration based on current context
func GetActiveConfig() *ActiveConfig {
	cfg := &ActiveConfig{
		Context:   "default",
		ServerURL: viper.GetString("server.url"),
		Token:     viper.GetString("auth.token"),
		Timeout:   viper.GetDuration("server.timeout"),
		Insecure:  viper.GetBool("server.insecure"),
	}

	// Check if a specific context is requested
	contextName := viper.GetString("context")
	if contextName == "" {
		contextName = viper.GetString("current-context")
	}

	// If we have contexts configured, try to use the specified one
	if contextName != "" {
		var contexts []Context
		if err := viper.UnmarshalKey("contexts", &contexts); err == nil {
			for _, ctx := range contexts {
				if ctx.Name == contextName {
					cfg.Context = ctx.Name
					if ctx.Server.URL != "" {
						cfg.ServerURL = expandEnv(ctx.Server.URL)
					}
					if ctx.Auth.Token != "" {
						cfg.Token = expandEnv(ctx.Auth.Token)
					}
					if ctx.Server.Timeout > 0 {
						cfg.Timeout = ctx.Server.Timeout
					}
					cfg.Insecure = ctx.Server.Insecure
					break
				}
			}
		}
	}

	// Expand environment variables in token
	cfg.Token = expandEnv(cfg.Token)

	// If no token from config, try to load from credentials store
	if cfg.Token == "" && cfg.ServerURL != "" {
		if store, err := auth.NewStore(); err == nil {
			if creds, err := store.Load(cfg.ServerURL); err == nil {
				cfg.Token = creds.Token
			}
		}
	}

	// Ensure timeout has a default
	if cfg.Timeout == 0 {
		cfg.Timeout = 30 * time.Second
	}

	return cfg
}

// expandEnv expands ${VAR} and $VAR in strings
func expandEnv(s string) string {
	if strings.Contains(s, "${") || strings.Contains(s, "$") {
		return os.ExpandEnv(s)
	}
	return s
}

// ConfigDir returns the path to the config directory
func ConfigDir() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ".minicluster"
	}
	return filepath.Join(home, ".minicluster")
}

// ConfigPath returns the path to the config file
func ConfigPath() string {
	return filepath.Join(ConfigDir(), "config.yaml")
}

// EnsureConfigDir creates the config directory if it doesn't exist
func EnsureConfigDir() error {
	dir := ConfigDir()
	return os.MkdirAll(dir, 0700)
}

// DefaultConfig returns a default configuration
func DefaultConfig() *Config {
	return &Config{
		Server: ServerConfig{
			URL:     "http://localhost:5147",
			Timeout: 30 * time.Second,
		},
		Output: OutputConfig{
			Format: "table",
			Color:  "auto",
		},
		Defaults: DefaultsConfig{
			Wait:    true,
			Timeout: 5 * time.Minute,
			Confirm: true,
		},
		CurrentContext: "local",
		Contexts: []Context{
			{
				Name: "local",
				Server: ServerConfig{
					URL: "http://localhost:5147",
				},
			},
		},
	}
}
