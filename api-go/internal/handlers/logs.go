package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type LogsHandler struct {
	logsDB *gorm.DB
	appDB  *gorm.DB
}

func NewLogsHandler(logsDB, appDB *gorm.DB) *LogsHandler {
	return &LogsHandler{logsDB: logsDB, appDB: appDB}
}

// Routes returns a router with service log routes (for standalone mount).
func (h *LogsHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/logs", h.getLogs)
	r.Get("/logs/search", h.searchLogs)
	r.Get("/history", h.getHistory)
	return r
}

// InjectRoutes registers log routes directly onto r (no Mount).
// Use this inside ServicesHandler.AddSubRoutes to avoid chi Mount("/") conflicts.
func (h *LogsHandler) InjectRoutes(r chi.Router) {
	r.Get("/logs", h.getLogs)
	r.Get("/logs/search", h.searchLogs)
	r.Get("/history", h.getHistory)
}

// ManagementRoutes mounts under /api/logs
func (h *LogsHandler) ManagementRoutes() chi.Router {
	r := chi.NewRouter()
	r.Delete("/truncate", h.truncate)
	r.Get("/stats", h.stats)
	return r
}

func (h *LogsHandler) getLogs(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	tail := 100
	if t := r.URL.Query().Get("tail"); t != "" {
		if n, err := strconv.Atoi(t); err == nil {
			tail = n
		}
	}

	// get latest session
	var session models.ServiceSession
	if err := h.logsDB.Where("service_id = ?", svcID).
		Order("start_timestamp desc").First(&session).Error; err != nil {
		writeJSON(w, http.StatusOK, map[string]any{"lines": []any{}})
		return
	}

	var logs []models.SessionLogEntry
	h.logsDB.Where("session_id = ?", session.ID).
		Order("timestamp asc").
		Limit(tail).Find(&logs)

	writeJSON(w, http.StatusOK, map[string]any{"lines": logs})
}

func (h *LogsHandler) searchLogs(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	q := r.URL.Query()
	tail, _ := strconv.Atoi(q.Get("tail"))
	if tail == 0 {
		tail = 100
	}
	page, _ := strconv.Atoi(q.Get("page"))
	if page < 1 {
		page = 1
	}
	pageSize, _ := strconv.Atoi(q.Get("pageSize"))
	if pageSize < 1 {
		pageSize = 50
	}
	sessionID := q.Get("sessionId")
	logType := q.Get("logType")

	query := h.logsDB.Model(&models.SessionLogEntry{}).Where("service_id = ?", svcID)
	if sessionID != "" && sessionID != "all" {
		query = query.Where("session_id = ?", sessionID)
	}
	if logType != "" {
		query = query.Where("type = ?", logType)
	}
	if from := q.Get("from"); from != "" {
		if t, err := time.Parse(time.RFC3339, from); err == nil {
			query = query.Where("timestamp >= ?", t)
		}
	}
	if to := q.Get("to"); to != "" {
		if t, err := time.Parse(time.RFC3339, to); err == nil {
			query = query.Where("timestamp <= ?", t)
		}
	}

	var total int64
	query.Count(&total)

	var logs []models.SessionLogEntry
	query.Order("timestamp asc").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&logs)

	writeJSON(w, http.StatusOK, map[string]any{
		"total":    total,
		"page":     page,
		"pageSize": pageSize,
		"lines":    logs,
	})
}

func (h *LogsHandler) getHistory(w http.ResponseWriter, r *http.Request) {
	svcID, err := h.resolveServiceID(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var events []models.LifecycleEvent
	h.logsDB.Where("service_id = ?", svcID).
		Order("timestamp desc").
		Find(&events)

	writeJSON(w, http.StatusOK, events)
}

func (h *LogsHandler) truncate(w http.ResponseWriter, r *http.Request) {
	if r.URL.Query().Get("confirm") != "true" {
		writeError(w, http.StatusBadRequest, "confirm=true required")
		return
	}
	var (
		deletedLogs     int64
		deletedEvents   int64
		deletedSessions int64
	)
	h.logsDB.Where("1=1").Delete(&models.SessionLogEntry{})
	h.logsDB.Model(&models.SessionLogEntry{}).Count(&deletedLogs)
	h.logsDB.Where("1=1").Delete(&models.LifecycleEvent{})
	h.logsDB.Model(&models.LifecycleEvent{}).Count(&deletedEvents)
	h.logsDB.Where("1=1").Delete(&models.ServiceSession{})
	h.logsDB.Model(&models.ServiceSession{}).Count(&deletedSessions)

	writeJSON(w, http.StatusOK, map[string]any{
		"message": "truncated",
		"deleted": map[string]int64{
			"logs":     deletedLogs,
			"events":   deletedEvents,
			"sessions": deletedSessions,
		},
	})
}

func (h *LogsHandler) stats(w http.ResponseWriter, r *http.Request) {
	var logCount, sessionCount, eventCount int64
	h.logsDB.Model(&models.SessionLogEntry{}).Count(&logCount)
	h.logsDB.Model(&models.ServiceSession{}).Count(&sessionCount)
	h.logsDB.Model(&models.LifecycleEvent{}).Count(&eventCount)

	var activeSessions int64
	h.logsDB.Model(&models.ServiceSession{}).Where("status = ?", models.SessionRunning).Count(&activeSessions)

	writeJSON(w, http.StatusOK, map[string]any{
		"logs":           logCount,
		"sessions":       sessionCount,
		"activeSessions": activeSessions,
		"events":         eventCount,
	})
}

func (h *LogsHandler) resolveServiceID(identifier string) (string, error) {
	var svc models.Service
	err := h.appDB.Select("id").
		Where("id = ? OR name = ? OR slug = ?", identifier, identifier, identifier).
		First(&svc).Error
	return svc.ID, err
}
