package handlers

import (
	"archive/zip"
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/manifest"
	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// RegistryHandler provides package registry endpoints.
//
//   GET    /api/registry/packages                      → list packages
//   GET    /api/registry/packages/{name}               → list versions
//   GET    /api/registry/packages/{name}/{version}     → get details
//   POST   /api/registry/packages                      → publish (multipart ZIP)
//   DELETE /api/registry/packages/{name}/{version}     → unpublish
//   GET    /api/registry/packages/{name}/{version}/download → download file
//
//   GET    /api/registry/installs                      → list installs
//   POST   /api/registry/install                       → install a package
//   DELETE /api/registry/installs/{id}                 → remove install record
type RegistryHandler struct {
	appDB      *gorm.DB
	storageDir string
	log        *zap.Logger
}

func NewRegistryHandler(appDB *gorm.DB, storageDir string, log *zap.Logger) *RegistryHandler {
	if err := os.MkdirAll(storageDir, 0755); err != nil {
		log.Error("failed to create registry storage dir", zap.Error(err))
	}
	return &RegistryHandler{appDB: appDB, storageDir: storageDir, log: log}
}

// ── List packages ─────────────────────────────────────────────────────────

func (h *RegistryHandler) ListPackages(w http.ResponseWriter, r *http.Request) {
	var pkgs []models.Package
	q := h.appDB.Order("name asc, created_at desc")
	if name := r.URL.Query().Get("name"); name != "" {
		q = q.Where("name = ?", name)
	}
	if tag := r.URL.Query().Get("tag"); tag != "" {
		q = q.Where("tags LIKE ?", "%"+tag+"%")
	}
	if err := q.Find(&pkgs).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, pkgs)
}

// ── List versions ─────────────────────────────────────────────────────────

func (h *RegistryHandler) ListVersions(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	var pkgs []models.Package
	if err := h.appDB.Where("name = ?", name).Order("created_at desc").Find(&pkgs).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, pkgs)
}

// ── Get package ───────────────────────────────────────────────────────────

func (h *RegistryHandler) GetPackage(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	version := chi.URLParam(r, "version")
	var pkg models.Package
	res := h.appDB.Where("name = ? AND version = ?", name, version).First(&pkg)
	if res.Error == gorm.ErrRecordNotFound {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "package not found"})
		return
	}
	if res.Error != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": res.Error.Error()})
		return
	}
	writeJSON(w, http.StatusOK, pkg)
}

// ── Publish ───────────────────────────────────────────────────────────────

func (h *RegistryHandler) PublishPackage(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(128 << 20); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form (max 128 MB)"})
		return
	}

	file, header, err := r.FormFile("package")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing 'package' file field"})
		return
	}
	defer file.Close()

	// Read ZIP into memory so we can inspect and store it
	zipData, err := io.ReadAll(file)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to read upload"})
		return
	}

	// Parse & validate manifest.json from ZIP
	mf, err := manifest.ParseFromBytes(zipData)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if err := mf.Validate(); err != nil {
		writeJSON(w, http.StatusUnprocessableEntity, map[string]string{"error": err.Error()})
		return
	}

	// Allow form overrides (e.g. from older CLI that passes name/version separately)
	if n := r.FormValue("name"); n != "" {
		mf.Name = n
	}
	if v := r.FormValue("version"); v != "" {
		mf.Version = v
	}
	if d := r.FormValue("description"); d != "" {
		mf.Description = d
	}
	if a := r.FormValue("author"); a != "" {
		mf.Author = a
	}

	// Duplicate check
	var existing models.Package
	if res := h.appDB.Where("name = ? AND version = ?", mf.Name, mf.Version).First(&existing); res.Error == nil {
		writeJSON(w, http.StatusConflict, map[string]string{
			"error": fmt.Sprintf("package %s@%s already exists", mf.Name, mf.Version),
		})
		return
	}

	// Structured storage: storageDir/{name}/{version}/package.mcpkg
	pkgDir := filepath.Join(h.storageDir, mf.Name, mf.Version)
	if err := os.MkdirAll(pkgDir, 0755); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to create package dir"})
		return
	}
	pkgPath := filepath.Join(pkgDir, "package.mcpkg")
	if err := os.WriteFile(pkgPath, zipData, 0644); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "failed to write package file"})
		return
	}

	// Compute checksum
	sum := sha256.Sum256(zipData)
	checksum := hex.EncodeToString(sum[:])

	// Serialise manifest for storage
	manifestJSON, _ := json.Marshal(mf)

	tags := r.FormValue("tags")

	pkg := models.Package{
		ID:          newUUID(),
		Name:        mf.Name,
		Version:     mf.Version,
		Description: mf.Description,
		Author:      mf.Author,
		Tags:        tags,
		Manifest:    string(manifestJSON),
		FilePath:    pkgPath,
		FileSize:    int64(len(zipData)),
		Checksum:    checksum,
		IsPublic:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}
	_ = header // only used for original filename, not needed now

	if err := h.appDB.Create(&pkg).Error; err != nil {
		os.RemoveAll(pkgDir)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	h.log.Info("package published", zap.String("name", mf.Name), zap.String("version", mf.Version))
	writeJSON(w, http.StatusCreated, pkg)
}

// ── Unpublish ─────────────────────────────────────────────────────────────

func (h *RegistryHandler) UnpublishPackage(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	version := chi.URLParam(r, "version")
	var pkg models.Package
	res := h.appDB.Where("name = ? AND version = ?", name, version).First(&pkg)
	if res.Error == gorm.ErrRecordNotFound {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "package not found"})
		return
	}
	if res.Error != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": res.Error.Error()})
		return
	}
	// Remove structured directory
	pkgDir := filepath.Join(h.storageDir, name, version)
	os.RemoveAll(pkgDir)

	if err := h.appDB.Delete(&pkg).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "package deleted"})
}

// ── Download ──────────────────────────────────────────────────────────────

func (h *RegistryHandler) DownloadPackage(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	version := chi.URLParam(r, "version")
	var pkg models.Package
	res := h.appDB.Where("name = ? AND version = ?", name, version).First(&pkg)
	if res.Error == gorm.ErrRecordNotFound {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "package not found"})
		return
	}
	if res.Error != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": res.Error.Error()})
		return
	}
	h.appDB.Model(&pkg).UpdateColumn("downloads", gorm.Expr("downloads + 1"))
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s-%s.mcpkg"`, name, version))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, pkg.FilePath)
}

// ── List installs ─────────────────────────────────────────────────────────

func (h *RegistryHandler) ListInstalls(w http.ResponseWriter, r *http.Request) {
	var installs []models.PackageInstall
	if err := h.appDB.Order("created_at desc").Find(&installs).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, installs)
}

// ── Install ───────────────────────────────────────────────────────────────

type installRequest struct {
	Name    string            `json:"name"`
	Version string            `json:"version"`
	Env     map[string]string `json:"env"`     // caller-supplied env overrides
	AppID   *string           `json:"appId"`   // attach to this app
	AutoStart bool            `json:"autoStart"`
}

func (h *RegistryHandler) InstallPackage(w http.ResponseWriter, r *http.Request) {
	var req installRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if req.Name == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name is required"})
		return
	}

	// Resolve latest if version not specified
	if req.Version == "" {
		var pkg models.Package
		if err := h.appDB.Where("name = ?", req.Name).Order("created_at desc").First(&pkg).Error; err != nil {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "package not found"})
			return
		}
		req.Version = pkg.Version
	}

	var pkg models.Package
	if err := h.appDB.Where("name = ? AND version = ?", req.Name, req.Version).First(&pkg).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{
			"error": fmt.Sprintf("package %s@%s not found", req.Name, req.Version),
		})
		return
	}

	// Create install record (pending)
	install := models.PackageInstall{
		ID:          newUUID(),
		PackageID:   pkg.ID,
		PackageName: pkg.Name,
		Version:     pkg.Version,
		Status:      "installing",
		CreatedAt:   time.Now(),
	}
	if err := h.appDB.Create(&install).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Perform install synchronously (fast for local packages)
	svcID, installErr := h.performInstall(pkg, req)

	now := time.Now()
	if installErr != nil {
		install.Status = "failed"
		install.Error = installErr.Error()
		h.log.Error("package install failed", zap.String("name", pkg.Name), zap.Error(installErr))
	} else {
		install.Status = "installed"
		install.InstalledAt = &now
		install.ServiceID = svcID
	}
	h.appDB.Save(&install)

	h.appDB.Model(&pkg).UpdateColumn("downloads", gorm.Expr("downloads + 1"))

	if installErr != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{
			"error":     installErr.Error(),
			"installId": install.ID,
		})
		return
	}
	writeJSON(w, http.StatusCreated, install)
}

// performInstall extracts the package and creates a Service (+ ContainerConfig if docker).
// Returns the created service ID.
func (h *RegistryHandler) performInstall(pkg models.Package, req installRequest) (string, error) {
	// 1. Parse manifest from stored file
	zipData, err := os.ReadFile(pkg.FilePath)
	if err != nil {
		return "", fmt.Errorf("cannot read package file: %w", err)
	}
	mf, err := manifest.ParseFromBytes(zipData)
	if err != nil {
		return "", fmt.Errorf("cannot parse manifest: %w", err)
	}

	// 2. Extract to data/installed/{name}/{version}/
	extractDir := filepath.Join(filepath.Dir(filepath.Dir(pkg.FilePath)), "..", "installed", pkg.Name, pkg.Version)
	extractDir = filepath.Clean(extractDir)
	if err := extractZIP(zipData, extractDir); err != nil {
		return "", fmt.Errorf("extract failed: %w", err)
	}

	// 3. Run pre-install script if present
	if mf.Scripts.PreInstall != "" {
		if err := runScript(filepath.Join(extractDir, mf.Scripts.PreInstall), extractDir); err != nil {
			return "", fmt.Errorf("pre-install script failed: %w", err)
		}
	}

	// 4. Build environment variables: manifest defaults + caller overrides
	envMap := make(map[string]string)
	for k, v := range mf.Env {
		if v.Default != "" {
			envMap[k] = v.Default
		}
	}
	for k, v := range req.Env {
		envMap[k] = v
	}
	envJSON, _ := json.Marshal(envMap)

	// 5. Build working directory
	workDir := extractDir
	if mf.Runtime.WorkingDirectory != "" {
		workDir = filepath.Join(extractDir, mf.Runtime.WorkingDirectory)
	}

	// 6. Health check fields
	hcType := models.HealthCheckNone
	hcURL := ""
	hcCmd := ""
	hcInterval := 30
	hcTimeout := 5
	hcRetries := 3
	if mf.HealthCheck != nil {
		switch mf.HealthCheck.Type {
		case "http":
			hcType = models.HealthCheckHttp
			hcURL = fmt.Sprintf("http://localhost:%d%s", mf.HealthCheck.Port, mf.HealthCheck.Path)
		case "tcp":
			hcType = models.HealthCheckTcp
		case "command", "exec":
			hcType = models.HealthCheckExec
			hcCmd = mf.HealthCheck.Command
		}
		if mf.HealthCheck.IntervalSeconds > 0 {
			hcInterval = mf.HealthCheck.IntervalSeconds
		}
		if mf.HealthCheck.TimeoutSeconds > 0 {
			hcTimeout = mf.HealthCheck.TimeoutSeconds
		}
		if mf.HealthCheck.Retries > 0 {
			hcRetries = mf.HealthCheck.Retries
		}
	}

	svcID := newUUID()
	svcSlug := slugify(fmt.Sprintf("%s-%s", pkg.Name, pkg.Version))

	now := time.Now()

	switch mf.Runtime.Type {
	case manifest.RuntimeProcess, manifest.RuntimeScript:
		svc := models.Service{
			ID:                   svcID,
			Name:                 fmt.Sprintf("%s@%s", pkg.Name, pkg.Version),
			Slug:                 svcSlug,
			ServiceType:          models.ServiceTypeProcess,
			ExecutablePath:       mf.Runtime.Command,
			Arguments:            mf.Runtime.Arguments,
			EnvironmentVariables: string(envJSON),
			WorkingDirectory:     workDir,
			AutoStart:            req.AutoStart,
			AppID:                req.AppID,
			HealthCheckType:      hcType,
			HealthCheckUrl:       hcURL,
			HealthCheckCommand:   hcCmd,
			HealthCheckInterval:  hcInterval,
			HealthCheckTimeout:   hcTimeout,
			HealthCheckRetries:   hcRetries,
			RestartPolicy:        models.RestartOnFailure,
			CreatedAt:            now,
			ModifiedAt:           now,
		}
		if mf.Runtime.Shell {
			svc.ExecutablePath = "bash"
			svc.Arguments = "-c " + mf.Runtime.Command + " " + mf.Runtime.Arguments
		}
		if err := h.appDB.Create(&svc).Error; err != nil {
			return "", fmt.Errorf("failed to create service: %w", err)
		}

	case manifest.RuntimeDocker:
		svc := models.Service{
			ID:                  svcID,
			Name:                fmt.Sprintf("%s@%s", pkg.Name, pkg.Version),
			Slug:                svcSlug,
			ServiceType:         models.ServiceTypeDocker,
			EnvironmentVariables: string(envJSON),
			AutoStart:           req.AutoStart,
			AppID:               req.AppID,
			HealthCheckType:     hcType,
			HealthCheckUrl:      hcURL,
			HealthCheckInterval: hcInterval,
			HealthCheckTimeout:  hcTimeout,
			HealthCheckRetries:  hcRetries,
			RestartPolicy:       models.RestartOnFailure,
			CreatedAt:           now,
			ModifiedAt:          now,
		}
		if err := h.appDB.Create(&svc).Error; err != nil {
			return "", fmt.Errorf("failed to create service: %w", err)
		}

		tag := mf.Runtime.Tag
		if tag == "" {
			tag = "latest"
		}
		pullPolicy := models.PullPolicy(mf.Runtime.PullPolicy)
		if pullPolicy == "" {
			pullPolicy = models.PullIfNotPresent
		}
		cc := models.ContainerConfig{
			ServiceID:    svcID,
			Image:        mf.Runtime.Image,
			Tag:          tag,
			Registry:     mf.Runtime.Registry,
			PullPolicy:   pullPolicy,
			RemoveOnStop: true,
		}
		if err := h.appDB.Create(&cc).Error; err != nil {
			return "", fmt.Errorf("failed to create container config: %w", err)
		}
	}

	// 7. Run post-install script
	if mf.Scripts.PostInstall != "" {
		if err := runScript(filepath.Join(extractDir, mf.Scripts.PostInstall), extractDir); err != nil {
			h.log.Warn("post-install script failed", zap.String("name", pkg.Name), zap.Error(err))
			// non-fatal
		}
	}

	return svcID, nil
}

// ── Remove install record ─────────────────────────────────────────────────

func (h *RegistryHandler) RemoveInstall(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var install models.PackageInstall
	if err := h.appDB.First(&install, "id = ?", id).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "install not found"})
		return
	}
	now := time.Now()
	install.Status = "removed"
	install.RemovedAt = &now
	h.appDB.Save(&install)
	writeJSON(w, http.StatusOK, map[string]string{"message": "installation removed"})
}

// ── internal helpers ──────────────────────────────────────────────────────

// extractZIP extracts a ZIP archive to destDir, guarding against path traversal.
func extractZIP(zipData []byte, destDir string) error {
	if err := os.MkdirAll(destDir, 0755); err != nil {
		return err
	}
	zr, err := zip.NewReader(bytes.NewReader(zipData), int64(len(zipData)))
	if err != nil {
		return err
	}
	clean := filepath.Clean(destDir) + string(filepath.Separator)
	for _, f := range zr.File {
		target := filepath.Join(destDir, filepath.FromSlash(f.Name))
		if !strings.HasPrefix(filepath.Clean(target)+string(filepath.Separator), clean) {
			return fmt.Errorf("illegal path in archive: %s", f.Name)
		}
		if f.FileInfo().IsDir() {
			os.MkdirAll(target, f.Mode())
			continue
		}
		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}
		rc, err := f.Open()
		if err != nil {
			return err
		}
		dst, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			rc.Close()
			return err
		}
		_, copyErr := io.Copy(dst, rc)
		rc.Close()
		dst.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

// runScript executes a shell script in the given working directory.
func runScript(scriptPath, workDir string) error {
	if _, err := os.Stat(scriptPath); os.IsNotExist(err) {
		return nil // script listed in manifest but absent — skip
	}
	cmd := exec.Command("bash", scriptPath)
	cmd.Dir = workDir
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("script %s: %w\n%s", filepath.Base(scriptPath), err, string(out))
	}
	return nil
}

// sha256File computes the SHA-256 of a file on disk (kept for legacy use).
func sha256File(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", err
	}
	defer f.Close()
	h := sha256.New()
	if _, err := io.Copy(h, f); err != nil {
		return "", err
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
