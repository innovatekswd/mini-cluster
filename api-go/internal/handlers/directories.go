package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/models"
	"github.com/innovatek/minicluster/internal/workers"
	"gorm.io/gorm"
)

// DirectoriesHandler handles directory monitoring CRUD and snapshot queries.
type DirectoriesHandler struct {
	aggDB *gorm.DB
}

// NewDirectoriesHandler creates a new handler.
func NewDirectoriesHandler(aggDB *gorm.DB) *DirectoriesHandler {
	return &DirectoriesHandler{aggDB: aggDB}
}

// Routes returns the chi router for directory endpoints.
func (h *DirectoriesHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Get("/{id}/snapshots", h.snapshots)
	return r
}

// list returns all watched directories.
func (h *DirectoriesHandler) list(w http.ResponseWriter, r *http.Request) {
	dirs, err := workers.ListWatchedDirectories(h.aggDB)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, dirs)
}

// createRequest is the JSON body for creating a watched directory.
type createRequest struct {
	Path            string `json:"path"`
	Label           string `json:"label"`
	Recursive       bool   `json:"recursive"`
	IntervalSeconds int    `json:"intervalSeconds"`
}

// create adds a new watched directory.
func (h *DirectoriesHandler) create(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	if req.Path == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "path is required"})
		return
	}

	dir, err := workers.CreateWatchedDirectory(h.aggDB, req.Path, req.Label, req.Recursive, req.IntervalSeconds)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusCreated, dir)
}

// get returns a single watched directory by ID.
func (h *DirectoriesHandler) get(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var dir models.WatchedDirectory
	if err := h.aggDB.First(&dir, "id = ?", id).Error; err != nil {
		writeJSON(w, http.StatusNotFound, map[string]string{"error": "directory not found"})
		return
	}
	writeJSON(w, http.StatusOK, dir)
}

// updateRequest is the JSON body for updating a watched directory.
type updateRequest struct {
	Path            *string `json:"path"`
	Label           *string `json:"label"`
	Recursive       *bool   `json:"recursive"`
	IntervalSeconds *int    `json:"intervalSeconds"`
	Enabled         *bool   `json:"enabled"`
}

// update modifies an existing watched directory.
func (h *DirectoriesHandler) update(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	var req updateRequest
	if err := readJSON(r, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}

	updates := make(map[string]interface{})
	if req.Path != nil {
		updates["path"] = *req.Path
	}
	if req.Label != nil {
		updates["label"] = *req.Label
	}
	if req.Recursive != nil {
		updates["recursive"] = *req.Recursive
	}
	if req.IntervalSeconds != nil {
		updates["interval_seconds"] = *req.IntervalSeconds
	}
	if req.Enabled != nil {
		updates["enabled"] = *req.Enabled
	}

	dir, err := workers.UpdateWatchedDirectory(h.aggDB, id, updates)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, dir)
}

// delete removes a watched directory and its snapshots.
func (h *DirectoriesHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := workers.DeleteWatchedDirectory(h.aggDB, id); err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusNoContent, nil)
}

// snapshots returns snapshots for a watched directory.
func (h *DirectoriesHandler) snapshots(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")

	q := r.URL.Query()
	var from, to time.Time
	if f := q.Get("from"); f != "" {
		if t, err := time.Parse(time.RFC3339, f); err == nil {
			from = t
		}
	}
	if t := q.Get("to"); t != "" {
		if parsed, err := time.Parse(time.RFC3339, t); err == nil {
			to = parsed
		}
	}

	snapshots, err := workers.GetDirectorySnapshots(h.aggDB, id, from, to)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, snapshots)
}
