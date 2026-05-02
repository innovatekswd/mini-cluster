//go:build !windows

package main

import (
	"os"

	"go.uber.org/zap"
)

// runAsWindowsService is a no-op on non-Windows platforms.
// Always returns false so main() uses its normal SIGINT/SIGTERM handling.
func runAsWindowsService(quit chan<- os.Signal, log *zap.Logger) bool {
	return false
}

// IsWindowsServiceActive always returns false on non-Windows platforms.
func IsWindowsServiceActive() bool { return false }

// InstallWindowsService is not supported on non-Windows platforms.
func InstallWindowsService(_ string) error { return nil }

// UninstallWindowsService is not supported on non-Windows platforms.
func UninstallWindowsService() error { return nil }
