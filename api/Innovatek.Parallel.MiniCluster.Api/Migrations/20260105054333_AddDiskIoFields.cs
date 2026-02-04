using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddDiskIoFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<long>(
                name: "TotalDiskBytesRead",
                table: "ProcessMetricsAggregated",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "TotalDiskBytesWritten",
                table: "ProcessMetricsAggregated",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiskBytesRead",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiskBytesWritten",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiskReadOperations",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiskReadRate",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiskWriteOperations",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "DiskWriteRate",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<double>(
                name: "GpuUsagePercent",
                table: "ProcessMetrics",
                type: "REAL",
                nullable: false,
                defaultValue: 0.0);

            migrationBuilder.AddColumn<long>(
                name: "NetworkReceiveRate",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<long>(
                name: "NetworkSendRate",
                table: "ProcessMetrics",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0L);

            migrationBuilder.AddColumn<string>(
                name: "Priority",
                table: "ProcessMetrics",
                type: "TEXT",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "TotalDiskBytesRead",
                table: "ProcessMetricsAggregated");

            migrationBuilder.DropColumn(
                name: "TotalDiskBytesWritten",
                table: "ProcessMetricsAggregated");

            migrationBuilder.DropColumn(
                name: "DiskBytesRead",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "DiskBytesWritten",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "DiskReadOperations",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "DiskReadRate",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "DiskWriteOperations",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "DiskWriteRate",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "GpuUsagePercent",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "NetworkReceiveRate",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "NetworkSendRate",
                table: "ProcessMetrics");

            migrationBuilder.DropColumn(
                name: "Priority",
                table: "ProcessMetrics");
        }
    }
}
