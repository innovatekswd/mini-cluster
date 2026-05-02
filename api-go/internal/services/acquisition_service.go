package services

// acquisition_service.go — platform-aware binary acquisition for Spec 026 "acquire" components.
//
// Provider resolution order: native package manager → direct download fallback.
// Only providers available on the current system are tried.

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"

	"github.com/innovatek/minicluster/internal/manifest"
	"go.uber.org/zap"
)

// Platform identifies the current operating system / package manager combination.
type Platform string

const (
	PlatformWindowsAMD64 Platform = "windows-amd64"
	PlatformLinuxDeb     Platform = "linux-deb"
	PlatformLinuxRPM     Platform = "linux-rpm"
	PlatformLinuxArch    Platform = "linux-arch"
	PlatformDarwin       Platform = "macos"
	PlatformUnknown      Platform = "unknown"
)

// DetectPlatform returns the Platform for the current host.
func DetectPlatform() Platform {
	switch runtime.GOOS {
	case "windows":
		return PlatformWindowsAMD64
	case "darwin":
		return PlatformDarwin
	case "linux":
		// Prefer deb, fallback to rpm, fallback to arch
		if _, err := exec.LookPath("apt-get"); err == nil {
			return PlatformLinuxDeb
		}
		if _, err := exec.LookPath("dnf"); err == nil {
			return PlatformLinuxRPM
		}
		if _, err := exec.LookPath("pacman"); err == nil {
			return PlatformLinuxArch
		}
		// No recognized package manager — still Linux, will try direct download
		return PlatformLinuxDeb
	}
	return PlatformUnknown
}

// AcquisitionService dispatches acquire operations to the correct provider for the current platform.
type AcquisitionService struct {
	platform Platform
	log      *zap.Logger
}

func NewAcquisitionService(log *zap.Logger) *AcquisitionService {
	return &AcquisitionService{platform: DetectPlatform(), log: log}
}

// Install acquires a component binary as described by its AcquireConfig.
// installDir is the target directory where the binary should be placed when using the download provider.
// onProgress is called with human-readable status messages.
func (a *AcquisitionService) Install(ctx context.Context, cfg *manifest.AcquireConfig, installDir string, onProgress func(string)) error {
	if cfg == nil {
		return fmt.Errorf("acquire config is nil")
	}

	var target *manifest.AcquireTarget
	switch a.platform {
	case PlatformWindowsAMD64:
		target = cfg.Windows
	case PlatformLinuxDeb:
		target = cfg.LinuxDeb
	case PlatformLinuxRPM:
		target = cfg.LinuxRPM
	case PlatformDarwin:
		target = cfg.Macos
	}

	if target != nil {
		switch target.Provider {
		case "apt":
			return a.installApt(ctx, target, onProgress)
		case "dnf":
			return a.installDnf(ctx, target, onProgress)
		case "chocolatey":
			return a.installChocolatey(ctx, target, onProgress)
		case "brew":
			return a.installBrew(ctx, target, onProgress)
		case "winget":
			return a.installWinget(ctx, target, onProgress)
		}
	}

	// Fallback: direct download
	if cfg.Direct != nil {
		return a.installDirect(ctx, cfg.Direct, installDir, onProgress)
	}

	return fmt.Errorf("no acquisition strategy available for platform %q", a.platform)
}

// ── apt ──────────────────────────────────────────────────────────────────

func (a *AcquisitionService) installApt(ctx context.Context, t *manifest.AcquireTarget, onProgress func(string)) error {
	if _, err := exec.LookPath("apt-get"); err != nil {
		return fmt.Errorf("apt-get not found")
	}
	pkg := t.Package
	if t.Version != "" {
		pkg = fmt.Sprintf("%s=%s", t.Package, t.Version)
	}
	onProgress(fmt.Sprintf("Installing via apt: %s", pkg))
	cmd := exec.CommandContext(ctx, "apt-get", "install", "-y", "--no-install-recommends", pkg) //nolint:gosec
	cmd.Env = append(os.Environ(), "DEBIAN_FRONTEND=noninteractive")
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("apt-get failed: %w\n%s", err, out)
	}
	return nil
}

// ── dnf ──────────────────────────────────────────────────────────────────

func (a *AcquisitionService) installDnf(ctx context.Context, t *manifest.AcquireTarget, onProgress func(string)) error {
	if _, err := exec.LookPath("dnf"); err != nil {
		return fmt.Errorf("dnf not found")
	}
	pkg := t.Package
	if t.Version != "" {
		pkg = fmt.Sprintf("%s-%s", t.Package, t.Version)
	}
	onProgress(fmt.Sprintf("Installing via dnf: %s", pkg))
	cmd := exec.CommandContext(ctx, "dnf", "install", "-y", pkg) //nolint:gosec
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("dnf failed: %w\n%s", err, out)
	}
	return nil
}

// ── chocolatey ───────────────────────────────────────────────────────────

func (a *AcquisitionService) installChocolatey(ctx context.Context, t *manifest.AcquireTarget, onProgress func(string)) error {
	if _, err := exec.LookPath("choco"); err != nil {
		return fmt.Errorf("chocolatey (choco) not found")
	}
	args := []string{"install", t.Package, "-y"}
	if t.Version != "" {
		args = append(args, "--version", t.Version)
	}
	onProgress(fmt.Sprintf("Installing via chocolatey: %s", t.Package))
	cmd := exec.CommandContext(ctx, "choco", args...) //nolint:gosec
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("choco failed: %w\n%s", err, out)
	}
	return nil
}

// ── brew ─────────────────────────────────────────────────────────────────

func (a *AcquisitionService) installBrew(ctx context.Context, t *manifest.AcquireTarget, onProgress func(string)) error {
	if _, err := exec.LookPath("brew"); err != nil {
		return fmt.Errorf("brew not found")
	}
	formula := t.Formula
	if t.Tap != "" {
		formula = t.Tap + "/" + t.Formula
	}
	onProgress(fmt.Sprintf("Installing via brew: %s", formula))
	cmd := exec.CommandContext(ctx, "brew", "install", formula) //nolint:gosec
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("brew failed: %w\n%s", err, out)
	}
	return nil
}

// ── winget ───────────────────────────────────────────────────────────────

func (a *AcquisitionService) installWinget(ctx context.Context, t *manifest.AcquireTarget, onProgress func(string)) error {
	if _, err := exec.LookPath("winget"); err != nil {
		return fmt.Errorf("winget not found")
	}
	args := []string{"install", "--id", t.Package, "--silent"}
	if t.Version != "" {
		args = append(args, "--version", t.Version)
	}
	onProgress(fmt.Sprintf("Installing via winget: %s", t.Package))
	cmd := exec.CommandContext(ctx, "winget", args...) //nolint:gosec
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("winget failed: %w\n%s", err, out)
	}
	return nil
}

// ── direct download ───────────────────────────────────────────────────────

// installDirect downloads a binary from a direct URL, verifies checksum, extracts, and places
// the binary in installDir.
func (a *AcquisitionService) installDirect(ctx context.Context, t *manifest.AcquireTarget, installDir string, onProgress func(string)) error {
	platform := string(a.platform)
	// Try exact platform key first, then GOOS-amd64 fallback
	url, ok := t.URLs[platform]
	if !ok {
		url, ok = t.URLs[runtime.GOOS+"-amd64"]
	}
	if !ok {
		// Last fallback: first URL in map
		for _, u := range t.URLs {
			url = u
			break
		}
	}
	if url == "" {
		return fmt.Errorf("no download URL for platform %q", platform)
	}

	onProgress(fmt.Sprintf("Downloading %s...", url))
	data, err := downloadWithContext(ctx, url)
	if err != nil {
		return fmt.Errorf("download failed: %w", err)
	}

	// Verify checksum if provided
	if expected, ok := t.Checksums[platform]; ok && expected != "" {
		sum := sha256.Sum256(data)
		got := "sha256:" + hex.EncodeToString(sum[:])
		if got != expected {
			return fmt.Errorf("checksum mismatch: got %s, expected %s", got, expected)
		}
		onProgress("Checksum verified.")
	}

	// Determine archive type from URL
	lurl := strings.ToLower(url)
	if err := os.MkdirAll(installDir, 0755); err != nil {
		return fmt.Errorf("cannot create install dir: %w", err)
	}

	switch {
	case strings.HasSuffix(lurl, ".tar.gz") || strings.HasSuffix(lurl, ".tgz"):
		onProgress("Extracting archive...")
		if err := extractTarGz(data, installDir, t.Extract.Binary); err != nil {
			return fmt.Errorf("extract failed: %w", err)
		}
	case strings.HasSuffix(lurl, ".zip"):
		onProgress("Extracting archive...")
		if err := extractDirectZip(data, installDir, t.Extract.Binary); err != nil {
			return fmt.Errorf("extract failed: %w", err)
		}
	default:
		// Treat as raw binary
		binPath := filepath.Join(installDir, t.Extract.Binary)
		if binPath == installDir+"/" {
			binPath = filepath.Join(installDir, filepath.Base(url))
		}
		if err := os.WriteFile(binPath, data, 0755); err != nil { //nolint:gosec
			return fmt.Errorf("write binary: %w", err)
		}
	}

	onProgress("Acquisition complete.")
	return nil
}

// downloadWithContext downloads URL data respecting ctx cancellation.
func downloadWithContext(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d from %s", resp.StatusCode, url)
	}
	return io.ReadAll(resp.Body)
}

// extractTarGz extracts data (.tar.gz) to dir, placing binaryName if set.
func extractTarGz(data []byte, dir string, binaryName string) error {
	tmpFile, err := os.CreateTemp("", "mcpkg-*.tar.gz")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())
	if _, err := tmpFile.Write(data); err != nil {
		return err
	}
	tmpFile.Close()

	args := []string{"-xzf", tmpFile.Name(), "-C", dir}
	if binaryName != "" {
		args = append(args, "--wildcards", "*"+binaryName)
	}
	cmd := exec.Command("tar", args...) //nolint:gosec
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("tar: %w\n%s", err, out)
	}
	// Flatten: if binaryName is set and inside a sub-dir, move it up
	if binaryName != "" {
		_ = flattenBinary(dir, binaryName)
	}
	return nil
}

// extractDirectZip extracts data (.zip) to dir.
func extractDirectZip(data []byte, dir string, binaryName string) error {
	// Reuse the zip extractor from registry.go via a small helper
	tmpFile, err := os.CreateTemp("", "mcpkg-*.zip")
	if err != nil {
		return err
	}
	defer os.Remove(tmpFile.Name())
	if _, err := tmpFile.Write(data); err != nil {
		return err
	}
	tmpFile.Close()

	cmd := exec.Command("unzip", "-o", tmpFile.Name(), "-d", dir) //nolint:gosec
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("unzip: %w\n%s", err, out)
	}
	if binaryName != "" {
		_ = flattenBinary(dir, binaryName)
	}
	return nil
}

// flattenBinary walks dir and moves binaryName to the top level if it's nested.
func flattenBinary(dir, binaryName string) error {
	return filepath.Walk(dir, func(path string, info os.FileInfo, err error) error {
		if err != nil || info.IsDir() {
			return err
		}
		if filepath.Base(path) == binaryName && filepath.Dir(path) != dir {
			dest := filepath.Join(dir, binaryName)
			if err := os.Rename(path, dest); err != nil {
				return err
			}
		}
		return nil
	})
}
