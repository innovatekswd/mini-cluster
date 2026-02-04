// MiniCluster CLI - Command-line interface for MiniCluster
package main

import (
	"os"

	"github.com/innovatek/minicluster-cli/internal/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
