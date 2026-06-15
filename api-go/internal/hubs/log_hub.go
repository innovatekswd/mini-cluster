package hubs

import (
	"time"

	"github.com/philippseith/signalr"
	"go.uber.org/zap"
)

// LogEntry is the payload broadcast to UI clients.
type LogEntry struct {
	ServiceID string    `json:"serviceId"`
	SessionID string    `json:"sessionId"`
	Type      string    `json:"type"`
	Line      string    `json:"line"`
	Timestamp time.Time `json:"timestamp"`
}

// MetricsUpdate is the payload broadcast on metrics tick.
type MetricsUpdate struct {
	ServiceID   string         `json:"serviceId"`
	Metrics     map[string]any `json:"metrics"`
	SystemStats map[string]any `json:"systemStats,omitempty"`
}

// LogHub is a SignalR hub for real-time log streaming.
type LogHub struct {
	signalr.Hub
	log *zap.Logger
}

func NewLogHub(log *zap.Logger) *LogHub {
	return &LogHub{log: log}
}

// JoinAppGroup subscribes the caller to log events for a specific app.
func (h *LogHub) JoinAppGroup(appID string) {
	h.Groups().AddToGroup("app:"+appID, h.ConnectionID())
}

// LeaveAppGroup unsubscribes the caller from an app group.
func (h *LogHub) LeaveAppGroup(appID string) {
	h.Groups().RemoveFromGroup("app:"+appID, h.ConnectionID())
}

// JoinSystemMetrics subscribes to system metrics broadcasts.
func (h *LogHub) JoinSystemMetrics() {
	h.Groups().AddToGroup("system:metrics", h.ConnectionID())
}

// LeaveSystemMetrics unsubscribes from system metrics.
func (h *LogHub) LeaveSystemMetrics() {
	h.Groups().RemoveFromGroup("system:metrics", h.ConnectionID())
}

// JoinAllMetrics subscribes to all service + system metrics.
func (h *LogHub) JoinAllMetrics() {
	h.Groups().AddToGroup("all:metrics", h.ConnectionID())
}

// LeaveAllMetrics unsubscribes from all metrics.
func (h *LogHub) LeaveAllMetrics() {
	h.Groups().RemoveFromGroup("all:metrics", h.ConnectionID())
}

// BroadcastLog sends a log line to all clients subscribed to the service.
func (h *LogHub) BroadcastLog(entry LogEntry) {
	h.Clients().Group("app:"+entry.ServiceID).Send("LogEntry", entry)
}

// BroadcastMetrics sends a metrics snapshot to subscribed clients.
func (h *LogHub) BroadcastMetrics(update MetricsUpdate) {
	h.Clients().Group("all:metrics").Send("MetricsUpdate", update)
}

// BroadcastSystemMetrics sends system-level metrics to subscribers.
func (h *LogHub) BroadcastSystemMetrics(data any) {
	defer func() { recover() }() // Guard against panic if hub not yet initialized
	h.Clients().Group("system:metrics").Send("SystemMetrics", data)
}

// SendServiceEvent broadcasts a service lifecycle event (started/stopped).
func (h *LogHub) SendServiceEvent(eventName, serviceID, sessionID string) {
	h.Clients().All().Send(eventName, map[string]string{
		"serviceId": serviceID,
		"sessionId": sessionID,
	})
}

// ReplayLogs sends the last N log lines to the newly connected caller.
func (h *LogHub) ReplayLogs(serviceID string, lines []LogEntry) {
	h.Clients().Caller().Send("ReplayLogs", map[string]any{
		"serviceId": serviceID,
		"lines":     lines,
	})
}
