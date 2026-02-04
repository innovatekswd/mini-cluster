package cmd

import (
	"bufio"
	"context"
	"fmt"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/spf13/cobra"
)

// Service DTOs
type ServiceDto struct {
	ID                   string            `json:"id"`
	Name                 string            `json:"name"`
	ExecutablePath       string            `json:"executablePath"`
	Arguments            string            `json:"arguments"`
	EnvironmentVariables map[string]string `json:"environmentVariables"`
	AutoStart            bool              `json:"autoStart"`
	WorkingDirectory     string            `json:"workingDirectory"`
	AccessLink           string            `json:"accessLink"`
	IsExternal           bool              `json:"isExternal"`
	UseShellExecute      bool              `json:"useShellExecute"`
	CreateNoWindow       bool              `json:"createNoWindow"`
	CaptureOutput        bool              `json:"captureOutput"`
	Description          string            `json:"description"`
	OrderIndex           int               `json:"orderIndex"`
	AppID                *string           `json:"appId"`
	Status               string            `json:"status"`
	CreatedAt            string            `json:"createdAt"`
	ModifiedAt           string            `json:"modifiedAt"`
}

type CreateServiceRequest struct {
	Name                 string            `json:"name"`
	ExecutablePath       string            `json:"executablePath"`
	Arguments            string            `json:"arguments,omitempty"`
	EnvironmentVariables map[string]string `json:"environmentVariables,omitempty"`
	AutoStart            bool              `json:"autoStart,omitempty"`
	WorkingDirectory     string            `json:"workingDirectory,omitempty"`
	Description          string            `json:"description,omitempty"`
	AppID                *string           `json:"appId,omitempty"`
}

var serviceCmd = &cobra.Command{
	Use:     "service",
	Aliases: []string{"svc", "services"},
	Short:   "Manage services",
	Long:    `Start, stop, restart, and manage services.`,
}

var serviceListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all services",
	Long: `List all services with their current status.

Examples:
  mc service list
  mc service list -o json`,
	RunE: runServiceList,
}

var serviceGetCmd = &cobra.Command{
	Use:   "get <service>",
	Short: "Get service details",
	Long: `Get detailed information about a specific service.

The service can be specified by name or ID.

Examples:
  mc service get my-service
  mc service get "My Service" -o json`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceGet,
}

var serviceStartCmd = &cobra.Command{
	Use:   "start <service>",
	Short: "Start a service",
	Long: `Start a stopped service.

The service can be specified by name or ID.

Examples:
  mc service start my-service
  mc service start "API Server"`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceStart,
}

var serviceStopCmd = &cobra.Command{
	Use:   "stop <service>",
	Short: "Stop a service",
	Long: `Stop a running service.

The service can be specified by name or ID.

Examples:
  mc service stop my-service
  mc service stop "API Server"`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceStop,
}

var serviceRestartCmd = &cobra.Command{
	Use:   "restart <service>",
	Short: "Restart a service",
	Long: `Restart a service (stop then start).

The service can be specified by name or ID.

Examples:
  mc service restart my-service
  mc service restart "API Server"`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceRestart,
}

var serviceLogsCmd = &cobra.Command{
	Use:   "logs <service>",
	Short: "View service logs",
	Long: `View logs for a service.

The service can be specified by name or ID.

Examples:
  mc service logs my-service
  mc service logs my-service -f
  mc service logs "API Server" --tail 100`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceLogs,
}

var serviceStatusCmd = &cobra.Command{
	Use:   "status [service]",
	Short: "Get service status",
	Long: `Get the runtime status of services.

The service can be specified by name or ID.

Examples:
  mc service status              # All services
  mc service status my-service   # Specific service`,
	RunE: runServiceStatus,
}

var serviceDeleteCmd = &cobra.Command{
	Use:   "delete <service>",
	Short: "Delete a service",
	Long: `Delete a service. Service must be stopped first.

The service can be specified by name or ID.

Examples:
  mc service delete my-service
  mc service delete "API Server" --yes`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceDelete,
}

var serviceCloneCmd = &cobra.Command{
	Use:   "clone <service>",
	Short: "Clone a service",
	Long: `Clone a service with its configuration.

The service can be specified by name or ID.

Examples:
  mc service clone my-service
  mc service clone "API Server"`,
	Args: cobra.ExactArgs(1),
	RunE: runServiceClone,
}

func init() {
	rootCmd.AddCommand(serviceCmd)
	serviceCmd.AddCommand(serviceListCmd)
	serviceCmd.AddCommand(serviceGetCmd)
	serviceCmd.AddCommand(serviceStartCmd)
	serviceCmd.AddCommand(serviceStopCmd)
	serviceCmd.AddCommand(serviceRestartCmd)
	serviceCmd.AddCommand(serviceLogsCmd)
	serviceCmd.AddCommand(serviceStatusCmd)
	serviceCmd.AddCommand(serviceDeleteCmd)
	serviceCmd.AddCommand(serviceCloneCmd)

	// Logs flags
	serviceLogsCmd.Flags().BoolP("follow", "f", false, "Follow log output")
	serviceLogsCmd.Flags().Int("tail", 100, "Number of lines to show from end of logs")
}

func runServiceList(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	var services []ServiceDto
	if err := client.Get(ctx, "/api/services", &services); err != nil {
		return fmt.Errorf("failed to list services: %w", err)
	}

	if len(services) == 0 {
		out.Info("No services found")
		return nil
	}

	headers := []string{"ID", "Name", "Status", "Executable", "Description"}
	var rows [][]string
	for _, svc := range services {
		rows = append(rows, []string{
			svc.ID,
			svc.Name,
			formatStatus(svc.Status),
			truncate(svc.ExecutablePath, 25),
			truncate(svc.Description, 25),
		})
	}

	return out.OutputTable(headers, rows)
}

func runServiceGet(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	service := args[0]

	var svc ServiceDto
	if err := client.Get(ctx, "/api/services/"+service, &svc); err != nil {
		return fmt.Errorf("failed to get service: %w", err)
	}

	return out.Output(svc)
}

func runServiceStart(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	service := args[0]

	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := client.Post(ctx, "/api/services/"+service+"/start", nil, &result); err != nil {
		return fmt.Errorf("failed to start service: %w", err)
	}

	if result.Success {
		out.Success(result.Message)
	} else {
		out.Error(result.Message)
	}
	return nil
}

func runServiceStop(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	service := args[0]

	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := client.Post(ctx, "/api/services/"+service+"/stop", nil, &result); err != nil {
		return fmt.Errorf("failed to stop service: %w", err)
	}

	if result.Success {
		out.Success(result.Message)
	} else {
		out.Error(result.Message)
	}
	return nil
}

func runServiceRestart(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	service := args[0]

	var result struct {
		Success bool   `json:"success"`
		Message string `json:"message"`
	}
	if err := client.Post(ctx, "/api/services/"+service+"/restart", nil, &result); err != nil {
		return fmt.Errorf("failed to restart service: %w", err)
	}

	if result.Success {
		out.Success(result.Message)
	} else {
		out.Error(result.Message)
	}
	return nil
}

func runServiceLogs(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()

	service := args[0]
	follow, _ := cmd.Flags().GetBool("follow")
	tail, _ := cmd.Flags().GetInt("tail")

	// Get initial logs
	var logs struct {
		Lines []string `json:"lines"`
	}
	path := fmt.Sprintf("/api/logs/%s?tail=%d", service, tail)
	if err := client.Get(ctx, path, &logs); err != nil {
		return fmt.Errorf("failed to get logs: %w", err)
	}

	// Print initial logs
	for _, line := range logs.Lines {
		fmt.Println(line)
	}

	if !follow {
		return nil
	}

	// Follow mode - poll for new logs
	fmt.Println("--- Following logs (Ctrl+C to exit) ---")

	sigChan := make(chan os.Signal, 1)
	signal.Notify(sigChan, syscall.SIGINT, syscall.SIGTERM)

	ticker := time.NewTicker(1 * time.Second)
	defer ticker.Stop()

	lastLineCount := len(logs.Lines)

	for {
		select {
		case <-sigChan:
			fmt.Println("\n--- Log stream stopped ---")
			return nil
		case <-ticker.C:
			var newLogs struct {
				Lines []string `json:"lines"`
			}
			if err := client.Get(ctx, fmt.Sprintf("/api/logs/%s?tail=1000", service), &newLogs); err != nil {
				continue // Ignore errors in follow mode
			}

			// Print only new lines
			if len(newLogs.Lines) > lastLineCount {
				for i := lastLineCount; i < len(newLogs.Lines); i++ {
					fmt.Println(newLogs.Lines[i])
				}
				lastLineCount = len(newLogs.Lines)
			}
		}
	}
}

func runServiceStatus(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	if len(args) == 1 {
		// Single service status
		service := args[0]
		var svc ServiceDto
		if err := client.Get(ctx, "/api/services/"+service, &svc); err != nil {
			return fmt.Errorf("failed to get service: %w", err)
		}
		fmt.Printf("%s: %s\n", svc.Name, formatStatus(svc.Status))
		return nil
	}

	// All services status
	var statuses map[string]string
	if err := client.Get(ctx, "/api/services/statuses", &statuses); err != nil {
		return fmt.Errorf("failed to get statuses: %w", err)
	}

	// Get service names for better display
	var services []ServiceDto
	if err := client.Get(ctx, "/api/services", &services); err != nil {
		return fmt.Errorf("failed to get services: %w", err)
	}

	nameMap := make(map[string]string)
	for _, svc := range services {
		nameMap[svc.ID] = svc.Name
	}

	headers := []string{"ID", "Name", "Status"}
	var rows [][]string
	for id, status := range statuses {
		name := nameMap[id]
		if name == "" {
			name = "(unknown)"
		}
		rows = append(rows, []string{
			id,
			name,
			formatStatus(status),
		})
	}

	return out.OutputTable(headers, rows)
}

func runServiceDelete(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	service := args[0]

	// Get service details first
	var svc ServiceDto
	if err := client.Get(ctx, "/api/services/"+service, &svc); err != nil {
		return fmt.Errorf("failed to get service: %w", err)
	}

	// Confirm deletion
	if !Confirm(fmt.Sprintf("Delete service '%s'?", svc.Name)) {
		out.Info("Cancelled")
		return nil
	}

	if err := client.Delete(ctx, "/api/services/"+service); err != nil {
		return fmt.Errorf("failed to delete service: %w", err)
	}

	out.Success("Deleted service '%s'", svc.Name)
	return nil
}

func runServiceClone(cmd *cobra.Command, args []string) error {
	ctx := context.Background()
	client := GetClient()
	out := GetFormatter()

	service := args[0]

	var svc ServiceDto
	if err := client.Post(ctx, "/api/services/"+service+"/clone", nil, &svc); err != nil {
		return fmt.Errorf("failed to clone service: %w", err)
	}

	out.Success("Cloned service to '%s' (%s)", svc.Name, svc.ID)
	return nil
}

func formatStatus(status string) string {
	switch status {
	case "running", "Running":
		return "Running"
	case "stopped", "Stopped":
		return "Stopped"
	case "starting", "Starting":
		return "Starting"
	case "stopping", "Stopping":
		return "Stopping"
	case "failed", "Failed":
		return "Failed"
	default:
		return status
	}
}

// Helper for stdin input
func readLine() string {
	reader := bufio.NewReader(os.Stdin)
	line, _ := reader.ReadString('\n')
	return line
}
