package handlers

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// RegistryHandler provides package registry endpoints.
//
//   GET    /api/registry/packages              → list packages
//   GET    /api/registry/packages/{name}       → list versions of a package
//   GET    /api/registry/packages/{name}/{ver} → get package details
//   POST   /api/registry/packages              → publish a package (multipart)
//   DELETE /api/registry/packages/{name}/{ver} → unpublish
//
//   GET    /api/registry/installs              → list installations
//   POST   /api/registry/install               → install a package
//   DELETE /api/registry/installs/{id}         → remove an installation record
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
	q := h.appDB.Order("name asc, version desc")

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

// ── List versions of a package ────────────────────────────────────────────

func (h *RegistryHandler) ListVersions(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	var pkgs []models.Package
	if err := h.appDB.Where("name = ?", name).Order("created_at desc").Find(&pkgs).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, pkgs)
}

// ── Get package details ───────────────────────────────────────────────────

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

// ── Publish (upload) a package ────────────────────────────────────────────

func (h *RegistryHandler) PublishPackage(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(64 << 20); err != nil { // 64 MB
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid multipart form"})
		return
	}

	file, header, err := r.FormFile("package")
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "missing 'package' field"})
		return
	}
	defer file.Close()

	// Read manifest fields from form
	name := r.FormValue("name")
	version := r.FormValue("version")
	description := r.FormValue("description")
	author := r.FormValue("author")
	tags := r.FormValue("tags")
	manifest := r.FormValue("manifest")

	if name == "" || version == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "name and version are required"})
		return
	}

	// Check for duplicate
	var existing models.Package
	if res := h.appDB.Where("name = ? AND version = ?", name, version).First(&existing); res.Error == nil {
		writeJSON(w, http.StatusConflict, map[string]string{"error": fmt.Sprintf("package %s@%s already exists", name, version)})
		return
	}

	// Write to storage
	safeFile := filepath.Clean(filepath.Join(h.storageDir, name+"@"+version+".mcpkg"))
	if err := writeToFile(safeFile, file); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Compute checksum
	checksum, err := sha256File(safeFile)
	if err != nil {
		os.Remove(safeFile)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	pkg := models.Package{
		ID:          newUUID(),
		Name:        name,
		Version:     version,
		Description: description,
		Author:      author,
		Tags:        tags,
		Manifest:    manifest,
		FilePath:    safeFile,
		FileSize:    header.Size,
		Checksum:    checksum,
		IsPublic:    true,
		CreatedAt:   time.Now(),
		UpdatedAt:   time.Now(),
	}

	if err := h.appDB.Create(&pkg).Error; err != nil {
		os.Remove(safeFile)
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	writeJSON(w, http.StatusCreated, pkg)
}

// ── Unpublish (delete) a package ─────────────────────────────────────────

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

	if pkg.FilePath != "" {
		os.Remove(pkg.FilePath)
	}

	if err := h.appDB.Delete(&pkg).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"message": "package deleted"})
}

// ── Download package file ─────────────────────────────────────────────────

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

	// Increment download counter
	h.appDB.Model(&pkg).UpdateColumn("downloads", gorm.Expr("downloads + 1"))

	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s@%s.mcpkg"`, name, version))
	w.Header().Set("Content-Type", "application/octet-stream")
	http.ServeFile(w, r, pkg.FilePath)
}

// ── List installations ────────────────────────────────────────────────────

func (h *RegistryHandler) ListInstalls(w http.ResponseWriter, r *http.Request) {
	var installs []models.PackageInstall
	if err := h.appDB.Order("created_at desc").Find(&installs).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, installs)
}

// ── Install a package ─────────────────────────────────────────────────────

type installRequest struct {
	Name    string `json:"name"`
	Version string `json:"version"`
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

	// Verify package exists
	var pkg models.Package
	if err := h.appDB.Where("name = ? AND version = ?", req.Name, req.Version).First(&pkg).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": fmt.Sprintf("package %s@%s not found", req.Name, req.Version)})
		return
	}

	install := models.PackageInstall{
		ID:          newUUID(),
		PackageID:   pkg.ID,
		PackageName: pkg.Name,
		Version:     pkg.Version,
		Status:      "installed",
		CreatedAt:   time.Now(),
	}
	now := time.Now()
	install.InstalledAt = &now

	if err := h.appDB.Create(&install).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}

	// Increment downloads
	h.appDB.Model(&pkg).UpdateColumn("downloads", gorm.Expr("downloads + 1"))

	writeJSON(w, http.StatusCreated, install)
}

// ── Remove installation record ────────────────────────────────────────────

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

// ── helpers ───────────────────────────────────────────────────────────────

func writeToFile(path string, r io.Reader) error {
	if err := os.MkdirAll(filepath.Dir(path), 0755); err != nil {
		return err
	}
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	_, err = io.Copy(f, r)
	return err
}

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
