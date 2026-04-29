package workers

import (
	"context"
	"time"

	"github.com/google/uuid"
	"github.com/innovatek/minicluster/internal/models"
	robfig "github.com/robfig/cron/v3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// CronScheduler loads cron jobs from DB and executes them via robfig/cron.
type CronScheduler struct {
	appDB          *gorm.DB
	log            *zap.Logger
	cron           *robfig.Cron
	OnTriggerStart func(serviceID string)
}

func NewCronScheduler(appDB *gorm.DB, log *zap.Logger) *CronScheduler {
	return &CronScheduler{
		appDB: appDB,
		log:   log,
		cron:  robfig.New(),
	}
}

func (s *CronScheduler) Run(ctx context.Context) {
	s.reload()
	s.cron.Start()
	<-ctx.Done()
	cronCtx := s.cron.Stop()
	<-cronCtx.Done()
}

// Reload re-reads cron jobs from DB and rebuilds the schedule.
func (s *CronScheduler) reload() {
	// remove all existing entries
	for _, e := range s.cron.Entries() {
		s.cron.Remove(e.ID)
	}

	var jobs []models.CronJob
	s.appDB.Where("is_enabled = true").Find(&jobs)

	for _, job := range jobs {
		j := job // capture
		_, err := s.cron.AddFunc(j.CronExpression, func() {
			s.execute(j)
		})
		if err != nil {
			s.log.Warn("invalid cron expression",
				zap.String("job", j.Name),
				zap.String("expression", j.CronExpression),
				zap.Error(err))
		}
	}
	s.log.Info("cron scheduler loaded", zap.Int("jobs", len(jobs)))
}

func (s *CronScheduler) execute(job models.CronJob) {
	run := models.CronJobRun{
		ID:        uuid.NewString(),
		CronJobID: job.ID,
		StartedAt: time.Now().UTC(),
		Status:    "Running",
	}
	s.appDB.Create(&run)

	switch job.TargetType {
	case models.CronTargetService:
		if job.Action == models.CronActionStart && s.OnTriggerStart != nil && job.ServiceID != nil {
			s.OnTriggerStart(*job.ServiceID)
		}
	}

	s.appDB.Model(&run).Updates(map[string]any{
		"finished_at": time.Now().UTC(),
		"status":      "Completed",
	})
}
