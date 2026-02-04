using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProcessMetricsTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProcessMetrics",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    WorkingSetMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    PrivateMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    VirtualMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    PeakWorkingSetMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    CpuUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    TotalProcessorTime = table.Column<long>(type: "INTEGER", nullable: false),
                    UserProcessorTime = table.Column<long>(type: "INTEGER", nullable: false),
                    ThreadCount = table.Column<int>(type: "INTEGER", nullable: false),
                    HandleCount = table.Column<int>(type: "INTEGER", nullable: false),
                    NetworkBytesSent = table.Column<long>(type: "INTEGER", nullable: false),
                    NetworkBytesReceived = table.Column<long>(type: "INTEGER", nullable: false),
                    IsResponding = table.Column<bool>(type: "INTEGER", nullable: false),
                    ProcessId = table.Column<int>(type: "INTEGER", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessMetrics", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProcessMetricsAggregated",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    IntervalSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    SampleCount = table.Column<int>(type: "INTEGER", nullable: false),
                    AvgWorkingSetMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    MaxWorkingSetMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    MinWorkingSetMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    AvgPrivateMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    MaxPrivateMemory = table.Column<long>(type: "INTEGER", nullable: false),
                    AvgCpuUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    MaxCpuUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    MinCpuUsagePercent = table.Column<double>(type: "REAL", nullable: false),
                    AvgThreadCount = table.Column<double>(type: "REAL", nullable: false),
                    MaxThreadCount = table.Column<int>(type: "INTEGER", nullable: false),
                    AvgHandleCount = table.Column<double>(type: "REAL", nullable: false),
                    MaxHandleCount = table.Column<int>(type: "INTEGER", nullable: false),
                    TotalNetworkBytesSent = table.Column<long>(type: "INTEGER", nullable: false),
                    TotalNetworkBytesReceived = table.Column<long>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProcessMetricsAggregated", x => x.Id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetrics_AppId",
                table: "ProcessMetrics",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetrics_AppId_Timestamp",
                table: "ProcessMetrics",
                columns: new[] { "AppId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetrics_SessionId",
                table: "ProcessMetrics",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetrics_Timestamp",
                table: "ProcessMetrics",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetricsAggregated_AppId",
                table: "ProcessMetricsAggregated",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetricsAggregated_AppId_Timestamp_IntervalSeconds",
                table: "ProcessMetricsAggregated",
                columns: new[] { "AppId", "Timestamp", "IntervalSeconds" });

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetricsAggregated_IntervalSeconds",
                table: "ProcessMetricsAggregated",
                column: "IntervalSeconds");

            migrationBuilder.CreateIndex(
                name: "IX_ProcessMetricsAggregated_Timestamp",
                table: "ProcessMetricsAggregated",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProcessMetrics");

            migrationBuilder.DropTable(
                name: "ProcessMetricsAggregated");
        }
    }
}
