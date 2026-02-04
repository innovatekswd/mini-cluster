import React, { Component, type ReactNode, type ErrorInfo } from "react";
import { FaExclamationTriangle, FaRedo, FaHome } from "react-icons/fa";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component to render when error occurs */
  fallback?: ReactNode;
  /** Callback when error is caught */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show retry button */
  showRetry?: boolean;
  /** Whether to show go home button */
  showHomeLink?: boolean;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Reusable error boundary component for catching and displaying errors.
 * Use at route level or around critical components.
 * 
 * @example
 * ```tsx
 * // In a route component
 * function MyRoute() {
 *   return (
 *     <RouteErrorBoundary>
 *       <MyComponent />
 *     </RouteErrorBoundary>
 *   );
 * }
 * ```
 */
export class RouteErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error("Error caught by RouteErrorBoundary:", error, errorInfo);
    }
    
    // Call optional error callback
    this.props.onError?.(error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    const { hasError, error, errorInfo } = this.state;
    const { children, fallback, showRetry = true, showHomeLink = true } = this.props;

    if (hasError) {
      // Use custom fallback if provided
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="rounded-full bg-red-500/10 p-4 mb-6">
            <FaExclamationTriangle className="text-red-400" size={48} />
          </div>
          
          <h2 className="text-2xl font-semibold text-white mb-2">
            Something went wrong
          </h2>
          
          <p className="text-gray-400 mb-6 max-w-md">
            {error?.message || "An unexpected error occurred. Please try again."}
          </p>

          {/* Error details in development */}
          {import.meta.env.DEV && errorInfo && (
            <details className="mb-6 w-full max-w-xl text-left">
              <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-400">
                View error details
              </summary>
              <pre className="mt-2 p-4 bg-slate-900 rounded-lg text-xs text-red-400 overflow-auto max-h-48">
                {error?.stack}
              </pre>
            </details>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {showRetry && (
              <button
                onClick={this.handleRetry}
                className="inline-flex items-center gap-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg transition-colors"
              >
                <FaRedo size={14} />
                Try Again
              </button>
            )}
            {showHomeLink && (
              <button
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
              >
                <FaHome size={14} />
                Go Home
              </button>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}

/**
 * Hook to programmatically trigger error boundary from functional components.
 * Useful when you want to handle async errors or imperative error states.
 */
export function useErrorBoundary() {
  const [error, setError] = React.useState<Error | null>(null);
  
  // If error is set, throw it to be caught by nearest error boundary
  if (error) {
    throw error;
  }
  
  return {
    showBoundary: (error: Error) => setError(error),
    resetBoundary: () => setError(null),
  };
}

/**
 * Wrapper for async operations that catches errors and shows them in the error boundary.
 */
export function withErrorBoundary<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  options?: Omit<ErrorBoundaryProps, "children">
): React.FC<P> {
  const WithErrorBoundary: React.FC<P> = (props) => (
    <RouteErrorBoundary {...options}>
      <WrappedComponent {...props} />
    </RouteErrorBoundary>
  );
  
  WithErrorBoundary.displayName = `WithErrorBoundary(${
    WrappedComponent.displayName || WrappedComponent.name || "Component"
  })`;
  
  return WithErrorBoundary;
}
