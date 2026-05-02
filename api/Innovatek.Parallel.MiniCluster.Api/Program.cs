using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Api.Middleware;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;




var builder = WebApplication.CreateBuilder(args);

// Run as a Windows Service or systemd service when invoked that way.
// Has no effect when running interactively.
builder.Host.UseWindowsService(options => options.ServiceName = "MiniCluster");
builder.Host.UseSystemd();

// For single-file deployments (and Windows Service mode where CWD is System32),
// always anchor ContentRoot to the exe directory so appsettings.json and wwwroot
// are found regardless of the working directory.
var exeDir = Path.GetDirectoryName(Environment.ProcessPath ?? AppContext.BaseDirectory)
    ?? Directory.GetCurrentDirectory();

builder.WebHost.UseContentRoot(exeDir);

// Explicitly load appsettings from the exe directory (needed for single-file + service mode).
builder.Configuration
    .SetBasePath(exeDir)
    .AddJsonFile("appsettings.json", optional: true, reloadOnChange: false)
    .AddJsonFile($"appsettings.{builder.Environment.EnvironmentName}.json", optional: true, reloadOnChange: false)
    .AddEnvironmentVariables();

var webRootPath = Path.Combine(exeDir, "wwwroot");
if (Directory.Exists(webRootPath))
{
    builder.WebHost.UseWebRoot(webRootPath);
}

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
    options.MaximumReceiveMessageSize = 262144; // 256 KB (was 100 KB)
    options.StreamBufferCapacity = 50;          // was 10 — prevents backpressure on fast log output
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(120); // was 60 s — tolerates network hiccups
    options.KeepAliveInterval = TimeSpan.FromSeconds(15);      // was 30 s — more frequent heartbeat
});

// AutoMapper
builder.Services.AddAutoMapper(typeof(Program));

builder.Services.AddSwaggerGen();

// Response Compression (gzip + Brotli)
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<BrotliCompressionProvider>();
    options.Providers.Add<GzipCompressionProvider>();
    options.MimeTypes = ResponseCompressionDefaults.MimeTypes.Concat(
        new[] { "application/json", "text/plain", "application/javascript", "text/css" });
});
builder.Services.Configure<BrotliCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Fastest);
builder.Services.Configure<GzipCompressionProviderOptions>(options =>
    options.Level = CompressionLevel.Fastest);

// ── App Pipeline ────────────────────────────────────────────────────────────

var app = builder.Build();

app.UseExceptionHandler();
app.UseResponseCompression();
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
    var webRoot = app.Environment.WebRootPath;
    var indexPath = webRoot is not null ? Path.Combine(webRoot, "index.html") : null;
    if (indexPath is not null && File.Exists(indexPath))
    {
        context.Response.ContentType = "text/html";
        await context.Response.SendFileAsync(indexPath);
    }
    else
    {
        context.Response.StatusCode = 404;
        await context.Response.WriteAsync("UI not found. Ensure the wwwroot folder is alongside the executable.");
    }
});

app.Run();
