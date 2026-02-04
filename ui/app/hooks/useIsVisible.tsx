import { useState, useEffect } from "react";
import type { RefObject } from "react";

export function useIsVisible(ref: RefObject<HTMLElement>): boolean {
  const [isVisible, setIsVisible] = useState(false);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Update our state when observer callback fires
        setIsVisible(entry.isIntersecting);
      },
      {
        root: null,
        threshold: 0.1, // Trigger when at least 10% is visible
      }
    );
    
    const currentElement = ref.current;
    if (currentElement) {
      observer.observe(currentElement);
    }
    
    return () => {
      if (currentElement) {
        observer.unobserve(currentElement);
      }
    };
  }, [ref]);
  
  return isVisible;
}