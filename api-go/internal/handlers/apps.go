package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

// ─── DTOs ──────────────────────────────────────────────────────────────────

type AppDto struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Icon        string    `json:"icon"`
	Color       string    `json:"color"`
	ParentAppID *string   `json:"parentAppId"`
	SortOrder   int       `json:"sortOrder"`
	CreatedAt   time.Time `json:"createdAt"`
	ModifiedAt  time.Time `json:"modifiedAt"`
}

type AppWithStatsDto struct {
	AppDto
	ServiceCount int `json:"serviceCount"`
	RunningCount int `json:"runningCount"`
	StoppedCount int `json:"stoppedCount"`
}

type CreateAppDto struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	Color       string  `json:"color"`
	ParentAppID *string `json:"parentAppId"`
}

type UpdateAppDto struct {
	Name        string  `json:"name"`
	Description string  `json:"description"`
	Icon        string  `json:"icon"`
	Color       string  `json:"color"`
	ParentAppID *string `json:"parentAppId"`
	SortOrder   *int    `json:"sortOrder"`
}

// ─── Handler ───────────────────────────────────────────────────────────────

type AppsHandler struct {
	db      *gorm.DB
	runtime RuntimeStatusProvider
}

// RuntimeStatusProvider lets the handler check if a service is running
// without a hard dependency on the process manager.
type RuntimeStatusProvider interface {
	GetStatus(serviceID string) string // "Running", "Stopped", etc.
}

func NewAppsHandler(db *gorm.DB, runtime RuntimeStatusProvider) *AppsHandler {
	return &AppsHandler{db: db, runtime: runtime}
}

func (h *AppsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{identifier}", h.get)
	r.Put("/{identifier}", h.update)
	r.Delete("/{identifier}", h.delete)
	return r
}

func (h *AppsHandler) list(w http.ResponseWriter, r *http.Request) {
	var apps []models.App
	if err := h.db.Order("sort_order asc, name asc").Find(&apps).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	// get service counts per app
	type countRow struct {
		AppID string
		Count int
	}
	var counts []countRow
	h.db.Model(&models.Service{}).
		Select("app_id, count(*) as count").
		Group("app_id").
		Scan(&counts)
	countMap := make(map[string]int, len(counts))
	for _, c := range counts {
		countMap[c.AppID] = c.Count
	}

	result := make([]AppWithStatsDto, len(apps))
	for i, a := range apps {
		dto := toAppWithStats(&a, countMap[a.ID], h.runtime)
		result[i] = dto
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *AppsHandler) get(w http.ResponseWriter, r *http.Request) {
	app, err := h.resolveApp(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, toAppDto(app))
}

func (h *AppsHandler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateAppDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}

	var maxOrder int
	h.db.Model(&models.App{}).Select("COALESCE(MAX(sort_order),0)").Scan(&maxOrder)

	app := models.App{
		ID:          uuid.NewString(),
		Name:        req.Name,
		Slug:        slugify(req.Name),
		Description: req.Description,
		Icon:        req.Icon,
		Color:       req.Color,
		ParentAppID: req.ParentAppID,
		SortOrder:   maxOrder + 1,
		CreatedAt:   time.Now().UTC(),
		ModifiedAt:  time.Now().UTC(),
	}
	// ensure unique slug
	app.Slug = uniqueSlug(h.db, "apps", app.Slug, "")

	if err := h.db.Create(&app).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toAppDto(&app))
}

func (h *AppsHandler) update(w http.ResponseWriter, r *http.Request) {
	app, err := h.resolveApp(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var req UpdateAppDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updates := map[string]any{"modified_at": time.Now().UTC()}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.Description != "" {
		updates["description"] = req.Description
	}
	if req.Icon != "" {
		updates["icon"] = req.Icon
	}
	if req.Color != "" {
		updates["color"] = req.Color
	}
	if req.ParentAppID != nil {
		updates["parent_app_id"] = req.ParentAppID
	}
	if req.SortOrder != nil {
		updates["sort_order"] = *req.SortOrder
	}

	if err := h.db.Model(app).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toAppDto(app))
}

func (h *AppsHandler) delete(w http.ResponseWriter, r *http.Request) {
	app, err := h.resolveApp(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if err := h.db.Delete(app).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *AppsHandler) resolveApp(identifier string) (*models.App, error) {
	var app models.App
	err := h.db.Where("id = ? OR name = ? OR slug = ?", identifier, identifier, identifier).
		First(&app).Error
	return &app, err
}

// ─── Mapping helpers ───────────────────────────────────────────────────────

func toAppDto(a *models.App) AppDto {
	return AppDto{
		ID:          a.ID,
		Name:        a.Name,
		Slug:        a.Slug,
		Description: a.Description,
		Icon:        a.Icon,
		Color:       a.Color,
		ParentAppID: a.ParentAppID,
		SortOrder:   a.SortOrder,
		CreatedAt:   a.CreatedAt,
		ModifiedAt:  a.ModifiedAt,
	}
}

func toAppWithStats(a *models.App, serviceCount int, runtime RuntimeStatusProvider) AppWithStatsDto {
	// running count would need service IDs — simplified: report total only
	return AppWithStatsDto{
		AppDto:       toAppDto(a),
		ServiceCount: serviceCount,
	}
}
