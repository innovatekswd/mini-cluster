using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddMachineClusterFields : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Environments",
                type: "TEXT",
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<Guid>(
                name: "MachineId",
                table: "ControlledApps",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Machines",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Host = table.Column<string>(type: "TEXT", maxLength: 255, nullable: true),
                    Port = table.Column<int>(type: "INTEGER", nullable: false),
                    ConnectionType = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    SshUsername = table.Column<string>(type: "TEXT", nullable: true),
                    SshKeyPath = table.Column<string>(type: "TEXT", nullable: true),
                    SshPassword = table.Column<string>(type: "TEXT", nullable: true),
                    Status = table.Column<string>(type: "TEXT", maxLength: 20, nullable: false),
                    LastSeen = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Metadata = table.Column<string>(type: "TEXT", nullable: true),
                    OrderIndex = table.Column<int>(type: "INTEGER", nullable: false),
                    IsLocal = table.Column<bool>(type: "INTEGER", nullable: false),
                    AgentEndpoint = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    AgentApiKey = table.Column<string>(type: "TEXT", nullable: true),
                    AgentVersion = table.Column<string>(type: "TEXT", maxLength: 50, nullable: true),
                    Labels = table.Column<string>(type: "TEXT", nullable: true),
                    CpuCores = table.Column<int>(type: "INTEGER", nullable: true),
                    TotalMemoryBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    TotalDiskBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Machines", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 2, 6, 20, 24, 21, 553, DateTimeKind.Utc).AddTicks(1814));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 2, 6, 20, 24, 21, 562, DateTimeKind.Utc).AddTicks(1253));

            migrationBuilder.CreateIndex(
                name: "IX_Environments_Slug",
                table: "Environments",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_MachineId",
                table: "ControlledApps",
                column: "MachineId");

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

            migrationBuilder.AddForeignKey(
                name: "FK_ControlledApps_Machines_MachineId",
                table: "ControlledApps",
                column: "MachineId",
                principalTable: "Machines",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_ControlledApps_Machines_MachineId",
                table: "ControlledApps");

            migrationBuilder.DropTable(
                name: "Machines");

            migrationBuilder.DropIndex(
                name: "IX_Environments_Slug",
                table: "Environments");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_MachineId",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Environments");

            migrationBuilder.DropColumn(
                name: "MachineId",
                table: "ControlledApps");

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 2, 5, 17, 36, 49, 623, DateTimeKind.Utc).AddTicks(4831));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 2, 5, 17, 36, 49, 631, DateTimeKind.Utc).AddTicks(4890));
        }
    }
}
