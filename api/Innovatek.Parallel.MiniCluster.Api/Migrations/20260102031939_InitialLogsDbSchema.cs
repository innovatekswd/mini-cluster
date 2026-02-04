using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class InitialLogsDbSchema : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "AppSessions",
                columns: table => new
                {
                    SessionId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    StartTimestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    EndTimestamp = table.Column<DateTime>(type: "TEXT", nullable: true),
                    AutoStart = table.Column<bool>(type: "INTEGER", nullable: false),
                    ExitReason = table.Column<string>(type: "TEXT", nullable: true),
                    ExitCode = table.Column<int>(type: "INTEGER", nullable: true),
                    WorkingDirectory = table.Column<string>(type: "TEXT", nullable: true),
                    EnvironmentSnapshot = table.Column<string>(type: "TEXT", nullable: true),
                    CommandLineArguments = table.Column<string>(type: "TEXT", nullable: true)
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
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    TriggeredBy = table.Column<string>(type: "TEXT", nullable: true),
                    ExitCode = table.Column<int>(type: "INTEGER", nullable: true)
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
                    Timestamp = table.Column<DateTime>(type: "TEXT", nullable: false),
                    LogType = table.Column<string>(type: "TEXT", nullable: false),
                    Line = table.Column<string>(type: "TEXT", nullable: false)
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
                name: "IX_AppSessions_AppId",
                table: "AppSessions",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_AppSessions_AppId_StartTimestamp",
                table: "AppSessions",
                columns: new[] { "AppId", "StartTimestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_AppSessions_StartTimestamp",
                table: "AppSessions",
                column: "StartTimestamp");

            migrationBuilder.CreateIndex(
                name: "IX_LifecycleEvents_AppId",
                table: "LifecycleEvents",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_LifecycleEvents_AppId_Timestamp",
                table: "LifecycleEvents",
                columns: new[] { "AppId", "Timestamp" });

            migrationBuilder.CreateIndex(
                name: "IX_LifecycleEvents_Timestamp",
                table: "LifecycleEvents",
                column: "Timestamp");

            migrationBuilder.CreateIndex(
                name: "IX_SessionLogs_SessionId",
                table: "SessionLogs",
                column: "SessionId");

            migrationBuilder.CreateIndex(
                name: "IX_SessionLogs_Timestamp",
                table: "SessionLogs",
                column: "Timestamp");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "LifecycleEvents");

            migrationBuilder.DropTable(
                name: "SessionLogs");

            migrationBuilder.DropTable(
                name: "AppSessions");
        }
    }
}
