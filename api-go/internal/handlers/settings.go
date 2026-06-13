package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type SettingsDto struct {
	ID                       string    `json:"id"`
	MetricsCollectionEnabled bool      `json:"metricsCollectionEnabled"`
	MetricsIntervalSeconds   int       `json:"metricsIntervalSeconds"`
	Theme                    string    `json:"theme"`
	UpdatedAt                time.Time `json:"updatedAt"`
}

type SettingsHandler struct {
	db *gorm.DB
}

func NewSettingsHandler(db *gorm.DB) *SettingsHandler {
	return &SettingsHandler{db: db}
}

func (h *SettingsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.get)
	r.Put("/", h.update)
	r.Get("/intervals", h.intervals)
	return r
}

func (h *SettingsHandler) get(w http.ResponseWriter, r *http.Request) {
	settings := h.getOrCreate()
	writeJSON(w, http.StatusOK, toSettingsDto(settings))
}

func (h *SettingsHandler) update(w http.ResponseWriter, r *http.Request) {
	settings := h.getOrCreate()
	var req SettingsDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	updates := map[string]any{
		"metrics_collection_enabled": req.MetricsCollectionEnabled,
		"theme":                      req.Theme,
		"updated_at":                 time.Now().UTC(),
	}
	if req.MetricsIntervalSeconds > 0 {
		updates["metrics_interval_seconds"] = req.MetricsIntervalSeconds
	}
	h.db.Model(settings).Updates(updates)
	writeJSON(w, http.StatusOK, toSettingsDto(settings))
}

func (h *SettingsHandler) intervals(w http.ResponseWriter, r *http.Request) {
	options := []map[string]any{
		{"seconds": 1, "label": "1 second"},
		{"seconds": 2, "label": "2 seconds"},
		{"seconds": 5, "label": "5 seconds"},
		{"seconds": 10, "label": "10 seconds"},
		{"seconds": 30, "label": "30 seconds"},
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"collectionIntervals": options,
		"aggregationIntervals": options,
		"intervals":            options,
	})
}

func (h *SettingsHandler) getOrCreate() *models.AppSettings {
	var settings models.AppSettings
	if err := h.db.First(&settings).Error; err != nil {
		settings = models.AppSettings{
			ID:                       uuid.NewString(),
			MetricsCollectionEnabled: true,
			MetricsIntervalSeconds:   5,
			Theme:                    "dark",
			UpdatedAt:                time.Now().UTC(),
		}
		h.db.Create(&settings)
	}
	return &settings
}

func toSettingsDto(s *models.AppSettings) SettingsDto {
	return SettingsDto{
		ID:                       s.ID,
		MetricsCollectionEnabled: s.MetricsCollectionEnabled,
		MetricsIntervalSeconds:   s.MetricsIntervalSeconds,
		Theme:                    s.Theme,
		UpdatedAt:                s.UpdatedAt,
	}
}
