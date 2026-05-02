using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Api.Middleware;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;
using System.Security.Cryptography;
using System.Text.Json;
using System.Text.Json.Nodes;




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

// Bind listen port from config ("Port") or env var ASPNETCORE_URLS / DOTNET_URLS.
// Default is 5000 (same as the Go backend) so both binaries work out-of-the-box
// on the same port without any configuration change.
// Override: set "Port": 8080 in appsettings.json, or ASPNETCORE_URLS=http://*:8080 env var.
if (string.IsNullOrEmpty(Environment.GetEnvironmentVariable("ASPNETCORE_URLS")) &&
    string.IsNullOrEmpty(Environment.GetEnvironmentVariable("DOTNET_URLS")))
{
    var port = builder.Configuration.GetValue<int?>("Port") ?? 5000;
    builder.WebHost.UseUrls($"http://*:{port}");
}

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

// ── First-run setup ─────────────────────────────────────────────────────────
// Generate a random JWT secret and persist it to appsettings.json when the
// configured value is empty or still set to the well-known default.
// This runs before AddAuth() so the in-memory config is updated in time.
EnsureJwtSecret(exeDir, builder.Configuration);

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
builder.Services.AddAutoMapper(cfg => cfg.AddProfile<MappingProfile>());

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

// ── First-run helpers ────────────────────────────────────────────────────────

/// <summary>
/// Generates a cryptographically random JWT secret and persists it to
/// appsettings.json when the current value is missing or still the well-known
/// default shipped in the repository.  Also patches the live IConfiguration
/// so AddAuth() picks up the new value without requiring a restart.
/// </summary>
static void EnsureJwtSecret(string exeDir, IConfiguration configuration)
{
    const string sectionKey = "Authentication:JwtSecret";
    const string defaultSecret = "MiniCluster-Super-Secret-Key-That-Should-Be-Changed-In-Production-256bits!";

    var current = configuration[sectionKey];
    if (!string.IsNullOrEmpty(current) && current != defaultSecret)
        return; // already configured with a custom secret

    var newSecret = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    // Patch the live IConfiguration so AddAuth() gets the new value immediately.
    ((IConfigurationRoot)configuration)[sectionKey] = newSecret;

    // Persist to appsettings.json so it survives restarts.
    var configPath = Path.Combine(exeDir, "appsettings.json");
    try
    {
        JsonNode root;
        if (File.Exists(configPath))
        {
            var text = File.ReadAllText(configPath);
            root = JsonNode.Parse(text, nodeOptions: new JsonNodeOptions { PropertyNameCaseInsensitive = true })
                   ?? new JsonObject();
        }
        else
        {
            root = new JsonObject();
        }

        // Navigate/create Authentication section.
        if (root["Authentication"] is not JsonObject authNode)
        {
            authNode = new JsonObject();
            root["Authentication"] = authNode;
        }
        authNode["JwtSecret"] = newSecret;

        var options = new JsonSerializerOptions { WriteIndented = true };
        File.WriteAllText(configPath, root.ToJsonString(options));

        Console.WriteLine($"[MiniCluster] First run: generated JWT secret and saved to {configPath}");
    }
    catch (Exception ex)
    {
        Console.Error.WriteLine($"[MiniCluster] Warning: could not persist JWT secret to {configPath}: {ex.Message}");
        // Non-fatal — the in-memory patch means this run will work fine.
    }
}
