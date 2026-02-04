using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddProxyRouteApiKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ApiKey",
                table: "ProxyRoutes",
                type: "TEXT",
                nullable: true);

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

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ApiKey",
                table: "ProxyRoutes");

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 1, 10, 18, 55, 19, 719, DateTimeKind.Utc).AddTicks(8407));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 1, 10, 18, 55, 19, 735, DateTimeKind.Utc).AddTicks(1720));
        }
    }
}
