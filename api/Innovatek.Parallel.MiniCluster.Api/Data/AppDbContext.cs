using Innovatek.Parallel.MiniCluster.Core.Entities;
using Innovatek.Parallel.Identity.Entities;
using Innovatek.Parallel.Identity.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json;

namespace Innovatek.Parallel.MiniCluster.Api.Data;

public class AppDbContext : DbContext, IIdentityDbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    // Services (formerly ControlledApps) - uses same table for migration compatibility
    public DbSet<Service> Services => Set<Service>();
    
    // Apps - for grouping services
    public DbSet<App> Apps { get; set; }
    
    public DbSet<Core.Entities.Environment> Environments { get; set; }
    public DbSet<ServiceFile> ServiceFiles { get; set; }
    public DbSet<AppSettings> AppSettings { get; set; }
    
    // Service Groups (formerly AppGroups)
    public DbSet<ServiceGroup> ServiceGroups { get; set; }
    public DbSet<ServiceGroupAssignment> ServiceGroupAssignments { get; set; }
    public DbSet<GroupVariable> GroupVariables { get; set; }
    
    // Proxy Routes
    public DbSet<ProxyRoute> ProxyRoutes { get; set; }
    public DbSet<ProxySettings> ProxySettings { get; set; }
    
    // Authentication
    public DbSet<User> Users { get; set; }
    public DbSet<RefreshToken> RefreshTokens { get; set; }
    
    // Note: Logging data moved to LogsDbContext (SessionLogs, ServiceSessions, LifecycleEvents)
    
    protected override void OnConfiguring(DbContextOptionsBuilder optionsBuilder)
    {
        // Suppress pending model changes warning (expected due to database split)
        optionsBuilder.ConfigureWarnings(warnings => 
            warnings.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.RelationalEventId.PendingModelChangesWarning));
    }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        var dictConverter = new ValueConverter<Dictionary<string, string>, string>(
            v => JsonSerializer.Serialize(v, (JsonSerializerOptions?)null),
            v => JsonSerializer.Deserialize<Dictionary<string, string>>(v, (JsonSerializerOptions?)null)!);

        var dictComparer = new Microsoft.EntityFrameworkCore.ChangeTracking.ValueComparer<Dictionary<string, string>>(
            (c1, c2) => c1 != null && c2 != null && c1.Count == c2.Count && c1.All(kvp => c2.ContainsKey(kvp.Key) && c2[kvp.Key] == kvp.Value),
            c => c.Aggregate(0, (a, v) => HashCode.Combine(a, v.GetHashCode())),
            c => c.ToDictionary(kvp => kvp.Key, kvp => kvp.Value));

        // App entity
        modelBuilder.Entity<App>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name).IsUnique(); // Unique app names
            entity.HasIndex(e => e.Slug).IsUnique(); // Unique app slugs
            entity.HasIndex(e => e.SortOrder);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(1000);
            entity.Property(e => e.Icon).HasMaxLength(50);
            entity.Property(e => e.Color).HasMaxLength(20);
        });

        // Service entity - maps to ControlledApps table for migration compatibility
        modelBuilder.Entity<Service>(entity =>
        {
            entity.ToTable("ControlledApps");
            entity.HasKey(e => e.Id);
            entity.Property(e => e.EnvironmentVariables)
                .HasConversion(dictConverter)
                .Metadata.SetValueComparer(dictComparer);
            entity.HasIndex(e => e.Name);
            entity.HasIndex(e => e.AutoStart);
            entity.HasIndex(e => e.AppId);
            entity.HasIndex(e => new { e.AppId, e.Name }).IsUnique(); // Unique service names per app
            entity.HasIndex(e => new { e.AppId, e.Slug }).IsUnique(); // Unique service slugs per app
            entity.Property(e => e.Slug).IsRequired().HasMaxLength(200);
            
            // Configure relationship with App
            entity.HasOne(e => e.App)
                .WithMany(a => a.Services)
                .HasForeignKey(e => e.AppId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<Core.Entities.Environment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Variables)
                .HasConversion(dictConverter)
                .Metadata.SetValueComparer(dictComparer);
            entity.HasIndex(e => e.Name);
        });

        modelBuilder.Entity<ServiceFile>(entity =>
        {
            entity.ToTable("AppFiles"); // Keep table name for migration compatibility
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.ServiceId);
        });

        modelBuilder.Entity<ServiceGroup>(entity =>
        {
            entity.ToTable("AppGroups"); // Keep table name for migration compatibility
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Name);
            entity.HasOne(e => e.ParentGroup)
                .WithMany(e => e.ChildGroups)
                .HasForeignKey(e => e.ParentGroupId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        modelBuilder.Entity<ServiceGroupAssignment>(entity =>
        {
            entity.ToTable("AppGroupAssignments"); // Keep table name for migration compatibility
            entity.HasKey(e => new { e.ServiceId, e.GroupId });
            entity.HasOne(e => e.Service)
                .WithMany()
                .HasForeignKey(e => e.ServiceId)
                .OnDelete(DeleteBehavior.Cascade);
            entity.HasOne(e => e.Group)
                .WithMany(g => g.ServiceAssignments)
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GroupVariable>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.GroupId, e.Key }).IsUnique();
            entity.HasOne(e => e.Group)
                .WithMany()
                .HasForeignKey(e => e.GroupId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AppSettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasData(new AppSettings
            {
                Id = 1,
                MaxMessagesToKeepInUi = 1000,
                EnableLogSearch = true,
                MetricsCollectionIntervalSeconds = 5,
                MetricsRetentionHours = 24,
                MetricsAggregationIntervalSeconds = 60
            });
        });

        modelBuilder.Entity<ProxyRoute>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.PathPrefix).IsUnique();
            entity.HasIndex(e => e.Subdomain).IsUnique();
            entity.HasIndex(e => e.ProxyPort).IsUnique();
            entity.HasIndex(e => e.IsEnabled);
        });

        modelBuilder.Entity<ProxySettings>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasData(new ProxySettings
            {
                Id = 1,
                BaseDomainType = "nip.io",
                PortRangeStart = 5001,
                PortRangeEnd = 5099,
                DefaultRequireAuth = true
            });
        });

        // User entity
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Username).IsUnique();
            entity.Property(e => e.Username).IsRequired().HasMaxLength(100);
            entity.Property(e => e.PasswordHash).IsRequired();
            entity.Property(e => e.Role).IsRequired().HasMaxLength(50).HasDefaultValue("Operator");
            entity.Property(e => e.Email).HasMaxLength(255);
        });

        // RefreshToken entity
        modelBuilder.Entity<RefreshToken>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Token).IsUnique();
            entity.Property(e => e.Token).IsRequired();
            entity.HasOne(e => e.User)
                .WithMany(u => u.RefreshTokens)
                .HasForeignKey(e => e.UserId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
