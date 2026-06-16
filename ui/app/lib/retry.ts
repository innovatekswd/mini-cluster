/**
 * Retry utilities with exponential backoff for refresh mechanisms.
 */

export interface RetryOptions {
  /** Maximum number of retry attempts (default: 3) */
  maxRetries?: number;
  /** Initial delay in ms before first retry (default: 500) */
  initialDelay?: number;
  /** Backoff multiplier (default: 2) */
  backoffMultiplier?: number;
  /** Maximum delay cap in ms (default: 10000) */
  maxDelay?: number;
  /** Optional abort signal */
  signal?: AbortSignal;
}

/**
 * Execute an async function with exponential backoff retry.
 * Returns the result on success, or throws the last error after all retries exhausted.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelay = 500,
    backoffMultiplier = 2,
    maxDelay = 10_000,
    signal,
  } = options;

  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    if (signal?.aborted) {
      throw new DOMException("Aborted", "AbortError");
    }

    try {
      return await fn();
    } catch (error) {
      lastError = error;

      if (attempt < maxRetries) {
        const delay = Math.min(
          initialDelay * Math.pow(backoffMultiplier, attempt),
          maxDelay
        );
        await sleep(delay, signal);
      }
    }
  }

  throw lastError;
}

/**
 * Schedule a series of progressive refetch calls at increasing intervals.
 * Useful after mutations where the backend needs time to propagate state changes.
 *
 * @param refetchFn - The function to call on each tick
 * @param delays - Array of delays in ms between each refetch (e.g., [500, 1500, 3000])
 * @param signal - Optional abort signal to cancel pending refetches
 */
export function progressiveRefetch(
  refetchFn: () => void,
  delays: number[] = [500, 1500, 3000],
  signal?: AbortSignal
): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];

  for (const delay of delays) {
    const timer = setTimeout(() => {
      if (signal?.aborted) return;
      refetchFn();
    }, delay);
    timers.push(timer);
  }

  // Return a cleanup function that cancels all pending refetches
  return () => {
    timers.forEach(clearTimeout);
  };
}

/**
 * Sleep with optional abort support.
 */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    const timer = setTimeout(resolve, ms);

    if (signal) {
      const onAbort = () => {
        clearTimeout(timer);
        reject(new DOMException("Aborted", "AbortError"));
      };
      signal.addEventListener("abort", onAbort, { once: true });
    }
  });
}
