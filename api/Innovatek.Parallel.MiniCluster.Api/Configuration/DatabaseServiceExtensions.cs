using Innovatek.Parallel.MiniCluster.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Innovatek.Parallel.MiniCluster.Api.Configuration;

public static class DatabaseServiceExtensions
{
    public static IServiceCollection AddDatabases(this IServiceCollection services, IConfiguration configuration, IWebHostEnvironment environment)
    {
        // Control Database (static config)
        var connectionString = configuration.GetConnectionString("DefaultConnection") 
            ?? "Data Source=controlcenter.db";
        services.AddDbContext<AppDbContext>(options =>
        {
            options.UseSqlite(connectionString, sqliteOptions =>
            {
                sqliteOptions.CommandTimeout(30);
                sqliteOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            });
            options.EnableSensitiveDataLogging(environment.IsDevelopment());
            options.EnableDetailedErrors(environment.IsDevelopment());
            options.AddInterceptors(new SqliteConnectionInterceptor());
        });

        // Logs Database (high-volume transient data)
        var logsConnectionString = configuration.GetConnectionString("LogsConnection") 
            ?? "Data Source=logs.db;Mode=ReadWriteCreate;Cache=Shared;Pooling=True;BusyTimeout=5000;Journal Mode=WAL";
        services.AddDbContext<LogsDbContext>(options =>
        {
            options.UseSqlite(logsConnectionString, sqliteOptions =>
            {
                sqliteOptions.CommandTimeout(30);
                sqliteOptions.UseQuerySplittingBehavior(QuerySplittingBehavior.SplitQuery);
            });
            options.EnableSensitiveDataLogging(environment.IsDevelopment());
            options.EnableDetailedErrors(environment.IsDevelopment());
            options.AddInterceptors(new SqliteConnectionInterceptor());
        });

        return services;
    }
}
