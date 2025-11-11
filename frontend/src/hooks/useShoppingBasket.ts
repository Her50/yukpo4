import { useMemo } from 'react';
import { useShopping } from '@/context/ShoppingContext';

export const useShoppingBasket = () => {
  const shopping = useShopping();

  const totals = useMemo(() => {
    const quantity = shopping.items.reduce((acc, item) => acc + item.quantity, 0);
    const estimatedItemsTotal = shopping.items.reduce((acc, item) => acc + (item.estimatedPriceCents ?? 0), 0);
    const estimateTotal = shopping.estimate?.estimated_total_cents ?? estimatedItemsTotal;

    return {
      quantity,
      estimatedItemsTotal,
      estimateTotal,
      estimateCurrency: shopping.estimate?.currency ?? shopping.currency,
    };
  }, [shopping.items, shopping.estimate, shopping.currency]);

  return {
    ...shopping,
    totalQuantity: totals.quantity,
    estimatedItemsTotalCents: totals.estimatedItemsTotal,
    estimatedTotalCents: totals.estimateTotal,
    estimateCurrency: totals.estimateCurrency,
  };
};

export default useShoppingBasket;

