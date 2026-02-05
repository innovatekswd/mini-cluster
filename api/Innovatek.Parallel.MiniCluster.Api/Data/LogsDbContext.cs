using Innovatek.Parallel.MiniCluster.Core.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.Data.Sqlite;

namespace Innovatek.Parallel.MiniCluster.Api.Data;

public class LogsDbContext : DbContext
{
    public LogsDbContext(DbContextOptions<LogsDbContext> options) : base(options) { }

    public DbSet<SessionLogEntry> SessionLogs => Set<SessionLogEntry>();
    public DbSet<ServiceSession> ServiceSessions { get; set; }
    public DbSet<ServiceLifecycleEvent> LifecycleEvents => Set<ServiceLifecycleEvent>();
    public DbSet<ProcessMetrics> ProcessMetrics => Set<ProcessMetrics>();
    public DbSet<ProcessMetricsAggregated> ProcessMetricsAggregated => Set<ProcessMetricsAggregated>();
    public DbSet<SystemMetrics> SystemMetrics => Set<SystemMetrics>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<SessionLogEntry>(entity =>
        {
            entity.HasKey(l => l.Id);
            entity.HasIndex(l => l.SessionId);
            entity.HasIndex(l => l.Timestamp);
        });

        modelBuilder.Entity<ServiceSession>(entity =>
        {
            entity.ToTable("AppSessions"); // Keep table name for migration compatibility
            entity.HasIndex(s => s.ServiceId);
            entity.HasIndex(s => s.StartTimestamp);
            entity.HasIndex(s => new { s.ServiceId, s.StartTimestamp }); // Composite for cleanup queries
        });

        modelBuilder.Entity<ServiceLifecycleEvent>(entity =>
        {
            entity.ToTable("LifecycleEvents"); // Keep table name for migration compatibility
            entity.HasIndex(e => e.ServiceId);
            entity.HasIndex(e => e.Timestamp);
            entity.HasIndex(e => new { e.ServiceId, e.Timestamp }); // Composite for cleanup queries
        });

        modelBuilder.Entity<ProcessMetrics>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => m.ServiceId);
            entity.HasIndex(m => m.Timestamp);
            entity.HasIndex(m => new { m.ServiceId, m.Timestamp }); // Composite for time-series queries
            entity.HasIndex(m => m.SessionId);
            // Store TimeSpan as ticks
            entity.Property(m => m.TotalProcessorTime).HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));
            entity.Property(m => m.UserProcessorTime).HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));
        });

        modelBuilder.Entity<ProcessMetricsAggregated>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => m.ServiceId);
            entity.HasIndex(m => m.Timestamp);
            entity.HasIndex(m => new { m.ServiceId, m.Timestamp, m.IntervalSeconds }); // Composite for aggregated queries
            entity.HasIndex(m => m.IntervalSeconds);
        });

        modelBuilder.Entity<SystemMetrics>(entity =>
        {
            entity.HasKey(m => m.Id);
            entity.HasIndex(m => m.Timestamp);
            // Store TimeSpan as ticks
            entity.Property(m => m.SystemUptime).HasConversion(
                v => v.Ticks,
                v => TimeSpan.FromTicks(v));
        });
    }
}
