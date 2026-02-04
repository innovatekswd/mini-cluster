using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProxyRoutes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "ProxyRoutes",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Icon = table.Column<string>(type: "TEXT", nullable: true),
                    TargetUrl = table.Column<string>(type: "TEXT", nullable: false),
                    EnablePathPrefix = table.Column<bool>(type: "INTEGER", nullable: false),
                    PathPrefix = table.Column<string>(type: "TEXT", nullable: true),
                    RewriteUrls = table.Column<bool>(type: "INTEGER", nullable: false),
                    RewriteWebSocket = table.Column<bool>(type: "INTEGER", nullable: false),
                    EnableSubdomain = table.Column<bool>(type: "INTEGER", nullable: false),
                    Subdomain = table.Column<string>(type: "TEXT", nullable: true),
                    EnablePort = table.Column<bool>(type: "INTEGER", nullable: false),
                    ProxyPort = table.Column<int>(type: "INTEGER", nullable: true),
                    EnableIframe = table.Column<bool>(type: "INTEGER", nullable: false),
                    StripXFrameOptions = table.Column<bool>(type: "INTEGER", nullable: false),
                    RequireAuth = table.Column<bool>(type: "INTEGER", nullable: false),
                    AllowedRoles = table.Column<string>(type: "TEXT", nullable: true),
                    PreserveHostHeader = table.Column<bool>(type: "INTEGER", nullable: false),
                    TimeoutSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    CustomHeaders = table.Column<string>(type: "TEXT", nullable: true),
                    IsHealthy = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastHealthCheck = table.Column<DateTime>(type: "TEXT", nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProxyRoutes", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "ProxySettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    BaseDomainType = table.Column<string>(type: "TEXT", nullable: false),
                    CustomBaseDomain = table.Column<string>(type: "TEXT", nullable: true),
                    PortRangeStart = table.Column<int>(type: "INTEGER", nullable: false),
                    PortRangeEnd = table.Column<int>(type: "INTEGER", nullable: false),
                    DefaultRequireAuth = table.Column<bool>(type: "INTEGER", nullable: false),
                    ServerIp = table.Column<string>(type: "TEXT", nullable: true),
                    UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ProxySettings", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 1, 10, 18, 55, 19, 719, DateTimeKind.Utc).AddTicks(8407));

            migrationBuilder.InsertData(
                table: "ProxySettings",
                columns: new[] { "Id", "BaseDomainType", "CustomBaseDomain", "DefaultRequireAuth", "PortRangeEnd", "PortRangeStart", "ServerIp", "UpdatedAt" },
                values: new object[] { 1, "nip.io", null, true, 5099, 5001, null, new DateTime(2026, 1, 10, 18, 55, 19, 735, DateTimeKind.Utc).AddTicks(1720) });

            migrationBuilder.CreateIndex(
                name: "IX_ProxyRoutes_IsEnabled",
                table: "ProxyRoutes",
                column: "IsEnabled");

            migrationBuilder.CreateIndex(
                name: "IX_ProxyRoutes_PathPrefix",
                table: "ProxyRoutes",
                column: "PathPrefix",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProxyRoutes_ProxyPort",
                table: "ProxyRoutes",
                column: "ProxyPort",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ProxyRoutes_Subdomain",
                table: "ProxyRoutes",
                column: "Subdomain",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ProxyRoutes");

            migrationBuilder.DropTable(
                name: "ProxySettings");

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 1, 5, 5, 21, 19, 694, DateTimeKind.Utc).AddTicks(9707));
        }
    }
}
