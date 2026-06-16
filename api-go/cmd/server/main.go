package main

import (
	"compress/gzip"
	"context"
	"embed"
	"fmt"
	"io/fs"
	"net/http"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"
	"time"

	"github.com/go-chi/chi/v5"
	chimiddleware "github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/innovatek/minicluster/internal/auth"
	"github.com/innovatek/minicluster/internal/config"
	"github.com/innovatek/minicluster/internal/db"
	"github.com/innovatek/minicluster/internal/handlers"
	"github.com/innovatek/minicluster/internal/hubs"
	"github.com/innovatek/minicluster/internal/middleware"
	"github.com/innovatek/minicluster/internal/models"
	"github.com/innovatek/minicluster/internal/services"
	"github.com/innovatek/minicluster/internal/workers"
	"github.com/philippseith/signalr"
	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

//go:embed static/*
var staticFiles embed.FS

func main() {
	// ─── Logger ─────────────────────────────────────────────────────────────
	log := buildLogger()
	defer log.Sync() //nolint:errcheck

	// ─── Config ─────────────────────────────────────────────────────────────
	cfg, err := config.Load()
	if err != nil {
		log.Fatal("failed to load config", zap.Error(err))
	}

	// ─── Data dir ───────────────────────────────────────────────────────────
	dataDir := cfg.DataDir
	if dataDir == "" {
		dataDir = db.DataDir()
	}
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatal("cannot create data dir", zap.String("path", dataDir), zap.Error(err))
	}

	// ─── Databases ──────────────────────────────────────────────────────────
	databases, err := db.Open(dataDir)
	if err != nil {
		log.Fatal("failed to open databases", zap.Error(err))
	}

	// ─── Auth service ────────────────────────────────────────────────────────
	authSvc := auth.NewService(databases.App, &cfg.Authentication)
	if err := authSvc.EnsureAdminUser(); err != nil {
		log.Fatal("ensure admin user failed", zap.Error(err))
	}

	// ─── Process manager ────────────────────────────────────────────────────
	procMgr := services.NewProcessManager(databases.App, databases.Logs, log)

	// ─── Container runtime (optional) ───────────────────────────────────────
	var containerSvc services.IContainerService
	var containerMgr *services.ContainerManager
	if cfg.ContainerRuntime.Enabled {
		dockerSvc, err := services.NewDockerService(cfg.ContainerRuntime.SocketPath)
		if err != nil {
			log.Warn("container runtime unavailable", zap.Error(err))
		} else if err := dockerSvc.Ping(context.Background()); err != nil {
			log.Warn("container runtime not reachable", zap.Error(err))
		} else {
			containerSvc = dockerSvc
			containerMgr = services.NewContainerManager(containerSvc, databases.App, databases.Logs, log)
			log.Info("container runtime ready")
		}
	}

	// ─── Unified service executor ────────────────────────────────────────────
	executor := services.NewServiceExecutor(procMgr, containerMgr, databases.App, log)

	// ─── Hubs ───────────────────────────────────────────────────────────────
	logHub := hubs.NewLogHub(log)
	terminalHub := hubs.NewTerminalHub(log)

	// wire process events → SignalR broadcasts
	onStarted := func(serviceID, sessionID string) {
		logHub.SendServiceEvent("ServiceStarted", serviceID, sessionID)
	}
	onStopped := func(serviceID, sessionID string, _ int) {
		logHub.SendServiceEvent("ServiceStopped", serviceID, sessionID)
	}
	onLogLine := func(serviceID, sessionID string, logType models.LogType, line string) {
		logHub.BroadcastLog(hubs.LogEntry{
			ServiceID: serviceID,
			SessionID: sessionID,
			Type:      string(logType),
			Line:      line,
			Timestamp: time.Now().UTC(),
		})
	}
	procMgr.OnStarted = onStarted
	procMgr.OnStopped = onStopped
	procMgr.OnLogLine = onLogLine
	if containerMgr != nil {
		containerMgr.OnStarted = onStarted
		containerMgr.OnStopped = onStopped
		containerMgr.OnLogLine = onLogLine
	}

	// ─── Workers ────────────────────────────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	metricsCollector := workers.NewMetricsCollector(databases.Logs, 5, log)
	if containerMgr != nil {
		metricsCollector.SetContainerManager(containerMgr, databases.App)
	}
	// Wire system metrics broadcast to SignalR for real-time UI updates
	metricsCollector.OnSystemMetrics = func(snap models.SystemMetricsSnapshot) {
		logHub.BroadcastSystemMetrics(snap)
	}
	metricsAggregator := workers.NewMetricsAggregator(databases.Logs, databases.Aggregated, log)
	directoryCollector := workers.NewDirectoryMetricsCollector(databases.Aggregated, log)
	hbMonitor := workers.NewHeartbeatMonitor(databases.App, log)
	logCleanup := workers.NewLogCleanupWorker(databases.Logs,
		cfg.LogCleanup.IntervalMinutes, cfg.LogCleanup.RetentionHours, cfg.LogCleanup.AutoVacuum, log)
	healthChecker := workers.NewHealthCheckWorker(databases.App, executor, log)
	cronSched := workers.NewCronScheduler(databases.App, log)
	autoRestart := workers.NewAutoRestartWorker(databases.App, executor, log)

	healthChecker.OnTriggerStart = func(serviceID string) { _, _ = executor.StartService(serviceID) }
	cronSched.OnTriggerStart = func(serviceID string) { _, _ = executor.StartService(serviceID) }

	for _, worker := range []func(context.Context){
		metricsCollector.Run,
		metricsAggregator.Run,
		directoryCollector.Run,
		hbMonitor.Run,
		logCleanup.Run,
		healthChecker.Run,
		cronSched.Run,
		autoRestart.Run,
	} {
		go worker(ctx)
	}

	// auto-start services (process + container)
	go executor.AutoStartServices()

	// ─── Handlers ────────────────────────────────────────────────────────────
	authHandler := handlers.NewAuthHandler(authSvc)
	appsHandler := handlers.NewAppsHandler(databases.App, executor)
	svcHandler := handlers.NewServicesHandler(databases.App, executor)
	envHandler := handlers.NewEnvironmentsHandler(databases.App)
	logsHandler := handlers.NewLogsHandler(databases.Logs, databases.App)
	sessionsHandler := handlers.NewSessionsHandler(databases.Logs, databases.App)
	machinesHandler := handlers.NewMachinesHandler(databases.App)
	clusterHandler := handlers.NewClusterHandler(databases.App)
	cronHandler := handlers.NewCronHandler(databases.App)
	metricsHandler := handlers.NewMetricsHandler(databases.Logs, databases.Aggregated, metricsCollector)
	directoriesHandler := handlers.NewDirectoriesHandler(databases.Aggregated)
	settingsHandler := handlers.NewSettingsHandler(databases.App)
	versionsHandler := handlers.NewVersionsHandler(databases.App)
	proxyHandler := handlers.NewProxyHandler(databases.App)
	groupsHandler := handlers.NewGroupsHandler(databases.App)
	explorerCfg := handlers.ExplorerConfig{
		AllowedRoots:   cfg.Explorer.AllowedPaths,
		MaxUploadBytes: int64(cfg.Explorer.MaxUploadSizeMB) * 1024 * 1024,
	}
	explorerHandler := handlers.NewExplorerHandler(explorerCfg)
	importHandler := handlers.NewImportHandler(databases.App)
	healthHandler := handlers.NewHealthHandler(databases.App, databases.Logs)
	containerHandler := handlers.NewContainerHandler(containerSvc, databases.App, databases.Logs, log)
	registryHandler := handlers.NewRegistryHandler(databases.App, cfg.Registry.StorageDir, log)
	systemHandler := handlers.NewSystemHandler(IsWindowsServiceActive, InstallWindowsService, UninstallWindowsService)

	// ─── SignalR servers ─────────────────────────────────────────────────────
	signalROrigins := []string{
		"localhost:*",
		"127.0.0.1:*",
		"[::1]:*",
	}
	logHubServer, err := signalr.NewServer(ctx,
		signalr.UseHub(logHub),
		signalr.KeepAliveInterval(15*time.Second),
		signalr.TimeoutInterval(120*time.Second),
		signalr.AllowOriginPatterns(signalROrigins),
	)
	if err != nil {
		log.Fatal("signalr log hub failed", zap.Error(err))
	}
	terminalHubServer, err := signalr.NewServer(ctx,
		signalr.UseHub(terminalHub),
		signalr.KeepAliveInterval(15*time.Second),
		signalr.TimeoutInterval(120*time.Second),
		signalr.AllowOriginPatterns(signalROrigins),
	)
	if err != nil {
		log.Fatal("signalr terminal hub failed", zap.Error(err))
	}

	// ─── Router ──────────────────────────────────────────────────────────────
	r := chi.NewRouter()

	// global middleware
	r.Use(chimiddleware.Recoverer)
	r.Use(skipSignalRMiddleware(chimiddleware.Compress(gzip.DefaultCompression)))
	r.Use(skipSignalRMiddleware(chimiddleware.Timeout(30 * time.Second)))
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   cfg.Cors.AllowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-Agent-Api-Key", "X-Requested-With", "X-SignalR-User-Agent"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	// auth (uses handler's own Routes which has login rate limiting inline)
	jwtMW := middleware.JWTAuth(authSvc)
	r.Route("/api/auth", func(r chi.Router) {
		r.Use(middleware.LoginRateLimit)
		r.Mount("/", authHandler.Routes(jwtMW))
	})

	// health (no auth) — available at both /health and /api/health
	r.Get("/health", healthHandler.ServeHTTP)
	r.Get("/api/health", healthHandler.ServeHTTP)

	// protected API
	r.Route("/api", func(r chi.Router) {
		r.Use(middleware.JWTAuth(authSvc))
		r.Use(middleware.AuthBypass(!cfg.Authentication.Enabled))
		r.Use(middleware.RoleBasedAccess)

		// apps — also mount /Apps for .NET-compatible casing used by the UI
		r.Mount("/apps", appsHandler.Routes())
		r.Mount("/Apps", appsHandler.Routes())

		// services — mount svcHandler directly so its static routes (e.g.
		// /statuses) always win over any parametric /{identifier} pattern.
		// Versions and logs sub-routes are injected via AddSubRoutes so they
		// live inside the /{identifier} group in svcHandler.Routes(), not as
		// competing siblings at this level.
		svcHandler.
			AddSubRoutes(versionsHandler.InjectServiceRoutes).
			AddSubRoutes(logsHandler.InjectRoutes)
		r.Mount("/services", svcHandler.Routes())
		r.Post("/services/import", importHandler.Import)
		r.Mount("/service-versions", versionsHandler.StandaloneRoutes())

		// environments — also mount /envs to match the .NET [Route("api/envs")] convention
		r.Mount("/environments", envHandler.Routes())
		r.Mount("/envs", envHandler.Routes())

		// sessions
		r.Mount("/sessions", sessionsHandler.Routes())

		// machines
		r.Mount("/machines", machinesHandler.Routes())

		// cluster (agent routes also validated by AgentAPIKey middleware)
		r.Route("/cluster", func(r chi.Router) {
			r.Use(middleware.AgentAPIKey(databases.App))
			r.Mount("/", clusterHandler.Routes())
		})

		// cron
		r.Mount("/cron", cronHandler.Routes())

		// metrics
		r.Mount("/metrics", metricsHandler.Routes())

		// directories
		r.Mount("/directories", directoriesHandler.Routes())

		// settings
		r.Mount("/settings", settingsHandler.Routes())

		// proxy
		r.Mount("/proxy-routes", proxyHandler.RoutesRoutes())
		r.Mount("/proxy-settings", proxyHandler.SettingsRoutes())

		// groups
		r.Mount("/groups", groupsHandler.Routes())

		// explorer
		r.Mount("/explorer", explorerHandler.Routes())
		r.Mount("/files", explorerHandler.FileRoutes())

		// container infrastructure
		r.Get("/containers/runtime", containerHandler.GetRuntime)
		r.Get("/images", containerHandler.ListImages)
		r.Post("/images/pull", containerHandler.PullImage)
		r.Delete("/images/{name}", containerHandler.RemoveImage)
		r.Get("/volumes", containerHandler.ListVolumes)
		r.Post("/volumes", containerHandler.CreateVolume)
		r.Delete("/volumes/{name}", containerHandler.RemoveVolume)
		r.Get("/networks", containerHandler.ListNetworks)
		r.Post("/networks", containerHandler.CreateNetwork)
		r.Delete("/networks/{id}", containerHandler.RemoveNetwork)
		r.Route("/services/{id}/container", func(r chi.Router) {
			r.Get("/", containerHandler.GetConfig)
			r.Put("/", containerHandler.UpsertConfig)
			r.Delete("/", containerHandler.DeleteConfig)
			r.Get("/stats", containerHandler.GetStats)
			r.Get("/logs", containerHandler.StreamContainerLogs)
			r.Post("/exec", containerHandler.Exec)
		})

		// package registry
		r.Route("/registry", func(r chi.Router) {
			r.Get("/packages", registryHandler.ListPackages)
			r.Get("/packages/{name}", registryHandler.ListVersions)
			r.Get("/packages/{name}/{version}", registryHandler.GetPackage)
			r.Get("/packages/{name}/{version}/manifest", registryHandler.GetManifest)
			r.Get("/packages/{name}/{version}/components", registryHandler.GetComponents)
			r.Post("/packages", registryHandler.PublishPackage)
			r.Delete("/packages/{name}/{version}", registryHandler.UnpublishPackage)
			r.Get("/packages/{name}/{version}/download", registryHandler.DownloadPackage)
			r.Post("/validate", registryHandler.ValidateManifest)
			r.Get("/installs", registryHandler.ListInstalls)
			r.Post("/install", registryHandler.InstallPackage)
			r.Delete("/installs/{id}", registryHandler.RemoveInstall)
		})

		// system info + service management
		r.Mount("/system", systemHandler.Routes())
	})

	// SignalR hubs — chi.Router satisfies MappableRouter with this adapter
	chiWrapper := func(router chi.Router) func() signalr.MappableRouter {
		return func() signalr.MappableRouter { return &chiMappable{router} }
	}
	logHubServer.MapHTTP(chiWrapper(r), "/loghub")
	terminalHubServer.MapHTTP(chiWrapper(r), "/terminalhub")

	// static / SPA fallback
	r.Handle("/*", spaHandler())

	// ─── Start server ────────────────────────────────────────────────────────
	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:         addr,
		Handler:      r,
		ReadTimeout:  60 * time.Second,
		WriteTimeout: 60 * time.Second,
		IdleTimeout:  120 * time.Second,
	}

	go func() {
		log.Info("MiniCluster API starting", zap.String("addr", addr), zap.String("dataDir", dataDir))
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal("server error", zap.Error(err))
		}
	}()

	// graceful shutdown — also handles Windows Service stop signals
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	runAsWindowsService(quit, log) // no-op on non-Windows; sends SIGTERM on SCM stop
	<-quit
	log.Info("shutting down...")
	cancel()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer shutdownCancel()
	_ = srv.Shutdown(shutdownCtx)
	log.Info("server stopped")
}

func buildLogger() *zap.Logger {
	encoderCfg := zap.NewProductionEncoderConfig()
	encoderCfg.TimeKey = "time"
	encoderCfg.EncodeTime = zapcore.ISO8601TimeEncoder
	cfg := zap.NewProductionConfig()
	cfg.EncoderConfig = encoderCfg
	log, _ := cfg.Build()
	return log
}

func skipSignalRMiddleware(mw func(http.Handler) http.Handler) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		wrapped := mw(next)
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if isSignalRRequest(r) {
				next.ServeHTTP(w, r)
				return
			}
			wrapped.ServeHTTP(w, r)
		})
	}
}

func isSignalRRequest(r *http.Request) bool {
	return strings.HasPrefix(r.URL.Path, "/loghub") ||
		strings.HasPrefix(r.URL.Path, "/terminalhub")
}

// spaHandler serves the embedded React build and falls back to index.html.
func spaHandler() http.Handler {
	sub, err := fs.Sub(staticFiles, "static")
	if err != nil {
		// static dir not embedded (dev mode), return 404 for unknown paths
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			http.NotFound(w, r)
		})
	}
	fsHandler := http.FileServer(http.FS(sub))
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.TrimPrefix(r.URL.Path, "/")
		// try serving the file directly
		f, err := sub.(fs.FS).Open(path)
		if err == nil {
			f.Close()
			fsHandler.ServeHTTP(w, r)
			return
		}
		// fall back to index.html (SPA routing)
		r2 := r.Clone(r.Context())
		r2.URL.Path = "/"
		fsHandler.ServeHTTP(w, r2)
	})
}

// staticPlaceholder ensures the embed compiles even when no build output exists.
func init() {
	_ = filepath.Join // ensure filepath import is used
}

// chiMappable adapts chi.Router to satisfy signalr.MappableRouter.
type chiMappable struct {
	r chi.Router
}

func (c *chiMappable) HandleFunc(pattern string, fn func(w http.ResponseWriter, r *http.Request)) {
	c.r.HandleFunc(pattern, fn)
}

func (c *chiMappable) Handle(pattern string, handler http.Handler) {
	c.r.Handle(pattern, handler)
}
