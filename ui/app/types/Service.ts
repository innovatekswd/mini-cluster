export type ServiceType = "process" | "container" | "pod";

export type Service = {
  id: string; // Guid in .NET
  createdAt: string; // DateTime in .NET
  modifiedAt: string; // DateTime in .NET
  useShellExecute: boolean;
  createNoWindow: boolean;
  captureOutput?: number;  // 0=Auto (default), 1=Always capture, 2=Never capture

  arguments: string;
  workingDirectory: string;
  environmentVariables: Record<string, string>;
  name: string;
  executablePath: string;
  autoStart: boolean;
  status?: string;
  accessLink: string;
  isExternal: boolean;
  appId?: string; // Optional app ID for grouping
  
  // Phase 5 additions (optional for backward compatibility)
  machineId?: string;
  machineName?: string;
  appName?: string;
  type?: ServiceType;
  
  // Container config (optional)
  image?: string;
  containerName?: string;
  ports?: string;
  volumes?: string;
  network?: string;
  dockerOptions?: string;
  
  // Advanced options (optional)
  processId?: number;
  containerId?: string;
  restartOnFailure?: boolean;
  maxRestartAttempts?: number;
  orderIndex?: number;
  startOrder?: number;
  inheritEnvFromApp?: boolean;
};

export type ServiceFormData = {
  name: string;
  executablePath: string;
  arguments?: string;
  workingDirectory?: string;
  environmentVariables?: Record<string, string>;
  accessLink?: string;   // URL for accessing the service
  isExternal?: boolean;  // Flag to indicate the service runs externally
  useShellExecute: boolean;
  createNoWindow: boolean;
  autoStart?: boolean;   // Flag to indicate if service should auto-start
  captureOutput?: number;  // 0=Auto (default), 1=Always capture, 2=Never capture
  appId?: string;        // App ID to assign the service to
};
