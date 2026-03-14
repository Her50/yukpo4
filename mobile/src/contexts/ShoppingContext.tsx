import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from 'react';
import { Text } from 'react-native';

import { shoppingApi, walletApi } from '../services/api';
import {
    DeliveryRecipientPayload,
    ShoppingBasketItem,
    ShoppingEstimate,
    ShoppingOrderPayload,
    ShoppingSummary,
} from '../types/delivery';
import { useAuth } from './AuthContext';
import { useDeliveryContext } from './DeliveryContext';

type ShoppingLocation = {
    label?: string;
    latitude?: number;
    longitude?: number;
    address?: string;
};

interface ShoppingContextValue {
    items: ShoppingBasketItem[];
    pickup: ShoppingLocation | null;
    dropoff: ShoppingLocation | null;
    recipientDraft: DeliveryRecipientPayload | null;
    estimate: ShoppingEstimate | null;
    budget: number | null;
    currency: string;
    walletBalance: {
        balance: number;
        currency: string;
        pending?: number;
    } | null;
    comment: string;
    loadingEstimate: boolean;
    submittingOrder: boolean;
    setPickup: React.Dispatch<React.SetStateAction<ShoppingLocation | null>>;
    setDropoff: React.Dispatch<React.SetStateAction<ShoppingLocation | null>>;
    setComment: (value: string) => void;
    setRecipientDraft: (value: DeliveryRecipientPayload | null) => void;
    setBudget: (value: number | null) => void;
    setCurrency: (value: string) => void;
    addProduct: (item: Omit<ShoppingBasketItem, 'id'> & Partial<Pick<ShoppingBasketItem, 'id'>>) => void;
    updateProduct: (itemId: string, payload: Partial<ShoppingBasketItem>) => void;
    removeProduct: (itemId: string) => void;
    resetBasket: () => void;
    estimateBasket: () => Promise<void>;
    createShoppingOrder: () => Promise<{
        success: boolean;
        data?: any;
        error?: string;
    }>;
    applyShoppingSummary: (summary: ShoppingSummary) => void;
    refreshWalletBalance: () => Promise<void>;
}

const ShoppingContext = createContext<ShoppingContextValue | undefined>(undefined);

const generateLocalId = () => `local-${Math.random().toString(36).slice(2, 8)}-${Date.now()}`;

export const ShoppingProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const { refreshActiveDeliveries } = useDeliveryContext();
    const [items, setItems] = useState<ShoppingBasketItem[]>([]);
    const [pickup, setPickup] = useState<ShoppingLocation | null>(null);
    const [dropoff, setDropoff] = useState<ShoppingLocation | null>(null);
    const [recipientDraft, setRecipientDraft] = useState<DeliveryRecipientPayload | null>(null);
    const [estimate, setEstimate] = useState<ShoppingEstimate | null>(null);
    const [budget, setBudget] = useState<number | null>(null);
    const [currency, setCurrency] = useState('XAF');
    const [comment, setComment] = useState('');
    const [walletBalance, setWalletBalance] = useState<{
        balance: number;
        currency: string;
        pending?: number;
    } | null>(null);
    const [loadingEstimate, setLoadingEstimate] = useState(false);
    const [submittingOrder, setSubmittingOrder] = useState(false);

    const refreshWalletBalance = useCallback(async () => {
        if (!user?.id) {
            return;
        }

        const response = await walletApi.getBalance();
        if (response.success && response.data) {
            if (Array.isArray(response.data)) {
                const first = response.data[0];
                setWalletBalance(
                    first
                        ? {
                            balance: first.balance ?? 0,
                            currency: first.currency ?? currency,
                            pending: first.pending ?? 0,
                        }
                        : null
                );
            } else {
                setWalletBalance({
                    balance: response.data.balance ?? 0,
                    currency: response.data.currency ?? currency,
                    pending: response.data.pending ?? 0,
                });
            }
        }
    }, [currency, user?.id]);

    useEffect(() => {
        refreshWalletBalance().catch(error => {
            console.error('[ShoppingContext] refreshWalletBalance error:', error);
        });
    }, [refreshWalletBalance]);

    const addProduct = useCallback(
        (item: Omit<ShoppingBasketItem, 'id'> & Partial<Pick<ShoppingBasketItem, 'id'>>) => {
            const id = item.id ?? generateLocalId();
            setItems(prev => {
                const existingIndex = prev.findIndex(entry => entry.id === id);
                if (existingIndex >= 0) {
                    const next = [...prev];
                    next[existingIndex] = {
                        ...next[existingIndex],
                        ...item,
                        id,
                    };
                    return next;
                }
                return [
                    ...prev,
                    {
                        id,
                        label: item.label,
                        quantity: item.quantity,
                        unit: item.unit,
                        estimatedPrice: item.estimatedPrice ?? null,
                        estimatedTotal: item.estimatedTotal ?? null,
                        note: item.note,
                        isSubstitution: item.isSubstitution ?? false,
                        imageUrl: item.imageUrl,
                        actualPrice: item.actualPrice ?? null,
                        actualTotal: item.actualTotal ?? null,
                    },
                ];
            });
        },
        []
    );

    const updateProduct = useCallback((itemId: string, payload: Partial<ShoppingBasketItem>) => {
        setItems(prev => {
            const index = prev.findIndex(item => item.id === itemId);
            if (index === -1) {
                return prev;
            }
            const next = [...prev];
            next[index] = {
                ...next[index],
                ...payload,
            };
            return next;
        });
    }, []);

    const removeProduct = useCallback((itemId: string) => {
        setItems(prev => prev.filter(item => item.id !== itemId));
    }, []);

    const resetBasket = useCallback(() => {
        setItems([]);
        setEstimate(null);
        setBudget(null);
        setComment('');
        setRecipientDraft(null);
        setPickup(null);
        setDropoff(null);
    }, []);

    const buildShoppingPayload = useCallback((): ShoppingOrderPayload | null => {
        if (items.length === 0) {
            return null;
        }

        if (!dropoff) {
            return null;
        }

        const pickupPayload = pickup
            ? {
                label: pickup.label,
                latitude: pickup.latitude,
                longitude: pickup.longitude,
                address: pickup.address,
            }
            : {};

        const dropoffPayload = dropoff
            ? {
                label: dropoff.label,
                latitude: dropoff.latitude,
                longitude: dropoff.longitude,
                address: dropoff.address,
            }
            : {};

        return {
            items: items.map(item => ({
                label: item.label,
                quantity: item.quantity,
                unit: item.unit,
                note: item.note,
                estimatedPrice: item.estimatedPrice ?? undefined,
            })),
            pickup: pickupPayload,
            dropoff: dropoffPayload,
            budget: budget ?? 0,
            currency,
            comment: comment || undefined,
            recipient: recipientDraft ?? undefined,
        };
    }, [items, pickup, dropoff, budget, currency, comment, recipientDraft]);

    const estimateBasket = useCallback(async () => {
        const payload = buildShoppingPayload();
        if (!payload) {
            console.warn('[ShoppingContext] estimateBasket: payload incomplet');
            return;
        }

        setLoadingEstimate(true);
        try {
            const response = await shoppingApi.estimateOrder(payload);
            if (response.success && response.data) {
                setEstimate((response.data as any).estimate ?? response.data);
            } else if (!response.success) {
                console.warn('[ShoppingContext] estimateBasket error:', response.error);
            }
        } catch (error) {
            console.error('[ShoppingContext] estimateBasket exception:', error);
        } finally {
            setLoadingEstimate(false);
        }
    }, [buildShoppingPayload]);

    const createShoppingOrder = useCallback(async () => {
        const payload = buildShoppingPayload();
        if (!payload) {
            return {
                success: false,
                error: 'Panier incomplet',
            };
        }

        setSubmittingOrder(true);
        try {
            const response = await shoppingApi.createOrder(payload);
            if (response.success) {
                await refreshActiveDeliveries();
                resetBasket();
            }
            return response;
        } catch (error: any) {
            console.error('[ShoppingContext] createShoppingOrder error:', error);
            return {
                success: false,
                error: error?.message ?? 'Erreur création commande',
            };
        } finally {
            setSubmittingOrder(false);
        }
    }, [buildShoppingPayload, resetBasket]);

    const applyShoppingSummary = useCallback((summary: ShoppingSummary) => {
        if (!summary) {
            return;
        }

        setItems(summary.items ?? []);
        setEstimate(summary.estimate ?? null);
        setComment(summary.comment ?? '');
    }, []);

    const value = useMemo<ShoppingContextValue>(
        () => ({
            items,
            pickup,
            dropoff,
            recipientDraft,
            estimate,
            budget,
            currency,
            walletBalance,
            comment,
            loadingEstimate,
            submittingOrder,
            setPickup,
            setDropoff,
            setComment,
            setRecipientDraft,
            setBudget,
            setCurrency,
            addProduct,
            updateProduct,
            removeProduct,
            resetBasket,
            estimateBasket,
            createShoppingOrder,
            applyShoppingSummary,
            refreshWalletBalance,
        }),
        [
            items,
            pickup,
            dropoff,
            recipientDraft,
            estimate,
            budget,
            currency,
            walletBalance,
            comment,
            loadingEstimate,
            submittingOrder,
            addProduct,
            updateProduct,
            removeProduct,
            resetBasket,
            estimateBasket,
            createShoppingOrder,
            applyShoppingSummary,
            refreshWalletBalance,
        ]
    );

    // ✅ CORRIGÉ: S'assurer que les enfants sont toujours des éléments React valides
    const safeChildren = React.Children.map(children, (child, index) => {
        if (typeof child === 'string' || typeof child === 'number') {
            return <Text key={index}>{String(child)}</Text>;
        }
        if (child == null) {
            return null;
        }
        return child;
    });

    return <ShoppingContext.Provider value={value}>{safeChildren}</ShoppingContext.Provider>;
};

export const useShoppingContext = () => {
    const context = useContext(ShoppingContext);
    if (!context) {
        throw new Error('useShoppingContext must be used within a ShoppingProvider');
    }
    return context;
};


