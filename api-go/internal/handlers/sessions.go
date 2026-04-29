package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type SessionsHandler struct {
	logsDB *gorm.DB
	appDB  *gorm.DB
}

func NewSessionsHandler(logsDB, appDB *gorm.DB) *SessionsHandler {
	return &SessionsHandler{logsDB: logsDB, appDB: appDB}
}

// Routes mounts under /api/services/{serviceId}/sessions
func (h *SessionsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{sessionId}", h.get)
	r.Post("/{sessionId}/close", h.close)
	return r
}

func (h *SessionsHandler) list(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	page, _ := strconv.Atoi(r.URL.Query().Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(r.URL.Query().Get("pageSize"))
	if pageSize < 1 {
		pageSize = 20
	}

	var total int64
	h.logsDB.Model(&models.ServiceSession{}).Where("service_id = ?", svcID).Count(&total)

	var sessions []models.ServiceSession
	h.logsDB.Where("service_id = ?", svcID).
		Order("start_timestamp desc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&sessions)

	// attach log line counts
	type sessionWithCount struct {
		models.ServiceSession
		LogLineCount int64 `json:"logLineCount"`
	}
	result := make([]sessionWithCount, len(sessions))
	for i, s := range sessions {
		var count int64
		h.logsDB.Model(&models.SessionLogEntry{}).Where("session_id = ?", s.ID).Count(&count)
		result[i] = sessionWithCount{ServiceSession: s, LogLineCount: count}
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"sessions": result,
	})
}

func (h *SessionsHandler) create(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var body struct {
		PID int `json:"pid"`
	}
	_ = readJSON(r, &body)

	session := models.ServiceSession{
		ID:             uuid.NewString(),
		ServiceID:      svcID,
		StartTimestamp: time.Now().UTC(),
		Status:         models.SessionRunning,
		PID:            body.PID,
	}
	if err := h.logsDB.Create(&session).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, session)
}

func (h *SessionsHandler) get(w http.ResponseWriter, r *http.Request) {
	var session models.ServiceSession
	if err := h.logsDB.First(&session, "id = ?", chi.URLParam(r, "sessionId")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, session)
}

func (h *SessionsHandler) close(w http.ResponseWriter, r *http.Request) {
	var session models.ServiceSession
	if err := h.logsDB.First(&session, "id = ?", chi.URLParam(r, "sessionId")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var body struct {
		ExitCode *int `json:"exitCode"`
	}
	_ = readJSON(r, &body)

	now := time.Now().UTC()
	status := models.SessionStopped
	if body.ExitCode != nil && *body.ExitCode != 0 {
		status = models.SessionFailed
	}

	h.logsDB.Model(&session).Updates(map[string]any{
		"end_timestamp": now,
		"status":        status,
		"exit_code":     body.ExitCode,
	})
	writeJSON(w, http.StatusOK, session)
}

func (h *SessionsHandler) resolveServiceID(identifier string) (string, error) {
	var svc models.Service
	err := h.appDB.Select("id").
		Where("id = ? OR name = ? OR slug = ?", identifier, identifier, identifier).
		First(&svc).Error
	return svc.ID, err
}
