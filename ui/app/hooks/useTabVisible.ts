import { useState, useEffect } from "react";

/**
 * Returns `true` when the browser tab is visible (active), `false` when hidden.
 * Use this to pause polling/intervals when the user is not looking at the tab.
 */
export function useTabVisible(): boolean {
  const [isVisible, setIsVisible] = useState(!document.hidden);

  useEffect(() => {
    const handler = () => setIsVisible(!document.hidden);
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  return isVisible;
}
