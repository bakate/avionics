import { useEffect, useRef } from "react";

/**
 * Hook for handling click outside to close elements
 */
export function useClickOutside<T extends HTMLElement>(
  isOpen: boolean,
  onClose: () => void,
) {
  const ref = useRef<T>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (
        ref.current &&
        !ref.current.contains(event.target as Node) &&
        isOpen
      ) {
        onClose();
      }
    };

    // Listen to both mouse and touch events for better mobile support
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return ref;
}
