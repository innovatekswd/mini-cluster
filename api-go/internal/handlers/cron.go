package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"github.com/robfig/cron/v3"
	"gorm.io/gorm"
)

type CronJobDto struct {
	ID                string                  `json:"id"`
	Name              string                  `json:"name"`
	Description       string                  `json:"description"`
	CronExpression    string                  `json:"cronExpression"`
	Timezone          string                  `json:"timezone"`
	TargetType        models.CronTargetType   `json:"targetType"`
	AppID             *string                 `json:"appId"`
	ServiceID         *string                 `json:"serviceId"`
	GroupID           *string                 `json:"groupId"`
	ScriptPath        string                  `json:"scriptPath"`
	Action            models.CronAction       `json:"action"`
	WaitForCompletion bool                    `json:"waitForCompletion"`
	TimeoutSeconds    int                     `json:"timeoutSeconds"`
	MissedPolicy      models.CronMissedPolicy `json:"missedPolicy"`
	DependsOnJobID    *string                 `json:"dependsOnJobId"`
	IsEnabled         bool                    `json:"isEnabled"`
	LastRun           *time.Time              `json:"lastRun"`
	NextRun           *time.Time              `json:"nextRun"`
	LastRunStatus     string                  `json:"lastRunStatus"`
	LastRunError      string                  `json:"lastRunError"`
	TotalRuns         int                     `json:"totalRuns"`
	FailedRuns        int                     `json:"failedRuns"`
	CreatedAt         time.Time               `json:"createdAt"`
	ModifiedAt        time.Time               `json:"modifiedAt"`
}

type CreateCronJobDto struct {
	Name              string                  `json:"name"`
	Description       string                  `json:"description"`
	CronExpression    string                  `json:"cronExpression"`
	Timezone          string                  `json:"timezone"`
	TargetType        models.CronTargetType   `json:"targetType"`
	AppID             *string                 `json:"appId"`
	ServiceID         *string                 `json:"serviceId"`
	GroupID           *string                 `json:"groupId"`
	ScriptPath        string                  `json:"scriptPath"`
	Action            models.CronAction       `json:"action"`
	WaitForCompletion bool                    `json:"waitForCompletion"`
	TimeoutSeconds    int                     `json:"timeoutSeconds"`
	MissedPolicy      models.CronMissedPolicy `json:"missedPolicy"`
	DependsOnJobID    *string                 `json:"dependsOnJobId"`
	IsEnabled         bool                    `json:"isEnabled"`
}

type CronHandler struct {
	db *gorm.DB
}

func NewCronHandler(db *gorm.DB) *CronHandler {
	return &CronHandler{db: db}
}

func (h *CronHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/{id}", h.get)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Post("/{id}/test", h.test)
	return r
}

func (h *CronHandler) list(w http.ResponseWriter, r *http.Request) {
	var jobs []models.CronJob
	if err := h.db.Find(&jobs).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	dtos := make([]CronJobDto, len(jobs))
	for i, j := range jobs {
		dtos[i] = toCronDto(&j)
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (h *CronHandler) get(w http.ResponseWriter, r *http.Request) {
	var job models.CronJob
	if err := h.db.First(&job, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, toCronDto(&job))
}

func (h *CronHandler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateCronJobDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if !validCronExpression(req.CronExpression) {
		writeError(w, http.StatusBadRequest, "invalid cron expression")
		return
	}
	job := models.CronJob{
		ID:                uuid.NewString(),
		Name:              req.Name,
		Description:       req.Description,
		CronExpression:    req.CronExpression,
		Timezone:          req.Timezone,
		TargetType:        req.TargetType,
		AppID:             req.AppID,
		ServiceID:         req.ServiceID,
		GroupID:           req.GroupID,
		ScriptPath:        req.ScriptPath,
		Action:            req.Action,
		WaitForCompletion: req.WaitForCompletion,
		TimeoutSeconds:    req.TimeoutSeconds,
		MissedPolicy:      req.MissedPolicy,
		DependsOnJobID:    req.DependsOnJobID,
		IsEnabled:         req.IsEnabled,
		CreatedAt:         time.Now().UTC(),
		ModifiedAt:        time.Now().UTC(),
	}
	if job.Timezone == "" {
		job.Timezone = "UTC"
	}
	if err := h.db.Create(&job).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toCronDto(&job))
}

func (h *CronHandler) update(w http.ResponseWriter, r *http.Request) {
	var job models.CronJob
	if err := h.db.First(&job, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	var req CreateCronJobDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.CronExpression != "" && !validCronExpression(req.CronExpression) {
		writeError(w, http.StatusBadRequest, "invalid cron expression")
		return
	}
	updates := map[string]any{"modified_at": time.Now().UTC()}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.CronExpression != "" {
		updates["cron_expression"] = req.CronExpression
	}
	updates["is_enabled"] = req.IsEnabled
	h.db.Model(&job).Updates(updates)
	writeJSON(w, http.StatusOK, toCronDto(&job))
}

func (h *CronHandler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Delete(&models.CronJob{}, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *CronHandler) test(w http.ResponseWriter, r *http.Request) {
	var job models.CronJob
	if err := h.db.First(&job, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	schedule, err := parser.Parse(job.CronExpression)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	next := schedule.Next(time.Now().UTC())
	writeJSON(w, http.StatusOK, map[string]any{
		"cronExpression": job.CronExpression,
		"nextRun":        next,
	})
}

func validCronExpression(expr string) bool {
	parser := cron.NewParser(cron.Minute | cron.Hour | cron.Dom | cron.Month | cron.Dow)
	_, err := parser.Parse(expr)
	return err == nil
}

func toCronDto(j *models.CronJob) CronJobDto {
	return CronJobDto{
		ID:                j.ID,
		Name:              j.Name,
		Description:       j.Description,
		CronExpression:    j.CronExpression,
		Timezone:          j.Timezone,
		TargetType:        j.TargetType,
		AppID:             j.AppID,
		ServiceID:         j.ServiceID,
		GroupID:           j.GroupID,
		ScriptPath:        j.ScriptPath,
		Action:            j.Action,
		WaitForCompletion: j.WaitForCompletion,
		TimeoutSeconds:    j.TimeoutSeconds,
		MissedPolicy:      j.MissedPolicy,
		DependsOnJobID:    j.DependsOnJobID,
		IsEnabled:         j.IsEnabled,
		LastRun:           j.LastRun,
		NextRun:           j.NextRun,
		LastRunStatus:     j.LastRunStatus,
		LastRunError:      j.LastRunError,
		TotalRuns:         j.TotalRuns,
		FailedRuns:        j.FailedRuns,
		CreatedAt:         j.CreatedAt,
		ModifiedAt:        j.ModifiedAt,
	}
}
