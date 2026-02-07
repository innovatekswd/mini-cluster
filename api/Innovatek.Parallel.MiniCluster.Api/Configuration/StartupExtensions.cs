using Innovatek.Parallel.MiniCluster.Api.Data;
using Innovatek.Parallel.MiniCluster.Api.Services;
using Innovatek.Parallel.Identity.Services;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

public static class StartupExtensions
{
    public static async Task InitializeAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();
        var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
        
        try
        {
            // Apply migrations for both databases
            var controlDb = scope.ServiceProvider.GetRequiredService<AppDbContext>();
            var logsDb = scope.ServiceProvider.GetRequiredService<LogsDbContext>();
            
            controlDb.Database.Migrate();
            logsDb.Database.Migrate();
            
            await Task.Delay(500);
            
            // Create initial admin user if none exist
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
            
            // Auto-start services
            var manager = scope.ServiceProvider.GetRequiredService<IServiceProcessManager>();
            var autoStartServices = await controlDb.Services.Where(s => s.AutoStart).ToListAsync();

            foreach (var service in autoStartServices)
            {
                try
                {
                    await manager.StartServiceAsync(service.Id, "auto");
                    logger.LogInformation("Auto-started service: {ServiceName}", service.Name);
                }
                catch (Exception ex)
                {
                    logger.LogError(ex, "Failed to auto-start service: {ServiceName}", service.Name);
                }
            }
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Error during startup initialization");
        }
    }
}
