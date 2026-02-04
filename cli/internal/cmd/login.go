package cmd

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"strings"
	"syscall"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"golang.org/x/term"

	"github.com/innovatek/minicluster-cli/internal/api"
	"github.com/innovatek/minicluster-cli/internal/auth"
	"github.com/innovatek/minicluster-cli/internal/output"
)

var loginCmd = &cobra.Command{
	Use:   "login",
	Short: "Authenticate with the MiniCluster server",
	Long: `Authenticate with the MiniCluster server and store credentials.

Examples:
  # Interactive login (prompts for username and password)
  mc login

  # Login with username (prompts for password)
  mc login --username admin

  # Login with a specific server
  mc login --server http://localhost:5000

  # Use an existing token directly
  mc login --token <jwt-token>`,
	RunE: runLogin,
}

func init() {
	rootCmd.AddCommand(loginCmd)
	loginCmd.Flags().StringP("username", "u", "", "Username for authentication")
	loginCmd.Flags().StringP("password", "p", "", "Password for authentication (not recommended, use interactive prompt)")
	loginCmd.Flags().String("token", "", "Use an existing JWT token directly")
}

func runLogin(cmd *cobra.Command, args []string) error {
	ctx := context.Background()

	server := getServerURL()
	if server == "" {
		return fmt.Errorf("no server specified; use --server flag or set MC_SERVER environment variable")
	}

	formatter := output.NewFormatter(output.Options{
		Format:  output.ParseFormat(viper.GetString("output.format")),
		NoColor: viper.GetBool("output.no_color"),
	})

	// Check if using direct token
	token, _ := cmd.Flags().GetString("token")
	if token != "" {
		return saveToken(server, token, "", formatter)
	}

	// Get username
	username, _ := cmd.Flags().GetString("username")
	if username == "" {
		fmt.Print("Username: ")
		reader := bufio.NewReader(os.Stdin)
		input, err := reader.ReadString('\n')
		if err != nil {
			return fmt.Errorf("failed to read username: %w", err)
		}
		username = strings.TrimSpace(input)
	}

	// Get password
	password, _ := cmd.Flags().GetString("password")
	if password == "" {
		fmt.Print("Password: ")
		bytePassword, err := term.ReadPassword(int(syscall.Stdin))
		if err != nil {
			return fmt.Errorf("failed to read password: %w", err)
		}
		fmt.Println() // newline after password
		password = string(bytePassword)
	}

	// Authenticate
	timeout := viper.GetDuration("timeout")
	debug := viper.GetBool("debug")
	client := api.NewClient(server, "", timeout, debug)

	var authResp struct {
		Token     string    `json:"token"`
		ExpiresAt time.Time `json:"expiresAt,omitempty"`
	}

	err := client.Post(ctx, "/api/auth/login", map[string]string{
		"username": username,
		"password": password,
	}, &authResp)
	if err != nil {
		return fmt.Errorf("authentication failed: %w", err)
	}

	return saveToken(server, authResp.Token, username, formatter)
}

func saveToken(server, token, username string, formatter output.Formatter) error {
	store, err := auth.NewStore()
	if err != nil {
		return fmt.Errorf("failed to create credential store: %w", err)
	}

	creds := &auth.Credentials{
		Token:    token,
		Server:   server,
		Username: username,
	}

	if err := store.Save(creds); err != nil {
		return fmt.Errorf("failed to save credentials: %w", err)
	}

	formatter.Success("Logged in to %s", server)
	return nil
}

func getServerURL() string {
	// Check command line flag / viper config
	serverURL := viper.GetString("server.url")
	if serverURL != "" {
		return serverURL
	}
	return ""
}
