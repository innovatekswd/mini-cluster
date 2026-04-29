package handlers

import (
	"net"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	"gorm.io/gorm"
)

type ProxyHandler struct {
	db *gorm.DB
}

func NewProxyHandler(db *gorm.DB) *ProxyHandler {
	return &ProxyHandler{db: db}
}

// RoutesRoutes mounts under /api/proxy-routes
func (h *ProxyHandler) RoutesRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.listRoutes)
	r.Post("/", h.createRoute)
	r.Get("/{id}", h.getRoute)
	r.Put("/{id}", h.updateRoute)
	r.Delete("/{id}", h.deleteRoute)
	return r
}

// SettingsRoutes mounts under /api/proxy-settings
func (h *ProxyHandler) SettingsRoutes() chi.Router {
	r := chi.NewRouter()
	r.Get("/", h.getSettings)
	r.Put("/", h.updateSettings)
	r.Get("/server-ip", h.serverIP)
	return r
}

func (h *ProxyHandler) listRoutes(w http.ResponseWriter, r *http.Request) {
	var routes []models.ProxyRoute
	h.db.Order("created_at").Find(&routes)
	writeJSON(w, http.StatusOK, routes)
}

func (h *ProxyHandler) getRoute(w http.ResponseWriter, r *http.Request) {
	var route models.ProxyRoute
	if err := h.db.First(&route, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	writeJSON(w, http.StatusOK, route)
}

func (h *ProxyHandler) createRoute(w http.ResponseWriter, r *http.Request) {
	var req models.ProxyRoute
	if err := readJSON(r, &req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	req.ID = uuid.NewString()
	req.CreatedAt = time.Now().UTC()
	req.UpdatedAt = time.Now().UTC()
	if err := h.db.Create(&req).Error; err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, req)
}

func (h *ProxyHandler) updateRoute(w http.ResponseWriter, r *http.Request) {
	var existing models.ProxyRoute
	if err := h.db.First(&existing, "id = ?", chi.URLParam(r, "id")).Error; err != nil {
		if isNotFound(err) {
			notFound(w)
		} else {
			writeError(w, http.StatusInternalServerError, err.Error())
		}
		return
	}
	if err := readJSON(r, &existing); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	existing.UpdatedAt = time.Now().UTC()
	h.db.Save(&existing)
	writeJSON(w, http.StatusOK, existing)
}

func (h *ProxyHandler) deleteRoute(w http.ResponseWriter, r *http.Request) {
	h.db.Delete(&models.ProxyRoute{}, "id = ?", chi.URLParam(r, "id"))
	w.WriteHeader(http.StatusNoContent)
}

func (h *ProxyHandler) getSettings(w http.ResponseWriter, r *http.Request) {
	settings := h.proxySettingsOrCreate()
	writeJSON(w, http.StatusOK, settings)
}

func (h *ProxyHandler) updateSettings(w http.ResponseWriter, r *http.Request) {
	existing := h.proxySettingsOrCreate()
	if err := readJSON(r, existing); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	existing.UpdatedAt = time.Now().UTC()
	h.db.Save(existing)
	writeJSON(w, http.StatusOK, existing)
}

func (h *ProxyHandler) serverIP(w http.ResponseWriter, r *http.Request) {
	ip := detectOutboundIP()
	writeJSON(w, http.StatusOK, map[string]string{"ip": ip})
}

func (h *ProxyHandler) proxySettingsOrCreate() *models.ProxySetting {
	var s models.ProxySetting
	if err := h.db.First(&s).Error; err != nil {
		s = models.ProxySetting{
			ID:        uuid.NewString(),
			CreatedAt: time.Now().UTC(),
			UpdatedAt: time.Now().UTC(),
		}
		h.db.Create(&s)
	}
	return &s
}

func detectOutboundIP() string {
	conn, err := net.Dial("udp", "8.8.8.8:80")
	if err != nil {
		return "127.0.0.1"
	}
	defer conn.Close()
	return conn.LocalAddr().(*net.UDPAddr).IP.String()
}
