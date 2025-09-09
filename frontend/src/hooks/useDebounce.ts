import { useState, useEffect } from "react";

/**
 * Retourne une version temporisée d'une valeur (ex: champ texte)
 * @param value Valeur d'entrée à observer
 * @param delay Durée d'attente avant retour (ms)
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebounced(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
