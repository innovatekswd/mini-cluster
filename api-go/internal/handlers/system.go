package handlers

import (
	"context"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/Masterminds/semver/v3"
	"github.com/go-chi/chi/v5"

	"github.com/innovatek/minicluster/internal/update"
)

// SystemHandler exposes OS/runtime info and service install/uninstall endpoints.
// Service install functions are in service_windows.go / service_notwindows.go
// in the main package and are called here via the injected callbacks to keep
// this package platform-agnostic.
type SystemHandler struct {
	isServiceFn        func() bool
	installServiceFn   func(exePath string) error
	uninstallServiceFn func() error
	version            string
	gitCommit          string
	buildTime          string
	updateChecker      *update.CachedChecker // may be nil if updates disabled
}

func NewSystemHandler(
	isServiceFn func() bool,
	installServiceFn func(exePath string) error,
	uninstallServiceFn func() error,
	version, gitCommit, buildTime string,
	updateChecker *update.CachedChecker,
) *SystemHandler {
	return &SystemHandler{
		isServiceFn:        isServiceFn,
		installServiceFn:   installServiceFn,
		uninstallServiceFn: uninstallServiceFn,
		version:            version,
		gitCommit:          gitCommit,
		buildTime:          buildTime,
		updateChecker:      updateChecker,
	}
}

func (h *SystemHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/info", h.GetInfo)
	r.Get("/update/check", h.CheckUpdate)
	r.Post("/service/install", h.InstallService)
	r.Delete("/service/uninstall", h.UninstallService)
	return r
}

// GET /api/system/update/check
func (h *SystemHandler) CheckUpdate(w http.ResponseWriter, r *http.Request) {
	if h.updateChecker == nil {
		writeJSON(w, http.StatusOK, update.CheckResult{
			CurrentVersion:  h.version,
			LatestVersion:   h.version,
			UpdateAvailable: false,
		})
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()

	latest, err := h.updateChecker.Latest(ctx)
	if err != nil {
		writeError(w, http.StatusBadGateway, "update check failed: "+err.Error())
		return
	}

	// Compare versions
	currentVer, currErr := semver.NewVersion(strings.TrimPrefix(h.version, "v"))
	latestVer, latErr := semver.NewVersion(strings.TrimPrefix(latest.Version, "v"))

	updateAvailable := false
	if currErr == nil && latErr == nil {
		updateAvailable = latestVer.GreaterThan(currentVer)
	}

	result := update.CheckResult{
		CurrentVersion:  h.version,
		LatestVersion:   latest.Version,
		UpdateAvailable: updateAvailable,
		Release:         latest,
	}
	writeJSON(w, http.StatusOK, result)
}

// GET /api/system/info
func (h *SystemHandler) GetInfo(w http.ResponseWriter, r *http.Request) {
	isService := h.isServiceFn()

	serviceType := "none"
	if isService {
		if runtime.GOOS == "windows" {
			serviceType = "windows"
		} else {
			serviceType = "systemd"
		}
	} else if runtime.GOOS == "linux" && isRunningUnderSystemd() {
		isService = true
		serviceType = "systemd"
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"os":           runtime.GOOS,
		"arch":         runtime.GOARCH,
		"runtime":      "go",
		"isService":    isService,
		"serviceType":  serviceType,
		"serviceName":  "MiniCluster",
		"version":      h.version,
		"gitCommit":    h.gitCommit,
		"buildTime":    h.buildTime,
	})
}

// POST /api/system/service/install
func (h *SystemHandler) InstallService(w http.ResponseWriter, r *http.Request) {
	exePath, err := os.Executable()
	if err != nil {
		writeError(w, http.StatusInternalServerError, "cannot determine executable path: "+err.Error())
		return
	}

	if runtime.GOOS == "linux" {
		if err := installSystemdService(exePath); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{
			"message":     "Systemd service installed and started.",
			"serviceName": "minicluster",
		})
		return
	}

	if err := h.installServiceFn(exePath); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{
		"message":     "Service installed.",
		"serviceName": "MiniCluster",
	})
}

// DELETE /api/system/service/uninstall
func (h *SystemHandler) UninstallService(w http.ResponseWriter, r *http.Request) {
	if runtime.GOOS == "linux" {
		if err := uninstallSystemdService(); err != nil {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		writeJSON(w, http.StatusOK, map[string]string{"message": "Systemd service uninstalled."})
		return
	}

	if err := h.uninstallServiceFn(); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "Service uninstalled."})
}

// ── Linux systemd helpers ────────────────────────────────────────────────────

func isRunningUnderSystemd() bool {
	return os.Getenv("INVOCATION_ID") != ""
}

func installSystemdService(exePath string) error {
	unit := strings.Join([]string{
		"[Unit]",
		"Description=MiniCluster API Server",
		"After=network.target",
		"",
		"[Service]",
		"Type=simple",
		"ExecStart=" + exePath,
		"Restart=on-failure",
		"RestartSec=5",
		"StandardOutput=journal",
		"StandardError=journal",
		"SyslogIdentifier=minicluster",
		"",
		"[Install]",
		"WantedBy=multi-user.target",
	}, "\n")

	if err := os.WriteFile("/etc/systemd/system/minicluster.service", []byte(unit), 0o644); err != nil {
		return err
	}

	for _, args := range [][]string{
		{"systemctl", "daemon-reload"},
		{"systemctl", "enable", "minicluster"},
		{"systemctl", "start", "minicluster"},
	} {
		if out, err := exec.Command(args[0], args[1:]...).CombinedOutput(); err != nil {
			return &cmdError{cmd: strings.Join(args, " "), out: string(out), err: err}
		}
	}
	return nil
}

func uninstallSystemdService() error {
	for _, args := range [][]string{
		{"systemctl", "stop", "minicluster"},
		{"systemctl", "disable", "minicluster"},
	} {
		_ = exec.Command(args[0], args[1:]...).Run() // best-effort
	}
	_ = os.Remove("/etc/systemd/system/minicluster.service")
	_ = exec.Command("systemctl", "daemon-reload").Run()
	return nil
}

type cmdError struct {
	cmd string
	out string
	err error
}

func (e *cmdError) Error() string {
	return e.cmd + ": " + e.err.Error() + ": " + e.out
}
