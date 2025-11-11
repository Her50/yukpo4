import { useEffect, useMemo } from 'react';
import { useShopping } from '@/context/ShoppingContext';
import { useDebounce } from './useDebounce';

const ESTIMATE_DEBOUNCE_MS = 400;

export const useShoppingEstimate = ({ auto = true } = {}) => {
  const { items, refreshEstimate, estimate, isEstimating, lastError } = useShopping();
  const serializedItems = JSON.stringify(
    items.map((item) => ({
      id: item.id,
      q: item.quantity,
      p: item.estimatedPriceCents ?? 0,
    })),
  );
  const debouncedFingerprint = useDebounce(serializedItems, ESTIMATE_DEBOUNCE_MS);

  useEffect(() => {
    if (!auto) return;
    refreshEstimate().catch((error) => {
      console.error('[useShoppingEstimate] refreshEstimate failed', error);
    });
  }, [debouncedFingerprint, auto, refreshEstimate]);

  return useMemo(
    () => ({
      estimate,
      refreshEstimate,
      isEstimating,
      lastError,
    }),
    [estimate, refreshEstimate, isEstimating, lastError],
  );
};

export default useShoppingEstimate;

