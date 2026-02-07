using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Api.Middleware;
using Innovatek.Parallel.MiniCluster.Api.Configuration;




var builder = WebApplication.CreateBuilder(args);

// Ensure data directory exists for SQLite databases
var dataDirectory = OperatingSystem.IsWindows() 
    ? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.CommonApplicationData), "MiniCluster")
    : "/var/lib/minicluster";

if (!Directory.Exists(dataDirectory))
{
    Directory.CreateDirectory(dataDirectory);
}

// ── Services ────────────────────────────────────────────────────────────────

builder.Services.AddDatabases(builder.Configuration, builder.Environment);
builder.Services.AddAuth(builder.Configuration);
builder.Services.AddProcessManagement();
builder.Services.AddPlatformServices(builder.Configuration);

// Global exception handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddProblemDetails();

// CORS
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

// MVC & API
builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddHttpClient();

// SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.MaximumReceiveMessageSize = 102400;
    options.StreamBufferCapacity = 10;
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(60);
    options.KeepAliveInterval = TimeSpan.FromSeconds(30);
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

builder.Services.AddSwaggerGen();

// ── App Pipeline ────────────────────────────────────────────────────────────

var app = builder.Build();

app.UseExceptionHandler();
app.UseRequestTimeout(TimeSpan.FromSeconds(30));

// Initialize: migrate DBs, create admin, auto-start services
await app.InitializeAsync();

// CORS
app.UseCors("DefaultPolicy");

// Static files (embedded UI)
app.UseDefaultFiles();
app.UseStaticFiles();

// Auth pipeline
app.UseLoginRateLimit();
app.UseAuthentication();
app.UseAuthenticationBypass();
app.UseAuthorization();
app.UseRoleBasedAccess();
app.UseAgentApiKeyAuth();

// API + Hubs
app.UseSwagger();
app.UseSwaggerUI();
app.MapControllers();
app.MapHub<LogHub>("/loghub");
app.MapHub<TerminalHub>("/terminalhub");

// Reverse Proxy
app.MapReverseProxy(proxyPipeline =>
{
    proxyPipeline.UseMiddleware<ProxyAuthMiddleware>();
});

// SPA fallback
app.MapFallback(async context =>
{
    context.Response.ContentType = "text/html";
    await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
});

app.Run();
