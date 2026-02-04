# React Query Implementation with Enhanced Error Handling

## Overview

This document outlines the implementation of TanStack React Query and enhanced error handling in the Minicluster UI application. The goal is to provide a consistent pattern for data fetching, mutation handling, and user feedback with toast notifications.

## Core Components

### 1. Error Provider (`app/context/ErrorProvider.tsx`)

- Provides a global context for error handling
- Exposes `showError`, `showSuccess`, and `showInfo` methods
- Uses `react-hot-toast` for toast notifications
- Handles global React Query errors

### 2. Error-Handled Mutation (`app/hooks/useErrorHandledMutation.ts`)

- Custom hook for standardized mutation error handling
- Supports:
  - Automatic error toasts
  - Success messages
  - Loading indicators
  - Automatic query invalidation
  - Optimistic updates
  - Proper error rollback

### 3. Query Client Configuration (`app/lib/queryClient.ts`)

- Configured with sensible defaults
- Global error handling for uncaught query errors
- Caching strategy for better performance

## Query Patterns

### 1. Standard Query Pattern

```typescript
const { data, isLoading, error } = useQuery({
  queryKey: ["key", id],
  queryFn: () => fetchData(id),
  staleTime: 2 * 60 * 1000, // 2 minutes
});
```

### 2. Standard Mutation Pattern

```typescript
const mutation = useErrorHandledMutation(
  {
    mutationFn: (data) => updateData(data),
    onSuccess: (result) => {
      // Handle success
    },
  },
  {
    errorMessage: "Failed to update data",
    successMessage: "Data updated successfully",
    invalidateQueries: [["key", id]],
  }
);
```

### 3. Optimistic Updates Pattern

```typescript
const mutation = useErrorHandledMutation({
  mutationFn: (data) => updateData(data),
  onMutate: async (variables) => {
    // Cancel in-flight queries
    await queryClient.cancelQueries({ queryKey: ["key", id] });

    // Save old state
    const previousData = queryClient.getQueryData(["key", id]);

    // Update cache optimistically
    queryClient.setQueryData(["key", id], newOptimisticData);

    // Return context for rollback
    return { previousData };
  },
  onError: (error, variables, context) => {
    // Rollback on error
    if (context?.previousData) {
      queryClient.setQueryData(["key", id], context.previousData);
    }
  },
});
```

## Enhanced File Operations

The file operations have been enhanced with:

1. **Optimistic Updates**

   - Files are updated in the UI before server confirmation
   - Improves perceived performance for users

2. **Error Handling**

   - Automatic rollback of optimistic updates on failure
   - Consistent error messages via toasts

3. **Proper Cache Management**
   - Synchronized cache across file list and file detail views
   - Proper invalidation of related queries

## Best Practices

1. **Use Query Keys Consistently**

   - Create constants for query keys to ensure consistent cache management
   - Follow nesting patterns for related data

2. **Handle Loading States**

   - Always handle loading states in UI components
   - Use skeleton loaders for better UX

3. **Error Handling**

   - Always handle errors with user-friendly messages
   - Log errors to console for debugging

4. **Optimistic Updates**

   - Use for frequent user interactions
   - Always implement rollback on failure

5. **Toast Notifications**
   - Use success toasts for operation confirmation
   - Error toasts should be actionable when possible

## Future Enhancements

1. **Offline Support**

   - Implement optimistic updates with persistence
   - Queue operations for offline usage

2. **Retry Strategies**

   - Custom retry logic for different operation types

3. **Prefetching**
   - Implement prefetching for anticipated user actions
   - Use hover intent for data prefetching
