using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddAppsTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AppGroupAssignments_ControlledApps_AppId",
                table: "AppGroupAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_ControlledApps_ControlledApps_ParentAppId",
                table: "ControlledApps");

            migrationBuilder.DropTable(
                name: "Services");

            migrationBuilder.DropTable(
                name: "Machines");

            migrationBuilder.DropIndex(
                name: "IX_GroupVariables_GroupId",
                table: "GroupVariables");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_IsComposite",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "IsComposite",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "StartMode",
                table: "ControlledApps");

            migrationBuilder.RenameColumn(
                name: "ParentAppId",
                table: "ControlledApps",
                newName: "AppId");

            migrationBuilder.RenameIndex(
                name: "IX_ControlledApps_ParentAppId",
                table: "ControlledApps",
                newName: "IX_ControlledApps_AppId");

            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "AppGroupAssignments",
                newName: "ServiceId");

            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "AppFiles",
                newName: "ServiceId");

            migrationBuilder.CreateTable(
                name: "Apps",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    Icon = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    Color = table.Column<string>(type: "TEXT", maxLength: 20, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    SortOrder = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Apps", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 1, 31, 12, 36, 18, 848, DateTimeKind.Utc).AddTicks(5079));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 1, 31, 12, 36, 18, 856, DateTimeKind.Utc).AddTicks(6577));

            migrationBuilder.CreateIndex(
                name: "IX_AppFiles_ServiceId",
                table: "AppFiles",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_Apps_Name",
                table: "Apps",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Apps_SortOrder",
                table: "Apps",
                column: "SortOrder");

            migrationBuilder.AddForeignKey(
                name: "FK_AppGroupAssignments_ControlledApps_ServiceId",
                table: "AppGroupAssignments",
                column: "ServiceId",
                principalTable: "ControlledApps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledApps_Apps_AppId",
                table: "ControlledApps",
                column: "AppId",
                principalTable: "Apps",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_AppGroupAssignments_ControlledApps_ServiceId",
                table: "AppGroupAssignments");

            migrationBuilder.DropForeignKey(
                name: "FK_ControlledApps_Apps_AppId",
                table: "ControlledApps");

            migrationBuilder.DropTable(
                name: "Apps");

            migrationBuilder.DropIndex(
                name: "IX_AppFiles_ServiceId",
                table: "AppFiles");

            migrationBuilder.RenameColumn(
                name: "AppId",
                table: "ControlledApps",
                newName: "ParentAppId");

            migrationBuilder.RenameIndex(
                name: "IX_ControlledApps_AppId",
                table: "ControlledApps",
                newName: "IX_ControlledApps_ParentAppId");

            migrationBuilder.RenameColumn(
                name: "ServiceId",
                table: "AppGroupAssignments",
                newName: "AppId");

            migrationBuilder.RenameColumn(
                name: "ServiceId",
                table: "AppFiles",
                newName: "AppId");

            migrationBuilder.AddColumn<bool>(
                name: "IsComposite",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "StartMode",
                table: "ControlledApps",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "Machines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    ConnectionType = table.Column<string>(type: "TEXT", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Host = table.Column<string>(type: "TEXT", nullable: true),
                    IsLocal = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastSeen = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Metadata = table.Column<string>(type: "TEXT", nullable: true),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    Port = table.Column<int>(type: "INTEGER", nullable: false),
                    SshKeyPath = table.Column<string>(type: "TEXT", nullable: true),
                    SshPassword = table.Column<string>(type: "TEXT", nullable: true),
                    SshUsername = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Machines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Services",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MachineId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AccessLink = table.Column<string>(type: "TEXT", nullable: true),
                    Arguments = table.Column<string>(type: "TEXT", nullable: true),
                    AutoStart = table.Column<bool>(type: "INTEGER", nullable: false),
                    CaptureOutput = table.Column<int>(type: "INTEGER", nullable: false),
                    ContainerId = table.Column<string>(type: "TEXT", nullable: true),
                    ContainerName = table.Column<string>(type: "TEXT", nullable: true),
                    CreateNoWindow = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    DockerOptions = table.Column<string>(type: "TEXT", nullable: true),
                    EnvironmentVariables = table.Column<string>(type: "TEXT", nullable: false),
                    ExecutablePath = table.Column<string>(type: "TEXT", nullable: true),
                    Image = table.Column<string>(type: "TEXT", nullable: true),
                    InheritEnvFromApp = table.Column<bool>(type: "INTEGER", nullable: false),
                    IsExternal = table.Column<bool>(type: "INTEGER", nullable: false),
                    MaxRestartAttempts = table.Column<int>(type: "INTEGER", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Network = table.Column<string>(type: "TEXT", nullable: true),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    Ports = table.Column<string>(type: "TEXT", nullable: true),
                    ProcessId = table.Column<int>(type: "INTEGER", nullable: true),
                    RestartOnFailure = table.Column<bool>(type: "INTEGER", nullable: false),
                    StartOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    UseShellExecute = table.Column<bool>(type: "INTEGER", nullable: false),
                    Volumes = table.Column<string>(type: "TEXT", nullable: true),
                    WorkingDirectory = table.Column<string>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Services", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Services_ControlledApps_AppId",
                        column: x => x.AppId,
                        principalTable: "ControlledApps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Services_Machines_MachineId",
                        column: x => x.MachineId,
                        principalTable: "Machines",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 1, 30, 7, 23, 19, 16, DateTimeKind.Utc).AddTicks(7842));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 1, 30, 7, 23, 19, 29, DateTimeKind.Utc).AddTicks(2068));

            migrationBuilder.CreateIndex(
                name: "IX_GroupVariables_GroupId",
                table: "GroupVariables",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_IsComposite",
                table: "ControlledApps",
                column: "IsComposite");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_Host",
                table: "Machines",
                column: "Host");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_IsLocal",
                table: "Machines",
                column: "IsLocal");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_Name",
                table: "Machines",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Machines_Status",
                table: "Machines",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Services_AppId",
                table: "Services",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_Services_MachineId",
                table: "Services",
                column: "MachineId");

            migrationBuilder.CreateIndex(
                name: "IX_Services_Name",
                table: "Services",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_Services_Status",
                table: "Services",
                column: "Status");

            migrationBuilder.CreateIndex(
                name: "IX_Services_Type",
                table: "Services",
                column: "Type");

            migrationBuilder.AddForeignKey(
                name: "FK_AppGroupAssignments_ControlledApps_AppId",
                table: "AppGroupAssignments",
                column: "AppId",
                principalTable: "ControlledApps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledApps_ControlledApps_ParentAppId",
                table: "ControlledApps",
                column: "ParentAppId",
                principalTable: "ControlledApps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
