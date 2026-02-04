using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSettingsAndProcessMetrics : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    MaxMessagesToKeepInUi = table.Column<int>(type: "INTEGER", nullable: false),
                    EnableLogSearch = table.Column<bool>(type: "INTEGER", nullable: false),
                    MetricsCollectionIntervalSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    MetricsRetentionHours = table.Column<int>(type: "INTEGER", nullable: false),
                    MetricsAggregationIntervalSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppSettings", x => x.Id);
                });

            migrationBuilder.InsertData(
                table: "AppSettings",
                columns: new[] { "Id", "EnableLogSearch", "MaxMessagesToKeepInUi", "MetricsAggregationIntervalSeconds", "MetricsCollectionIntervalSeconds", "MetricsRetentionHours", "ModifiedAt" },
                values: new object[] { 1, true, 1000, 60, 5, 24, new DateTime(2026, 1, 5, 5, 21, 19, 694, DateTimeKind.Utc).AddTicks(9707) });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AppSettings");
        }
    }
}
