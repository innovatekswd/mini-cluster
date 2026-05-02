//go:build windows

package main

import (
	"context"
	"os"
	"syscall"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sys/windows/svc"
	"golang.org/x/sys/windows/svc/eventlog"
	"golang.org/x/sys/windows/svc/mgr"
)

// windowsService implements svc.Handler. When the SCM sends Stop/Shutdown it
// signals the quit channel that main() is already listening on — so the
// existing graceful-shutdown path in main() handles everything.
type windowsService struct {
	quit chan<- os.Signal
	log  *zap.Logger
}

func (w *windowsService) Execute(_ []string, req <-chan svc.ChangeRequest, status chan<- svc.Status) (bool, uint32) {
	const accepted = svc.AcceptStop | svc.AcceptShutdown
	status <- svc.Status{State: svc.StartPending}
	status <- svc.Status{State: svc.Running, Accepts: accepted}

	for cr := range req {
		switch cr.Cmd {
		case svc.Stop, svc.Shutdown:
			status <- svc.Status{State: svc.StopPending}
			w.quit <- syscall.SIGTERM // hand off to main()'s shutdown path
			return false, 0
		case svc.Interrogate:
			status <- cr.CurrentStatus
		}
	}
	return false, 0
}

// runAsWindowsService starts the SCM dispatch loop in a goroutine.
// Returns false immediately if the process was not started by the SCM.
// When it returns true, main() should continue normally — the service handler
// will send to quit when the SCM requests a stop.
func runAsWindowsService(quit chan<- os.Signal, log *zap.Logger) bool {
	isService, err := svc.IsWindowsService()
	if err != nil || !isService {
		return false
	}

	const svcName = "MiniCluster"
	_ = eventlog.InstallAsEventCreate(svcName, eventlog.Error|eventlog.Warning|eventlog.Info)

	log.Info("running as Windows service", zap.String("name", svcName))
	go func() {
		if err := svc.Run(svcName, &windowsService{quit: quit, log: log}); err != nil {
			log.Error("windows service run failed", zap.Error(err))
		}
	}()
	return true
}

// IsWindowsServiceActive returns true when the process was started by the SCM.
func IsWindowsServiceActive() bool {
	ok, _ := svc.IsWindowsService()
	return ok
}

// InstallWindowsService registers this binary as a Windows Service.
func InstallWindowsService(exePath string) error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect() //nolint:errcheck

	const svcName = "MiniCluster"

	// Update if already installed.
	if s, err := m.OpenService(svcName); err == nil {
		cfg, _ := s.Config()
		cfg.BinaryPathName = exePath
		_ = s.UpdateConfig(cfg)
		s.Close()
		return nil
	}

	s, err := m.CreateService(svcName, exePath, mgr.Config{
		StartType:   mgr.StartAutomatic,
		DisplayName: "MiniCluster API",
		Description: "MiniCluster lightweight process management platform",
	})
	if err != nil {
		return err
	}
	defer s.Close()
	return eventlog.InstallAsEventCreate(svcName, eventlog.Error|eventlog.Warning|eventlog.Info)
}

// UninstallWindowsService stops and removes the Windows Service.
func UninstallWindowsService() error {
	m, err := mgr.Connect()
	if err != nil {
		return err
	}
	defer m.Disconnect() //nolint:errcheck

	const svcName = "MiniCluster"
	s, err := m.OpenService(svcName)
	if err != nil {
		return nil // not installed
	}
	defer s.Close()

	_, _ = s.Control(svc.Stop)
	time.Sleep(2 * time.Second)
	if err := s.Delete(); err != nil {
		return err
	}
	_ = eventlog.Remove(svcName)
	return nil
}

// shutdownContext is a helper used by the service Execute method.
func shutdownContext(d time.Duration) (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.Background(), d)
}
