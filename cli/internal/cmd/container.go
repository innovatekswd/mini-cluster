package cmd

import (
	"context"
	"fmt"
	"strings"

	"github.com/spf13/cobra"

	"github.com/innovatek/minicluster-cli/internal/api"
)

var containerCmd = &cobra.Command{
	Use:     "container",
	Aliases: []string{"containers"},
	Short:   "Manage container runtime and container-type services",
}

var containerRuntimeCmd = &cobra.Command{
	Use:   "runtime",
	Short: "Show Docker runtime info",
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		info, err := client.GetContainerRuntime(context.Background())
		if err != nil {
			return err
		}
		return out.Output(info)
	},
}

var imagesCmd = &cobra.Command{
	Use:   "images",
	Short: "Manage local Docker images",
}

var imagesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List local Docker images",
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		images, err := client.ListImages(context.Background())
		if err != nil {
			return err
		}
		headers := []string{"ID", "TAGS", "SIZE"}
		rows := make([][]string, len(images))
		for i, img := range images {
			id := img.ID
			if len(id) > 12 {
				id = id[:12]
			}
			tags := strings.Join(img.Tags, ", ")
			if tags == "" {
				tags = "<none>"
			}
			rows[i] = []string{id, tags, formatImageBytes(img.Size)}
		}
		return out.OutputTable(headers, rows)
	},
}

var imagesPullCmd = &cobra.Command{
	Use:   "pull <image>",
	Short: "Pull a Docker image",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		out.Info("Pulling %s ...", args[0])
		return client.PullImage(context.Background(), args[0], func(ev api.PullEvent) {
			if ev.Error != "" {
				out.Error("%s", ev.Error)
				return
			}
			if ev.Progress != "" {
				fmt.Printf("\r%s: %s %s", ev.ID, ev.Status, ev.Progress)
			} else if ev.Status != "" {
				fmt.Printf("%s: %s\n", ev.ID, ev.Status)
			}
		})
	},
}

var imagesRemoveCmd = &cobra.Command{
	Use:     "remove <image>",
	Aliases: []string{"rm"},
	Short:   "Remove a Docker image",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		if err := client.RemoveImage(context.Background(), args[0]); err != nil {
			return err
		}
		out.Success("Image %s removed", args[0])
		return nil
	},
}

var containerConfigCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage container configuration for a service",
}

var containerConfigGetCmd = &cobra.Command{
	Use:   "get <service>",
	Short: "Get container config for a service",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		svc, err := findServiceByNameOrID(client, args[0])
		if err != nil {
			return err
		}
		cfg, err := client.GetContainerConfig(context.Background(), svc.ID)
		if err != nil {
			return err
		}
		return out.Output(cfg)
	},
}

var containerConfigSetCmd = &cobra.Command{
	Use:   "set <service>",
	Short: "Create or update container config for a service",
	Args:  cobra.ExactArgs(1),
	RunE:  runContainerConfigSet,
}

var containerConfigDeleteCmd = &cobra.Command{
	Use:     "delete <service>",
	Aliases: []string{"rm"},
	Short:   "Delete container config for a service",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		svc, err := findServiceByNameOrID(client, args[0])
		if err != nil {
			return err
		}
		if err := client.DeleteContainerConfig(context.Background(), svc.ID); err != nil {
			return err
		}
		out.Success("Container config deleted for service %s", svc.Name)
		return nil
	},
}

var containerStatsCmd = &cobra.Command{
	Use:   "stats <service>",
	Short: "Show container resource stats",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		svc, err := findServiceByNameOrID(client, args[0])
		if err != nil {
			return err
		}
		stats, err := client.GetContainerStats(context.Background(), svc.ID)
		if err != nil {
			return err
		}
		return out.Output(stats)
	},
}

var containerExecCmd = &cobra.Command{
	Use:   "exec <service> <command> [args...]",
	Short: "Execute a command inside a running container",
	Args:  cobra.MinimumNArgs(2),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		svc, err := findServiceByNameOrID(client, args[0])
		if err != nil {
			return err
		}
		result, err := client.ExecContainer(context.Background(), svc.ID, args[1:])
		if err != nil {
			return err
		}
		if result.Stdout != "" {
			fmt.Print(result.Stdout)
		}
		if result.Stderr != "" {
			fmt.Fprint(out.Writer(), result.Stderr)
		}
		if result.ExitCode != 0 {
			return fmt.Errorf("command exited with code %d", result.ExitCode)
		}
		return nil
	},
}

func findServiceByNameOrID(client *api.Client, nameOrID string) (*ServiceDto, error) {
	var svcs []ServiceDto
	if err := client.Get(context.Background(), "/api/services", &svcs); err != nil {
		return nil, err
	}
	for i := range svcs {
		if svcs[i].ID == nameOrID || strings.EqualFold(svcs[i].Name, nameOrID) {
			return &svcs[i], nil
		}
	}
	return nil, fmt.Errorf("service %q not found", nameOrID)
}

func formatImageBytes(b int64) string {
	const unit = 1024
	if b < unit {
		return fmt.Sprintf("%d B", b)
	}
	div, exp := int64(unit), 0
	for n := b / unit; n >= unit; n /= unit {
		div *= unit
		exp++
	}
	return fmt.Sprintf("%.1f %cB", float64(b)/float64(div), "KMGTPE"[exp])
}

var (
	ccImage        string
	ccTag          string
	ccRegistry     string
	ccPullPolicy   string
	ccPorts        string
	ccVolumes      string
	ccNetwork      string
	ccMemory       int64
	ccCPU          float64
	ccEntrypoint   string
	ccCommand      string
	ccUser         string
	ccWorkDir      string
	ccPrivileged   bool
	ccReadOnly     bool
	ccRemoveOnStop bool
	ccLabels       string
)

func runContainerConfigSet(cmd *cobra.Command, args []string) error {
	client := GetClient()
	out := GetFormatter()

	svc, err := findServiceByNameOrID(client, args[0])
	if err != nil {
		return err
	}

	cfg, _ := client.GetContainerConfig(context.Background(), svc.ID)
	if cfg == nil {
		cfg = &api.ContainerConfig{}
	}

	if cmd.Flags().Changed("image") {
		cfg.Image = ccImage
	}
	if cmd.Flags().Changed("tag") {
		cfg.Tag = ccTag
	}
	if cmd.Flags().Changed("registry") {
		cfg.Registry = ccRegistry
	}
	if cmd.Flags().Changed("pull-policy") {
		cfg.PullPolicy = ccPullPolicy
	}
	if cmd.Flags().Changed("port") {
		cfg.Ports = ccPorts
	}
	if cmd.Flags().Changed("volume") {
		cfg.Volumes = ccVolumes
	}
	if cmd.Flags().Changed("network") {
		cfg.NetworkMode = ccNetwork
	}
	if cmd.Flags().Changed("memory") {
		cfg.MemoryLimitBytes = ccMemory
	}
	if cmd.Flags().Changed("cpu") {
		cfg.CpuLimit = ccCPU
	}
	if cmd.Flags().Changed("entrypoint") {
		cfg.Entrypoint = ccEntrypoint
	}
	if cmd.Flags().Changed("cmd") {
		cfg.Command = ccCommand
	}
	if cmd.Flags().Changed("user") {
		cfg.User = ccUser
	}
	if cmd.Flags().Changed("workdir") {
		cfg.WorkingDir = ccWorkDir
	}
	if cmd.Flags().Changed("privileged") {
		cfg.Privileged = ccPrivileged
	}
	if cmd.Flags().Changed("read-only") {
		cfg.ReadOnly = ccReadOnly
	}
	if cmd.Flags().Changed("remove-on-stop") {
		cfg.RemoveOnStop = ccRemoveOnStop
	}
	if cmd.Flags().Changed("labels") {
		cfg.Labels = ccLabels
	}

	result, err := client.UpsertContainerConfig(context.Background(), svc.ID, cfg)
	if err != nil {
		return err
	}
	out.Success("Container config saved")
	return out.Output(result)
}

func init() {
	imagesCmd.AddCommand(imagesListCmd, imagesPullCmd, imagesRemoveCmd)

	containerConfigCmd.AddCommand(containerConfigGetCmd, containerConfigSetCmd, containerConfigDeleteCmd)

	f := containerConfigSetCmd.Flags()
	f.StringVar(&ccImage, "image", "", "Docker image name")
	f.StringVar(&ccTag, "tag", "latest", "Image tag")
	f.StringVar(&ccRegistry, "registry", "", "Registry host (optional)")
	f.StringVar(&ccPullPolicy, "pull-policy", "IfNotPresent", "Pull policy: Always|IfNotPresent|Never")
	f.StringVar(&ccPorts, "port", "", `Port mappings JSON e.g. '[{"hostPort":8080,"containerPort":80}]'`)
	f.StringVar(&ccVolumes, "volume", "", `Volume mounts JSON e.g. '[{"source":"/data","target":"/app/data"}]'`)
	f.StringVar(&ccNetwork, "network", "bridge", "Network mode")
	f.Int64Var(&ccMemory, "memory", 0, "Memory limit in bytes (0 = unlimited)")
	f.Float64Var(&ccCPU, "cpu", 0, "CPU quota (0 = unlimited)")
	f.StringVar(&ccEntrypoint, "entrypoint", "", "Override entrypoint")
	f.StringVar(&ccCommand, "cmd", "", "Override command")
	f.StringVar(&ccUser, "user", "", "Run as user")
	f.StringVar(&ccWorkDir, "workdir", "", "Working directory inside container")
	f.BoolVar(&ccPrivileged, "privileged", false, "Run in privileged mode")
	f.BoolVar(&ccReadOnly, "read-only", false, "Mount root filesystem as read-only")
	f.BoolVar(&ccRemoveOnStop, "remove-on-stop", true, "Remove container on stop")
	f.StringVar(&ccLabels, "labels", "", "Labels JSON")

	containerCmd.AddCommand(containerRuntimeCmd, imagesCmd, containerConfigCmd, containerStatsCmd, containerExecCmd)
	rootCmd.AddCommand(containerCmd)
}
