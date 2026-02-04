using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class RemoveLoggingTablesFromControlDb : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LifecycleEvents");

            migrationBuilder.DropTable(
                name: "SessionLogs");

            migrationBuilder.DropTable(
                name: "AppSessions");

            migrationBuilder.CreateIndex(
                name: "IX_VariableGroups_Name",
                table: "VariableGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_AutoStart",
                table: "ControlledApps",
                column: "AutoStart");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_Name",
                table: "ControlledApps",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_VariableGroups_Name",
                table: "VariableGroups");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_AutoStart",
                table: "ControlledApps");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_Name",
                table: "ControlledApps");

            migrationBuilder.CreateTable(
                name: "AppSessions",
                columns: table => new
                {
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AutoStart = table.Column<bool>(type: "INTEGER", nullable: false),
                    CommandLineArguments = table.Column<string>(type: "TEXT", nullable: true),
                    EndTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    EnvironmentSnapshot = table.Column<string>(type: "TEXT", nullable: true),
                    ExitCode = table.Column<int>(type: "INTEGER", nullable: true),
                    ExitReason = table.Column<string>(type: "TEXT", nullable: true),
                    StartTimestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    WorkingDirectory = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppSessions", x => x.SessionId);
                });

            migrationBuilder.CreateTable(
                name: "LifecycleEvents",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    EventType = table.Column<int>(type: "INTEGER", nullable: false),
                    ExitCode = table.Column<int>(type: "INTEGER", nullable: true),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TriggeredBy = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_LifecycleEvents", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "SessionLogs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Line = table.Column<string>(type: "TEXT", nullable: false),
                    LogType = table.Column<string>(type: "TEXT", nullable: false),
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SessionLogs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SessionLogs_AppSessions_SessionId",
                        column: x => x.SessionId,
                        principalTable: "AppSessions",
                        principalColumn: "SessionId",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_SessionLogs_SessionId",
                table: "SessionLogs",
                column: "SessionId");
        }
    }
}
