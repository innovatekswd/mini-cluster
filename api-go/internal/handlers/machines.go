package handlers

import (
	"fmt"
	"net"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type MachineDto struct {
	ID               string                `json:"id"`
	Name             string                `json:"name"`
	Host             string                `json:"host"`
	Port             int                   `json:"port"`
	ConnectionType   models.ConnectionType `json:"connectionType"`
	Status           models.MachineStatus  `json:"status"`
	LastSeen         *time.Time            `json:"lastSeen"`
	IsLocal          bool                  `json:"isLocal"`
	AgentEndpoint    string                `json:"agentEndpoint"`
	AgentVersion     string                `json:"agentVersion"`
	CpuCores         int                   `json:"cpuCores"`
	TotalMemoryBytes int64                 `json:"totalMemoryBytes"`
	TotalDiskBytes   int64                 `json:"totalDiskBytes"`
	Labels           string                `json:"labels"`
	OrderIndex       int                   `json:"orderIndex"`
	CreatedAt        time.Time             `json:"createdAt"`
	ModifiedAt       time.Time             `json:"modifiedAt"`
}

type CreateMachineDto struct {
	Name           string                `json:"name"`
	Host           string                `json:"host"`
	Port           int                   `json:"port"`
	ConnectionType models.ConnectionType `json:"connectionType"`
	SshUsername    string                `json:"sshUsername"`
	SshKeyPath     string                `json:"sshKeyPath"`
	AgentEndpoint  string                `json:"agentEndpoint"`
	AgentApiKey    string                `json:"agentApiKey"`
	Labels         string                `json:"labels"`
}

type MachinesHandler struct {
	db *gorm.DB
}

func NewMachinesHandler(db *gorm.DB) *MachinesHandler {
	return &MachinesHandler{db: db}
}

func (h *MachinesHandler) Routes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.list)
	r.Post("/", h.create)
	r.Get("/local", h.getLocal)
	r.Get("/{id}", h.get)
	r.Get("/{id}/services", h.getWithServices)
	r.Put("/{id}", h.update)
	r.Delete("/{id}", h.delete)
	r.Post("/{id}/test", h.testConnection)
	return r
}

func (h *MachinesHandler) list(w http.ResponseWriter, r *http.Request) {
	var machines []models.Machine
	if err := h.db.Order("order_index asc, name asc").Find(&machines).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	dtos := make([]MachineDto, len(machines))
	for i, m := range machines {
		dtos[i] = toMachineDto(&m)
	}
	writeJSON(w, http.StatusOK, dtos)
}

func (h *MachinesHandler) getLocal(w http.ResponseWriter, r *http.Request) {
	var machine models.Machine
	err := h.db.Where("is_local = true").First(&machine).Error
	if err != nil {
		if !isNotFound(err) {
			writeError(w, http.StatusInternalServerError, err.Error())
			return
		}
		// create local machine record
		machine = models.Machine{
			ID:             uuid.NewString(),
			Name:           "local",
			Host:           "localhost",
			ConnectionType: models.ConnectionLocal,
			Status:         models.MachineOnline,
			IsLocal:        true,
			CreatedAt:      time.Now().UTC(),
			ModifiedAt:     time.Now().UTC(),
		}
		h.db.Create(&machine)
	}
	writeJSON(w, http.StatusOK, toMachineDto(&machine))
}

func (h *MachinesHandler) get(w http.ResponseWriter, r *http.Request) {
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

func (h *MachinesHandler) getWithServices(w http.ResponseWriter, r *http.Request) {
	var machine models.Machine
	if err := h.db.First(&machine, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	var services []models.Service
	h.db.Where("machine_id = ?", machine.ID).Find(&services)

	serviceDtos := make([]ServiceResponseDto, len(services))
	for i, s := range services {
		serviceDtos[i] = toServiceDto(&s)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"machine":  toMachineDto(&machine),
		"services": serviceDtos,
	})
}

func (h *MachinesHandler) create(w http.ResponseWriter, r *http.Request) {
	var req CreateMachineDto
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	machine := models.Machine{
		ID:             uuid.NewString(),
		Name:           req.Name,
		Host:           req.Host,
		Port:           req.Port,
		ConnectionType: req.ConnectionType,
		Status:         models.MachineUnknown,
		SshUsername:    req.SshUsername,
		SshKeyPath:     req.SshKeyPath,
		AgentEndpoint:  req.AgentEndpoint,
		AgentApiKey:    req.AgentApiKey,
		Labels:         req.Labels,
		CreatedAt:      time.Now().UTC(),
		ModifiedAt:     time.Now().UTC(),
	}
	if machine.Port == 0 {
		machine.Port = 22
	}
	if err := h.db.Create(&machine).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, toMachineDto(&machine))
}

func (h *MachinesHandler) update(w http.ResponseWriter, r *http.Request) {
	var machine models.Machine
	if err := h.db.First(&machine, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	var req CreateMachineDto
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
	if req.Host != "" {
		updates["host"] = req.Host
	}
	if req.AgentEndpoint != "" {
		updates["agent_endpoint"] = req.AgentEndpoint
	}
	if req.Labels != "" {
		updates["labels"] = req.Labels
	}
	h.db.Model(&machine).Updates(updates)
	writeJSON(w, http.StatusOK, toMachineDto(&machine))
}

func (h *MachinesHandler) delete(w http.ResponseWriter, r *http.Request) {
	if err := h.db.Delete(&models.Machine{}, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func toMachineDto(m *models.Machine) MachineDto {
	return MachineDto{
		ID:               m.ID,
		Name:             m.Name,
		Host:             m.Host,
		Port:             m.Port,
		ConnectionType:   m.ConnectionType,
		Status:           m.Status,
		LastSeen:         m.LastSeen,
		IsLocal:          m.IsLocal,
		AgentEndpoint:    m.AgentEndpoint,
		AgentVersion:     m.AgentVersion,
		CpuCores:         m.CpuCores,
		TotalMemoryBytes: m.TotalMemoryBytes,
		TotalDiskBytes:   m.TotalDiskBytes,
		Labels:           m.Labels,
		OrderIndex:       m.OrderIndex,
		CreatedAt:        m.CreatedAt,
		ModifiedAt:       m.ModifiedAt,
	}
}

// testConnection tests connectivity to a machine
func (h *MachinesHandler) testConnection(w http.ResponseWriter, r *http.Request) {
	var machine models.Machine
	if err := h.db.First(&machine, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}

	// For local machines, always succeed
	if machine.IsLocal {
		writeJSON(w, http.StatusOK, map[string]any{
			"success":   true,
			"message":   "Local machine is reachable",
			"latencyMs": 1,
		})
		return
	}

	// For remote machines, attempt a TCP connection test
	start := time.Now()
	conn, err := net.DialTimeout("tcp", fmt.Sprintf("%s:%d", machine.Host, machine.Port), 5*time.Second)
	latency := time.Since(start).Milliseconds()
	if err != nil {
		writeJSON(w, http.StatusOK, map[string]any{
			"success": false,
			"message": fmt.Sprintf("Connection failed: %v", err),
		})
		return
	}
	conn.Close()

	writeJSON(w, http.StatusOK, map[string]any{
		"success":   true,
		"message":   "Connection successful",
		"latencyMs": latency,
	})
}
