package handlers

import (
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	mw "github.com/innovatek/minicluster/internal/middleware"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

// ─── DTOs ──────────────────────────────────────────────────────────────────

type AgentRegistrationDto struct {
	Name       string             `json:"name"`
	Endpoint   string             `json:"endpoint"`
	ApiKey     string             `json:"apiKey"`
	SystemInfo AgentSystemInfoDto `json:"systemInfo"`
	Labels     map[string]string  `json:"labels"`
}

type AgentSystemInfoDto struct {
	OS           string `json:"os"`
	Architecture string `json:"architecture"`
	Hostname     string `json:"hostname"`
	AgentVersion string `json:"agentVersion"`
	CpuCores     int    `json:"cpuCores"`
	TotalMemory  int64  `json:"totalMemory"`
	TotalDisk    int64  `json:"totalDisk"`
}

type AgentRegistrationResultDto struct {
	MachineID         string `json:"machineId"`
	ControllerVersion string `json:"controllerVersion"`
}

type HeartbeatDto struct {
	MachineID string           `json:"machineId"`
	Status    string           `json:"status"`
	Metrics   HeartbeatMetrics `json:"metrics"`
}

type HeartbeatMetrics struct {
	CpuPercent    float64 `json:"cpuPercent"`
	MemoryUsedMB  int64   `json:"memoryUsedMb"`
	DiskUsedBytes int64   `json:"diskUsedBytes"`
}

type HeartbeatAckDto struct {
	Accepted        bool      `json:"accepted"`
	ServerTime      time.Time `json:"serverTime"`
	PendingCommands []string  `json:"pendingCommands"`
}

type ClusterStatusDto struct {
	TotalNodes    int                  `json:"totalNodes"`
	OnlineNodes   int                  `json:"onlineNodes"`
	OfflineNodes  int                  `json:"offlineNodes"`
	DegradedNodes int                  `json:"degradedNodes"`
	Nodes         []ClusterNodeSummary `json:"nodes"`
}

type ClusterNodeSummary struct {
	ID             string                `json:"id"`
	Name           string                `json:"name"`
	Host           string                `json:"host"`
	Status         models.MachineStatus  `json:"status"`
	IsLocal        bool                  `json:"isLocal"`
	ConnectionType models.ConnectionType `json:"connectionType"`
	LastSeen       *time.Time            `json:"lastSeen"`
	AgentVersion   string                `json:"agentVersion"`
	CpuCores       int                   `json:"cpuCores"`
	TotalMemory    int64                 `json:"totalMemory"`
	Labels         string                `json:"labels"`
}

// ─── Handler ───────────────────────────────────────────────────────────────

const controllerVersion = "1.0.0"

type ClusterHandler struct {
	db *gorm.DB
}

func NewClusterHandler(db *gorm.DB) *ClusterHandler {
	return &ClusterHandler{db: db}
}

func (h *ClusterHandler) Routes() chi.Router {
	r := chi.NewRouter()
	// agent-facing (validated by AgentAPIKey middleware upstream)
	r.Post("/register", h.register)
	r.Post("/heartbeat", h.heartbeat)
	// JWT-authenticated
	r.Get("/status", h.status)
	r.Get("/nodes", h.listNodes)
	r.Get("/nodes/{id}", h.getNode)
	r.Post("/nodes", h.createNode)
	return r
}

func (h *ClusterHandler) register(w http.ResponseWriter, r *http.Request) {
	var req AgentRegistrationDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	// hash the provided API key
	hashedKey := mw.HashAPIKey(req.ApiKey)

	var machine models.Machine
	err := h.db.Where("agent_api_key = ?", hashedKey).First(&machine).Error
	if isNotFound(err) {
		// new registration
		machine = models.Machine{
			ID:               newID(),
			Name:             req.Name,
			Host:             req.SystemInfo.Hostname,
			ConnectionType:   models.ConnectionAgent,
			Status:           models.MachineOnline,
			AgentEndpoint:    req.Endpoint,
			AgentApiKey:      hashedKey,
			AgentVersion:     req.SystemInfo.AgentVersion,
			CpuCores:         req.SystemInfo.CpuCores,
			TotalMemoryBytes: req.SystemInfo.TotalMemory,
			TotalDiskBytes:   req.SystemInfo.TotalDisk,
			CreatedAt:        time.Now().UTC(),
			ModifiedAt:       time.Now().UTC(),
		}
		h.db.Create(&machine)
	} else if err == nil {
		// re-registration: update fields
		now := time.Now().UTC()
		h.db.Model(&machine).Updates(map[string]any{
			"status":             models.MachineOnline,
			"last_seen":          now,
			"agent_version":      req.SystemInfo.AgentVersion,
			"agent_endpoint":     req.Endpoint,
			"cpu_cores":          req.SystemInfo.CpuCores,
			"total_memory_bytes": req.SystemInfo.TotalMemory,
			"total_disk_bytes":   req.SystemInfo.TotalDisk,
			"modified_at":        now,
		})
	}

	writeJSON(w, http.StatusOK, AgentRegistrationResultDto{
		MachineID:         machine.ID,
		ControllerVersion: controllerVersion,
	})
}

func (h *ClusterHandler) heartbeat(w http.ResponseWriter, r *http.Request) {
	machine := mw.GetMachine(r)
	if machine == nil {
		writeError(w, http.StatusUnauthorized, "machine not found")
		return
	}

	var req HeartbeatDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}

	now := time.Now().UTC()
	h.db.Model(machine).Updates(map[string]any{
		"last_seen":   now,
		"status":      models.MachineOnline,
		"modified_at": now,
	})

	writeJSON(w, http.StatusOK, HeartbeatAckDto{
		Accepted:        true,
		ServerTime:      now,
		PendingCommands: []string{},
	})
}

func (h *ClusterHandler) status(w http.ResponseWriter, r *http.Request) {
	var machines []models.Machine
	h.db.Find(&machines)

	result := ClusterStatusDto{Nodes: make([]ClusterNodeSummary, len(machines))}
	for i, m := range machines {
		result.TotalNodes++
		switch m.Status {
		case models.MachineOnline:
			result.OnlineNodes++
		case models.MachineOffline:
			result.OfflineNodes++
		case models.MachineDegraded:
			result.DegradedNodes++
		}
		result.Nodes[i] = ClusterNodeSummary{
			ID:             m.ID,
			Name:           m.Name,
			Host:           m.Host,
			Status:         m.Status,
			IsLocal:        m.IsLocal,
			ConnectionType: m.ConnectionType,
			LastSeen:       m.LastSeen,
			AgentVersion:   m.AgentVersion,
			CpuCores:       m.CpuCores,
			TotalMemory:    m.TotalMemoryBytes,
			Labels:         m.Labels,
		}
	}
	writeJSON(w, http.StatusOK, result)
}

func (h *ClusterHandler) listNodes(w http.ResponseWriter, r *http.Request) {
	var machines []models.Machine
	h.db.Order("order_index asc, name asc").Find(&machines)
	dtos := make([]MachineDto, len(machines))
	for i, m := range machines {
		dtos[i] = toMachineDto(&m)
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (h *ClusterHandler) getNode(w http.ResponseWriter, r *http.Request) {
	var machine models.Machine
	if err := h.db.First(&machine, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, toMachineDto(&machine))
}

func (h *ClusterHandler) createNode(w http.ResponseWriter, r *http.Request) {
	var req CreateMachineDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	machine := models.Machine{
		ID:             newID(),
		Name:           req.Name,
		Host:           req.Host,
		Port:           req.Port,
		ConnectionType: req.ConnectionType,
		AgentEndpoint:  req.AgentEndpoint,
		Status:         models.MachineUnknown,
		CreatedAt:      time.Now().UTC(),
		ModifiedAt:     time.Now().UTC(),
	}
	if machine.Port == 0 {
		machine.Port = 22
	}
	h.db.Create(&machine)
	writeJSON(w, http.StatusCreated, toMachineDto(&machine))
}

func newID() string {
	return newUUID()
}
