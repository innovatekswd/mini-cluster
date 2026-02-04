/**
 * Central export point for all custom hooks
 */

// Data fetching hooks (React Query)
export * from "./useAppsQueries";
export { 
  appQueryKeys,
  useAppStatusQuery,
  useAppArgsQuery,
  useAppEnvQuery,
  useAppControlMutation,
  useUpdateAppMutation,
  useDeleteAppMutation,
  useUpdateAppArgsMutation,
  useUpdateAppEnvMutation,
  useCreateAppMutation,
  useImportAppsMutation,
  useExportAppsMutation,
  type EnvVariables,
} from "./useServiceQueries";
export { useAppsQuery as useServicesQuery } from "./useServiceQueries";
export * from "./useMachinesQueries";
export * from "./useProxyQueries";

// Feature hooks
export * from "./useDashboardData";
export * from "./useKeyboardNavigation";
