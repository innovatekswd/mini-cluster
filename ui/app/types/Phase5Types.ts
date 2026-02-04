// Phase 5: Machines, Services, and AppGroups types

export type ServiceType = "process" | "container" | "pod";

export interface Machine {
  id: string;
  name: string;
  host?: string;
  port: number;
  connectionType: "local" | "ssh" | "agent";
  sshUsername?: string;
  status: "online" | "offline" | "unknown";
  lastSeen?: string;
  metadata?: string;
  orderIndex: number;
  isLocal: boolean;
  createdAt: string;
  modifiedAt: string;
  // Computed
  serviceCount: number;
  runningServiceCount: number;
}

export interface MachineWithServices extends Machine {
  services: Service[];
}

export interface Service {
  id: string;
  appId: string;
  appName?: string;
  machineId: string;
  machineName?: string;
  name: string;
  type: ServiceType;
  
  // Process config
  executablePath?: string;
  arguments?: string;
  workingDirectory?: string;
  useShellExecute: boolean;
  createNoWindow: boolean;
  captureOutput: number;
  
  // Container config
  image?: string;
  containerName?: string;
  ports?: string;
  volumes?: string;
  network?: string;
  dockerOptions?: string;
  
  // Common
  environmentVariables: Record<string, string>;
  status: "running" | "stopped" | "starting" | "stopping" | "failed" | "unknown";
  processId?: number;
  containerId?: string;
  autoStart: boolean;
  restartOnFailure: boolean;
  maxRestartAttempts: number;
  orderIndex: number;
  startOrder: number;
  accessLink?: string;
  isExternal: boolean;
  inheritEnvFromApp: boolean;
  
  createdAt: string;
  modifiedAt: string;
}

export interface AppGroup {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string;
  orderIndex: number;
  createdAt: string;
  modifiedAt: string;
  // Computed
  appCount: number;
  childGroups?: AppGroup[];
}

export interface GroupVariable {
  id: string;
  groupId: string;
  key: string;
  value?: string;
  isSecret: boolean;
}

export interface AppTreeNode {
  id: string;
  name: string;
  description?: string;
  isComposite: boolean;
  status: "running" | "stopped" | "starting" | "stopping" | "failed";
  serviceCount: number;
  childCount: number;
  children: AppTreeNode[];
}

// Extended app type with Phase 5 fields
export interface AppWithHierarchy {
  id: string;
  name: string;
  executablePath: string;
  arguments?: string;
  workingDirectory?: string;
  environmentVariables: Record<string, string>;
  autoStart: boolean;
  accessLink?: string;
  isExternal: boolean;
  useShellExecute: boolean;
  createNoWindow: boolean;
  captureOutput: number;
  createdAt: string;
  modifiedAt: string;
  
  // Hierarchy fields
  parentAppId?: string;
  isComposite: boolean;
  orderIndex: number;
  description?: string;
  startMode: "sequential" | "parallel";
  
  // Computed
  serviceCount: number;
  runningServiceCount: number;
  childCount: number;
  childAppCount: number;
  groupNames: string[];
  groupIds: string[];
  machineCount: number;
  
  // Runtime
  status?: string;
}

// API DTOs
export interface CreateMachineDto {
  name: string;
  host?: string;
  port?: number;
  connectionType?: "local" | "ssh" | "agent";
  sshUsername?: string;
  sshKeyPath?: string;
  sshPassword?: string;
  orderIndex?: number;
}

export interface CreateServiceDto {
  appId: string;
  machineId: string;
  name: string;
  type?: ServiceType;
  executablePath?: string;
  arguments?: string;
  workingDirectory?: string;
  useShellExecute?: boolean;
  createNoWindow?: boolean;
  captureOutput?: number;
  image?: string;
  containerName?: string;
  ports?: string;
  volumes?: string;
  network?: string;
  dockerOptions?: string;
  environmentVariables?: Record<string, string>;
  autoStart?: boolean;
  restartOnFailure?: boolean;
  maxRestartAttempts?: number;
  orderIndex?: number;
  startOrder?: number;
  accessLink?: string;
  isExternal?: boolean;
  inheritEnvFromApp?: boolean;
}

export interface CreateAppGroupDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  parentGroupId?: string;
  orderIndex?: number;
}

export interface CreateGroupVariableDto {
  key: string;
  value?: string;
  isSecret?: boolean;
}

// Cascade operation results
export interface AppStartResult {
  totalStarted: number;
  totalFailed: number;
  results: AppStartResultItem[];
}

export interface AppStartResultItem {
  appId: string;
  appName?: string;
  success: boolean;
  error?: string;
}

export interface AppStopResult {
  totalStopped: number;
  totalFailed: number;
  results: AppStopResultItem[];
}

export interface AppStopResultItem {
  appId: string;
  appName?: string;
  success: boolean;
  error?: string;
}

// View mode for dashboard
export type ViewMode = "services" | "machines";
