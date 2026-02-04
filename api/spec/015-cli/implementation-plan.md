# MiniCluster CLI: Go Implementation Plan

> **Status:** 📋 Ready for Implementation  
> **Language:** Go 1.21+  
> **Estimated Effort:** 6-8 weeks  
> **Date:** 2026-02-04

---

## Project Setup

### Repository Structure

```
minicluster-cli/                    # New repository or subfolder
├── .github/
│   └── workflows/
│       ├── build.yml              # Build & test on PR
│       ├── release.yml            # Release binaries on tag
│       └── lint.yml               # Linting
├── cmd/
│   └── mc/
│       └── main.go                # Entry point
├── internal/
│   ├── api/                       # API client (generated + custom)
│   ├── auth/                      # Authentication handling
│   ├── cmd/                       # Command definitions
│   ├── config/                    # Configuration management
│   ├── output/                    # Output formatters
│   └── version/                   # Version info
├── pkg/
│   └── types/                     # Generated types from OpenAPI
├── scripts/
│   ├── generate-client.sh         # OpenAPI code generation
│   └── install.sh                 # Installation script
├── .golangci.yml                  # Linter config
├── .goreleaser.yml                # Release automation
├── go.mod
├── go.sum
├── Makefile
└── README.md
```

### Initial Setup Commands

```bash
# Create project
mkdir minicluster-cli && cd minicluster-cli
go mod init github.com/innovatek/minicluster-cli

# Install dependencies
go get github.com/spf13/cobra@latest
go get github.com/spf13/viper@latest
go get github.com/olekukonko/tablewriter@latest
go get github.com/fatih/color@latest
go get github.com/briandowns/spinner@latest
go get gopkg.in/yaml.v3@latest
go get github.com/zalando/go-keyring@latest  # Secure credential storage

# Dev dependencies
go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest
go install github.com/goreleaser/goreleaser@latest
```

---

## Phase 1: Foundation (Week 1-2)

### Goal
Working CLI skeleton with basic commands, configuration, and authentication.

### Tasks

#### 1.1 Project Scaffolding (Day 1-2)

```
□ Create repository structure
□ Initialize go.mod with dependencies
□ Create Makefile with targets:
  □ build, build-all, test, lint, clean
  □ generate (OpenAPI client generation)
□ Setup .golangci.yml for linting
□ Setup .goreleaser.yml for releases
□ Create basic README.md
```

**Makefile:**
```makefile
VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
LDFLAGS := -X github.com/innovatek/minicluster-cli/internal/version.Version=$(VERSION)
LDFLAGS += -X github.com/innovatek/minicluster-cli/internal/version.BuildTime=$(shell date -u +%Y-%m-%dT%H:%M:%SZ)

.PHONY: build
build:
	go build -ldflags "$(LDFLAGS)" -o bin/mc ./cmd/mc

.PHONY: build-all
build-all:
	GOOS=linux   GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/mc-linux-amd64 ./cmd/mc
	GOOS=linux   GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/mc-linux-arm64 ./cmd/mc
	GOOS=darwin  GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/mc-darwin-amd64 ./cmd/mc
	GOOS=darwin  GOARCH=arm64 go build -ldflags "$(LDFLAGS)" -o dist/mc-darwin-arm64 ./cmd/mc
	GOOS=windows GOARCH=amd64 go build -ldflags "$(LDFLAGS)" -o dist/mc-windows-amd64.exe ./cmd/mc

.PHONY: test
test:
	go test -v -race ./...

.PHONY: lint
lint:
	golangci-lint run

.PHONY: generate
generate:
	./scripts/generate-client.sh

.PHONY: clean
clean:
	rm -rf bin/ dist/
```

#### 1.2 Root Command & Global Flags (Day 2-3)

```
□ Create cmd/mc/main.go entry point
□ Create internal/cmd/root.go with:
  □ --server (-s) flag
  □ --token (-t) flag
  □ --config (-c) flag
  □ --output (-o) flag [table|json|yaml|quiet]
  □ --context flag
  □ --no-color flag
  □ --verbose (-v) flag
  □ --debug flag
  □ --timeout flag
  □ --yes (-y) flag
□ Wire up Viper for config file loading
□ Environment variable binding (MC_*)
```

**internal/cmd/root.go:**
```go
package cmd

import (
    "github.com/spf13/cobra"
    "github.com/spf13/viper"
)

var rootCmd = &cobra.Command{
    Use:   "mc",
    Short: "MiniCluster CLI - manage apps and services",
    Long:  `MiniCluster CLI enables DevOps automation, CI/CD integration,
and zero-downtime deployments from the terminal.`,
    PersistentPreRunE: initConfig,
}

func Execute() error {
    return rootCmd.Execute()
}

func init() {
    // Global flags
    rootCmd.PersistentFlags().StringP("server", "s", "", "MiniCluster API server URL")
    rootCmd.PersistentFlags().StringP("token", "t", "", "Authentication token")
    rootCmd.PersistentFlags().StringP("config", "c", "", "Config file path")
    rootCmd.PersistentFlags().StringP("output", "o", "table", "Output format (table|json|yaml|quiet)")
    rootCmd.PersistentFlags().String("context", "", "Context to use")
    rootCmd.PersistentFlags().Bool("no-color", false, "Disable colored output")
    rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")
    rootCmd.PersistentFlags().Bool("debug", false, "Debug mode (shows API calls)")
    rootCmd.PersistentFlags().Duration("timeout", 30*time.Second, "Request timeout")
    rootCmd.PersistentFlags().BoolP("yes", "y", false, "Skip confirmation prompts")
    
    // Bind to viper
    viper.BindPFlag("server.url", rootCmd.PersistentFlags().Lookup("server"))
    viper.BindPFlag("auth.token", rootCmd.PersistentFlags().Lookup("token"))
    viper.BindPFlag("output.format", rootCmd.PersistentFlags().Lookup("output"))
    // ... etc
    
    // Environment variables
    viper.SetEnvPrefix("MC")
    viper.AutomaticEnv()
}
```

#### 1.3 Configuration Management (Day 3-4)

```
□ Create internal/config/config.go
  □ Load config from ~/.minicluster/config.yaml
  □ Support environment variable expansion (${VAR})
  □ Merge flag > env > config > defaults
□ Create internal/config/defaults.go
  □ Default server URL: http://localhost:5147
  □ Default output format: table
  □ Default timeout: 30s
□ Create internal/config/contexts.go
  □ Context switching logic (future-ready)
  □ current-context handling
```

**internal/config/config.go:**
```go
package config

type Config struct {
    Server   ServerConfig   `yaml:"server"`
    Auth     AuthConfig     `yaml:"auth"`
    Output   OutputConfig   `yaml:"output"`
    Defaults DefaultsConfig `yaml:"defaults"`
    Contexts []Context      `yaml:"contexts"`
    CurrentContext string   `yaml:"current-context"`
}

type ServerConfig struct {
    URL      string        `yaml:"url"`
    Timeout  time.Duration `yaml:"timeout"`
    Insecure bool          `yaml:"insecure"`
}

type AuthConfig struct {
    Token    string `yaml:"token"`
    Username string `yaml:"username"`
    Password string `yaml:"password"`
    APIKey   string `yaml:"api-key"`
}

type Context struct {
    Name   string       `yaml:"name"`
    Server ServerConfig `yaml:"server"`
    Auth   AuthConfig   `yaml:"auth"`
}

func Load() (*Config, error) {
    // Implementation
}

func (c *Config) GetActiveContext() *Context {
    // Return context by name or default
}
```

#### 1.4 API Client Foundation (Day 4-5)

```
□ Create scripts/generate-client.sh
  □ Download swagger.json from API
  □ Run openapi-generator for Go
  □ Post-process generated code
□ Create internal/api/client.go
  □ HTTP client wrapper
  □ Base URL configuration
  □ Request/response logging (debug mode)
  □ Error handling wrapper
□ Create internal/api/auth.go
  □ Add Authorization header
  □ Token refresh logic (future)
```

**scripts/generate-client.sh:**
```bash
#!/bin/bash
set -e

SWAGGER_URL="${SWAGGER_URL:-http://localhost:5147/swagger/v1/swagger.json}"
OUTPUT_DIR="./pkg/types"

echo "Fetching OpenAPI spec from $SWAGGER_URL..."
curl -s "$SWAGGER_URL" -o /tmp/swagger.json

echo "Generating Go client..."
openapi-generator generate \
  -i /tmp/swagger.json \
  -g go \
  -o "$OUTPUT_DIR" \
  --additional-properties=packageName=types \
  --additional-properties=generateInterfaces=true

echo "Done! Generated types in $OUTPUT_DIR"
```

**internal/api/client.go:**
```go
package api

type Client struct {
    baseURL    string
    httpClient *http.Client
    token      string
    debug      bool
}

func NewClient(baseURL, token string, timeout time.Duration, debug bool) *Client {
    return &Client{
        baseURL: strings.TrimSuffix(baseURL, "/"),
        httpClient: &http.Client{Timeout: timeout},
        token:   token,
        debug:   debug,
    }
}

func (c *Client) do(ctx context.Context, method, path string, body, result interface{}) error {
    // Build request
    // Add auth header
    // Log if debug
    // Execute
    // Parse response
    // Handle errors
}
```

#### 1.5 Authentication Commands (Day 5-6)

```
□ Create internal/cmd/login.go
  □ Interactive login (prompt for server, user, password)
  □ Non-interactive login (--server, --username, --password)
  □ Token login (--token)
  □ Status check (--status)
□ Create internal/cmd/logout.go
  □ Clear stored credentials
□ Create internal/auth/store.go
  □ OS keychain integration (go-keyring)
  □ Fallback to encrypted file
  □ Token read/write/delete
```

**internal/cmd/login.go:**
```go
var loginCmd = &cobra.Command{
    Use:   "login",
    Short: "Authenticate with MiniCluster server",
    RunE:  runLogin,
}

func init() {
    loginCmd.Flags().String("server", "", "Server URL")
    loginCmd.Flags().String("username", "", "Username")
    loginCmd.Flags().String("password", "", "Password")
    loginCmd.Flags().String("token", "", "Use existing token")
    loginCmd.Flags().Bool("status", false, "Check login status")
    rootCmd.AddCommand(loginCmd)
}

func runLogin(cmd *cobra.Command, args []string) error {
    if status, _ := cmd.Flags().GetBool("status"); status {
        return showLoginStatus()
    }
    
    // Get credentials (interactive or flags)
    // Call API /api/auth/login
    // Store token securely
    // Print success message
}
```

#### 1.6 Version Command (Day 6)

```
□ Create internal/cmd/version.go
  □ Show version, build time, go version, os/arch
  □ --short flag for just version number
□ Create internal/version/version.go
  □ Variables set by ldflags at build time
```

#### 1.7 Basic Output Formatters (Day 6-7)

```
□ Create internal/output/formatter.go (interface)
□ Create internal/output/table.go
□ Create internal/output/json.go
□ Create internal/output/yaml.go
□ Create internal/output/quiet.go
□ Color detection and --no-color support
```

**internal/output/formatter.go:**
```go
package output

type Formatter interface {
    Format(data interface{}) error
}

func NewFormatter(format string, noColor bool) Formatter {
    switch format {
    case "json":
        return &JSONFormatter{}
    case "yaml":
        return &YAMLFormatter{}
    case "quiet":
        return &QuietFormatter{}
    default:
        return &TableFormatter{NoColor: noColor}
    }
}
```

### Phase 1 Deliverables

```bash
# These should work at end of Phase 1:
mc version
mc version --short
mc login
mc login --server https://example.com --username admin --password secret
mc login --status
mc logout
mc --help
mc app --help  # Shows help, not implemented yet
```

---

## Phase 2: Core Operations (Week 3-4)

### Goal
Full CRUD for apps and services, service control, and log streaming.

### Tasks

#### 2.1 App Commands (Day 1-3)

```
□ internal/cmd/app.go - parent command
□ internal/cmd/app_list.go
  □ Table output with status colors
  □ --filter flag
  □ --status flag
□ internal/cmd/app_get.go
  □ --with-services flag
  □ --with-stats flag
□ internal/cmd/app_create.go
  □ --description, --icon, --color flags
  □ --from-file flag (YAML/JSON)
□ internal/cmd/app_update.go
□ internal/cmd/app_delete.go
  □ --force flag
  □ --cascade flag
  □ Confirmation prompt (unless --yes)
□ internal/cmd/app_start.go
□ internal/cmd/app_stop.go
□ internal/cmd/app_restart.go
□ internal/cmd/app_status.go
□ internal/api/apps.go - API methods
```

**internal/cmd/app_list.go:**
```go
var appListCmd = &cobra.Command{
    Use:     "list",
    Aliases: []string{"ls"},
    Short:   "List all apps",
    RunE:    runAppList,
}

func init() {
    appListCmd.Flags().StringP("filter", "f", "", "Filter by name pattern")
    appListCmd.Flags().String("status", "", "Filter by status (running|stopped|mixed)")
    appCmd.AddCommand(appListCmd)
}

func runAppList(cmd *cobra.Command, args []string) error {
    client := api.ClientFromContext(cmd.Context())
    
    apps, err := client.ListApps(cmd.Context(), api.ListOptions{
        Filter: viper.GetString("filter"),
        Status: viper.GetString("status"),
    })
    if err != nil {
        return err
    }
    
    formatter := output.FormatterFromContext(cmd.Context())
    return formatter.FormatApps(apps)
}
```

#### 2.2 Service Commands (Day 3-6)

```
□ internal/cmd/service.go - parent command
□ internal/cmd/service_list.go
  □ --app flag to filter by app
  □ --unassigned flag
□ internal/cmd/service_get.go
□ internal/cmd/service_create.go
  □ --executable, --working-dir (required)
  □ --app, --args, --env, --env-file
  □ --auto-start, --access-link
  □ --from-file flag
□ internal/cmd/service_update.go
□ internal/cmd/service_delete.go
□ internal/cmd/service_start.go
□ internal/cmd/service_stop.go
□ internal/cmd/service_restart.go
□ internal/cmd/service_status.go
□ internal/cmd/service_metrics.go
□ internal/api/services.go - API methods
```

#### 2.3 Log Streaming (Day 6-7)

```
□ internal/cmd/service_logs.go
  □ -f/--follow flag for streaming
  □ -n/--tail flag
  □ --since, --until flags
  □ --timestamps flag
  □ --no-color flag
  □ Log level coloring (ERROR=red, WARN=yellow, etc.)
□ internal/api/logs.go
  □ SSE/streaming HTTP client
  □ Reconnection logic
```

**internal/cmd/service_logs.go:**
```go
var serviceLogsCmd = &cobra.Command{
    Use:   "logs <service>",
    Short: "View service logs",
    Args:  cobra.ExactArgs(1),
    RunE:  runServiceLogs,
}

func init() {
    serviceLogsCmd.Flags().BoolP("follow", "f", false, "Stream logs continuously")
    serviceLogsCmd.Flags().IntP("tail", "n", 100, "Number of lines to show")
    serviceLogsCmd.Flags().String("since", "", "Show logs since (timestamp or duration)")
    serviceLogsCmd.Flags().String("until", "", "Show logs until timestamp")
    serviceLogsCmd.Flags().Bool("timestamps", false, "Show timestamps")
    serviceCmd.AddCommand(serviceLogsCmd)
}

func runServiceLogs(cmd *cobra.Command, args []string) error {
    follow, _ := cmd.Flags().GetBool("follow")
    
    if follow {
        return streamLogs(cmd.Context(), args[0])
    }
    return fetchLogs(cmd.Context(), args[0])
}
```

#### 2.4 System Commands (Day 7-8)

```
□ internal/cmd/system.go - parent command
□ internal/cmd/system_status.go
□ internal/cmd/system_health.go
□ internal/cmd/system_metrics.go
  □ --watch flag with refresh interval
□ internal/api/system.go
```

### Phase 2 Deliverables

```bash
# These should work at end of Phase 2:
mc app list
mc app list -o json
mc app list --filter "prod-*"
mc app get my-app
mc app get my-app --with-services
mc app create new-app --description "My app" --icon "🚀"
mc app create -f app.yaml
mc app update my-app --description "Updated"
mc app delete my-app --cascade
mc app start my-app
mc app stop my-app
mc app status my-app

mc service list
mc service list --app my-app
mc service get my-service
mc service create api -e /usr/bin/dotnet --args "app.dll" -w /opt/app --app my-app
mc service create -f service.yaml
mc service start my-service
mc service stop my-service
mc service restart my-service
mc service logs my-service
mc service logs my-service -f
mc service logs my-service --since "1h" --tail 500
mc service status my-service
mc service metrics my-service

mc system status
mc system health
mc system metrics
mc system metrics --watch
```

---

## Phase 3: Deployment (Week 5-6)

### Goal
Zero-downtime deployments with blue-green, health checks, and rollback.

### Tasks

#### 3.1 Deploy Commands (Day 1-4)

```
□ internal/cmd/deploy.go - parent command
□ internal/cmd/deploy_bluegreen.go
  □ --target flag (new path/config)
  □ --health-check flag
  □ --health-timeout flag
  □ --health-retries flag
  □ --rollback-on-fail flag
  □ --keep-old flag
  □ Progress display with spinner
□ internal/cmd/deploy_rolling.go (if API supports)
  □ --batch-size flag
  □ --delay flag
□ internal/cmd/deploy_status.go
□ internal/cmd/deploy_rollback.go
  □ --to flag (specific version)
  □ --immediate flag
□ internal/cmd/deploy_history.go
□ internal/api/deploy.go
```

**internal/cmd/deploy_bluegreen.go:**
```go
var deployBlueGreenCmd = &cobra.Command{
    Use:   "blue-green <service>",
    Short: "Deploy using blue-green strategy",
    Args:  cobra.ExactArgs(1),
    RunE:  runDeployBlueGreen,
}

func init() {
    deployBlueGreenCmd.Flags().StringP("target", "t", "", "Target path or config")
    deployBlueGreenCmd.Flags().String("health-check", "", "Health check endpoint")
    deployBlueGreenCmd.Flags().Duration("health-timeout", 30*time.Second, "Health check timeout")
    deployBlueGreenCmd.Flags().Int("health-retries", 3, "Health check retries")
    deployBlueGreenCmd.Flags().Bool("rollback-on-fail", true, "Auto rollback on failure")
    deployBlueGreenCmd.Flags().Bool("keep-old", false, "Keep old version running")
    deployBlueGreenCmd.MarkFlagRequired("target")
    deployCmd.AddCommand(deployBlueGreenCmd)
}

func runDeployBlueGreen(cmd *cobra.Command, args []string) error {
    serviceName := args[0]
    
    // Show progress
    spinner := createSpinner("Deploying...")
    spinner.Start()
    defer spinner.Stop()
    
    // Step 1: Validate
    updateStatus("Validating configuration...")
    
    // Step 2: Create green instance
    updateStatus("Creating green instance...")
    
    // Step 3: Health check
    updateStatus("Running health checks...")
    
    // Step 4: Switch traffic
    updateStatus("Switching traffic...")
    
    // Step 5: Cleanup
    updateStatus("Cleaning up...")
    
    printSuccess("Deployment successful!")
}
```

#### 3.2 Progress Display (Day 4-5)

```
□ internal/output/progress.go
  □ Spinner for long operations
  □ Step-by-step status updates
  □ Success/failure indicators
  □ Ctrl+C handling with cleanup
```

#### 3.3 Health Check Client (Day 5-6)

```
□ internal/api/health.go
  □ HTTP health check with retries
  □ Exponential backoff
  □ Timeout handling
```

### Phase 3 Deliverables

```bash
# These should work at end of Phase 3:
mc deploy blue-green api-service --target /opt/api-v2 --health-check http://localhost:5000/health
mc deploy blue-green api-service -t /opt/api-v2 --health-check /health --health-timeout 60s
mc deploy status
mc deploy status <deployment-id>
mc deploy rollback api-service
mc deploy rollback api-service --to <deployment-id>
mc deploy history api-service
```

---

## Phase 4: Config & Polish (Week 7-8)

### Goal
Configuration as code, batch operations, shell completion, and release readiness.

### Tasks

#### 4.1 Config Commands (Day 1-3)

```
□ internal/cmd/config.go - parent command
□ internal/cmd/config_export.go
  □ Export app or service to YAML
  □ --format flag (yaml|json)
  □ --output flag (file path)
□ internal/cmd/config_import.go
  □ Import from YAML/JSON file
  □ --dry-run flag
  □ --create-missing flag
  □ --merge flag
□ internal/cmd/config_diff.go
  □ Compare file vs live
  □ Colorized diff output
□ internal/cmd/config_validate.go
  □ Validate config file syntax
  □ Check references exist
```

#### 4.2 Batch Operations (Day 3-4)

```
□ internal/cmd/batch.go - parent command
□ internal/cmd/batch_run.go
  □ Execute operations from file
  □ --dry-run flag
  □ --parallel flag
  □ --continue-on-error flag
  □ Progress display
□ internal/batch/executor.go
  □ Parse batch file
  □ Execute sequentially or parallel
  □ Collect results
```

#### 4.3 Proxy Commands (Day 4-5)

```
□ internal/cmd/proxy.go - parent command
□ internal/cmd/proxy_list.go
□ internal/cmd/proxy_create.go
□ internal/cmd/proxy_update.go
□ internal/cmd/proxy_delete.go
□ internal/cmd/proxy_reload.go
```

#### 4.4 Shell Completion (Day 5-6)

```
□ internal/cmd/completion.go
  □ Bash completion
  □ Zsh completion
  □ Fish completion
  □ PowerShell completion
□ Dynamic completions for:
  □ App names
  □ Service names
  □ Context names
```

**internal/cmd/completion.go:**
```go
var completionCmd = &cobra.Command{
    Use:   "completion [bash|zsh|fish|powershell]",
    Short: "Generate shell completion script",
    Args:  cobra.ExactArgs(1),
    RunE:  runCompletion,
}

func runCompletion(cmd *cobra.Command, args []string) error {
    switch args[0] {
    case "bash":
        return rootCmd.GenBashCompletion(os.Stdout)
    case "zsh":
        return rootCmd.GenZshCompletion(os.Stdout)
    case "fish":
        return rootCmd.GenFishCompletion(os.Stdout, true)
    case "powershell":
        return rootCmd.GenPowerShellCompletionWithDesc(os.Stdout)
    default:
        return fmt.Errorf("unsupported shell: %s", args[0])
    }
}
```

#### 4.5 Error Handling Polish (Day 6)

```
□ Improve all error messages
  □ Suggestion text for common errors
  □ "Did you mean X?" for typos
  □ Link to --help
□ Exit codes consistency check
□ Debug output cleanup
```

#### 4.6 Testing (Day 6-7)

```
□ Unit tests for commands
□ Unit tests for formatters
□ Unit tests for config loading
□ Integration tests (with mock server)
□ Test coverage > 70%
```

#### 4.7 Documentation & Release (Day 7-8)

```
□ README.md
  □ Installation instructions
  □ Quick start guide
  □ Configuration reference
□ CHANGELOG.md
□ Setup GitHub Actions
  □ Build on PR
  □ Release on tag
□ Setup Homebrew formula
□ Setup Scoop manifest
□ First release (v0.1.0)
```

### Phase 4 Deliverables

```bash
# These should work at end of Phase 4:
mc config export my-app -o my-app.yaml
mc config export my-service --format json
mc config import my-app.yaml --dry-run
mc config import my-app.yaml --create-missing
mc config diff my-app.yaml --live
mc config validate my-app.yaml

mc batch run deployment.yaml
mc batch run deployment.yaml --dry-run
mc batch run deployment.yaml --parallel

mc proxy list
mc proxy create --path /api --target http://localhost:5000
mc proxy delete <id>
mc proxy reload

mc completion bash
mc completion zsh
mc completion powershell

# Installation via package managers
brew install innovatek/tap/minicluster
scoop install minicluster
```

---

## File-by-File Implementation Checklist

### Week 1-2 (Phase 1)
```
□ cmd/mc/main.go
□ internal/version/version.go
□ internal/cmd/root.go
□ internal/cmd/version.go
□ internal/cmd/login.go
□ internal/cmd/logout.go
□ internal/config/config.go
□ internal/config/defaults.go
□ internal/config/contexts.go
□ internal/api/client.go
□ internal/api/auth.go
□ internal/auth/store.go
□ internal/output/formatter.go
□ internal/output/table.go
□ internal/output/json.go
□ internal/output/yaml.go
□ internal/output/quiet.go
□ scripts/generate-client.sh
□ Makefile
□ go.mod
```

### Week 3-4 (Phase 2)
```
□ internal/cmd/app.go
□ internal/cmd/app_list.go
□ internal/cmd/app_get.go
□ internal/cmd/app_create.go
□ internal/cmd/app_update.go
□ internal/cmd/app_delete.go
□ internal/cmd/app_start.go
□ internal/cmd/app_stop.go
□ internal/cmd/app_restart.go
□ internal/cmd/app_status.go
□ internal/cmd/service.go
□ internal/cmd/service_list.go
□ internal/cmd/service_get.go
□ internal/cmd/service_create.go
□ internal/cmd/service_update.go
□ internal/cmd/service_delete.go
□ internal/cmd/service_start.go
□ internal/cmd/service_stop.go
□ internal/cmd/service_restart.go
□ internal/cmd/service_logs.go
□ internal/cmd/service_status.go
□ internal/cmd/service_metrics.go
□ internal/cmd/system.go
□ internal/cmd/system_status.go
□ internal/cmd/system_health.go
□ internal/cmd/system_metrics.go
□ internal/api/apps.go
□ internal/api/services.go
□ internal/api/logs.go
□ internal/api/system.go
```

### Week 5-6 (Phase 3)
```
□ internal/cmd/deploy.go
□ internal/cmd/deploy_bluegreen.go
□ internal/cmd/deploy_rolling.go
□ internal/cmd/deploy_status.go
□ internal/cmd/deploy_rollback.go
□ internal/cmd/deploy_history.go
□ internal/api/deploy.go
□ internal/api/health.go
□ internal/output/progress.go
```

### Week 7-8 (Phase 4)
```
□ internal/cmd/config.go
□ internal/cmd/config_export.go
□ internal/cmd/config_import.go
□ internal/cmd/config_diff.go
□ internal/cmd/config_validate.go
□ internal/cmd/batch.go
□ internal/cmd/batch_run.go
□ internal/cmd/proxy.go
□ internal/cmd/proxy_list.go
□ internal/cmd/proxy_create.go
□ internal/cmd/proxy_update.go
□ internal/cmd/proxy_delete.go
□ internal/cmd/proxy_reload.go
□ internal/cmd/completion.go
□ internal/batch/executor.go
□ .github/workflows/build.yml
□ .github/workflows/release.yml
□ .goreleaser.yml
□ README.md
□ CHANGELOG.md
```

---

## Testing Matrix

| Command | Unit Test | Integration Test |
|---------|-----------|------------------|
| `mc version` | ✓ | - |
| `mc login` | ✓ | ✓ |
| `mc app list` | ✓ | ✓ |
| `mc app create` | ✓ | ✓ |
| `mc service logs` | ✓ | ✓ |
| `mc deploy blue-green` | ✓ | ✓ |
| `mc config export` | ✓ | ✓ |

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| API changes break CLI | Version negotiation header, clear error on mismatch |
| OpenAPI generation issues | Manual fallback, good error handling |
| Cross-platform bugs | CI matrix testing all platforms |
| Performance issues | Profile and optimize hot paths |

---

## Success Criteria

Phase 1 complete when:
- [ ] `mc version` works
- [ ] `mc login` authenticates and stores token
- [ ] Config file loading works
- [ ] All global flags work

Phase 2 complete when:
- [ ] All app CRUD commands work
- [ ] All service CRUD commands work
- [ ] Log streaming works with `-f`
- [ ] Output formats (table/json/yaml/quiet) work

Phase 3 complete when:
- [ ] Blue-green deployment works end-to-end
- [ ] Health checks run before switch
- [ ] Rollback works
- [ ] Deployment history works

Phase 4 complete when:
- [ ] Config export/import round-trips
- [ ] Shell completions work
- [ ] First release published
- [ ] Installation via brew/scoop works
