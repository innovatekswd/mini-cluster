package cmd

import (
	"archive/zip"
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"path/filepath"
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

// ── mc registry push <file.mcpkg | directory> ────────────────────────────

var registryPushCmd = &cobra.Command{
	Use:   "push <file.mcpkg|directory>",
	Short: "Publish a package to the registry",
	Long: `Publish a .mcpkg file or a directory containing a manifest.json.
When a directory is provided, it is zipped into a .mcpkg and the name/version
are read from manifest.json (use --name/--version to override).`,
	Args: cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		path := args[0]
		nameOverride, _ := cmd.Flags().GetString("name")
		versionOverride, _ := cmd.Flags().GetString("version")
		description, _ := cmd.Flags().GetString("description")
		author, _ := cmd.Flags().GetString("author")
		tags, _ := cmd.Flags().GetString("tags")

		var (
			reader        *bytes.Reader
			fileName      string
			name, version string
		)

		info, err := os.Stat(path)
		if err != nil {
			return fmt.Errorf("cannot stat path: %w", err)
		}

		if info.IsDir() {
			// Read manifest.json to get name/version
			mfBytes, err := os.ReadFile(filepath.Join(path, "manifest.json"))
			if err != nil {
				return fmt.Errorf("manifest.json not found in directory: %w", err)
			}
			var mf struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			}
			if err := json.Unmarshal(mfBytes, &mf); err != nil {
				return fmt.Errorf("invalid manifest.json: %w", err)
			}
			name = mf.Name
			version = mf.Version
			if nameOverride != "" {
				name = nameOverride
			}
			if versionOverride != "" {
				version = versionOverride
			}
			if name == "" || version == "" {
				return fmt.Errorf("manifest.json must contain name and version")
			}

			// Load .mcignore patterns
			ignorePatterns := loadMcIgnore(path)

			// Build ZIP in memory
			var buf bytes.Buffer
			zw := zip.NewWriter(&buf)
			err = filepath.Walk(path, func(fpath string, fi os.FileInfo, err error) error {
				if err != nil {
					return err
				}
				rel, _ := filepath.Rel(path, fpath)
				if rel == "." {
					return nil
				}
				if isIgnored(rel, ignorePatterns) {
					if fi.IsDir() {
						return filepath.SkipDir
					}
					return nil
				}
				if fi.IsDir() {
					return nil
				}
				w, err := zw.Create(rel)
				if err != nil {
					return err
				}
				data, err := os.ReadFile(fpath)
				if err != nil {
					return err
				}
				_, err = w.Write(data)
				return err
			})
			if err != nil {
				return fmt.Errorf("failed to build package: %w", err)
			}
			if err := zw.Close(); err != nil {
				return fmt.Errorf("failed to finalise zip: %w", err)
			}
			reader = bytes.NewReader(buf.Bytes())
			fileName = fmt.Sprintf("%s-%s.mcpkg", name, version)
		} else {
			// Pre-built .mcpkg file
			data, err := os.ReadFile(path)
			if err != nil {
				return fmt.Errorf("cannot read file: %w", err)
			}
			reader = bytes.NewReader(data)
			fileName = filepath.Base(path)
			name = nameOverride
			version = versionOverride
			if name == "" || version == "" {
				return fmt.Errorf("--name and --version are required when pushing a .mcpkg file")
			}
		}

		client := GetClient()
		out := GetFormatter()
		pkg, err := client.PublishPackage(context.Background(), name, version, description, author, tags, "", reader, fileName)
		if err != nil {
			return err
		}
		out.Success("Published %s@%s (checksum: %s)", pkg.Name, pkg.Version, shortChecksum(pkg.Checksum))
		return nil
	},
}

// loadMcIgnore reads .mcignore patterns from a directory.
func loadMcIgnore(dir string) []string {
	f, err := os.Open(filepath.Join(dir, ".mcignore"))
	if err != nil {
		return nil
	}
	defer f.Close()
	var patterns []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line != "" && !strings.HasPrefix(line, "#") {
			patterns = append(patterns, line)
		}
	}
	return patterns
}

// isIgnored checks if a path matches any ignore pattern (simple glob/prefix matching).
func isIgnored(rel string, patterns []string) bool {
	for _, pattern := range patterns {
		// Exact match or prefix directory match
		if rel == pattern {
			return true
		}
		// Glob match
		matched, err := filepath.Match(pattern, rel)
		if err == nil && matched {
			return true
		}
		// Match against base name
		matched, err = filepath.Match(pattern, filepath.Base(rel))
		if err == nil && matched {
			return true
		}
	}
	return false
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
		envPairs, _ := cmd.Flags().GetStringArray("env")
		autoStart, _ := cmd.Flags().GetBool("auto-start")

		envMap := map[string]string{}
		for _, pair := range envPairs {
			parts := strings.SplitN(pair, "=", 2)
			if len(parts) != 2 {
				return fmt.Errorf("invalid --env value %q: must be KEY=VALUE", pair)
			}
			envMap[parts[0]] = parts[1]
		}

		client := GetClient()
		out := GetFormatter()
		record, err := client.InstallPackage(context.Background(), name, version, envMap, autoStart)
		if err != nil {
			return err
		}
		out.Success("Installed %s@%s (status: %s, service: %s)", record.PackageName, record.Version, record.Status, record.ServiceID)
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

// ── mc registry search <query> ────────────────────────────────────────────

var registrySearchCmd = &cobra.Command{
	Use:   "search <query>",
	Short: "Search packages by name or tag",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		client := GetClient()
		out := GetFormatter()
		pkgs, err := client.SearchPackages(context.Background(), args[0])
		if err != nil {
			return err
		}
		if len(pkgs) == 0 {
			fmt.Println("No packages found.")
			return nil
		}
		headers := []string{"NAME", "VERSION", "DESCRIPTION", "DOWNLOADS"}
		rows := make([][]string, len(pkgs))
		for i, p := range pkgs {
			desc := p.Description
			if len(desc) > 50 {
				desc = desc[:47] + "..."
			}
			rows[i] = []string{p.Name, p.Version, desc, fmt.Sprintf("%d", p.Downloads)}
		}
		return out.OutputTable(headers, rows)
	},
}

// ── mc inspect <name>[@version] ───────────────────────────────────────────

var inspectCmd = &cobra.Command{
	Use:   "inspect <name>[@version]",
	Short: "Inspect a package — show components and required env vars",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		name, version := splitNameVersion(args[0])
		client := GetClient()

		pkg, err := client.GetPackage(context.Background(), name, version)
		if err != nil {
			return err
		}

		if version == "" {
			version = "latest"
		}
		comps, err := client.GetComponents(context.Background(), name, version)
		if err != nil {
			return err
		}

		fmt.Printf("Package: %s@%s\n", pkg.Name, pkg.Version)
		if pkg.Description != "" {
			fmt.Printf("Description: %s\n", pkg.Description)
		}
		if pkg.Author != "" {
			fmt.Printf("Author: %s\n", pkg.Author)
		}
		fmt.Printf("Size: %s  Checksum: %s\n", formatImageBytes(pkg.FileSize), shortChecksum(pkg.Checksum))
		fmt.Printf("\nComponents (%d):\n", len(comps))
		for _, c := range comps {
			fmt.Printf("  %-20s %-10s", c.Name, c.Type)
			if c.Image != "" {
				fmt.Printf(" image=%s", c.Image)
			}
			if c.Command != "" {
				fmt.Printf(" cmd=%s", c.Command)
			}
			fmt.Println()
			if len(c.DependsOn) > 0 {
				fmt.Printf("    dependsOn: %s\n", strings.Join(c.DependsOn, ", "))
			}
			if len(c.RequiredEnv) > 0 {
				fmt.Printf("    required env: %s\n", strings.Join(c.RequiredEnv, ", "))
			}
		}
		return nil
	},
}

// ── mc package ────────────────────────────────────────────────────────────

var packageCmd = &cobra.Command{
	Use:   "package",
	Short: "Build and manage .mcpkg packages",
}

var packageInitCmd = &cobra.Command{
	Use:   "init [directory]",
	Short: "Scaffold a manifest.json in the current directory",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir := "."
		if len(args) > 0 {
			dir = args[0]
		}
		if err := os.MkdirAll(dir, 0755); err != nil {
			return err
		}
		dest := filepath.Join(dir, "manifest.json")
		if _, err := os.Stat(dest); err == nil {
			return fmt.Errorf("manifest.json already exists in %s", dir)
		}
		skeleton := `{
  "schemaVersion": "2.0",
  "name": "my-package",
  "version": "1.0.0",
  "description": "My MiniCluster package",
  "author": "",
  "components": [
    {
      "name": "app",
      "type": "process",
      "bundled": true,
      "binaryPath": "app/my-binary",
      "arguments": "",
      "healthCheck": {
        "type": "http",
        "port": 8080,
        "path": "/health",
        "interval": "15s",
        "retries": 3
      }
    }
  ]
}
`
		if err := os.WriteFile(dest, []byte(skeleton), 0644); err != nil {
			return err
		}
		fmt.Printf("Created %s\n", dest)
		return nil
	},
}

var packageValidateCmd = &cobra.Command{
	Use:   "validate [directory]",
	Short: "Validate a package manifest.json",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir := "."
		if len(args) > 0 {
			dir = args[0]
		}
		manifestPath := filepath.Join(dir, "manifest.json")
		data, err := os.ReadFile(manifestPath)
		if err != nil {
			return fmt.Errorf("cannot read %s: %w", manifestPath, err)
		}
		// Call registry validate endpoint with raw JSON
		client := GetClient()
		var result map[string]interface{}
		if err := client.Post(context.Background(), "/api/registry/validate", json.RawMessage(data), &result); err != nil {
			// Surface validation error
			return fmt.Errorf("validation failed: %w", err)
		}
		fmt.Printf("✓ Valid manifest: %s@%s\n", result["name"], result["version"])
		if n, ok := result["components"].(float64); ok && n > 0 {
			fmt.Printf("  Components: %d\n", int(n))
		}
		return nil
	},
}

var packageBuildCmd = &cobra.Command{
	Use:   "build [directory]",
	Short: "Build a .mcpkg archive from a directory",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir := "."
		if len(args) > 0 {
			dir = args[0]
		}
		output, _ := cmd.Flags().GetString("output")
		return buildPackage(dir, output)
	},
}

// buildPackage zips a directory into a .mcpkg file (same logic as push, but local only)
func buildPackage(dir, output string) error {
	manifestPath := filepath.Join(dir, "manifest.json")
	manifestData, err := os.ReadFile(manifestPath)
	if err != nil {
		return fmt.Errorf("cannot read manifest.json: %w", err)
	}

	var meta struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	}
	if err := json.Unmarshal(manifestData, &meta); err != nil {
		return fmt.Errorf("invalid manifest.json: %w", err)
	}
	if meta.Name == "" || meta.Version == "" {
		return fmt.Errorf("manifest.json must have name and version")
	}

	if output == "" {
		output = fmt.Sprintf("%s-%s.mcpkg", meta.Name, meta.Version)
	}

	ignores := loadMcIgnore(dir)
	buf := &bytes.Buffer{}
	zw := zip.NewWriter(buf)

	err = filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		rel, _ := filepath.Rel(dir, path)
		rel = filepath.ToSlash(rel)
		if isIgnored(rel, ignores) {
			return nil
		}
		w, err := zw.Create(rel)
		if err != nil {
			return err
		}
		f, err := os.Open(path) //nolint:gosec
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = io.Copy(w, f)
		return err
	})
	if err != nil {
		return fmt.Errorf("build failed: %w", err)
	}
	if err := zw.Close(); err != nil {
		return err
	}
	if err := os.WriteFile(output, buf.Bytes(), 0644); err != nil {
		return fmt.Errorf("write failed: %w", err)
	}
	fmt.Printf("Built %s (%s)\n", output, formatImageBytes(int64(buf.Len())))
	return nil
}

var packagePushCmd = &cobra.Command{
	Use:   "push [directory]",
	Short: "Build and push a package to the registry",
	Args:  cobra.MaximumNArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		dir := "."
		if len(args) > 0 {
			dir = args[0]
		}
		tmp := fmt.Sprintf("_build-%d.mcpkg", time.Now().UnixNano())
		defer os.Remove(tmp)
		if err := buildPackage(dir, tmp); err != nil {
			return err
		}
		// Delegate to registryPushCmd logic by invoking with temp file
		registryPushCmd.SetArgs([]string{tmp})
		return registryPushCmd.RunE(registryPushCmd, []string{tmp})
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
	registryCmd.AddCommand(registryListCmd, registryVersionsCmd, registryShowCmd, registrySearchCmd)
	registryCmd.AddCommand(registryPushCmd, registryDeleteCmd)
	registryCmd.AddCommand(registryInstallsCmd, registryUninstallCmd)

	registryListCmd.Flags().String("name", "", "Filter by package name")
	registryListCmd.Flags().String("tag", "", "Filter by tag")

	registryPushCmd.Flags().String("name", "", "Override package name")
	registryPushCmd.Flags().String("version", "", "Override package version")
	registryPushCmd.Flags().String("description", "", "Package description")
	registryPushCmd.Flags().String("author", "", "Package author")
	registryPushCmd.Flags().String("tags", "", "Comma-separated tags")

	installCmd.Flags().StringArray("env", nil, "Environment variable override KEY=VALUE (repeatable)")
	installCmd.Flags().Bool("auto-start", true, "Automatically start the installed service")

	// package subcommands
	packageCmd.AddCommand(packageInitCmd, packageValidateCmd, packageBuildCmd, packagePushCmd)
	packageBuildCmd.Flags().String("output", "", "Output file path (default: <name>-<version>.mcpkg)")

	rootCmd.AddCommand(registryCmd)
	rootCmd.AddCommand(installCmd)
	rootCmd.AddCommand(inspectCmd)
	rootCmd.AddCommand(packageCmd)
}
