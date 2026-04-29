package handlers

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type ImportPayload struct {
	Services     []models.Service     `json:"services"`
	Environments []models.Environment `json:"environments"`
}

type ImportHandler struct {
	db *gorm.DB
}

func NewImportHandler(db *gorm.DB) *ImportHandler {
	return &ImportHandler{db: db}
}

func (h *ImportHandler) Import(w http.ResponseWriter, r *http.Request) {
	var payload ImportPayload
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON payload")
		return
	}

	imported := map[string]int{"services": 0, "environments": 0}

	for i := range payload.Environments {
		env := &payload.Environments[i]
		// upsert by name
		var existing models.Environment
		if h.db.Where("name = ?", env.Name).First(&existing).Error == nil {
			// update
			env.ID = existing.ID
			env.ModifiedAt = time.Now().UTC()
			h.db.Save(env)
		} else {
			env.ID = uuid.NewString()
			env.CreatedAt = time.Now().UTC()
			env.ModifiedAt = time.Now().UTC()
			h.db.Create(env)
			imported["environments"]++
		}
	}

	for i := range payload.Services {
		svc := &payload.Services[i]
		var existing models.Service
		if h.db.Where("name = ?", svc.Name).First(&existing).Error == nil {
			svc.ID = existing.ID
			svc.ModifiedAt = time.Now().UTC()
			h.db.Save(svc)
		} else {
			svc.ID = uuid.NewString()
			svc.Slug = slug_from(svc.Name)
			svc.CreatedAt = time.Now().UTC()
			svc.ModifiedAt = time.Now().UTC()
			h.db.Create(svc)
			imported["services"]++
		}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"imported": imported,
		"message":  "import complete",
	})
}

func slug_from(name string) string {
	return slugify(name)
}
