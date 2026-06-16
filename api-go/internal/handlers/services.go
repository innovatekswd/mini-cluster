package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

// ─── DTOs ──────────────────────────────────────────────────────────────────

type ServiceResponseDto struct {
	ID                   string                 `json:"id"`
	Name                 string                 `json:"name"`
	Slug                 string                 `json:"slug"`
	ExecutablePath       string                 `json:"executablePath"`
	Arguments            string                 `json:"arguments"`
	// EnvironmentVariables is returned as a JSON object so the UI can read it directly.
	EnvironmentVariables json.RawMessage        `json:"environmentVariables"`
	WorkingDirectory     string                 `json:"workingDirectory"`
	AutoStart            bool                   `json:"autoStart"`
	AccessLink           string                 `json:"accessLink"`
	IsExternal           bool                   `json:"isExternal"`
	CaptureOutput        models.CaptureMode     `json:"captureOutput"`
	RestartPolicy        models.RestartPolicy   `json:"restartPolicy"`
	HealthCheckType      models.HealthCheckType `json:"healthCheckType"`
	HealthCheckUrl       string                 `json:"healthCheckUrl"`
	HealthCheckInterval  int                    `json:"healthCheckInterval"`
	HealthCheckTimeout   int                    `json:"healthCheckTimeout"`
	HealthCheckRetries   int                    `json:"healthCheckRetries"`
	HealthCheckCommand   string                 `json:"healthCheckCommand"`
	AppID                *string                `json:"appId"`
	MachineID            *string                `json:"machineId"`
	OrderIndex           int                    `json:"orderIndex"`
	CreatedAt            time.Time              `json:"createdAt"`
	ModifiedAt           time.Time              `json:"modifiedAt"`
	Status               string                 `json:"status,omitempty"`
}

type CreateServiceDto struct {
	Name                 string                 `json:"name"`
	ExecutablePath       string                 `json:"executablePath"`
	Arguments            string                 `json:"arguments"`
	// EnvironmentVariables accepts either a JSON object {"K":"V"} or a JSON string.
	EnvironmentVariables json.RawMessage        `json:"environmentVariables"`
	WorkingDirectory     string                 `json:"workingDirectory"`
	AutoStart            bool                   `json:"autoStart"`
	AccessLink           string                 `json:"accessLink"`
	IsExternal           bool                   `json:"isExternal"`
	CaptureOutput        models.CaptureMode     `json:"captureOutput"`
	RestartPolicy        models.RestartPolicy   `json:"restartPolicy"`
	HealthCheckType      models.HealthCheckType `json:"healthCheckType"`
	HealthCheckUrl       string                 `json:"healthCheckUrl"`
	HealthCheckInterval  int                    `json:"healthCheckInterval"`
	HealthCheckTimeout   int                    `json:"healthCheckTimeout"`
	HealthCheckRetries   int                    `json:"healthCheckRetries"`
	HealthCheckCommand   string                 `json:"healthCheckCommand"`
	AppID                *string                `json:"appId"`
	MachineID            *string                `json:"machineId"`
	OrderIndex           int                    `json:"orderIndex"`
}

type UpdateServiceDto = CreateServiceDto

// ─── Process Manager interface ─────────────────────────────────────────────

type ProcessManager interface {
	StartService(id string) (string, error) // returns error message if failed
	StopService(id string) error
	GetStatus(serviceID string) string
}

// ─── Handler ───────────────────────────────────────────────────────────────

type ServicesHandler struct {
	db        *gorm.DB
	process   ProcessManager
	// subRoutes are registered inside the /{identifier} sub-router.
	// Use AddSubRoutes to inject additional route groups (versions, logs, etc.)
	// without creating competing /{identifier} param routes at the outer level.
	subRoutes []func(chi.Router)
}

func NewServicesHandler(db *gorm.DB, pm ProcessManager) *ServicesHandler {
	return &ServicesHandler{db: db, process: pm}
}

// AddSubRoutes registers a function that mounts additional routes under
// /api/services/{identifier}. Call before the router is built (i.e. before
// the first request is served). Returns the handler for chaining.
func (h *ServicesHandler) AddSubRoutes(fn func(chi.Router)) *ServicesHandler {
	h.subRoutes = append(h.subRoutes, fn)
	return h
}

func (h *ServicesHandler) Routes() chi.Router {
	r := chi.NewRouter()

	// ── top-level (no identifier) ──────────────────────────────────────────
	// These MUST be registered as flat static routes so chi's radix tree
	// picks them (static > param) over any /{identifier} pattern.
	r.Get("/", h.list)
	r.Get("/statuses", h.statuses)
	r.Post("/", h.create)

	// ── per-service sub-routes ─────────────────────────────────────────────
	// Group all /{identifier}/... routes inside a single r.Route block.
	// This keeps the routing tree unambiguous: the static routes above always
	// win over the parameter group below.
	r.Route("/{identifier}", func(r chi.Router) {
		r.Get("/", h.get)
		r.Put("/", h.update)
		r.Delete("/", h.delete)
		r.Post("/clone", h.clone)

		// execution
		r.Post("/exec/start", h.start)
		r.Post("/exec/stop", h.stop)
		r.Get("/exec/status", h.status)

		// environment & arguments
		r.Get("/env", h.getEnv)
		r.Put("/env", h.putEnv)
		r.Get("/args", h.getArgs)
		r.Put("/args", h.putArgs)

		// injected sub-routers (versions, logs, …)
		for _, fn := range h.subRoutes {
			fn(r)
		}
	})

	return r
}

func (h *ServicesHandler) list(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("appId")
	machineID := r.URL.Query().Get("machineId")
	query := h.db.Order("order_index asc, name asc")
	if appID != "" {
		query = query.Where("app_id = ?", appID)
	}
	if machineID != "" {
		query = query.Where("machine_id = ?", machineID)
	}

	var services []models.Service
	if err := query.Find(&services).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	dtos := make([]ServiceResponseDto, len(services))
	for i, s := range services {
		dtos[i] = toServiceDto(&s)
		dtos[i].Status = h.process.GetStatus(s.ID)
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (h *ServicesHandler) statuses(w http.ResponseWriter, r *http.Request) {
	appID := r.URL.Query().Get("appId")
	query := h.db.Select("id")
	if appID != "" {
		query = query.Where("app_id = ?", appID)
	}

	var services []models.Service
	if err := query.Find(&services).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}

	result := make(map[string]string, len(services))
	for _, s := range services {
		result[s.ID] = h.process.GetStatus(s.ID)
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ServicesHandler) get(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	dto := toServiceDto(svc)
	dto.Status = h.process.GetStatus(svc.ID)
	writeJSON(w, http.StatusOK, dto)
}

func (h *ServicesHandler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateServiceDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if req.Name == "" || req.ExecutablePath == "" {
		writeError(w, http.StatusBadRequest, "name and executablePath are required")
		return
	}

	var maxOrder int
	h.db.Model(&models.Service{}).Select("COALESCE(MAX(order_index),0)").Scan(&maxOrder)
	orderIndex := req.OrderIndex
	if orderIndex == 0 {
		orderIndex = maxOrder + 1
	}

	svc := models.Service{
		ID:                   uuid.NewString(),
		Name:                 req.Name,
		Slug:                 uniqueSlug(h.db, "services", slugify(req.Name), ""),
		ExecutablePath:       req.ExecutablePath,
		Arguments:            req.Arguments,
		EnvironmentVariables: normalizeEnvVars(req.EnvironmentVariables),
		WorkingDirectory:     req.WorkingDirectory,
		AutoStart:            req.AutoStart,
		AccessLink:           req.AccessLink,
		IsExternal:           req.IsExternal,
		CaptureOutput:        req.CaptureOutput,
		RestartPolicy:        req.RestartPolicy,
		HealthCheckType:      req.HealthCheckType,
		HealthCheckUrl:       req.HealthCheckUrl,
		HealthCheckInterval:  req.HealthCheckInterval,
		HealthCheckTimeout:   req.HealthCheckTimeout,
		HealthCheckRetries:   req.HealthCheckRetries,
		HealthCheckCommand:   req.HealthCheckCommand,
		AppID:                req.AppID,
		MachineID:            req.MachineID,
		OrderIndex:           orderIndex,
		CreatedAt:            time.Now().UTC(),
		ModifiedAt:           time.Now().UTC(),
	}
	if svc.CaptureOutput == "" {
		svc.CaptureOutput = models.CaptureModeBoth
	}
	if svc.RestartPolicy == "" {
		svc.RestartPolicy = models.RestartNever
	}

	if err := h.db.Create(&svc).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toServiceDto(&svc))
}

func (h *ServicesHandler) update(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var req UpdateServiceDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	updates := map[string]any{
		"modified_at": time.Now().UTC(),
	}
	if req.Name != "" {
		updates["name"] = req.Name
	}
	if req.ExecutablePath != "" {
		updates["executable_path"] = req.ExecutablePath
	}
	if req.Arguments != "" {
		updates["arguments"] = req.Arguments
	}
	if req.EnvironmentVariables != nil {
		updates["environment_variables"] = normalizeEnvVars(req.EnvironmentVariables)
	}
	if req.WorkingDirectory != "" {
		updates["working_directory"] = req.WorkingDirectory
	}
	updates["auto_start"] = req.AutoStart
	if req.CaptureOutput != "" {
		updates["capture_output"] = req.CaptureOutput
	}
	if req.RestartPolicy != "" {
		updates["restart_policy"] = req.RestartPolicy
	}
	if req.HealthCheckType != "" {
		updates["health_check_type"] = req.HealthCheckType
	}
	updates["health_check_url"] = req.HealthCheckUrl
	updates["health_check_interval"] = req.HealthCheckInterval
	updates["health_check_timeout"] = req.HealthCheckTimeout
	updates["health_check_retries"] = req.HealthCheckRetries
	updates["health_check_command"] = req.HealthCheckCommand
	updates["app_id"] = req.AppID
	updates["machine_id"] = req.MachineID
	updates["order_index"] = req.OrderIndex
	updates["access_link"] = req.AccessLink
	updates["is_external"] = req.IsExternal

	if err := h.db.Model(svc).Updates(updates).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, toServiceDto(svc))
}

func (h *ServicesHandler) delete(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if err := h.db.Delete(svc).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *ServicesHandler) start(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if errMsg, startErr := h.process.StartService(svc.ID); startErr != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{
			"success":      "false",
			"errorMessage": errMsg,
		})
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *ServicesHandler) stop(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if err := h.process.StopService(svc.ID); err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]bool{"success": true})
}

func (h *ServicesHandler) status(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": h.process.GetStatus(svc.ID)})
}

func (h *ServicesHandler) clone(w http.ResponseWriter, r *http.Request) {
	orig, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	var maxOrder int
	h.db.Model(&models.Service{}).Select("COALESCE(MAX(order_index),0)").Scan(&maxOrder)

	cloned := *orig
	cloned.ID = uuid.NewString()
	cloned.Name = fmt.Sprintf("%s (copy)", orig.Name)
	cloned.Slug = uniqueSlug(h.db, "services", slugify(cloned.Name), "")
	cloned.OrderIndex = maxOrder + 1
	cloned.CreatedAt = time.Now().UTC()
	cloned.ModifiedAt = time.Now().UTC()

	if err := h.db.Create(&cloned).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toServiceDto(&cloned))
}

func (h *ServicesHandler) getEnv(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"environmentVariables": svc.EnvironmentVariables})
}

func (h *ServicesHandler) putEnv(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	var body map[string]any
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	// accept either {environmentVariables: "..."} or raw map
	var envVars string
	if v, ok := body["environmentVariables"].(string); ok {
		envVars = v
	} else {
		import_json, _ := encodeJSON(body)
		envVars = import_json
	}
	if err := h.db.Model(svc).Update("environment_variables", envVars).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"environmentVariables": envVars})
}

func (h *ServicesHandler) getArgs(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"arguments": svc.Arguments})
}

func (h *ServicesHandler) putArgs(w http.ResponseWriter, r *http.Request) {
	svc, err := h.resolve(chi.URLParam(r, "identifier"))
	if err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	var body struct {
		Arguments string `json:"arguments"`
	}
	if err := readJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	if err := h.db.Model(svc).Update("arguments", body.Arguments).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"arguments": body.Arguments})
}

// ─── Helpers ───────────────────────────────────────────────────────────────

func (h *ServicesHandler) resolve(identifier string) (*models.Service, error) {
	var svc models.Service
	err := h.db.Where("id = ? OR name = ? OR slug = ?", identifier, identifier, identifier).
		First(&svc).Error
	return &svc, err
}

func toServiceDto(s *models.Service) ServiceResponseDto {
	return ServiceResponseDto{
		ID:                   s.ID,
		Name:                 s.Name,
		Slug:                 s.Slug,
		ExecutablePath:       s.ExecutablePath,
		Arguments:            s.Arguments,
		EnvironmentVariables: envVarsToRaw(s.EnvironmentVariables),
		WorkingDirectory:     s.WorkingDirectory,
		AutoStart:            s.AutoStart,
		AccessLink:           s.AccessLink,
		IsExternal:           s.IsExternal,
		CaptureOutput:        s.CaptureOutput,
		RestartPolicy:        s.RestartPolicy,
		HealthCheckType:      s.HealthCheckType,
		HealthCheckUrl:       s.HealthCheckUrl,
		HealthCheckInterval:  s.HealthCheckInterval,
		HealthCheckTimeout:   s.HealthCheckTimeout,
		HealthCheckRetries:   s.HealthCheckRetries,
		HealthCheckCommand:   s.HealthCheckCommand,
		AppID:                s.AppID,
		MachineID:            s.MachineID,
		OrderIndex:           s.OrderIndex,
		CreatedAt:            s.CreatedAt,
		ModifiedAt:           s.ModifiedAt,
	}
}

// encodeJSON encodes v to a JSON string.
func encodeJSON(v any) (string, error) {
	b, err := json.Marshal(v)
	return string(b), err
}

// normalizeEnvVars converts a json.RawMessage (which may be a JSON object OR a
// JSON-encoded string like "\"{}\"") into the plain JSON-object string stored in
// the DB column.  If the incoming value is already a string literal (starts with
// '"'), it is JSON-unquoted to get the inner JSON.  If it is null or empty,
// "{}" is returned so the column is never stored as an empty string.
func normalizeEnvVars(raw json.RawMessage) string {
	if len(raw) == 0 || string(raw) == "null" {
		return "{}"
	}
	// If the value is a JSON string (e.g. "{\"KEY\":\"val\"}"), unwrap it.
	if raw[0] == '"' {
		var inner string
		if err := json.Unmarshal(raw, &inner); err == nil {
			if inner == "" {
				return "{}"
			}
			return inner
		}
	}
	// Otherwise it is already a JSON object/array – return as-is.
	return string(raw)
}

// envVarsToRaw converts the DB string (JSON object) to json.RawMessage so it is
// serialised as an object in the HTTP response (not as a JSON string).
func envVarsToRaw(s string) json.RawMessage {
	if s == "" || !json.Valid([]byte(s)) {
		return json.RawMessage("{}")
	}
	return json.RawMessage(s)
}
