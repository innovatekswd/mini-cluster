package workers

import (
	"context"
	"time"

	"github.com/innovatek/minicluster/internal/models"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// restartable abstracts the subset of ProcessManager needed by AutoRestartWorker.
type restartable interface {
	GetStatus(serviceID string) string
	StartService(serviceID string) (string, error)
	WasManuallyStopped(serviceID string) bool
	ClearManuallyStopped(serviceID string)
}

// AutoRestartWorker watches services that have a RestartPolicy and restarts them
// when they exit unexpectedly.
//
// Policy semantics:
//   - Never           → never restart (default)
//   - OnFailure       → restart only when exit code != 0
//   - Always          → restart regardless of exit code, unless manually stopped
//   - UnlessStopped   → same as Always but honours explicit StopService calls
type AutoRestartWorker struct {
	db      *gorm.DB
	pm      restartable
	log     *zap.Logger
	backoff backoffConfig
}

type backoffConfig struct {
	initialDelay time.Duration
	maxDelay     time.Duration
	multiplier   float64
}

// restartState tracks per-service restart attempt counters.
type restartState struct {
	attempts    int
	nextDelay   time.Duration
	lastAttempt time.Time
}

func NewAutoRestartWorker(db *gorm.DB, pm restartable, log *zap.Logger) *AutoRestartWorker {
	return &AutoRestartWorker{
		db:  db,
		pm:  pm,
		log: log,
		backoff: backoffConfig{
			initialDelay: 2 * time.Second,
			maxDelay:     5 * time.Minute,
			multiplier:   2.0,
		},
	}
}

func (w *AutoRestartWorker) Run(ctx context.Context) {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	state := make(map[string]*restartState)

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.checkAll(ctx, state)
		}
	}
}

func (w *AutoRestartWorker) checkAll(ctx context.Context, state map[string]*restartState) {
	var services []models.Service
	w.db.Where("restart_policy != ?", models.RestartNever).Find(&services)

	for _, svc := range services {
		select {
		case <-ctx.Done():
			return
		default:
		}

		currentStatus := w.pm.GetStatus(svc.ID)

		// only act on services that are not running/starting
		if currentStatus == "Running" || currentStatus == "Starting" {
			// reset backoff when running healthy
			delete(state, svc.ID)
			continue
		}

		// decide whether to restart
		if !w.shouldRestart(svc, currentStatus) {
			continue
		}

		// apply backoff
		s, ok := state[svc.ID]
		if !ok {
			s = &restartState{nextDelay: w.backoff.initialDelay}
			state[svc.ID] = s
		}

		if time.Since(s.lastAttempt) < s.nextDelay {
			continue // still in backoff window
		}

		w.log.Info("auto-restarting service",
			zap.String("service", svc.Name),
			zap.String("policy", string(svc.RestartPolicy)),
			zap.Int("attempt", s.attempts+1),
			zap.Duration("backoff", s.nextDelay),
		)

		w.pm.ClearManuallyStopped(svc.ID)
		if _, err := w.pm.StartService(svc.ID); err != nil {
			w.log.Warn("auto-restart failed", zap.String("service", svc.Name), zap.Error(err))
		}

		s.attempts++
		s.lastAttempt = time.Now()
		s.nextDelay = w.nextBackoff(s.nextDelay)
	}
}

func (w *AutoRestartWorker) shouldRestart(svc models.Service, currentStatus string) bool {
	switch svc.RestartPolicy {
	case models.RestartAlways:
		// restart unless the user explicitly stopped it
		return !w.pm.WasManuallyStopped(svc.ID)

	case models.RestartUnlessStopped:
		// same semantics as Always
		return !w.pm.WasManuallyStopped(svc.ID)

	case models.RestartOnFailure:
		// only restart if the last exit was a failure (status == Failed)
		return currentStatus == "Failed" && !w.pm.WasManuallyStopped(svc.ID)

	default:
		return false
	}
}

func (w *AutoRestartWorker) nextBackoff(current time.Duration) time.Duration {
	next := time.Duration(float64(current) * w.backoff.multiplier)
	if next > w.backoff.maxDelay {
		return w.backoff.maxDelay
	}
	return next
}
