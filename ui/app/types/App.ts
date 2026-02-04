// App types for Simple App Tabs feature
// Phase 1: Flat apps containing services (no hierarchy yet)

export interface App {
  id: string;
  name: string;
  description?: string;
  icon?: string; // Emoji or icon name
  color?: string; // Hex color for visual identity
  createdAt: string;
  modifiedAt: string;
  sortOrder: number;
}

export interface AppWithStats extends App {
  serviceCount: number;
  runningCount: number;
  stoppedCount: number;
}

export interface CreateAppDto {
  name: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface UpdateAppDto {
  name?: string;
  description?: string;
  icon?: string;
  color?: string;
}

export interface BulkOperationResult {
  total: number;
  succeeded: number;
  failed: number;
  errors: string[];
}
