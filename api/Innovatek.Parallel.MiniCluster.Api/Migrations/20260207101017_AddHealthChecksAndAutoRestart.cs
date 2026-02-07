using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddHealthChecksAndAutoRestart : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "HealthCheckFailureThreshold",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "HealthCheckGracePeriodSeconds",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 10);

            migrationBuilder.AddColumn<int>(
                name: "HealthCheckIntervalSeconds",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 30);

            migrationBuilder.AddColumn<string>(
                name: "HealthCheckTarget",
                table: "ControlledApps",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "HealthCheckTimeoutSeconds",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<int>(
                name: "HealthCheckType",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "MaxRestartDelaySeconds",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 300);

            migrationBuilder.AddColumn<int>(
                name: "MaxRestarts",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 5);

            migrationBuilder.AddColumn<int>(
                name: "RestartDelaySeconds",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 3);

            migrationBuilder.AddColumn<int>(
                name: "RestartPolicy",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<int>(
                name: "RestartWindowSeconds",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 300);

            migrationBuilder.AddColumn<bool>(
                name: "UseExponentialBackoff",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: true);

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 2, 7, 10, 10, 14, 253, DateTimeKind.Utc).AddTicks(1022));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 2, 7, 10, 10, 14, 260, DateTimeKind.Utc).AddTicks(7785));
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "HealthCheckFailureThreshold",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "HealthCheckGracePeriodSeconds",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "HealthCheckIntervalSeconds",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "HealthCheckTarget",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "HealthCheckTimeoutSeconds",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "HealthCheckType",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "MaxRestartDelaySeconds",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "MaxRestarts",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "RestartDelaySeconds",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "RestartPolicy",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "RestartWindowSeconds",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "UseExponentialBackoff",
                table: "ControlledApps");

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
        }
    }
}
