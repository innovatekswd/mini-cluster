package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type EnvironmentDto struct {
	ID          string    `json:"id"`
	Name        string    `json:"name"`
	Slug        string    `json:"slug"`
	Description string    `json:"description"`
	Variables   string    `json:"variables"`
	IsActive    bool      `json:"isActive"`
	CreatedAt   time.Time `json:"createdAt"`
	ModifiedAt  time.Time `json:"modifiedAt"`
}

type CreateEnvironmentDto struct {
	Name        string `json:"name"`
	Description string `json:"description"`
	Variables   string `json:"variables"`
}

type EnvironmentsHandler struct {
	db *gorm.DB
}

func NewEnvironmentsHandler(db *gorm.DB) *EnvironmentsHandler {
	return &EnvironmentsHandler{db: db}
}

func (h *EnvironmentsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/active", h.getActive)
	r.Get("/{id}", h.get)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Post("/{id}/activate", h.activate)
	return r
}

func (h *EnvironmentsHandler) list(w http.ResponseWriter, r *http.Request) {
	var envs []models.Environment
	if err := h.db.Find(&envs).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	dtos := make([]EnvironmentDto, len(envs))
	for i, e := range envs {
		dtos[i] = toEnvDto(&e)
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (h *EnvironmentsHandler) getActive(w http.ResponseWriter, r *http.Request) {
	var env models.Environment
	err := h.db.Where("is_active = true").First(&env).Error
	if err != nil {
		if isNotFound(err) {
			// auto-activate first environment if one exists; otherwise return null
			var first models.Environment
			if ferr := h.db.First(&first).Error; ferr != nil {
				writeJSON(w, http.StatusOK, nil)
				return
			}
			h.db.Model(&first).Update("is_active", true)
			writeJSON(w, http.StatusOK, toEnvDto(&first))
			return
		}
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toEnvDto(&env))
}

func (h *EnvironmentsHandler) get(w http.ResponseWriter, r *http.Request) {
	var env models.Environment
	if err := h.db.First(&env, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, toEnvDto(&env))
}

func (h *EnvironmentsHandler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateEnvironmentDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	name := req.Name
	if name == "" {
		name = "Environment"
	}
	env := models.Environment{
		ID:          uuid.NewString(),
		Name:        name,
		Slug:        uniqueSlug(h.db, "environments", slugify(name), ""),
		Description: req.Description,
		Variables:   req.Variables,
		CreatedAt:   time.Now().UTC(),
		ModifiedAt:  time.Now().UTC(),
	}
	if err := h.db.Create(&env).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toEnvDto(&env))
}

func (h *EnvironmentsHandler) update(w http.ResponseWriter, r *http.Request) {
	var env models.Environment
	if err := h.db.First(&env, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	var req CreateEnvironmentDto
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
	updates["variables"] = req.Variables
	if err := h.db.Model(&env).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toEnvDto(&env))
}

func (h *EnvironmentsHandler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Delete(&models.Environment{}, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *EnvironmentsHandler) activate(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	// deactivate all
	h.db.Model(&models.Environment{}).Where("is_active = true").Update("is_active", false)
	// activate target
	var env models.Environment
	if err := h.db.First(&env, "id = ?", id).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	h.db.Model(&env).Update("is_active", true)
	writeJSON(w, http.StatusOK, toEnvDto(&env))
}

func toEnvDto(e *models.Environment) EnvironmentDto {
	return EnvironmentDto{
		ID:          e.ID,
		Name:        e.Name,
		Slug:        e.Slug,
		Description: e.Description,
		Variables:   e.Variables,
		IsActive:    e.IsActive,
		CreatedAt:   e.CreatedAt,
		ModifiedAt:  e.ModifiedAt,
	}
}
