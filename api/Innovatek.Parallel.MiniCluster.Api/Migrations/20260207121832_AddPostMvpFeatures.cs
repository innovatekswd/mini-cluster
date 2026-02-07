using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Innovatek.Parallel.MiniCluster.Api.Migrations.AppDb
{
    /// <inheritdoc />
    public partial class AddPostMvpFeatures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "ServiceType",
                table: "ControlledApps",
                type: "INTEGER",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<Guid>(
                name: "ParentAppId",
                table: "Apps",
                type: "TEXT",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "AppSnapshots",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Version = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Label = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CreatedBy = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppSnapshots", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppSnapshots_Apps_AppId",
                        column: x => x.AppId,
                        principalTable: "Apps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ContainerConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Image = table.Column<string>(type: "TEXT", maxLength: 500, nullable: false),
                    Tag = table.Column<string>(type: "TEXT", maxLength: 200, nullable: true, defaultValue: "latest"),
                    Registry = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ContainerName = table.Column<string>(type: "TEXT", nullable: true),
                    Hostname = table.Column<string>(type: "TEXT", nullable: true),
                    NetworkMode = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    Privileged = table.Column<bool>(type: "INTEGER", nullable: false),
                    User = table.Column<string>(type: "TEXT", nullable: true),
                    MemoryLimitBytes = table.Column<long>(type: "INTEGER", nullable: true),
                    CpuLimit = table.Column<double>(type: "REAL", nullable: true),
                    PortMappings = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    VolumeMounts = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    Labels = table.Column<string>(type: "TEXT", maxLength: 4000, nullable: true),
                    RestartPolicy = table.Column<int>(type: "INTEGER", nullable: false),
                    ContainerId = table.Column<string>(type: "TEXT", nullable: true),
                    ImageId = table.Column<string>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContainerConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ContainerConfigs_ControlledApps_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "ControlledApps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CronJobs",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    Name = table.Column<string>(type: "TEXT", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "TEXT", maxLength: 1000, nullable: true),
                    TargetType = table.Column<int>(type: "INTEGER", nullable: false),
                    AppId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: true),
                    GroupId = table.Column<Guid>(type: "TEXT", nullable: true),
                    ScriptPath = table.Column<string>(type: "TEXT", nullable: true),
                    CronExpression = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    Timezone = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true, defaultValue: "UTC"),
                    Action = table.Column<int>(type: "INTEGER", nullable: false),
                    WaitForCompletion = table.Column<bool>(type: "INTEGER", nullable: false),
                    TimeoutSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    MissedPolicy = table.Column<int>(type: "INTEGER", nullable: false),
                    DependsOnJobId = table.Column<Guid>(type: "TEXT", nullable: true),
                    IsEnabled = table.Column<bool>(type: "INTEGER", nullable: false),
                    LastRun = table.Column<DateTime>(type: "TEXT", nullable: true),
                    NextRun = table.Column<DateTime>(type: "TEXT", nullable: true),
                    LastRunStatus = table.Column<int>(type: "INTEGER", nullable: false),
                    LastRunError = table.Column<string>(type: "TEXT", nullable: true),
                    TotalRuns = table.Column<int>(type: "INTEGER", nullable: false),
                    FailedRuns = table.Column<int>(type: "INTEGER", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    ModifiedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CronJobs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CronJobs_AppGroups_GroupId",
                        column: x => x.GroupId,
                        principalTable: "AppGroups",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CronJobs_Apps_AppId",
                        column: x => x.AppId,
                        principalTable: "Apps",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CronJobs_ControlledApps_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "ControlledApps",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CronJobs_CronJobs_DependsOnJobId",
                        column: x => x.DependsOnJobId,
                        principalTable: "CronJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                });

            migrationBuilder.CreateTable(
                name: "DeploymentConfigs",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Strategy = table.Column<int>(type: "INTEGER", nullable: false),
                    AutoRollbackOnFailure = table.Column<bool>(type: "INTEGER", nullable: false),
                    RollbackTimeoutSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    WaitForHealthy = table.Column<bool>(type: "INTEGER", nullable: false),
                    HealthCheckTimeoutSeconds = table.Column<int>(type: "INTEGER", nullable: false),
                    MaxVersionsToKeep = table.Column<int>(type: "INTEGER", nullable: false),
                    AutoVersionOnSave = table.Column<bool>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_DeploymentConfigs", x => x.Id);
                    table.ForeignKey(
                        name: "FK_DeploymentConfigs_ControlledApps_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "ControlledApps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "ServiceVersions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    Version = table.Column<string>(type: "TEXT", maxLength: 100, nullable: false),
                    SequenceNumber = table.Column<int>(type: "INTEGER", nullable: false),
                    Label = table.Column<string>(type: "TEXT", maxLength: 500, nullable: true),
                    ConfigSnapshot = table.Column<string>(type: "TEXT", nullable: false),
                    ConfigDiff = table.Column<string>(type: "TEXT", nullable: true),
                    Source = table.Column<int>(type: "INTEGER", nullable: false),
                    GitCommit = table.Column<string>(type: "TEXT", maxLength: 100, nullable: true),
                    GitBranch = table.Column<string>(type: "TEXT", nullable: true),
                    GitMessage = table.Column<string>(type: "TEXT", nullable: true),
                    DeploymentStatus = table.Column<int>(type: "INTEGER", nullable: false),
                    DeployedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    RolledBackAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    DeploymentNotes = table.Column<string>(type: "TEXT", maxLength: 2000, nullable: true),
                    DeployedBy = table.Column<Guid>(type: "TEXT", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ServiceVersions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_ServiceVersions_ControlledApps_ServiceId",
                        column: x => x.ServiceId,
                        principalTable: "ControlledApps",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "CronJobRuns",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "TEXT", nullable: false),
                    JobId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ScheduledFor = table.Column<DateTime>(type: "TEXT", nullable: false),
                    StartedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                    CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true),
                    Status = table.Column<int>(type: "INTEGER", nullable: false),
                    ExitCode = table.Column<int>(type: "INTEGER", nullable: true),
                    Output = table.Column<string>(type: "TEXT", nullable: true),
                    Error = table.Column<string>(type: "TEXT", nullable: true),
                    CronJobId = table.Column<Guid>(type: "TEXT", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_CronJobRuns", x => x.Id);
                    table.ForeignKey(
                        name: "FK_CronJobRuns_CronJobs_CronJobId",
                        column: x => x.CronJobId,
                        principalTable: "CronJobs",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_CronJobRuns_CronJobs_JobId",
                        column: x => x.JobId,
                        principalTable: "CronJobs",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "AppSnapshotEntries",
                columns: table => new
                {
                    Id = table.Column<int>(type: "INTEGER", nullable: false)
                        .Annotation("Sqlite:Autoincrement", true),
                    AppSnapshotId = table.Column<int>(type: "INTEGER", nullable: false),
                    ServiceId = table.Column<Guid>(type: "TEXT", nullable: false),
                    ServiceVersionId = table.Column<int>(type: "INTEGER", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AppSnapshotEntries", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AppSnapshotEntries_AppSnapshots_AppSnapshotId",
                        column: x => x.AppSnapshotId,
                        principalTable: "AppSnapshots",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_AppSnapshotEntries_ServiceVersions_ServiceVersionId",
                        column: x => x.ServiceVersionId,
                        principalTable: "ServiceVersions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.UpdateData(
                table: "AppSettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "ModifiedAt",
                value: new DateTime(2026, 2, 7, 12, 18, 29, 43, DateTimeKind.Utc).AddTicks(3343));

            migrationBuilder.UpdateData(
                table: "ProxySettings",
                keyColumn: "Id",
                keyValue: 1,
                column: "UpdatedAt",
                value: new DateTime(2026, 2, 7, 12, 18, 29, 50, DateTimeKind.Utc).AddTicks(9083));

            migrationBuilder.CreateIndex(
                name: "IX_Apps_ParentAppId",
                table: "Apps",
                column: "ParentAppId");

            migrationBuilder.CreateIndex(
                name: "IX_AppSnapshotEntries_AppSnapshotId",
                table: "AppSnapshotEntries",
                column: "AppSnapshotId");

            migrationBuilder.CreateIndex(
                name: "IX_AppSnapshotEntries_ServiceVersionId",
                table: "AppSnapshotEntries",
                column: "ServiceVersionId");

            migrationBuilder.CreateIndex(
                name: "IX_AppSnapshots_AppId",
                table: "AppSnapshots",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_ContainerConfigs_ServiceId",
                table: "ContainerConfigs",
                column: "ServiceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_CronJobRuns_CronJobId",
                table: "CronJobRuns",
                column: "CronJobId");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobRuns_JobId",
                table: "CronJobRuns",
                column: "JobId");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobRuns_StartedAt",
                table: "CronJobRuns",
                column: "StartedAt");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobs_AppId",
                table: "CronJobs",
                column: "AppId");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobs_DependsOnJobId",
                table: "CronJobs",
                column: "DependsOnJobId");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobs_GroupId",
                table: "CronJobs",
                column: "GroupId");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobs_IsEnabled",
                table: "CronJobs",
                column: "IsEnabled");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobs_Name",
                table: "CronJobs",
                column: "Name");

            migrationBuilder.CreateIndex(
                name: "IX_CronJobs_ServiceId",
                table: "CronJobs",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_DeploymentConfigs_ServiceId",
                table: "DeploymentConfigs",
                column: "ServiceId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ServiceVersions_ServiceId",
                table: "ServiceVersions",
                column: "ServiceId");

            migrationBuilder.CreateIndex(
                name: "IX_ServiceVersions_ServiceId_SequenceNumber",
                table: "ServiceVersions",
                columns: new[] { "ServiceId", "SequenceNumber" },
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_Apps_Apps_ParentAppId",
                table: "Apps",
                column: "ParentAppId",
                principalTable: "Apps",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Apps_Apps_ParentAppId",
                table: "Apps");

            migrationBuilder.DropTable(
                name: "AppSnapshotEntries");

            migrationBuilder.DropTable(
                name: "ContainerConfigs");

            migrationBuilder.DropTable(
                name: "CronJobRuns");

            migrationBuilder.DropTable(
                name: "DeploymentConfigs");

            migrationBuilder.DropTable(
                name: "AppSnapshots");

            migrationBuilder.DropTable(
                name: "ServiceVersions");

            migrationBuilder.DropTable(
                name: "CronJobs");

            migrationBuilder.DropIndex(
                name: "IX_Apps_ParentAppId",
                table: "Apps");

            migrationBuilder.DropColumn(
                name: "ServiceType",
                table: "ControlledApps");

            migrationBuilder.DropColumn(
                name: "ParentAppId",
                table: "Apps");

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
    }
}
