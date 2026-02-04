using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMachinesServicesAndGroups : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Description",
                table: "ControlledApps",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "IsComposite",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<int>(
                name: "OrderIndex",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentAppId",
                table: "ControlledApps",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "StartMode",
                table: "ControlledApps",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.CreateTable(
                name: "AppGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Icon = table.Column<string>(type: "TEXT", nullable: true),
                    Color = table.Column<string>(type: "TEXT", nullable: true),
                    ParentGroupId = table.Column<Guid>(type: "TEXT", nullable: true),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppGroups", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppGroups_AppGroups_ParentGroupId",
                        column: x => x.ParentGroupId,
                        principalTable: "AppGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "Machines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Host = table.Column<string>(type: "TEXT", nullable: true),
                    Port = table.Column<int>(type: "INTEGER", nullable: false),
                    ConnectionType = table.Column<string>(type: "TEXT", nullable: false),
                    SshUsername = table.Column<string>(type: "TEXT", nullable: true),
                    SshKeyPath = table.Column<string>(type: "TEXT", nullable: true),
                    SshPassword = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    LastSeen = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Metadata = table.Column<string>(type: "TEXT", nullable: true),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    IsLocal = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Machines", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "AppGroupAssignments",
                columns: table => new
                {
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: false),
                    AssignedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppGroupAssignments", x => new { x.AppId, x.GroupId });
                    table.ForeignKey(
                        name: "FK_AppGroupAssignments_AppGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "AppGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AppGroupAssignments_ControlledApps_AppId",
                        column: x => x.AppId,
                        principalTable: "ControlledApps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "GroupVariables",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Key = table.Column<string>(type: "TEXT", nullable: false),
                    Value = table.Column<string>(type: "TEXT", nullable: true),
                    IsSecret = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GroupVariables", x => x.Id);
                    table.ForeignKey(
                        name: "FK_GroupVariables_AppGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "AppGroups",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "Services",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    MachineId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Type = table.Column<int>(type: "INTEGER", nullable: false),
                    ExecutablePath = table.Column<string>(type: "TEXT", nullable: true),
                    Arguments = table.Column<string>(type: "TEXT", nullable: true),
                    WorkingDirectory = table.Column<string>(type: "TEXT", nullable: true),
                    UseShellExecute = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreateNoWindow = table.Column<bool>(type: "INTEGER", nullable: false),
                    CaptureOutput = table.Column<int>(type: "INTEGER", nullable: false),
                    Image = table.Column<string>(type: "TEXT", nullable: true),
                    ContainerName = table.Column<string>(type: "TEXT", nullable: true),
                    Ports = table.Column<string>(type: "TEXT", nullable: true),
                    Volumes = table.Column<string>(type: "TEXT", nullable: true),
                    Network = table.Column<string>(type: "TEXT", nullable: true),
                    DockerOptions = table.Column<string>(type: "TEXT", nullable: true),
                    EnvironmentVariables = table.Column<string>(type: "TEXT", nullable: false),
                    Status = table.Column<string>(type: "TEXT", nullable: false),
                    ProcessId = table.Column<int>(type: "INTEGER", nullable: true),
                    ContainerId = table.Column<string>(type: "TEXT", nullable: true),
                    AutoStart = table.Column<bool>(type: "INTEGER", nullable: false),
                    RestartOnFailure = table.Column<bool>(type: "INTEGER", nullable: false),
                    MaxRestartAttempts = table.Column<int>(type: "INTEGER", nullable: false),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    StartOrder = table.Column<int>(type: "INTEGER", nullable: false),
                    AccessLink = table.Column<string>(type: "TEXT", nullable: true),
                    IsExternal = table.Column<bool>(type: "INTEGER", nullable: false),
                    InheritEnvFromApp = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
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
                name: "IX_ControlledApps_IsComposite",
                table: "ControlledApps",
                column: "IsComposite");

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_ParentAppId",
                table: "ControlledApps",
                column: "ParentAppId");

            migrationBuilder.CreateIndex(
                name: "IX_AppGroupAssignments_GroupId",
                table: "AppGroupAssignments",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_AppGroups_Name",
                table: "AppGroups",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_AppGroups_ParentGroupId",
                table: "AppGroups",
                column: "ParentGroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupVariables_GroupId",
                table: "GroupVariables",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_GroupVariables_GroupId_Key",
                table: "GroupVariables",
                columns: new[] { "GroupId", "Key" },
                unique: true);

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
                name: "FK_ControlledApps_ControlledApps_ParentAppId",
                table: "ControlledApps",
                column: "ParentAppId",
                principalTable: "ControlledApps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ControlledApps_ControlledApps_ParentAppId",
                table: "ControlledApps");

            migrationBuilder.DropTable(
                name: "AppGroupAssignments");

            migrationBuilder.DropTable(
                name: "GroupVariables");

            migrationBuilder.DropTable(
                name: "Services");

            migrationBuilder.DropTable(
                name: "AppGroups");

            migrationBuilder.DropTable(
                name: "Machines");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_IsComposite",
                table: "ControlledApps");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_ParentAppId",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "Description",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "IsComposite",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "OrderIndex",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "ParentAppId",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "StartMode",
                table: "ControlledApps");

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 1, 10, 19, 2, 28, 139, DateTimeKind.Utc).AddTicks(3099));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 1, 10, 19, 2, 28, 155, DateTimeKind.Utc).AddTicks(5839));
        }
    }
}
