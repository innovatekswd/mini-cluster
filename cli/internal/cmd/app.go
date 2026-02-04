package cmd

import (
	"context"
	"fmt"

	"github.com/spf13/cobra"
)

// App DTOs for API communication
type AppWithStats struct {
	ID           string `json:"id"`
	Name         string `json:"name"`
	Description  string `json:"description"`
	Icon         string `json:"icon"`
	Color        string `json:"color"`
	ServiceCount int    `json:"serviceCount"`
	RunningCount int    `json:"runningCount"`
	StoppedCount int    `json:"stoppedCount"`
	SortOrder    int    `json:"sortOrder"`
	CreatedAt    string `json:"createdAt"`
	ModifiedAt   string `json:"modifiedAt"`
}

type AppDto struct {
	ID          string `json:"id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Icon        string `json:"icon"`
	Color       string `json:"color"`
	SortOrder   int    `json:"sortOrder"`
	CreatedAt   string `json:"createdAt"`
	ModifiedAt  string `json:"modifiedAt"`
}

type CreateAppRequest struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Icon        string `json:"icon,omitempty"`
	Color       string `json:"color,omitempty"`
}

type UpdateAppRequest struct {
	Name        *string `json:"name,omitempty"`
	Description *string `json:"description,omitempty"`
	Icon        *string `json:"icon,omitempty"`
	Color       *string `json:"color,omitempty"`
}

var appCmd = &cobra.Command{
	Use:     "app",
	Aliases: []string{"apps"},
	Short:   "Manage applications",
	Long:    `Create, list, update, and delete applications (groups of services).`,
}

var appListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all apps",
	Long: `List all applications with service statistics.

Examples:
  mc app list
  mc app list -o json
  mc app list -o yaml`,
	RunE: runAppList,
}

var appGetCmd = &cobra.Command{
	Use:   "get <app>",
	Short: "Get app details",
	Long: `Get detailed information about a specific application.

The app can be specified by name or ID.

Examples:
  mc app get my-app
  mc app get "My App"
  mc app get my-app -o json`,
	Args: cobra.ExactArgs(1),
	RunE: runAppGet,
}

var appCreateCmd = &cobra.Command{
	Use:   "create <name>",
	Short: "Create a new app",
	Long: `Create a new application.

Examples:
  mc app create "My App"
  mc app create "My App" --description "Description" --icon "🚀" --color "#3b82f6"`,
	Args: cobra.ExactArgs(1),
	RunE: runAppCreate,
}

var appDeleteCmd = &cobra.Command{
	Use:   "delete <app>",
	Short: "Delete an app",
	Long: `Delete an application. Services in the app will become unassigned.

The app can be specified by name or ID.

Examples:
  mc app delete my-app
  mc app delete "My App" --yes`,
	Args: cobra.ExactArgs(1),
	RunE: runAppDelete,
}

var appCloneCmd = &cobra.Command{
	Use:   "clone <app>",
	Short: "Clone an app",
	Long: `Clone an application and all its services.

The app can be specified by name or ID.

Examples:
  mc app clone my-app
  mc app clone "Production Stack"`,
	Args: cobra.ExactArgs(1),
	RunE: runAppClone,
}

func init() {
	rootCmd.AddCommand(appCmd)
	appCmd.AddCommand(appListCmd)
	appCmd.AddCommand(appGetCmd)
	appCmd.AddCommand(appCreateCmd)
	appCmd.AddCommand(appDeleteCmd)
	appCmd.AddCommand(appCloneCmd)

	// Create flags
	appCreateCmd.Flags().StringP("description", "d", "", "App description")
	appCreateCmd.Flags().String("icon", "", "App icon (emoji)")
	appCreateCmd.Flags().String("color", "", "App color (hex)")
}

func runAppList(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	var apps []AppWithStats
	if err := client.Get(ctx, "/api/apps", &apps); err != nil {
		return fmt.Errorf("failed to list apps: %w", err)
	}

	if len(apps) == 0 {
		out.Info("No apps found")
		return nil
	}

	headers := []string{"ID", "Name", "Services", "Running", "Description"}
	var rows [][]string
	for _, app := range apps {
		rows = append(rows, []string{
			app.ID,
			app.Name,
			fmt.Sprintf("%d", app.ServiceCount),
			fmt.Sprintf("%d/%d", app.RunningCount, app.ServiceCount),
			truncate(app.Description, 30),
		})
	}

	return out.OutputTable(headers, rows)
}

func runAppGet(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	app := args[0]

	var appDto AppDto
	if err := client.Get(ctx, "/api/apps/"+app, &appDto); err != nil {
		return fmt.Errorf("failed to get app: %w", err)
	}

	return out.Output(appDto)
}

func runAppCreate(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	name := args[0]
	description, _ := cmd.Flags().GetString("description")
	icon, _ := cmd.Flags().GetString("icon")
	color, _ := cmd.Flags().GetString("color")

	req := CreateAppRequest{
		Name:        name,
		Description: description,
		Icon:        icon,
		Color:       color,
	}

	var app AppDto
	if err := client.Post(ctx, "/api/apps", req, &app); err != nil {
		return fmt.Errorf("failed to create app: %w", err)
	}

	out.Success("Created app %s (%s)", app.Name, app.ID)
	return nil
}

func runAppDelete(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	app := args[0]

	// Confirm deletion
	if !Confirm(fmt.Sprintf("Delete app %s?", app)) {
		out.Info("Cancelled")
		return nil
	}

	if err := client.Delete(ctx, "/api/apps/"+app); err != nil {
		return fmt.Errorf("failed to delete app: %w", err)
	}

	out.Success("Deleted app %s", app)
	return nil
}

func runAppClone(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	app := args[0]

	var clonedApp AppDto
	if err := client.Post(ctx, "/api/apps/"+app+"/clone", nil, &clonedApp); err != nil {
		return fmt.Errorf("failed to clone app: %w", err)
	}

	out.Success("Cloned app to %s (%s)", clonedApp.Name, clonedApp.ID)
	return nil
}

func truncate(s string, maxLen int) string {
	if len(s) <= maxLen {
		return s
	}
	return s[:maxLen-3] + "..."
}
