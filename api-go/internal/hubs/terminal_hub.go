package hubs

import (
	"fmt"
	"io"
	"os"
	"os/exec"
	"sync"

	"github.com/creack/pty"
	"github.com/google/uuid"
	"github.com/philippseith/signalr"
	"go.uber.org/zap"
)

type terminal struct {
	id   string
	ptmx *os.File
	cmd  *exec.Cmd
}

// TerminalHub is a SignalR hub for interactive terminal (PTY) sessions.
type TerminalHub struct {
	signalr.Hub
	mu        sync.Mutex
	terminals map[string]*terminal
	log       *zap.Logger
}

func NewTerminalHub(log *zap.Logger) *TerminalHub {
	return &TerminalHub{
		terminals: make(map[string]*terminal),
		log:       log,
	}
}

// CreateTerminal spawns a new PTY shell and starts streaming output to the caller.
func (h *TerminalHub) CreateTerminal(workingDirectory string, cols, rows uint16) string {
	id := uuid.NewString()
	cmd := exec.Command(defaultShell())
	if workingDirectory != "" {
		if stat, err := os.Stat(workingDirectory); err == nil && stat.IsDir() {
			cmd.Dir = workingDirectory
		}
	}
	cmd.Env = append(os.Environ(), "TERM=xterm-256color")

	if cols == 0 {
		cols = 80
	}
	if rows == 0 {
		rows = 24
	}

	ptmx, err := pty.StartWithSize(cmd, &pty.Winsize{Rows: rows, Cols: cols})
	if err != nil {
		h.log.Error("pty start failed", zap.Error(err))
		h.Clients().Caller().Send("TerminalError", id, err.Error())
		return ""
	}

	t := &terminal{id: id, ptmx: ptmx, cmd: cmd}
	h.mu.Lock()
	h.terminals[id] = t
	h.mu.Unlock()

	connID := h.ConnectionID()
	go h.streamOutput(id, connID, ptmx, cmd)

	return id
}

// WriteToTerminal writes input bytes to the PTY.
func (h *TerminalHub) WriteToTerminal(terminalID, data string) {
	h.mu.Lock()
	t, ok := h.terminals[terminalID]
	h.mu.Unlock()
	if !ok {
		return
	}
	_, _ = io.WriteString(t.ptmx, data)
}

// ResizeTerminal sets the PTY window size.
func (h *TerminalHub) ResizeTerminal(terminalID string, cols, rows uint16) {
	h.mu.Lock()
	t, ok := h.terminals[terminalID]
	h.mu.Unlock()
	if !ok {
		return
	}
	_ = pty.Setsize(t.ptmx, &pty.Winsize{Rows: rows, Cols: cols})
}

// CloseTerminal kills the PTY session.
func (h *TerminalHub) CloseTerminal(terminalID string) {
	h.mu.Lock()
	t, ok := h.terminals[terminalID]
	if ok {
		delete(h.terminals, terminalID)
	}
	h.mu.Unlock()
	if !ok {
		return
	}
	_ = t.ptmx.Close()
	_ = t.cmd.Process.Kill()
}

// GetActiveTerminals returns the IDs of active terminals.
func (h *TerminalHub) GetActiveTerminals() []string {
	h.mu.Lock()
	defer h.mu.Unlock()
	ids := make([]string, 0, len(h.terminals))
	for id := range h.terminals {
		ids = append(ids, id)
	}
	return ids
}

func (h *TerminalHub) streamOutput(terminalID, connID string, r io.Reader, cmd *exec.Cmd) {
	buf := make([]byte, 4096)
	for {
		n, err := r.Read(buf)
		if n > 0 {
			h.Clients().Client(connID).Send("TerminalData", terminalID, string(buf[:n]))
		}
		if err != nil {
			break
		}
	}
	exitCode := 0
	if exitErr, ok := cmd.Wait().(*exec.ExitError); ok {
		exitCode = exitErr.ExitCode()
	}
	h.mu.Lock()
	delete(h.terminals, terminalID)
	h.mu.Unlock()
	h.Clients().Client(connID).Send("TerminalExit", terminalID, exitCode)
}

func defaultShell() string {
	if shell := os.Getenv("SHELL"); shell != "" {
		return shell
	}
	for _, s := range []string{"/bin/bash", "/bin/sh"} {
		if _, err := os.Stat(s); err == nil {
			return s
		}
	}
	return fmt.Sprintf("%s", "sh")
}
