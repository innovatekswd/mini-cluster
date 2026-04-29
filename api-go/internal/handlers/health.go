package handlers

import (
	"net/http"

	"gorm.io/gorm"
)

// HealthHandler provides a simple health check endpoint.
type HealthHandler struct {
	appDB  *gorm.DB
	logsDB *gorm.DB
}

func NewHealthHandler(appDB, logsDB *gorm.DB) *HealthHandler {
	return &HealthHandler{appDB: appDB, logsDB: logsDB}
}

func (h *HealthHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var serviceCount, sessionCount int64
	h.appDB.Table("services").Count(&serviceCount)
	h.logsDB.Table("app_sessions").Where("status = 'Running'").Count(&sessionCount)

	dbApp := pingDB(h.appDB)
	dbLogs := pingDB(h.logsDB)

	status := "healthy"
	code := http.StatusOK
	if !dbApp || !dbLogs {
		status = "degraded"
		code = http.StatusServiceUnavailable
	}

	writeJSON(w, code, map[string]any{
		"status":         status,
		"serviceCount":   serviceCount,
		"activeSessions": sessionCount,
		"database": map[string]bool{
			"app":  dbApp,
			"logs": dbLogs,
		},
	})
}

func pingDB(db *gorm.DB) bool {
	sqlDB, err := db.DB()
	if err != nil {
		return false
	}
	return sqlDB.Ping() == nil
}
