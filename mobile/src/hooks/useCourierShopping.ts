import { useCallback, useMemo, useState } from 'react';

import { useDeliveryContext } from '../contexts/DeliveryContext';
import { shoppingApi } from '../services/api';
import useDeliveryTracking from './useDeliveryTracking';

interface ToggleItemPayload {
    actualTotal?: number;
    actualPrice?: number;
    note?: string;
    isSubstitution?: boolean;
    status?: string;
}

export const useCourierShopping = (deliveryId: string | null) => {
    const { delivery, refresh } = useDeliveryTracking(deliveryId);
    const { updateDeliveryStatus } = useDeliveryContext();
    const [loadingItem, setLoadingItem] = useState(false);
    const [loadingCheckout, setLoadingCheckout] = useState(false);
    const [loadingStatus, setLoadingStatus] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const orderId = delivery?.orderId;

    const toggleItem = useCallback(
        async (itemId: string, payload: ToggleItemPayload) => {
            if (!orderId) {
                setError('Commande introuvable');
                return { success: false, error: 'Commande introuvable' };
            }

            setLoadingItem(true);
            try {
                const response = await shoppingApi.updateOrderItem(orderId, itemId, {
                    actual_total: payload.actualTotal,
                    actual_price: payload.actualPrice,
                    note: payload.note,
                    is_substitution: payload.isSubstitution,
                    status: payload.status,
                });

                if (!response.success) {
                    setError(response.error ?? 'Erreur mise à jour produit');
                } else {
                    setError(null);
                    await refresh({ force: true });
                }

                return response;
            } catch (err: any) {
                console.error('[useCourierShopping] toggleItem error:', err);
                const message = err?.message ?? 'Erreur mise à jour produit';
                setError(message);
                return { success: false, error: message };
            } finally {
                setLoadingItem(false);
            }
        },
        [orderId, refresh]
    );

    const updateActualTotal = useCallback(
        async (payload: { actualTotal: number; currency: string; receiptUrl?: string }) => {
            if (!orderId || !deliveryId) {
                setError('Commande introuvable');
                return { success: false, error: 'Commande introuvable' };
            }

            setLoadingCheckout(true);
            try {
                const response = await shoppingApi.checkoutOrder(orderId, {
                    actual_total: payload.actualTotal,
                    currency: payload.currency,
                    receipt_url: payload.receiptUrl,
                });

                if (!response.success) {
                    setError(response.error ?? 'Erreur validation panier');
                } else {
                    setError(null);
                    const statusResult = await updateDeliveryStatus(deliveryId, 'shopping_completed');
                    if (statusResult?.queued) {
                        setError('Statut livraison en attente – synchronisation dès le retour réseau.');
                    }
                    await refresh({ force: true });
                }

                return response;
            } catch (err: any) {
                console.error('[useCourierShopping] updateActualTotal error:', err);
                const message = err?.message ?? 'Erreur validation panier';
                setError(message);
                return {
                    success: false,
                    error: message,
                };
            } finally {
                setLoadingCheckout(false);
            }
        },
        [deliveryId, orderId, refresh, updateDeliveryStatus]
    );

    const markShoppingStatus = useCallback(
        async (status: string, note?: string) => {
            if (!orderId) {
                setError('Commande introuvable');
                return { success: false, error: 'Commande introuvable' };
            }

            setLoadingStatus(true);
            try {
                const response = await shoppingApi.markShoppingStatus(orderId, { status, note });
                if (response.success) {
                    const statusResult = await updateDeliveryStatus(deliveryId ?? '', status, { note });
                    if (statusResult?.queued) {
                        setError('Statut livraison en attente – synchronisation dès le retour réseau.');
                    }
                    await refresh({ force: true });
                    setError(null);
                } else {
                    setError(response.error ?? 'Erreur statut shopping');
                }
                return response;
            } catch (err: any) {
                console.error('[useCourierShopping] markShoppingStatus error:', err);
                const message = err?.message ?? 'Erreur statut shopping';
                setError(message);
                return { success: false, error: message };
            } finally {
                setLoadingStatus(false);
            }
        },
        [deliveryId, orderId, refresh, updateDeliveryStatus]
    );

    return useMemo(
        () => ({
            delivery,
            orderId,
            toggleItem,
            updateActualTotal,
            markShoppingStatus,
            loadingItem,
            loadingCheckout,
            loadingStatus,
            error,
        }),
        [
            delivery,
            orderId,
            toggleItem,
            updateActualTotal,
            markShoppingStatus,
            loadingItem,
            loadingCheckout,
            loadingStatus,
            error,
        ]
    );
};

export default useCourierShopping;


