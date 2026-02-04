// Package cmd provides all CLI commands
package cmd

import (
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/innovatek/minicluster-cli/internal/api"
	"github.com/innovatek/minicluster-cli/internal/config"
	"github.com/innovatek/minicluster-cli/internal/output"
)

var (
	cfgFile   string
	apiClient *api.Client
	formatter output.Formatter
)

// rootCmd represents the base command
var rootCmd = &cobra.Command{
	Use:   "mc",
	Short: "MiniCluster CLI - manage apps and services",
	Long: `MiniCluster CLI enables DevOps automation, CI/CD integration,
and zero-downtime deployments from the terminal.

The CLI is a thin client that communicates with the MiniCluster API server.
All process management happens server-side.

Quick start:
  mc login                    # Authenticate with server
  mc app list                 # List all apps
  mc service logs api -f      # Stream logs
  mc deploy blue-green api    # Zero-downtime deploy

Configuration:
  Config file: ~/.minicluster/config.yaml
  Environment: MC_SERVER_URL, MC_AUTH_TOKEN, etc.`,
	PersistentPreRunE: initializeClient,
	SilenceUsage:      true,
	SilenceErrors:     true,
}

// Execute runs the root command
func Execute() error {
	if err := rootCmd.Execute(); err != nil {
		// Print error with formatting
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return err
	}
	return nil
}

func init() {
	cobra.OnInitialize(initConfig)

	// Global flags
	rootCmd.PersistentFlags().StringVarP(&cfgFile, "config", "c", "", "Config file (default: ~/.minicluster/config.yaml)")
	rootCmd.PersistentFlags().StringP("server", "s", "", "MiniCluster API server URL")
	rootCmd.PersistentFlags().StringP("token", "t", "", "Authentication token")
	rootCmd.PersistentFlags().StringP("output", "o", "table", "Output format: table, json, yaml, quiet")
	rootCmd.PersistentFlags().String("context", "", "Context to use from config file")
	rootCmd.PersistentFlags().Bool("no-color", false, "Disable colored output")
	rootCmd.PersistentFlags().BoolP("verbose", "v", false, "Verbose output")
	rootCmd.PersistentFlags().Bool("debug", false, "Debug mode (shows API calls)")
	rootCmd.PersistentFlags().Duration("timeout", 30*time.Second, "Request timeout")
	rootCmd.PersistentFlags().BoolP("yes", "y", false, "Skip confirmation prompts")

	// Bind flags to viper
	viper.BindPFlag("server.url", rootCmd.PersistentFlags().Lookup("server"))
	viper.BindPFlag("auth.token", rootCmd.PersistentFlags().Lookup("token"))
	viper.BindPFlag("output.format", rootCmd.PersistentFlags().Lookup("output"))
	viper.BindPFlag("output.no_color", rootCmd.PersistentFlags().Lookup("no-color"))
	viper.BindPFlag("context", rootCmd.PersistentFlags().Lookup("context"))
	viper.BindPFlag("verbose", rootCmd.PersistentFlags().Lookup("verbose"))
	viper.BindPFlag("debug", rootCmd.PersistentFlags().Lookup("debug"))
	viper.BindPFlag("timeout", rootCmd.PersistentFlags().Lookup("timeout"))
	viper.BindPFlag("yes", rootCmd.PersistentFlags().Lookup("yes"))

	// Environment variable bindings
	viper.SetEnvPrefix("MC")
	viper.AutomaticEnv()
	viper.BindEnv("server.url", "MC_SERVER_URL")
	viper.BindEnv("auth.token", "MC_AUTH_TOKEN")
	viper.BindEnv("output.format", "MC_OUTPUT_FORMAT")
	viper.BindEnv("context", "MC_CONTEXT")
}

// initConfig reads in config file and ENV variables
func initConfig() {
	if cfgFile != "" {
		// Use config file from flag
		viper.SetConfigFile(cfgFile)
	} else {
		// Find home directory
		home, err := os.UserHomeDir()
		if err != nil {
			return
		}

		// Search for config in ~/.minicluster/
		configDir := filepath.Join(home, ".minicluster")
		viper.AddConfigPath(configDir)
		viper.SetConfigName("config")
		viper.SetConfigType("yaml")

		// Also check /etc/minicluster for system-wide config
		viper.AddConfigPath("/etc/minicluster")

		// Also check current directory for .minicluster.yaml
		viper.AddConfigPath(".")
		viper.SetConfigName(".minicluster")
	}

	// Set defaults
	viper.SetDefault("server.url", "http://localhost:5147")
	viper.SetDefault("server.timeout", "30s")
	viper.SetDefault("output.format", "table")
	viper.SetDefault("output.color", "auto")
	viper.SetDefault("defaults.wait", true)
	viper.SetDefault("defaults.confirm", true)

	// Read config file (ignore error if not found)
	if err := viper.ReadInConfig(); err == nil {
		if viper.GetBool("debug") {
			fmt.Fprintf(os.Stderr, "Using config file: %s\n", viper.ConfigFileUsed())
		}
	}
}

// initializeClient sets up the API client before each command
func initializeClient(cmd *cobra.Command, args []string) error {
	// Skip client init for certain commands
	if cmd.Name() == "version" || cmd.Name() == "help" || cmd.Name() == "completion" {
		return nil
	}

	// Get active context configuration
	cfg := config.GetActiveConfig()

	// Initialize formatter
	formatter = output.NewFormatter(output.Options{
		Format:  output.ParseFormat(viper.GetString("output.format")),
		NoColor: viper.GetBool("output.no_color"),
	})

	// Initialize API client (skip for login command without status flag)
	if cmd.Name() == "login" {
		return nil
	}

	// Create API client
	apiClient = api.NewClient(
		cfg.ServerURL,
		cfg.Token,
		cfg.Timeout,
		viper.GetBool("debug"),
	)

	return nil
}

// GetClient returns the initialized API client
func GetClient() *api.Client {
	return apiClient
}

// GetFormatter returns the initialized formatter
func GetFormatter() output.Formatter {
	return formatter
}

// Confirm asks for user confirmation (respects --yes flag)
func Confirm(prompt string) bool {
	if viper.GetBool("yes") {
		return true
	}

	fmt.Printf("%s [y/N]: ", prompt)
	var response string
	fmt.Scanln(&response)
	return response == "y" || response == "Y" || response == "yes" || response == "Yes"
}
