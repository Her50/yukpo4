import { useMemo } from 'react';

import { useShoppingContext } from '../contexts/ShoppingContext';

export const useShoppingBasket = () => {
    const context = useShoppingContext();

    return useMemo(
        () => ({
            items: context.items,
            pickup: context.pickup,
            dropoff: context.dropoff,
            recipientDraft: context.recipientDraft,
            estimate: context.estimate,
            budget: context.budget,
            currency: context.currency,
            walletBalance: context.walletBalance,
            comment: context.comment,
            loadingEstimate: context.loadingEstimate,
            submittingOrder: context.submittingOrder,
            setPickup: context.setPickup,
            setDropoff: context.setDropoff,
            setComment: context.setComment,
            setRecipientDraft: context.setRecipientDraft,
            setBudget: context.setBudget,
            setCurrency: context.setCurrency,
            addProduct: context.addProduct,
            updateProduct: context.updateProduct,
            removeProduct: context.removeProduct,
            resetBasket: context.resetBasket,
            estimateBasket: context.estimateBasket,
            createShoppingOrder: context.createShoppingOrder,
            applyShoppingSummary: context.applyShoppingSummary,
            refreshWalletBalance: context.refreshWalletBalance,
        }),
        [context]
    );
};

export default useShoppingBasket;


