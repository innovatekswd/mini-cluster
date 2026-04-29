package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type GroupsHandler struct {
	db *gorm.DB
}

func NewGroupsHandler(db *gorm.DB) *GroupsHandler {
	return &GroupsHandler{db: db}
}

func (h *GroupsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/tree", h.tree)
	r.Get("/{id}", h.get)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Get("/{id}/services", h.services)
	r.Post("/{id}/services/{serviceId}", h.addService)
	r.Delete("/{id}/services/{serviceId}", h.removeService)
	return r
}

func (h *GroupsHandler) list(w http.ResponseWriter, r *http.Request) {
	var groups []models.ServiceGroup
	h.db.Preload("Variables").Order("sort_order").Find(&groups)
	writeJSON(w, http.StatusOK, groups)
}

func (h *GroupsHandler) tree(w http.ResponseWriter, r *http.Request) {
	var roots []models.ServiceGroup
	h.db.Preload("Variables").Where("parent_id IS NULL").Order("sort_order").Find(&roots)
	writeJSON(w, http.StatusOK, roots)
}

func (h *GroupsHandler) get(w http.ResponseWriter, r *http.Request) {
	var group models.ServiceGroup
	if err := h.db.Preload("Variables").First(&group, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, group)
}

func (h *GroupsHandler) create(w http.ResponseWriter, r *http.Request) {
	var req models.ServiceGroup
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.ID = uuid.NewString()
	req.CreatedAt = time.Now().UTC()
	if err := h.db.Create(&req).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, req)
}

func (h *GroupsHandler) update(w http.ResponseWriter, r *http.Request) {
	var group models.ServiceGroup
	if err := h.db.First(&group, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if err := readJSON(r, &group); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	h.db.Save(&group)
	writeJSON(w, http.StatusOK, group)
}

func (h *GroupsHandler) delete(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	h.db.Delete(&models.ServiceGroupAssignment{}, "group_id = ?", id)
	h.db.Delete(&models.GroupVariable{}, "group_id = ?", id)
	h.db.Delete(&models.ServiceGroup{}, "id = ?", id)
	w.WriteHeader(http.StatusNoContent)
}

func (h *GroupsHandler) services(w http.ResponseWriter, r *http.Request) {
	groupID := chi.URLParam(r, "id")
	var assignments []models.ServiceGroupAssignment
	h.db.Where("group_id = ?", groupID).Find(&assignments)

	serviceIDs := make([]string, len(assignments))
	for i, a := range assignments {
		serviceIDs[i] = a.ServiceID
	}
	var services []models.Service
	if len(serviceIDs) > 0 {
		h.db.Where("id IN ?", serviceIDs).Find(&services)
	}
	writeJSON(w, http.StatusOK, services)
}

func (h *GroupsHandler) addService(w http.ResponseWriter, r *http.Request) {
	groupID := chi.URLParam(r, "id")
	serviceID := chi.URLParam(r, "serviceId")

	// idempotent: no duplicate
	var existing models.ServiceGroupAssignment
	if err := h.db.Where("group_id = ? AND service_id = ?", groupID, serviceID).First(&existing).Error; err != nil {
		assignment := models.ServiceGroupAssignment{
			ID:        uuid.NewString(),
			GroupID:   groupID,
			ServiceID: serviceID,
		}
		h.db.Create(&assignment)
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *GroupsHandler) removeService(w http.ResponseWriter, r *http.Request) {
	h.db.Delete(&models.ServiceGroupAssignment{},
		"group_id = ? AND service_id = ?",
		chi.URLParam(r, "id"), chi.URLParam(r, "serviceId"))
	w.WriteHeader(http.StatusNoContent)
}
