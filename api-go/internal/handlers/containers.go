package handlers

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/models"
	"github.com/innovatek/minicluster/internal/services"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// ContainerHandler provides container-infrastructure endpoints:
//
//	GET  /api/containers/runtime               → daemon version + status
//	GET  /api/images                           → list local images
//	POST /api/images/pull                      → pull an image
//	DELETE /api/images/{name}                  → remove an image
//
//	GET  /api/services/{id}/container          → get ContainerConfig
//	PUT  /api/services/{id}/container          → create/update ContainerConfig
//	DELETE /api/services/{id}/container        → remove ContainerConfig
//	GET  /api/services/{id}/container/stats    → live CPU/mem stats
//	POST /api/services/{id}/container/exec     → exec command in container
type ContainerHandler struct {
	svc    services.IContainerService
	appDB  *gorm.DB
	logsDB *gorm.DB
	log    *zap.Logger
}

func NewContainerHandler(svc services.IContainerService, appDB, logsDB *gorm.DB, log *zap.Logger) *ContainerHandler {
	return &ContainerHandler{svc: svc, appDB: appDB, logsDB: logsDB, log: log}
}

// ─── Runtime info ─────────────────────────────────────────────────────────

func (h *ContainerHandler) GetRuntime(w http.ResponseWriter, r *http.Request) {
	if h.svc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "container runtime not configured",
		})
		return
	}
	if err := h.svc.Ping(r.Context()); err != nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error":   "container runtime unreachable",
			"details": err.Error(),
		})
		return
	}
	info, err := h.svc.Info(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, info)
}

// ─── Image management ─────────────────────────────────────────────────────

func (h *ContainerHandler) ListImages(w http.ResponseWriter, r *http.Request) {
	if err := h.requireRuntime(w); err != nil {
		return
	}
	imgs, err := h.svc.ListImages(r.Context())
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, imgs)
}

func (h *ContainerHandler) PullImage(w http.ResponseWriter, r *http.Request) {
	if err := h.requireRuntime(w); err != nil {
		return
	}
	var req struct {
		Image string `json:"image"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || strings.TrimSpace(req.Image) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image is required"})
		return
	}

	// Stream progress as newline-delimited JSON (SSE-lite)
	w.Header().Set("Content-Type", "application/x-ndjson")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(http.StatusOK)
	flush := func() {
		if f, ok := w.(http.Flusher); ok {
			f.Flush()
		}
	}

	err := h.svc.PullImage(r.Context(), req.Image, func(line string) {
		data, _ := json.Marshal(map[string]string{"progress": line})
		_, _ = w.Write(append(data, '\n'))
		flush()
	})
	if err != nil {
		data, _ := json.Marshal(map[string]string{"error": err.Error()})
		_, _ = w.Write(append(data, '\n'))
		flush()
		return
	}
	data, _ := json.Marshal(map[string]string{"status": "done", "image": req.Image})
	_, _ = w.Write(append(data, '\n'))
	flush()
}

func (h *ContainerHandler) RemoveImage(w http.ResponseWriter, r *http.Request) {
	if err := h.requireRuntime(w); err != nil {
		return
	}
	name := chi.URLParam(r, "name")
	force := r.URL.Query().Get("force") == "true"
	if err := h.svc.RemoveImage(r.Context(), name, force); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Per-service container config ─────────────────────────────────────────

func (h *ContainerHandler) GetConfig(w http.ResponseWriter, r *http.Request) {
	svcID := chi.URLParam(r, "id")
	var cfg models.ContainerConfig
	if err := h.appDB.Where("service_id = ?", svcID).First(&cfg).Error; err != nil {
		if err == gorm.ErrRecordNotFound {
			writeJSON(w, http.StatusNotFound, map[string]string{"error": "no container config"})
			return
		}
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, cfg)
}

func (h *ContainerHandler) UpsertConfig(w http.ResponseWriter, r *http.Request) {
	svcID := chi.URLParam(r, "id")

	// Verify service exists
	var svc models.Service
	if err := h.appDB.First(&svc, "id = ?", svcID).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "service not found"})
		return
	}

	var input models.ContainerConfig
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON"})
		return
	}
	if strings.TrimSpace(input.Image) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "image is required"})
		return
	}

	input.ServiceID = svcID
	if input.Tag == "" {
		input.Tag = "latest"
	}
	if input.PullPolicy == "" {
		input.PullPolicy = models.PullIfNotPresent
	}

	// Upsert
	var existing models.ContainerConfig
	err := h.appDB.Where("service_id = ?", svcID).First(&existing).Error
	if err == gorm.ErrRecordNotFound {
		input.ID = newUUID()
		if err := h.appDB.Create(&input).Error; err != nil {
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
			return
		}
		// Set ServiceType to Docker
		h.appDB.Model(&svc).Update("service_type", models.ServiceTypeDocker)
		writeJSON(w, http.StatusCreated, input)
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	input.ID = existing.ID
	if err := h.appDB.Save(&input).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	h.appDB.Model(&svc).Update("service_type", models.ServiceTypeDocker)
	writeJSON(w, http.StatusOK, input)
}

func (h *ContainerHandler) DeleteConfig(w http.ResponseWriter, r *http.Request) {
	svcID := chi.URLParam(r, "id")
	if err := h.appDB.Where("service_id = ?", svcID).Delete(&models.ContainerConfig{}).Error; err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	// Reset service type to Process
	h.appDB.Model(&models.Service{}).Where("id = ?", svcID).Update("service_type", models.ServiceTypeProcess)
	w.WriteHeader(http.StatusNoContent)
}

// ─── Per-service container stats ──────────────────────────────────────────

func (h *ContainerHandler) GetStats(w http.ResponseWriter, r *http.Request) {
	if err := h.requireRuntime(w); err != nil {
		return
	}
	svcID := chi.URLParam(r, "id")
	var cfg models.ContainerConfig
	if err := h.appDB.Where("service_id = ?", svcID).First(&cfg).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no container config"})
		return
	}
	if cfg.ContainerID == "" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "container not running"})
		return
	}
	stats, err := h.svc.GetStats(r.Context(), cfg.ContainerID)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, stats)
}

// ─── Exec ──────────────────────────────────────────────────────────────────

func (h *ContainerHandler) Exec(w http.ResponseWriter, r *http.Request) {
	if err := h.requireRuntime(w); err != nil {
		return
	}
	svcID := chi.URLParam(r, "id")
	var req struct {
		Command []string `json:"command"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Command) == 0 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "command is required"})
		return
	}

	var cfg models.ContainerConfig
	if err := h.appDB.Where("service_id = ?", svcID).First(&cfg).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "no container config"})
		return
	}
	if cfg.ContainerID == "" {
		writeJSON(w, http.StatusConflict, map[string]string{"error": "container not running"})
		return
	}

	result, err := h.svc.Exec(r.Context(), cfg.ContainerID, req.Command)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, result)
}

// ─── helpers ──────────────────────────────────────────────────────────────

func (h *ContainerHandler) requireRuntime(w http.ResponseWriter) error {
	if h.svc == nil {
		writeJSON(w, http.StatusServiceUnavailable, map[string]string{
			"error": "container runtime not configured",
		})
		return gorm.ErrInvalidDB // any non-nil error
	}
	return nil
}
