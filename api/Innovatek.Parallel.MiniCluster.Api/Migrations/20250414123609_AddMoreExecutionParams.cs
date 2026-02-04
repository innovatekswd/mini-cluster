using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMoreExecutionParams : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "CreateNoWindow",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<bool>(
                name: "UseShellExecute",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: false);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "CreateNoWindow",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "UseShellExecute",
                table: "ControlledApps");
        }
    }
}
