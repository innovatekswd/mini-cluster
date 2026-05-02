package config

import (
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"os"
	"strings"

	"github.com/spf13/viper"
	"gopkg.in/yaml.v3"
)

type Config struct {
	Port    int    `mapstructure:"port"`
	DataDir string `mapstructure:"data_dir"`

	Authentication   AuthConfig             `mapstructure:"authentication"`
	Cors             CorsConfig             `mapstructure:"cors"`
	LogCleanup       LogCleanupConfig       `mapstructure:"log_cleanup"`
	Explorer         ExplorerConfig         `mapstructure:"explorer"`
	Agent            AgentConfig            `mapstructure:"agent"`
	SignalR          SignalRConfig          `mapstructure:"signalr"`
	ContainerRuntime ContainerRuntimeConfig `mapstructure:"container_runtime"`
	Registry         RegistryConfig         `mapstructure:"registry"`
}

type AuthConfig struct {
	Enabled                     bool   `mapstructure:"enabled"`
	JwtSecret                   string `mapstructure:"jwt_secret"`
	JwtIssuer                   string `mapstructure:"jwt_issuer"`
	JwtAudience                 string `mapstructure:"jwt_audience"`
	AccessTokenExpiryMinutes    int    `mapstructure:"access_token_expiry_minutes"`
	RefreshTokenExpiryDays      int    `mapstructure:"refresh_token_expiry_days"`
	AllowAnonymousInDevelopment bool   `mapstructure:"allow_anonymous_in_development"`
}

type CorsConfig struct {
	AllowedOrigins []string `mapstructure:"allowed_origins"`
}

type LogCleanupConfig struct {
	IntervalMinutes int  `mapstructure:"interval_minutes"`
	RetentionHours  int  `mapstructure:"retention_hours"`
	AutoVacuum      bool `mapstructure:"auto_vacuum"`
}

type ExplorerConfig struct {
	AllowedPaths      []string `mapstructure:"allowed_paths"`
	BlockedPaths      []string `mapstructure:"blocked_paths"`
	MaxUploadSizeMB   int      `mapstructure:"max_upload_size_mb"`
	MaxEditFileSizeMB int      `mapstructure:"max_edit_file_size_mb"`
	EnableTerminal    bool     `mapstructure:"enable_terminal"`
	ShowHiddenFiles   bool     `mapstructure:"show_hidden_files"`
}

type AgentConfig struct {
	Enabled                  bool              `mapstructure:"enabled"`
	ControllerUrl            string            `mapstructure:"controller_url"`
	ApiKey                   string            `mapstructure:"api_key"`
	Name                     string            `mapstructure:"name"`
	HeartbeatIntervalSeconds int               `mapstructure:"heartbeat_interval_seconds"`
	AdvertiseEndpoint        string            `mapstructure:"advertise_endpoint"`
	Labels                   map[string]string `mapstructure:"labels"`
}

type SignalRConfig struct {
	MaxMessageSizeKB   int `mapstructure:"max_message_size_kb"`
	KeepAliveIntervalS int `mapstructure:"keepalive_interval_seconds"`
	ClientTimeoutS     int `mapstructure:"client_timeout_seconds"`
}

type ContainerRuntimeConfig struct {
	Enabled     bool   `mapstructure:"enabled"`
	SocketPath  string `mapstructure:"socket_path"`  // empty = platform default
	StopTimeout int    `mapstructure:"stop_timeout"` // seconds, default 10
}

type RegistryConfig struct {
	StorageDir string `mapstructure:"storage_dir"` // where .mcpkg files are stored
}

// Load reads configuration from file and environment, returning populated Config.
// On first run (no jwt_secret configured) it generates a random secret and
// persists it to config.yaml next to the binary so subsequent runs reuse it.
func Load() (*Config, error) {
	v := viper.New()

	// defaults
	v.SetDefault("port", 5000)
	v.SetDefault("data_dir", "")
	v.SetDefault("authentication.enabled", true)
	v.SetDefault("authentication.jwt_issuer", "MiniCluster")
	v.SetDefault("authentication.jwt_audience", "MiniCluster")
	v.SetDefault("authentication.access_token_expiry_minutes", 30)
	v.SetDefault("authentication.refresh_token_expiry_days", 7)
	v.SetDefault("authentication.allow_anonymous_in_development", false)
	v.SetDefault("cors.allowed_origins", []string{"http://localhost:3000", "http://localhost:5173"})
	v.SetDefault("log_cleanup.interval_minutes", 10)
	v.SetDefault("log_cleanup.retention_hours", 24)
	v.SetDefault("log_cleanup.auto_vacuum", true)
	v.SetDefault("explorer.allowed_paths", []string{"/"})
	v.SetDefault("explorer.blocked_paths", []string{"/etc/shadow", "/etc/passwd", "/root"})
	v.SetDefault("explorer.max_upload_size_mb", 100)
	v.SetDefault("explorer.max_edit_file_size_mb", 10)
	v.SetDefault("explorer.enable_terminal", true)
	v.SetDefault("explorer.show_hidden_files", false)
	v.SetDefault("registry.storage_dir", "registry-packages")
	v.SetDefault("agent.heartbeat_interval_seconds", 30)
	v.SetDefault("signalr.max_message_size_kb", 256)
	v.SetDefault("signalr.keepalive_interval_seconds", 15)
	v.SetDefault("signalr.client_timeout_seconds", 120)

	v.SetConfigName("config")
	v.SetConfigType("yaml")
	v.AddConfigPath(".")
	v.AddConfigPath("/etc/minicluster")

	v.SetEnvPrefix("MINICLUSTER")
	v.SetEnvKeyReplacer(strings.NewReplacer(".", "_"))
	v.AutomaticEnv()

	// config file is optional
	_ = v.ReadInConfig()

	cfg := &Config{}
	if err := v.Unmarshal(cfg); err != nil {
		return nil, err
	}

	// ── First-run: generate JWT secret if none is configured ─────────────────
	// Environment variable MINICLUSTER_AUTHENTICATION_JWT_SECRET takes precedence
	// and is already handled by AutomaticEnv above.  Only generate+persist when
	// the secret is still empty after all sources have been consulted.
	if cfg.Authentication.JwtSecret == "" {
		secret, err := generateSecret(32)
		if err != nil {
			return nil, fmt.Errorf("generate jwt secret: %w", err)
		}
		cfg.Authentication.JwtSecret = secret
		// Persist to config.yaml so subsequent runs use the same key.
		if err := persistSecret(secret); err != nil {
			// Non-fatal: log a warning at runtime; the caller will see the
			// generated secret in cfg and the process will work for this run.
			fmt.Fprintf(os.Stderr, "warning: could not persist jwt_secret to config.yaml: %v\n", err)
		} else {
			fmt.Fprintf(os.Stderr, "info: generated JWT secret and saved to config.yaml (first run)\n")
		}
	}

	return cfg, nil
}

// generateSecret returns a URL-safe base64-encoded random key of byteLen bytes.
func generateSecret(byteLen int) (string, error) {
	b := make([]byte, byteLen)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.URLEncoding.EncodeToString(b), nil
}

// persistSecret reads config.yaml (if it exists), sets authentication.jwt_secret,
// and writes the file back.  It creates the file if it does not exist yet.
func persistSecret(secret string) error {
	const configFile = "config.yaml"

	// Read existing content so we don't overwrite other settings.
	raw := map[string]interface{}{}
	if data, err := os.ReadFile(configFile); err == nil {
		_ = yaml.Unmarshal(data, &raw)
	}

	// Navigate / create the authentication sub-map.
	authSection, _ := raw["authentication"].(map[string]interface{})
	if authSection == nil {
		authSection = map[string]interface{}{}
	}
	authSection["jwt_secret"] = secret
	raw["authentication"] = authSection

	data, err := yaml.Marshal(raw)
	if err != nil {
		return err
	}
	return os.WriteFile(configFile, data, 0o600)
}
