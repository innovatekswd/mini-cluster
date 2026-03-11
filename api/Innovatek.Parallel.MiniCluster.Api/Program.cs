using Innovatek.Parallel.MiniCluster.Api.Hubs;
using Innovatek.Parallel.MiniCluster.Api.Middleware;
using Innovatek.Parallel.MiniCluster.Api.Configuration;
using Microsoft.AspNetCore.ResponseCompression;
using System.IO.Compression;




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
    context.Response.ContentType = "text/html";
    await context.Response.SendFileAsync(Path.Combine(app.Environment.WebRootPath, "index.html"));
});

app.Run();
