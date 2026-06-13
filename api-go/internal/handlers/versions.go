package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type ServiceVersionDto struct {
	ID            string    `json:"id"`
	ServiceID     string    `json:"serviceId"`
	VersionNumber int       `json:"versionNumber"`
	Snapshot      string    `json:"snapshot"`
	ChangeNote    string    `json:"changeNote"`
	CreatedAt     time.Time `json:"createdAt"`
	CreatedBy     string    `json:"createdBy"`
}

type VersionsHandler struct {
	db *gorm.DB
}

func NewVersionsHandler(db *gorm.DB) *VersionsHandler {
	return &VersionsHandler{db: db}
}

// ServiceRoutes returns a router with /versions routes (for standalone mount).
func (h *VersionsHandler) ServiceRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/versions", h.list)
	r.Post("/versions", h.create)
	return r
}

// InjectServiceRoutes registers /versions routes directly onto r (no Mount).
// Use this inside ServicesHandler.AddSubRoutes to avoid chi Mount("/") conflicts.
func (h *VersionsHandler) InjectServiceRoutes(r chi.Router) {
	r.Get("/versions", h.list)
	r.Post("/versions", h.create)
}

// StandaloneRoutes mounts under /api/service-versions
func (h *VersionsHandler) StandaloneRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/{versionId}", h.get)
	r.Get("/{versionId}/diff", h.diff)
	r.Post("/{versionId}/rollback", h.rollback)
	return r
}

func (h *VersionsHandler) list(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	if limit <= 0 {
		limit = 50
	}
	var versions []models.ServiceVersion
	h.db.Where("service_id = ?", svcID).
		Order("version_number desc").
		Limit(limit).
		Find(&versions)
	dtos := make([]ServiceVersionDto, len(versions))
	for i, v := range versions {
		dtos[i] = toVersionDto(&v)
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (h *VersionsHandler) create(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// snapshot the current service state
	var svc models.Service
	if err := h.db.First(&svc, "id = ?", svcID).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	snapshotBytes, _ := json.Marshal(svc)

	var maxVer int
	h.db.Model(&models.ServiceVersion{}).
		Where("service_id = ?", svcID).
		Select("COALESCE(MAX(version_number),0)").
		Scan(&maxVer)

	var body struct {
		ChangeNote string `json:"changeNote"`
	}
	_ = readJSON(r, &body)

	ver := models.ServiceVersion{
		ID:            uuid.NewString(),
		ServiceID:     svcID,
		VersionNumber: maxVer + 1,
		Snapshot:      string(snapshotBytes),
		ChangeNote:    body.ChangeNote,
		CreatedAt:     time.Now().UTC(),
	}
	h.db.Create(&ver)
	writeJSON(w, http.StatusCreated, toVersionDto(&ver))
}

func (h *VersionsHandler) get(w http.ResponseWriter, r *http.Request) {
	var ver models.ServiceVersion
	if err := h.db.First(&ver, "id = ?", chi.URLParam(r, "versionId")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, toVersionDto(&ver))
}

func (h *VersionsHandler) diff(w http.ResponseWriter, r *http.Request) {
	var ver models.ServiceVersion
	if err := h.db.First(&ver, "id = ?", chi.URLParam(r, "versionId")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	compareToID := r.URL.Query().Get("compareToId")
	result := map[string]any{"version": toVersionDto(&ver)}
	if compareToID != "" {
		var compare models.ServiceVersion
		if err := h.db.First(&compare, "id = ?", compareToID).Error; err == nil {
			result["compareTo"] = toVersionDto(&compare)
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *VersionsHandler) rollback(w http.ResponseWriter, r *http.Request) {
	var ver models.ServiceVersion
	if err := h.db.First(&ver, "id = ?", chi.URLParam(r, "versionId")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var snapshot models.Service
	if err := json.Unmarshal([]byte(ver.Snapshot), &snapshot); err != nil {
		writeError(w, http.StatusInternalServerError, "invalid snapshot")
		return
	}

	// restore service fields from snapshot (excluding ID)
	h.db.Model(&models.Service{}).Where("id = ?", ver.ServiceID).Updates(map[string]any{
		"executable_path":       snapshot.ExecutablePath,
		"arguments":             snapshot.Arguments,
		"environment_variables": snapshot.EnvironmentVariables,
		"working_directory":     snapshot.WorkingDirectory,
		"modified_at":           time.Now().UTC(),
	})

	writeJSON(w, http.StatusOK, map[string]string{
		"message":   "rolled back",
		"serviceId": ver.ServiceID,
		"versionId": ver.ID,
	})
}

func (h *VersionsHandler) resolveServiceID(identifier string) (string, error) {
	var svc models.Service
	err := h.db.Select("id").
		Where("id = ? OR name = ? OR slug = ?", identifier, identifier, identifier).
		First(&svc).Error
	return svc.ID, err
}

func toVersionDto(v *models.ServiceVersion) ServiceVersionDto {
	return ServiceVersionDto{
		ID:            v.ID,
		ServiceID:     v.ServiceID,
		VersionNumber: v.VersionNumber,
		Snapshot:      v.Snapshot,
		ChangeNote:    v.ChangeNote,
		CreatedAt:     v.CreatedAt,
		CreatedBy:     v.CreatedBy,
	}
}
