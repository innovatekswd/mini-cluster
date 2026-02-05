/**
 * UI String Constants
 * 
 * Centralized location for all UI strings to enable:
 * 1. Easy i18n implementation in the future
 * 2. Consistent messaging across the app
 * 3. Single source of truth for user-facing text
 * 
 * Usage:
 * import { UI_STRINGS } from '~/lib/constants';
 * 
 * <h1>{UI_STRINGS.apps.title}</h1>
 */

export const UI_STRINGS = {
  // App management
  apps: {
    title: "Applications",
    subtitle: "Manage and organize your services into logical groups",
    noApps: "No Apps Yet",
    noAppsDescription: "Create your first app to organize your services",
    createApp: "Create App",
    newApp: "New App",
    seedData: "Seed Data",
    seeding: "Seeding...",
    deleteConfirmTitle: "Delete App",
    deleteConfirmMessage: (name: string) =>
      `Are you sure you want to delete "${name}"? Its services will become unassigned.`,
  },

  // Services
  services: {
    title: "Services",
    noServicesTitle: "No services found",
    noServicesDescription: "The selected apps don't have any services yet",
    noAppsSelectedTitle: "No apps selected",
    noAppsSelectedDescription: "Select one or more apps to view their services",
    editService: "Edit Service",
    updateService: "Update Service",
    updating: "Updating...",
  },

  // Common actions
  actions: {
    create: "Create",
    edit: "Edit",
    delete: "Delete",
    save: "Save",
    cancel: "Cancel",
    confirm: "Confirm",
    retry: "Retry",
    close: "Close",
    clone: "Clone",
    start: "Start",
    stop: "Stop",
    restart: "Restart",
    refresh: "Refresh",
    goHome: "Go Home",
    tryAgain: "Try Again",
    leave: "Leave",
    stay: "Stay",
    continue: "Continue",
  },

  // Status messages
  status: {
    loading: "Loading...",
    saving: "Saving...",
    deleting: "Deleting...",
  },

  // Toast messages
  toast: {
    success: {
      created: (name: string) => `"${name}" created successfully`,
      updated: (name: string) => `"${name}" updated successfully`,
      deleted: (name: string) => `"${name}" deleted successfully`,
      cloned: (name: string) => `Cloned as "${name}"`,
      saved: "Changes saved successfully",
      seeded: "Sample data seeded successfully!",
    },
    error: {
      generic: "An error occurred. Please try again.",
      loadFailed: "Failed to load data",
      saveFailed: "Failed to save changes",
      deleteFailed: "Failed to delete",
      createFailed: "Failed to create",
      updateFailed: "Failed to update",
      networkError: "Network error. Please check your connection.",
    },
  },

  // Confirmation dialogs
  confirm: {
    unsavedChanges: {
      title: "Unsaved Changes",
      message: "You have unsaved changes. Are you sure you want to leave?",
    },
    delete: {
      title: "Delete Item",
      message: (name: string) =>
        `Are you sure you want to delete "${name}"? This action cannot be undone.`,
    },
    destructiveAction: {
      title: "Confirm Action",
      message: (action: string) =>
        `Are you sure you want to ${action}? This action cannot be undone.`,
    },
  },

  // Empty states
  emptyState: {
    noResults: "No results found",
    noResultsDescription: (query: string) => `No items matching "${query}"`,
    loadError: "Failed to load data",
    loadErrorDescription: "Something went wrong. Please try again.",
  },

  // Error messages
  errors: {
    somethingWentWrong: "Something went wrong",
    unexpectedError: "An unexpected error occurred. Please try again.",
    pageNotFound: "The requested page could not be found.",
    viewDetails: "View error details",
  },

  // Navigation
  nav: {
    apps: "Apps",
    dashboard: "Dashboard",
    services: "Services",
    infrastructure: "Infrastructure",
    variables: "Variables",
    files: "Files",
    explorer: "Explorer",
    settings: "Settings",
    terminal: "Terminal",
    monitor: "Monitor",
    proxy: "Proxy",
    logout: "Logout",
  },

  // Dashboard
  dashboard: {
    title: "Dashboard",
    overview: "Overview",
    logs: "Logs",
    config: "Configuration",
    files: "Files",
    metrics: "Metrics",
    environment: "Environment",
    noAppSelected: "No app selected",
    selectAppPrompt: "Select an app from the sidebar to view its details",
  },

  // Forms
  forms: {
    required: "Required",
    optional: "Optional",
    nameLabel: "Name",
    namePlaceholder: "Enter name",
    descriptionLabel: "Description",
    descriptionPlaceholder: "Brief description...",
  },

  // Time
  time: {
    justNow: "Just now",
    minutesAgo: (n: number) => `${n} minute${n === 1 ? "" : "s"} ago`,
    hoursAgo: (n: number) => `${n} hour${n === 1 ? "" : "s"} ago`,
    daysAgo: (n: number) => `${n} day${n === 1 ? "" : "s"} ago`,
  },
} as const;

/**
 * Query keys for React Query
 * Centralized to avoid typos and enable easy refactoring
 */
export const QUERY_KEYS = {
  apps: ["apps"] as const,
  appsWithStats: ["appsWithStats"] as const,
  services: ["services"] as const,
  machines: ["machines"] as const,
  environments: ["environments"] as const,
  files: ["files"] as const,
  health: ["health"] as const,
} as const;

/**
 * API endpoints
 * Centralized for consistency and easy updates
 */
export const API_ENDPOINTS = {
  apps: "/api/apps",
  services: "/api/services",
  machines: "/api/machines",
  environments: "/api/env",
  files: "/api/files",
  health: "/api/health",
  auth: {
    login: "/api/auth/login",
    logout: "/api/auth/logout",
    refresh: "/api/auth/refresh",
    register: "/api/auth/register",
  },
} as const;

/**
 * Storage keys for localStorage/sessionStorage
 */
export const STORAGE_KEYS = {
  authToken: "auth-token",
  refreshToken: "refresh-token",
  theme: "theme",
  sidebarPinned: "sidebar-pinned",
  editorContent: (appId: string, fileId: string) => `editor-content-${appId}-${fileId}`,
} as const;

/**
 * Default values
 */
export const DEFAULTS = {
  toastDuration: 5000,
  maxToasts: 5,
  staleTime: 2 * 60 * 1000, // 2 minutes
  refetchInterval: 10 * 1000, // 10 seconds
  pollInterval: 30 * 1000, // 30 seconds
} as const;
