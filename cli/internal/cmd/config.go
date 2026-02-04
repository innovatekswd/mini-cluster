package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
	Long:  `View and modify CLI configuration settings.`,
}

var configGetCmd = &cobra.Command{
	Use:   "get [key]",
	Short: "Get configuration value",
	Long: `Get a configuration value. Without a key, shows all configuration.

Examples:
  mc config get
  mc config get server.url
  mc config get output.format`,
	RunE: runConfigGet,
}

var configSetCmd = &cobra.Command{
	Use:   "set <key> <value>",
	Short: "Set configuration value",
	Long: `Set a configuration value.

Examples:
  mc config set server.url http://localhost:5147
  mc config set output.format json
  mc config set defaults.confirm false`,
	Args: cobra.ExactArgs(2),
	RunE: runConfigSet,
}

var configListContextsCmd = &cobra.Command{
	Use:   "contexts",
	Short: "List available contexts",
	Long: `List all configured contexts for multi-server management.

Examples:
  mc config contexts`,
	RunE: runConfigContexts,
}

var configUseContextCmd = &cobra.Command{
	Use:   "use-context <name>",
	Short: "Switch to a different context",
	Long: `Switch to a different context (server configuration).

Examples:
  mc config use-context production
  mc config use-context staging`,
	Args: cobra.ExactArgs(1),
	RunE: runConfigUseContext,
}

var configCurrentContextCmd = &cobra.Command{
	Use:   "current-context",
	Short: "Show current context",
	Long: `Show the currently active context.

Examples:
  mc config current-context`,
	RunE: runConfigCurrentContext,
}

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configGetCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configListContextsCmd)
	configCmd.AddCommand(configUseContextCmd)
	configCmd.AddCommand(configCurrentContextCmd)
}

func runConfigGet(cmd *cobra.Command, args []string) error {
	out := GetFormatter()

	if len(args) == 0 {
		// Show all config
		settings := viper.AllSettings()
		return out.Output(settings)
	}

	key := args[0]
	value := viper.Get(key)
	if value == nil {
		out.Info("Key '%s' not set", key)
		return nil
	}

	fmt.Println(value)
	return nil
}

func runConfigSet(cmd *cobra.Command, args []string) error {
	out := GetFormatter()

	key := args[0]
	value := args[1]

	// Parse boolean values
	switch strings.ToLower(value) {
	case "true", "yes", "1":
		viper.Set(key, true)
	case "false", "no", "0":
		viper.Set(key, false)
	default:
		viper.Set(key, value)
	}

	// Save to config file
	if err := viper.WriteConfig(); err != nil {
		// Config file might not exist yet
		if err := viper.SafeWriteConfig(); err != nil {
			return fmt.Errorf("failed to save config: %w", err)
		}
	}

	out.Success("Set %s = %s", key, value)
	return nil
}

func runConfigContexts(cmd *cobra.Command, args []string) error {
	out := GetFormatter()

	contexts := viper.GetStringMap("contexts")
	if len(contexts) == 0 {
		out.Info("No contexts configured")
		out.Info("Add contexts to ~/.minicluster/config.yaml")
		return nil
	}

	currentContext := viper.GetString("current_context")

	headers := []string{"Name", "Server", "Current"}
	var rows [][]string
	for name := range contexts {
		server := viper.GetString(fmt.Sprintf("contexts.%s.server", name))
		current := ""
		if name == currentContext {
			current = "*"
		}
		rows = append(rows, []string{name, server, current})
	}

	return out.OutputTable(headers, rows)
}

func runConfigUseContext(cmd *cobra.Command, args []string) error {
	out := GetFormatter()

	contextName := args[0]

	// Verify context exists
	contexts := viper.GetStringMap("contexts")
	if _, exists := contexts[contextName]; !exists {
		return fmt.Errorf("context '%s' not found", contextName)
	}

	viper.Set("current_context", contextName)

	if err := viper.WriteConfig(); err != nil {
		return fmt.Errorf("failed to save config: %w", err)
	}

	out.Success("Switched to context '%s'", contextName)
	return nil
}

func runConfigCurrentContext(cmd *cobra.Command, args []string) error {
	currentContext := viper.GetString("current_context")
	if currentContext == "" {
		fmt.Println("(default)")
	} else {
		fmt.Println(currentContext)
	}
	return nil
}

// Server config commands (get server-side settings)
var serverConfigCmd = &cobra.Command{
	Use:   "server-config",
	Short: "View server configuration",
	Long:  `View configuration from the MiniCluster server.`,
	RunE:  runServerConfig,
}

func init() {
	rootCmd.AddCommand(serverConfigCmd)
}

func runServerConfig(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	var settings map[string]interface{}
	if err := client.Get(ctx, "/api/settings", &settings); err != nil {
		return fmt.Errorf("failed to get server config: %w", err)
	}

	return out.Output(settings)
}
