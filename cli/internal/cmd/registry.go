package cmd

import (
	"context"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

var registryCmd = &cobra.Command{
	Use:     "registry",
	Aliases: []string{"reg"},
	Short:   "Manage the package registry",
	Long:    `List, publish, and install heterogeneous multi-component packages (.mcpkg).`,
}

// ── mc registry list ──────────────────────────────────────────────────────

var registryListCmd = &cobra.Command{
	Use:   "list",
	Short: "List packages in the registry",
	RunE: func(cmd *cobra.Command, args []string) error {
		name, _ := cmd.Flags().GetString("name")
		tag, _ := cmd.Flags().GetString("tag")
		client := GetClient()
		out := GetFormatter()
		pkgs, err := client.ListPackages(context.Background(), name, tag)
		if err != nil {
			return err
		}
		headers := []string{"NAME", "VERSION", "AUTHOR", "DOWNLOADS", "PUBLISHED"}
		rows := make([][]string, len(pkgs))
		for i, p := range pkgs {
			rows[i] = []string{
				p.Name, p.Version, p.Author,
				fmt.Sprintf("%d", p.Downloads),
				p.CreatedAt.Format(time.RFC3339),
			}
		}
		return out.OutputTable(headers, rows)
	},
}

// ── mc registry versions <name> ───────────────────────────────────────────

var registryVersionsCmd = &cobra.Command{
	Use:   "versions <name>",
	Short: "List all versions of a package",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		pkgs, err := client.ListVersions(context.Background(), args[0])
		if err != nil {
			return err
		}
		headers := []string{"VERSION", "SIZE", "CHECKSUM", "DOWNLOADS", "PUBLISHED"}
		rows := make([][]string, len(pkgs))
		for i, p := range pkgs {
			rows[i] = []string{
				p.Version,
				formatImageBytes(p.FileSize),
				shortChecksum(p.Checksum),
				fmt.Sprintf("%d", p.Downloads),
				p.CreatedAt.Format(time.RFC3339),
			}
		}
		return out.OutputTable(headers, rows)
	},
}

// ── mc registry show <name>[@version] ────────────────────────────────────

var registryShowCmd = &cobra.Command{
	Use:   "show <name>[@version]",
	Short: "Show details of a package version",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name, version := splitNameVersion(args[0])
		client := GetClient()
		out := GetFormatter()
		pkg, err := client.GetPackage(context.Background(), name, version)
		if err != nil {
			return err
		}
		return out.Output(pkg)
	},
}

// ── mc registry push <file> ───────────────────────────────────────────────

var registryPushCmd = &cobra.Command{
	Use:   "push <file.mcpkg>",
	Short: "Publish a package to the registry",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		filePath := args[0]
		name, _ := cmd.Flags().GetString("name")
		version, _ := cmd.Flags().GetString("version")
		description, _ := cmd.Flags().GetString("description")
		author, _ := cmd.Flags().GetString("author")
		tags, _ := cmd.Flags().GetString("tags")

		f, err := os.Open(filePath)
		if err != nil {
			return fmt.Errorf("cannot open file: %w", err)
		}
		defer f.Close()

		client := GetClient()
		out := GetFormatter()
		pkg, err := client.PublishPackage(context.Background(), name, version, description, author, tags, "", f, filePath)
		if err != nil {
			return err
		}
		out.Success("Published %s@%s (checksum: %s)", pkg.Name, pkg.Version, shortChecksum(pkg.Checksum))
		return nil
	},
}

// ── mc registry delete <name>[@version] ──────────────────────────────────

var registryDeleteCmd = &cobra.Command{
	Use:     "delete <name>[@version]",
	Aliases: []string{"rm", "unpublish"},
	Short:   "Remove a package from the registry",
	Args:    cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name, version := splitNameVersion(args[0])
		if version == "" {
			return fmt.Errorf("version required — use <name>@<version>")
		}
		client := GetClient()
		out := GetFormatter()
		if err := client.UnpublishPackage(context.Background(), name, version); err != nil {
			return err
		}
		out.Success("Deleted %s@%s", name, version)
		return nil
	},
}

// ── mc install <name>[@version] ───────────────────────────────────────────

var installCmd = &cobra.Command{
	Use:   "install <name>[@version]",
	Short: "Install a package from the registry",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name, version := splitNameVersion(args[0])
		client := GetClient()
		out := GetFormatter()
		record, err := client.InstallPackage(context.Background(), name, version)
		if err != nil {
			return err
		}
		out.Success("Installed %s@%s (status: %s)", record.PackageName, record.Version, record.Status)
		return nil
	},
}

// ── mc registry installs ──────────────────────────────────────────────────

var registryInstallsCmd = &cobra.Command{
	Use:   "installs",
	Short: "List installed packages on this node",
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		installs, err := client.ListInstalls(context.Background())
		if err != nil {
			return err
		}
		headers := []string{"ID", "NAME", "VERSION", "STATUS", "INSTALLED_AT"}
		rows := make([][]string, len(installs))
		for i, inst := range installs {
			installedAt := ""
			if inst.InstalledAt != nil {
				installedAt = inst.InstalledAt.Format(time.RFC3339)
			}
			rows[i] = []string{inst.ID[:8], inst.PackageName, inst.Version, inst.Status, installedAt}
		}
		return out.OutputTable(headers, rows)
	},
}

// ── mc registry uninstall <id> ────────────────────────────────────────────

var registryUninstallCmd = &cobra.Command{
	Use:   "uninstall <id>",
	Short: "Remove an installation record",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		if err := client.RemoveInstall(context.Background(), args[0]); err != nil {
			return err
		}
		out.Success("Installation %s removed", args[0])
		return nil
	},
}

// ── helpers ───────────────────────────────────────────────────────────────

func splitNameVersion(s string) (name, version string) {
	parts := strings.SplitN(s, "@", 2)
	name = parts[0]
	if len(parts) == 2 {
		version = parts[1]
	}
	return
}

func shortChecksum(s string) string {
	if len(s) > 12 {
		return s[:12]
	}
	return s
}

func init() {
	// registry subcommands
	registryCmd.AddCommand(registryListCmd, registryVersionsCmd, registryShowCmd)
	registryCmd.AddCommand(registryPushCmd, registryDeleteCmd)
	registryCmd.AddCommand(registryInstallsCmd, registryUninstallCmd)

	registryListCmd.Flags().String("name", "", "Filter by package name")
	registryListCmd.Flags().String("tag", "", "Filter by tag")

	registryPushCmd.Flags().String("name", "", "Package name (required)")
	registryPushCmd.Flags().String("version", "", "Package version (required)")
	registryPushCmd.Flags().String("description", "", "Package description")
	registryPushCmd.Flags().String("author", "", "Package author")
	registryPushCmd.Flags().String("tags", "", "Comma-separated tags")
	registryPushCmd.MarkFlagRequired("name")
	registryPushCmd.MarkFlagRequired("version")

	rootCmd.AddCommand(registryCmd)
	rootCmd.AddCommand(installCmd)
}
