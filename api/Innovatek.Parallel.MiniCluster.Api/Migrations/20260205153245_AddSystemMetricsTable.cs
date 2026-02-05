using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations.LogsDb
{
    /// <inheritdoc />
    public partial class AddSystemMetricsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "SystemMetrics",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CpuUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    ProcessorCount = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalPhysicalMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    AvailablePhysicalMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    UsedPhysicalMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    MemoryUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    TotalDiskSpace = table.Column<long>(type: "INTEGER", nullable: false),
                    AvailableDiskSpace = table.Column<long>(type: "INTEGER", nullable: false),
                    UsedDiskSpace = table.Column<long>(type: "INTEGER", nullable: false),
                    DiskUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    NetworkBytesSent = table.Column<long>(type: "INTEGER", nullable: false),
                    NetworkBytesReceived = table.Column<long>(type: "INTEGER", nullable: false),
                    NetworkSendRate = table.Column<long>(type: "INTEGER", nullable: false),
                    NetworkReceiveRate = table.Column<long>(type: "INTEGER", nullable: false),
                    TotalProcesses = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalThreads = table.Column<int>(type: "INTEGER", nullable: false),
                    SystemUptime = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SystemMetrics", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SystemMetrics_Timestamp",
                table: "SystemMetrics",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SystemMetrics");
        }
    }
}
