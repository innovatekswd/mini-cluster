using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddSlugToAppsAndServices : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "VariableGroups");

            migrationBuilder.DropIndex(
                name: "IX_Apps_Name",
                table: "Apps");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "Operator",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 50,
                oldDefaultValue: "User");

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "ControlledApps",
                type: "TEXT",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "Slug",
                table: "Apps",
                type: "TEXT",
                maxLength: 200,
                nullable: false,
                defaultValue: "");

            // Generate slugs for existing Apps (lowercase name with spaces replaced by hyphens)
            // suppressTransaction: true is required because this Sql() follows an AlterColumn that
            // triggers a SQLite table rebuild (PRAGMA foreign_keys), which cannot run in a transaction.
            migrationBuilder.Sql(@"
                UPDATE Apps 
                SET Slug = LOWER(REPLACE(REPLACE(REPLACE(TRIM(Name), ' ', '-'), '\t', '-'), '_', '-'))
                WHERE Slug = '' OR Slug IS NULL;
            ", suppressTransaction: true);

            // Generate slugs for existing Services (lowercase name with spaces replaced by hyphens)
            migrationBuilder.Sql(@"
                UPDATE ControlledApps 
                SET Slug = LOWER(REPLACE(REPLACE(REPLACE(TRIM(Name), ' ', '-'), '\t', '-'), '_', '-'))
                WHERE Slug = '' OR Slug IS NULL;
            ", suppressTransaction: true);

            migrationBuilder.CreateTable(
                name: "Environments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    Variables = table.Column<string>(type: "TEXT", nullable: false),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Environments", x => x.Id);
                });

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

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_AppId_Name",
                table: "ControlledApps",
                columns: new[] { "AppId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ControlledApps_AppId_Slug",
                table: "ControlledApps",
                columns: new[] { "AppId", "Slug" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Apps_Name",
                table: "Apps",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Apps_Slug",
                table: "Apps",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Environments_Name",
                table: "Environments",
                column: "Name");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Environments");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_AppId_Name",
                table: "ControlledApps");

            migrationBuilder.DropIndex(
                name: "IX_ControlledApps_AppId_Slug",
                table: "ControlledApps");

            migrationBuilder.DropIndex(
                name: "IX_Apps_Name",
                table: "Apps");

            migrationBuilder.DropIndex(
                name: "IX_Apps_Slug",
                table: "Apps");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "Slug",
                table: "Apps");

            migrationBuilder.AlterColumn<string>(
                name: "Role",
                table: "Users",
                type: "TEXT",
                maxLength: 50,
                nullable: false,
                defaultValue: "User",
                oldClrType: typeof(string),
                oldType: "TEXT",
                oldMaxLength: 50,
                oldDefaultValue: "Operator");

            migrationBuilder.CreateTable(
                name: "VariableGroups",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Description = table.Column<string>(type: "TEXT", nullable: true),
                    IsActive = table.Column<bool>(type: "INTEGER", nullable: false),
                    Name = table.Column<string>(type: "TEXT", nullable: false),
                    Variables = table.Column<string>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_VariableGroups", x => x.Id);
                });

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 2, 1, 9, 0, 16, 288, DateTimeKind.Utc).AddTicks(6333));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 2, 1, 9, 0, 16, 294, DateTimeKind.Utc).AddTicks(8972));

            migrationBuilder.CreateIndex(
                name: "IX_Apps_Name",
                table: "Apps",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_VariableGroups_Name",
                table: "VariableGroups",
                column: "Name");
        }
    }
}
