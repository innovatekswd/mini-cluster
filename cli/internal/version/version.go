// Package version provides version information set at build time
package version

import (
	"fmt"
	"runtime"
)

// These variables are set at build time using ldflags
var (
	Version   = "dev"
	BuildTime = "unknown"
	GitCommit = "unknown"
)

// Info returns formatted version information
func Info() string {
	return fmt.Sprintf(`MiniCluster CLI
  Version:    %s
  Build Time: %s
  Git Commit: %s
  Go Version: %s
  OS/Arch:    %s/%s`,
		Version, BuildTime, GitCommit, runtime.Version(), runtime.GOOS, runtime.GOARCH)
}

// Short returns just the version number
func Short() string {
	return Version
}
