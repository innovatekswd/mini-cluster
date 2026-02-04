using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Data.Sqlite;
using System.Data.Common;

namespace Innovatek.Parallel.MiniCluster.Api.Data;

public class SqliteConnectionInterceptor : DbConnectionInterceptor
{
    public override void ConnectionOpened(DbConnection connection, ConnectionEndEventData eventData)
    {
        if (connection is SqliteConnection)
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;";
            command.ExecuteNonQuery();
        }
        base.ConnectionOpened(connection, eventData);
    }

    public override async Task ConnectionOpenedAsync(
        DbConnection connection, 
        ConnectionEndEventData eventData, 
        CancellationToken cancellationToken = default)
    {
        if (connection is SqliteConnection)
        {
            using var command = connection.CreateCommand();
            command.CommandText = "PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;";
            await command.ExecuteNonQueryAsync(cancellationToken);
        }
        await base.ConnectionOpenedAsync(connection, eventData, cancellationToken);
    }
}
