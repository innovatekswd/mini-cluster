package config

import (
	"strings"

	"github.com/spf13/viper"
)

type Config struct {
	Port    int    `mapstructure:"port"`
	DataDir string `mapstructure:"data_dir"`

	Authentication AuthConfig       `mapstructure:"authentication"`
	Cors           CorsConfig       `mapstructure:"cors"`
	LogCleanup     LogCleanupConfig `mapstructure:"log_cleanup"`
	Explorer       ExplorerConfig   `mapstructure:"explorer"`
	Agent          AgentConfig      `mapstructure:"agent"`
	SignalR        SignalRConfig    `mapstructure:"signalr"`
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

// Load reads configuration from file and environment, returning populated Config.
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
	return cfg, nil
}
