using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Api.Middleware;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Innovatek.Parallel.Identity.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.IdentityModel.Tokens;
using System.Text;
using Innovatek.Parallel.TemplateEngine;
using Yarp.ReverseProxy.Configuration;




var builder = WebApplication.CreateBuilder(args);

// Ensure data directory exists for SQLite databases
// Use platform-specific data directory
var dataDirectory = OperatingSystem.IsWindows() 
    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MiniCluster")
    : "/var/lib/minicluster";

if (!Directory.Exists(dataDirectory))
{
    Directory.CreateDirectory(dataDirectory);
}

// Add EF Core with SQLite - Control Database (static config)
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection") 
    ?? "Data Source=controlcenter.db";
builder.Services.AddDbContext<AppDbContext>(options =>
{
    options.UseSqlite(connectionString, sqliteOptions =>
    {
        sqliteOptions.CommandTimeout(30);
        sqliteOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
    });
    options.EnableSensitiveDataLogging(builder.Environment.IsDevelopment());
    options.EnableDetailedErrors(builder.Environment.IsDevelopment());
    options.AddInterceptors(new Innovatek.Parallel.MiniCluster.Api.Data.SqliteConnectionInterceptor());
});

// Add EF Core with SQLite - Logs Database (high-volume transient data)
var logsConnectionString = builder.Configuration.GetConnectionString("LogsConnection") 
    ?? "Data Source=logs.db;Mode=ReadWriteCreate;Cache=Shared;Pooling=True;BusyTimeout=5000;Journal Mode=WAL";
builder.Services.AddDbContext<LogsDbContext>(options =>
{
    options.UseSqlite(logsConnectionString, sqliteOptions =>
    {
        sqliteOptions.CommandTimeout(30);
        sqliteOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
    });
    options.EnableSensitiveDataLogging(builder.Environment.IsDevelopment());
    options.EnableDetailedErrors(builder.Environment.IsDevelopment());
    options.AddInterceptors(new Innovatek.Parallel.MiniCluster.Api.Data.SqliteConnectionInterceptor());
});

// Add global exception handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// Add CORS
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:3000" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("DefaultPolicy", policy =>
    {
        policy.WithOrigins(allowedOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// Add services
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient(); // For proxy health checks

// Authentication configuration
builder.Services.AddOptions<AuthenticationOptions>()
    .BindConfiguration(AuthenticationOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

var authConfig = builder.Configuration.GetSection(AuthenticationOptions.SectionName).Get<AuthenticationOptions>() 
    ?? new AuthenticationOptions();

// JWT Authentication
builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = authConfig.JwtIssuer,
        ValidAudience = authConfig.JwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(authConfig.JwtSecret)),
        ClockSkew = TimeSpan.Zero // Remove default 5 min clock skew
    };

    // Support JWT in query string for SignalR
    options.Events = new JwtBearerEvents
    {
        OnMessageReceived = context =>
        {
            var accessToken = context.Request.Query["access_token"];
            var path = context.HttpContext.Request.Path;
            
            if (!string.IsNullOrEmpty(accessToken) && 
                (path.StartsWithSegments("/loghub") || path.StartsWithSegments("/terminalhub")))
            {
                context.Token = accessToken;
            }
            return Task.CompletedTask;
        }
    };
});

builder.Services.AddAuthorization(options =>
{
    Innovatek.Parallel.MiniCluster.Api.Configuration.AuthPolicies.ConfigurePolicies(options);
});

// Identity services - register AppDbContext as IIdentityDbContext
builder.Services.AddScoped<IIdentityDbContext>(sp => sp.GetRequiredService<AppDbContext>());
builder.Services.AddScoped<IAuthService, AuthService>();

// Identifier resolver for name-based lookups
builder.Services.AddScoped<IIdentifierResolver, IdentifierResolver>();

// Configuration validation
builder.Services.AddOptions<LogCleanupOptions>()
    .BindConfiguration(LogCleanupOptions.SectionName)
    .ValidateDataAnnotations()
    .ValidateOnStart();

// Process management and logging services (from our fixes)
builder.Services.AddSingleton<IServiceProcessManager, ServiceProcessManager>();
builder.Services.AddSingleton<ILogBatchService, LogBatchService>();
builder.Services.AddHostedService(provider => (LogBatchService)provider.GetRequiredService<ILogBatchService>());
builder.Services.AddHostedService<ProcessMonitoringService>();
builder.Services.AddHostedService<LogCleanupService>(); // Automatic log cleanup every 10 minutes

// Health check & auto-restart services
builder.Services.AddSingleton<HealthCheckService>();
builder.Services.AddSingleton<IHealthCheckService>(provider =>
    provider.GetRequiredService<HealthCheckService>());
builder.Services.AddHostedService(provider =>
    provider.GetRequiredService<HealthCheckService>());

builder.Services.AddSingleton<AutoRestartService>();
builder.Services.AddSingleton<IAutoRestartService>(provider =>
    provider.GetRequiredService<AutoRestartService>());
builder.Services.AddHostedService(provider =>
    provider.GetRequiredService<AutoRestartService>());

// Process metrics collection service
builder.Services.AddSingleton<ProcessMetricsCollectionService>();
builder.Services.AddSingleton<IProcessMetricsService>(provider => 
    provider.GetRequiredService<ProcessMetricsCollectionService>());
builder.Services.AddHostedService(provider => 
    provider.GetRequiredService<ProcessMetricsCollectionService>());

// Terminal service for PTY/REPL support
builder.Services.AddSingleton<ITerminalService, TerminalService>();

// Machine service (cluster nodes)
builder.Services.AddScoped<IMachineService, MachineService>();

// Cluster services
builder.Services.AddScoped<IClusterNotificationService, ClusterNotificationService>();
builder.Services.AddOptions<AgentOptions>()
    .BindConfiguration(AgentOptions.SectionName)
    .ValidateDataAnnotations();
builder.Services.AddHostedService<HeartbeatMonitorService>();
builder.Services.AddHostedService<AgentRegistrationService>();

// File Explorer service
builder.Services.Configure<ExplorerOptions>(builder.Configuration.GetSection(ExplorerOptions.SectionName));
builder.Services.AddScoped<ExplorerService>();

// Post-MVP: Cron Scheduling
builder.Services.AddScoped<ICronSchedulingService, CronSchedulingService>();
builder.Services.AddHostedService<CronSchedulerBackgroundService>();

// Post-MVP: Service Versioning & Deployment
builder.Services.AddScoped<IServiceVersioningService, ServiceVersioningService>();

// Post-MVP: Hierarchical Apps
builder.Services.AddScoped<IAppTreeService, AppTreeService>();

// SignalR with enhanced configuration (from our fixes)
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 102400; // 100 KB
    options.StreamBufferCapacity = 10;
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.KeepAliveInterval = TimeSpan.FromSeconds(30);
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

// Variable resolution services (from branch)
builder.Services.AddScoped<IEnvironmentService, EnvironmentService>();
builder.Services.AddScoped<IVariableResolver, EnvironmentResolver>();
builder.Services.AddScoped<IVariableResolverFactory, DefaultVariableResolverFactory>();

builder.Services.AddSwaggerGen();

// Reverse Proxy (YARP)
builder.Services.AddSingleton<DatabaseProxyConfigProvider>();
builder.Services.AddSingleton<IProxyConfigProvider>(sp => sp.GetRequiredService<DatabaseProxyConfigProvider>());
builder.Services.AddSingleton<IProxyConfigNotifier>(sp => sp.GetRequiredService<DatabaseProxyConfigProvider>());
builder.Services.AddReverseProxy();

var app = builder.Build();

// Add exception handling middleware
app.UseExceptionHandler();

// Add request timeout middleware (30 second default)
app.UseRequestTimeout(TimeSpan.FromSeconds(30));

// Apply migrations and auto-start apps with proper error handling
using (var scope = app.Services.CreateScope())
{
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        // Apply migrations for both databases
        var controlDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();
        
        controlDb.Database.Migrate();
        logsDb.Database.Migrate();
        
        // Wait a moment for databases to be ready
        await Task.Delay(500);
        
        // Create initial admin user if no users exist
        var authService = scope.ServiceProvider.GetRequiredService<IAuthService>();
        var adminCreated = await authService.CreateInitialAdminIfNeededAsync();
        if (adminCreated)
        {
            logger.LogWarning("Created initial admin user. Username: admin, Password: admin. PLEASE CHANGE THIS PASSWORD!");
        }
        
        // Auto-register local machine
        var machineService = scope.ServiceProvider.GetRequiredService<IMachineService>();
        var localMachine = await machineService.GetOrCreateLocalAsync();
        logger.LogInformation("Local machine: {Name} (ID: {Id})", localMachine.Name, localMachine.Id);
        
        var manager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();
        var autoStartServices = await controlDb.Services.Where(s => s.AutoStart).ToListAsync();

        foreach (var service in autoStartServices)
        {
            try
            {
                await manager.StartServiceAsync(service.Id, "auto");
                logger.LogInformation($"Auto-started service: {service.Name}");
            }
            catch (Exception ex)
            {
                logger.LogError(ex, $"Failed to auto-start service: {service.Name}");
            }
        }
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Error during startup initialization");
    }
}

// Enable CORS
app.UseCors("DefaultPolicy");

// Enable default files and static file serving
app.UseDefaultFiles(); // Looks for index.html by default
app.UseStaticFiles();

// Authentication & Authorization
app.UseLoginRateLimit(); // 5 attempts/min per IP on /api/auth/login
app.UseAuthentication();
app.UseAuthenticationBypass(); // Skips auth when Authentication.Enabled=false
app.UseAuthorization();
app.UseRoleBasedAccess(); // RBAC: Viewer=read-only, Operator=no user mgmt, Admin=full

// Agent API key auth for /api/cluster/* endpoints
app.UseAgentApiKeyAuth();

app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapHub<LogHub>("/loghub");
app.MapHub<TerminalHub>("/terminalhub");

// Reverse Proxy endpoints with authentication middleware
app.MapReverseProxy(proxyPipeline =>
{
    proxyPipeline.UseMiddleware<ProxyAuthMiddleware>();
});


// Fallback to index.html to support client-side routing.
app.MapFallback(async context =>
{
    context.Response.ContentType = "text/html";
    await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
});


app.Run();
