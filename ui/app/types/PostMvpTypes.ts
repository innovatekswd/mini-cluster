// ═══════════════════════════════════════════════════════════════
// Post-MVP Types for Cron, Containers, Versioning, Hierarchy
// ═══════════════════════════════════════════════════════════════

// ── Cron Scheduling ────────────────────────────────────────────

export enum CronTarget {
  App = 0,
  Service = 1,
  Group = 2,
  Script = 3,
}

export enum CronAction {
  Start = 0,
  Stop = 1,
  Restart = 2,
  Execute = 3,
}

export enum CronMissedPolicy {
  RunOnce = 0,
  RunAll = 1,
  Skip = 2,
}

export enum CronRunStatus {
  Pending = 0,
  Running = 1,
  Success = 2,
  Failed = 3,
  Skipped = 4,
  TimedOut = 5,
}

export interface CronJob {
  id: string;
  name: string;
  description?: string;
  targetType: CronTarget;
  targetName?: string;
  appId?: string;
  serviceId?: string;
  groupId?: string;
  scriptPath?: string;
  cronExpression: string;
  timezone?: string;
  action: CronAction;
  waitForCompletion: boolean;
  timeoutSeconds: number;
  missedPolicy: CronMissedPolicy;
  isEnabled: boolean;
  lastRun?: string;
  nextRun?: string;
  lastRunStatus: CronRunStatus;
  lastRunError?: string;
  totalRuns: number;
  failedRuns: number;
  dependsOnJobId?: string;
  dependsOnJobName?: string;
}

export interface CronJobRun {
  id: string;
  jobId: string;
  scheduledFor: string;
  startedAt: string;
  completedAt?: string;
  status: CronRunStatus;
  exitCode?: number;
  output?: string;
  error?: string;
  durationSeconds?: number;
}

export interface CreateCronJobDto {
  name: string;
  description?: string;
  targetType: CronTarget;
  appId?: string;
  serviceId?: string;
  groupId?: string;
  scriptPath?: string;
  cronExpression: string;
  timezone?: string;
  action?: CronAction;
  waitForCompletion?: boolean;
  timeoutSeconds?: number;
  missedPolicy?: CronMissedPolicy;
  dependsOnJobId?: string;
}

export interface UpdateCronJobDto {
  name?: string;
  description?: string;
  targetType?: CronTarget;
  appId?: string;
  serviceId?: string;
  groupId?: string;
  scriptPath?: string;
  cronExpression?: string;
  timezone?: string;
  action?: CronAction;
  waitForCompletion?: boolean;
  timeoutSeconds?: number;
  missedPolicy?: CronMissedPolicy;
  dependsOnJobId?: string;
}

// ── Container Config ───────────────────────────────────────────

export enum ContainerRestartPolicy {
  No = 0,
  Always = 1,
  OnFailure = 2,
  UnlessStopped = 3,
}

export interface PortMapping {
  host: number;
  container: number;
  protocol: string;
}

export interface VolumeMount {
  host: string;
  container: string;
  readOnly: boolean;
}

export interface ContainerConfig {
  id: number;
  serviceId: string;
  image: string;
  tag?: string;
  registry?: string;
  containerName?: string;
  hostname?: string;
  networkMode?: string;
  privileged: boolean;
  user?: string;
  memoryLimitBytes?: number;
  cpuLimit?: number;
  portMappings?: PortMapping[];
  volumeMounts?: VolumeMount[];
  labels?: Record<string, string>;
  restartPolicy: number;
  containerId?: string;
  imageId?: string;
}

export interface CreateContainerConfigDto {
  image: string;
  tag?: string;
  registry?: string;
  containerName?: string;
  hostname?: string;
  networkMode?: string;
  privileged?: boolean;
  user?: string;
  memoryLimitBytes?: number;
  cpuLimit?: number;
  portMappings?: PortMapping[];
  volumeMounts?: VolumeMount[];
  labels?: Record<string, string>;
  restartPolicy?: number;
}

// ── Service Versioning ─────────────────────────────────────────

export enum VersionSource {
  Manual = 0,
  AutoSave = 1,
  Git = 2,
  Deploy = 3,
}

export enum DeploymentStatus {
  Pending = 0,
  Deploying = 1,
  Active = 2,
  RolledBack = 3,
  Failed = 4,
  Superseded = 5,
}

export enum DeploymentStrategy {
  InPlace = 0,
  BlueGreen = 1,
  Rolling = 2,
}

export interface ServiceVersion {
  id: number;
  serviceId: string;
  version: string;
  sequenceNumber: number;
  label?: string;
  source: VersionSource;
  deploymentStatus: DeploymentStatus;
  createdAt: string;
  deployedAt?: string;
  gitCommit?: string;
  configDiff?: string;
  deploymentNotes?: string;
}

export interface DeploymentResult {
  success: boolean;
  message?: string;
  previousVersion?: string;
  newVersion?: string;
}

export interface DeploymentConfig {
  id: number;
  serviceId: string;
  strategy: number;
  autoRollbackOnFailure: boolean;
  rollbackTimeoutSeconds: number;
  waitForHealthy: boolean;
  healthCheckTimeoutSeconds: number;
  maxVersionsToKeep: number;
  autoVersionOnSave: boolean;
}

export interface UpdateDeploymentConfigDto {
  strategy?: number;
  autoRollbackOnFailure?: boolean;
  rollbackTimeoutSeconds?: number;
  waitForHealthy?: boolean;
  healthCheckTimeoutSeconds?: number;
  maxVersionsToKeep?: number;
  autoVersionOnSave?: boolean;
}

export interface CreateVersionDto {
  version?: string;
  label?: string;
  source?: VersionSource;
  gitCommit?: string;
  notes?: string;
}

export interface AppSnapshot {
  id: number;
  appId: string;
  version: string;
  label?: string;
  createdAt: string;
  createdBy?: string;
  entries: AppSnapshotEntry[];
}

export interface AppSnapshotEntry {
  serviceId: string;
  serviceName: string;
  serviceVersionId: number;
  serviceVersion: string;
}

export interface CreateAppSnapshotDto {
  version?: string;
  label?: string;
}

// ── App Hierarchy / Tree ───────────────────────────────────────

export interface AppTreeNode {
  id: string;
  name: string;
  slug: string;
  icon?: string;
  color?: string;
  parentAppId?: string;
  sortOrder: number;
  totalServices: number;
  runningServices: number;
  stoppedServices: number;
  errorServices: number;
  services: AppTreeServiceSummary[];
  children: AppTreeNode[];
}

export interface AppTreeServiceSummary {
  id: string;
  name: string;
  status: string;
}

export interface MoveAppDto {
  newParentAppId?: string | null;
}

export interface ReorderChildrenDto {
  orderedChildIds: string[];
}
