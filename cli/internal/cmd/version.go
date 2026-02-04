package cmd

import (
	"fmt"
	"runtime"

	"github.com/spf13/cobra"

	"github.com/innovatek/minicluster-cli/internal/version"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Long:  `Print the version, build time, and git commit of the CLI.`,
	Run: func(cmd *cobra.Command, args []string) {
		short, _ := cmd.Flags().GetBool("short")
		if short {
			fmt.Println(version.Version)
			return
		}

		fmt.Printf("mc version %s\n", version.Version)
		if version.GitCommit != "" {
			fmt.Printf("Git commit: %s\n", version.GitCommit)
		}
		if version.BuildTime != "" {
			fmt.Printf("Build time: %s\n", version.BuildTime)
		}
		fmt.Printf("Go version: %s\n", runtime.Version())
		fmt.Printf("OS/Arch: %s/%s\n", runtime.GOOS, runtime.GOARCH)
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
	versionCmd.Flags().Bool("short", false, "Print only the version number")
}
