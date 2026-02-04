using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class RenameAppToService : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "ProcessMetricsAggregated",
                newName: "ServiceId");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetricsAggregated_AppId_Timestamp_IntervalSeconds",
                table: "ProcessMetricsAggregated",
                newName: "IX_ProcessMetricsAggregated_ServiceId_Timestamp_IntervalSeconds");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetricsAggregated_AppId",
                table: "ProcessMetricsAggregated",
                newName: "IX_ProcessMetricsAggregated_ServiceId");

            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "ProcessMetrics",
                newName: "ServiceId");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetrics_AppId_Timestamp",
                table: "ProcessMetrics",
                newName: "IX_ProcessMetrics_ServiceId_Timestamp");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetrics_AppId",
                table: "ProcessMetrics",
                newName: "IX_ProcessMetrics_ServiceId");

            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "LifecycleEvents",
                newName: "ServiceId");

            migrationBuilder.RenameIndex(
                name: "IX_LifecycleEvents_AppId_Timestamp",
                table: "LifecycleEvents",
                newName: "IX_LifecycleEvents_ServiceId_Timestamp");

            migrationBuilder.RenameIndex(
                name: "IX_LifecycleEvents_AppId",
                table: "LifecycleEvents",
                newName: "IX_LifecycleEvents_ServiceId");

            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "AppSessions",
                newName: "ServiceId");

            migrationBuilder.RenameIndex(
                name: "IX_AppSessions_AppId_StartTimestamp",
                table: "AppSessions",
                newName: "IX_AppSessions_ServiceId_StartTimestamp");

            migrationBuilder.RenameIndex(
                name: "IX_AppSessions_AppId",
                table: "AppSessions",
                newName: "IX_AppSessions_ServiceId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "ServiceId",
                table: "ProcessMetricsAggregated",
                newName: "AppId");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetricsAggregated_ServiceId_Timestamp_IntervalSeconds",
                table: "ProcessMetricsAggregated",
                newName: "IX_ProcessMetricsAggregated_AppId_Timestamp_IntervalSeconds");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetricsAggregated_ServiceId",
                table: "ProcessMetricsAggregated",
                newName: "IX_ProcessMetricsAggregated_AppId");

            migrationBuilder.RenameColumn(
                name: "ServiceId",
                table: "ProcessMetrics",
                newName: "AppId");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetrics_ServiceId_Timestamp",
                table: "ProcessMetrics",
                newName: "IX_ProcessMetrics_AppId_Timestamp");

            migrationBuilder.RenameIndex(
                name: "IX_ProcessMetrics_ServiceId",
                table: "ProcessMetrics",
                newName: "IX_ProcessMetrics_AppId");

            migrationBuilder.RenameColumn(
                name: "ServiceId",
                table: "LifecycleEvents",
                newName: "AppId");

            migrationBuilder.RenameIndex(
                name: "IX_LifecycleEvents_ServiceId_Timestamp",
                table: "LifecycleEvents",
                newName: "IX_LifecycleEvents_AppId_Timestamp");

            migrationBuilder.RenameIndex(
                name: "IX_LifecycleEvents_ServiceId",
                table: "LifecycleEvents",
                newName: "IX_LifecycleEvents_AppId");

            migrationBuilder.RenameColumn(
                name: "ServiceId",
                table: "AppSessions",
                newName: "AppId");

            migrationBuilder.RenameIndex(
                name: "IX_AppSessions_ServiceId_StartTimestamp",
                table: "AppSessions",
                newName: "IX_AppSessions_AppId_StartTimestamp");

            migrationBuilder.RenameIndex(
                name: "IX_AppSessions_ServiceId",
                table: "AppSessions",
                newName: "IX_AppSessions_AppId");
        }
    }
}
