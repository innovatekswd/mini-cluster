import { useError } from "../context/ErrorProvider";
import {
  useMutation,
  useQueryClient,
  type UseMutationOptions,
  type UseMutationResult,
  type QueryClient,
} from "@tanstack/react-query";

interface ErrorHandledMutationOptions<TData, TError, TVariables, TContext> {
  errorMessage?: string;
  successMessage?: string;
  showSuccessToast?: boolean;
  invalidateQueries?: string[][];
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
}

/**
 * Enhanced mutation hook with standardized error and success handling
 *
 * @param options Base mutation options
 * @param handlerOptions Additional options for error/success handling
 * @returns A mutation result with error handling
 */
export function useErrorHandledMutation<
  TData = unknown,
  TError = unknown,
  TVariables = void,
  TContext = unknown
>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
  handlerOptions: ErrorHandledMutationOptions<
    TData,
    TError,
    TVariables,
    TContext
  > = {}
): UseMutationResult<TData, TError, TVariables, TContext> {
  const { showError, showSuccess, showInfo } = useError();
  const queryClient = useQueryClient();

  const {
    errorMessage = "An error occurred",
    successMessage,
    showSuccessToast = !!successMessage,
    invalidateQueries = [],
  } = handlerOptions;
  const enrichedOptions: UseMutationOptions<
    TData,
    TError,
    TVariables,
    TContext
  > = {
    ...options,
    onMutate: async (variables) => {
      // Show loading info toast for long operations
      if (
        options.meta &&
        typeof options.meta === "object" &&
        "showLoadingToast" in options.meta &&
        options.meta.showLoadingToast
      ) {
        const loadingMessage =
          options.meta &&
          typeof options.meta === "object" &&
          "loadingMessage" in options.meta
            ? String(options.meta.loadingMessage)
            : "Processing...";
        showInfo(loadingMessage);
      }

      // Call original onMutate if provided
      if (options.onMutate) {
        return options.onMutate(variables);
      }

      // Call handler onMutate if provided
      if (handlerOptions.onMutate) {
        return handlerOptions.onMutate(variables);
      }

      return undefined as unknown as TContext;
    },
    onError: (error, variables, context) => {
      // Show toast with error
      showError(errorMessage, error);

      // Call original onError if provided
      if (options.onError) {
        options.onError(error, variables, context);
      }
    },
    onSuccess: (data, variables, context) => {
      // Show success toast if enabled
      if (showSuccessToast && successMessage) {
        showSuccess(successMessage);
      }

      // Invalidate queries if specified
      if (invalidateQueries.length > 0) {
        invalidateQueries.forEach((queryKey) => {
          queryClient.invalidateQueries({ queryKey });
        });
      }

      // Call original onSuccess if provided
      if (options.onSuccess) {
        options.onSuccess(data, variables, context);
      }
    },
  };

  return useMutation(enrichedOptions);
}

// Function to handle global query errors in the query client
export function setupGlobalQueryErrorHandler(
  queryClient: QueryClient,
  errorHandler: (error: any) => void
) {
  queryClient.getQueryCache().subscribe((event) => {
    if (
      event.type === "updated" &&
      event.query.state.status === "error" &&
      event.query.state.error
    ) {
      errorHandler(event.query.state.error);
    }
  });
}
