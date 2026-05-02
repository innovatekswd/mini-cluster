using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddAlertingTables : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AlertRules",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: true),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: true),
                    Metric = table.Column<int>(type: "INTEGER", nullable: false),
                    Operator = table.Column<int>(type: "INTEGER", nullable: false),
                    Threshold = table.Column<double>(type: "REAL", nullable: false),
                    DurationSeconds = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    CooldownMinutes = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 5),
                    Severity = table.Column<int>(type: "INTEGER", nullable: false),
                    NotifyChannels = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false, defaultValue: "all"),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LastTriggeredAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    TriggerCount = table.Column<int>(type: "INTEGER", nullable: false, defaultValue: 0)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertRules", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "NotificationChannels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false, defaultValue: true),
                    WebhookUrl = table.Column<string>(type: "TEXT", nullable: true),
                    WebhookHeaders = table.Column<string>(type: "TEXT", nullable: true),
                    WebhookTemplate = table.Column<string>(type: "TEXT", nullable: true),
                    EmailTo = table.Column<string>(type: "TEXT", nullable: true),
                    EmailSubjectTemplate = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NotificationChannels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AlertEvents",
                columns: table => new
                {
                    Id = table.Column<long>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AlertRuleId = table.Column<int>(type: "INTEGER", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EventType = table.Column<int>(type: "INTEGER", nullable: false),
                    Value = table.Column<double>(type: "REAL", nullable: false),
                    Threshold = table.Column<double>(type: "REAL", nullable: false),
                    Message = table.Column<string>(type: "TEXT", nullable: true),
                    NotificationResults = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AlertEvents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AlertEvents_AlertRules_AlertRuleId",
                        column: x => x.AlertRuleId,
                        principalTable: "AlertRules",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_AlertRules_IsEnabled",
                table: "AlertRules",
                column: "IsEnabled");

            migrationBuilder.CreateIndex(
                name: "IX_AlertEvents_AlertRuleId",
                table: "AlertEvents",
                column: "AlertRuleId");

            migrationBuilder.CreateIndex(
                name: "IX_AlertEvents_Timestamp",
                table: "AlertEvents",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_NotificationChannels_IsEnabled",
                table: "NotificationChannels",
                column: "IsEnabled");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "AlertEvents");
            migrationBuilder.DropTable(name: "AlertRules");
            migrationBuilder.DropTable(name: "NotificationChannels");
        }
    }
}
