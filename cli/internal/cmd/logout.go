package cmd

import (
	"fmt"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"

	"github.com/innovatek/minicluster-cli/internal/auth"
	"github.com/innovatek/minicluster-cli/internal/output"
)

var logoutCmd = &cobra.Command{
	Use:   "logout",
	Short: "Remove stored credentials",
	Long: `Remove stored authentication credentials for the server.

Examples:
  # Logout from the current server
  mc logout

  # Logout from a specific server
  mc logout --server http://localhost:5000

  # Logout from all servers
  mc logout --all`,
	RunE: runLogout,
}

func init() {
	rootCmd.AddCommand(logoutCmd)
	logoutCmd.Flags().Bool("all", false, "Remove credentials for all servers")
}

func runLogout(cmd *cobra.Command, args []string) error {
	formatter := output.NewFormatter(output.Options{
		Format:  output.ParseFormat(viper.GetString("output.format")),
		NoColor: viper.GetBool("output.no_color"),
	})

	store, err := auth.NewStore()
	if err != nil {
		return fmt.Errorf("failed to access credential store: %w", err)
	}

	all, _ := cmd.Flags().GetBool("all")

	if all {
		// Remove all credentials
		creds, err := store.List()
		if err != nil {
			formatter.Info("No stored credentials found")
			return nil
		}

		for server := range creds {
			if err := store.Delete(server); err != nil {
				formatter.Error("Failed to remove credentials for %s: %v", server, err)
			} else {
				formatter.Success("Removed credentials for %s", server)
			}
		}
		return nil
	}

	// Remove credentials for specific server
	server := getServerURL()
	if server == "" {
		return fmt.Errorf("no server specified; use --server flag or use --all to remove all credentials")
	}

	if err := store.Delete(server); err != nil {
		return fmt.Errorf("failed to remove credentials: %w", err)
	}

	formatter.Success("Logged out from %s", server)
	return nil
}
