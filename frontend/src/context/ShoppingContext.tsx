import { ShoppingEstimateResponse, ShoppingItemRequest, ShoppingOrderResponse, ShoppingRecipientPayload, ShoppingStorePayload, createShoppingOrder, estimateShoppingOrder, fetchWalletBalance } from '@/services/shoppingApi';
import {
    createContext,
    useCallback,
    useContext,
    useMemo,
    useReducer,
    useState,
    type ReactNode,
} from 'react';
import { toast } from 'react-hot-toast';

type ShoppingItem = {
    id: string;
    productId?: string;
    productName: string;
    characteristics?: unknown;
    quantity: number;
    unit: string;
    estimatedPriceCents?: number;
};

type ShoppingRecipientDraft = {
    userId?: number;
    contactName?: string;
    contactPhone?: string;
    notes?: string;
    chatThreadId?: string;
    dropoffOverride?: {
        latitude: number;
        longitude: number;
        address?: string | null;
    };
    dropoffAddress?: string | null;
};

type ShoppingEstimate = ShoppingEstimateResponse['estimate'];

interface ShoppingState {
    items: ShoppingItem[];
    currency: string;
    estimate?: ShoppingEstimate;
    isEstimating: boolean;
    lastError?: string;
    balance?: number;
    recipient?: ShoppingRecipientDraft;
}

type ShoppingAction =
    | { type: 'ADD_ITEM'; payload: ShoppingItem }
    | { type: 'UPDATE_ITEM'; payload: ShoppingItem }
    | { type: 'REMOVE_ITEM'; payload: string }
    | { type: 'CLEAR_ITEMS' }
    | { type: 'SET_ESTIMATE'; payload?: ShoppingEstimate }
    | { type: 'SET_ESTIMATING'; payload: boolean }
    | { type: 'SET_ERROR'; payload?: string }
    | { type: 'SET_CURRENCY'; payload: string }
    | { type: 'SET_BALANCE'; payload?: number }
    | { type: 'SET_RECIPIENT'; payload?: ShoppingRecipientDraft }
    | {
        type: 'UPDATE_RECIPIENT_LOCATION';
        payload?: { latitude: number; longitude: number; address?: string | null };
    };

const defaultState: ShoppingState = {
    items: [],
    currency: 'XAF',
    isEstimating: false,
};

const ShoppingContext = createContext<ShoppingContextValue | undefined>(undefined);
ShoppingContext.displayName = 'ShoppingContext';

function shoppingReducer(state: ShoppingState, action: ShoppingAction): ShoppingState {
    switch (action.type) {
        case 'ADD_ITEM':
            return {
                ...state,
                items: [...state.items, action.payload],
            };
        case 'UPDATE_ITEM':
            return {
                ...state,
                items: state.items.map((item) => (item.id === action.payload.id ? action.payload : item)),
            };
        case 'REMOVE_ITEM':
            return {
                ...state,
                items: state.items.filter((item) => item.id !== action.payload),
            };
        case 'CLEAR_ITEMS':
            return {
                ...state,
                items: [],
                estimate: undefined,
            };
        case 'SET_ESTIMATE':
            return {
                ...state,
                estimate: action.payload,
                lastError: undefined,
            };
        case 'SET_ESTIMATING':
            return {
                ...state,
                isEstimating: action.payload,
            };
        case 'SET_ERROR':
            return {
                ...state,
                lastError: action.payload,
            };
        case 'SET_CURRENCY':
            return {
                ...state,
                currency: action.payload,
            };
        case 'SET_BALANCE':
            return {
                ...state,
                balance: action.payload,
            };
        case 'SET_RECIPIENT':
            return {
                ...state,
                recipient: action.payload,
            };
        case 'UPDATE_RECIPIENT_LOCATION':
            if (!state.recipient || !action.payload) {
                return state;
            }
            return {
                ...state,
                recipient: {
                    ...state.recipient,
                    dropoffOverride: {
                        latitude: action.payload.latitude,
                        longitude: action.payload.longitude,
                        address: action.payload.address ?? state.recipient.dropoffOverride?.address ?? null,
                    },
                    dropoffAddress:
                        action.payload.address ??
                        state.recipient.dropoffAddress ??
                        state.recipient.dropoffOverride?.address ??
                        null,
                },
            };
        default:
            return state;
    }
}

export interface ShoppingContextValue {
    items: ShoppingItem[];
    currency: string;
    estimate?: ShoppingEstimate;
    isEstimating: boolean;
    balance?: number;
    lastError?: string;
    recipient?: ShoppingRecipientDraft;
    addItem: (item: Omit<ShoppingItem, 'id'>) => ShoppingItem;
    updateItem: (item: ShoppingItem) => void;
    removeItem: (id: string) => void;
    clearBasket: () => void;
    refreshEstimate: () => Promise<void>;
    setCurrency: (currency: string) => void;
    createOrder: (params: CreateOrderArgs) => Promise<ShoppingOrderResponse>;
    refreshBalance: () => Promise<void>;
    setRecipient: (recipient?: ShoppingRecipientDraft) => void;
    updateRecipientLocation: (
        location?: { latitude: number; longitude: number; address?: string | null },
    ) => void;
}

export interface CreateOrderArgs {
    store: ShoppingStoreInput;
    dropoff: {
        latitude: number;
        longitude: number;
        address?: string | null;
    };
    notes?: string | null;
    deliveryPricing: {
        basePriceCents: number;
        distancePriceCents: number;
        surchargeCents: number;
        discountCents: number;
        details?: unknown;
    };
    distanceMeters?: number | null;
    estimatedDurationSeconds?: number | null;
    metadata?: unknown;
}

export interface ShoppingStoreInput extends ShoppingStorePayload { }

export const ShoppingProvider = ({ children }: { children: ReactNode }) => {
    const [state, dispatch] = useReducer(shoppingReducer, defaultState);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const ensureBalance = useCallback(async () => {
        if (state.balance === undefined) {
            try {
                const response = await fetchWalletBalance();
                dispatch({ type: 'SET_BALANCE', payload: response.balance });
            } catch (error) {
                console.error('[ShoppingContext] Impossible de récupérer le solde wallet', error);
            }
        }
    }, [state.balance]);

    const addItem = useCallback(
        (item: Omit<ShoppingItem, 'id'>) => {
            const payload: ShoppingItem = {
                id: crypto.randomUUID(),
                ...item,
            };
            dispatch({ type: 'ADD_ITEM', payload });
            return payload;
        },
        [dispatch],
    );

    const updateItem = useCallback(
        (item: ShoppingItem) => {
            dispatch({ type: 'UPDATE_ITEM', payload: item });
        },
        [dispatch],
    );

    const removeItem = useCallback(
        (id: string) => {
            dispatch({ type: 'REMOVE_ITEM', payload: id });
        },
        [dispatch],
    );

    const clearBasket = useCallback(() => {
        dispatch({ type: 'CLEAR_ITEMS' });
    }, [dispatch]);

    const refreshEstimate = useCallback(async () => {
        if (!state.items.length) {
            dispatch({ type: 'SET_ESTIMATE', payload: undefined });
            return;
        }

        dispatch({ type: 'SET_ESTIMATING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: undefined });

        try {
            const payload = {
                items: state.items.map(mapItemToRequest),
                currency: state.currency,
            };

            const response = await estimateShoppingOrder(payload);
            dispatch({ type: 'SET_ESTIMATE', payload: response.estimate });
        } catch (error) {
            console.error('[ShoppingContext] Estimation échouée', error);
            dispatch({
                type: 'SET_ERROR',
                payload: error instanceof Error ? error.message : 'Estimation indisponible',
            });
            toast.error('Impossible de calculer le panier pour le moment.');
        } finally {
            dispatch({ type: 'SET_ESTIMATING', payload: false });
        }
    }, [state.items, state.currency]);

    const setCurrency = useCallback(
        (currency: string) => {
            dispatch({ type: 'SET_CURRENCY', payload: currency || 'XAF' });
        },
        [dispatch],
    );

    const refreshBalance = useCallback(async () => {
        try {
            const response = await fetchWalletBalance();
            dispatch({ type: 'SET_BALANCE', payload: response.balance });
        } catch (error) {
            console.error('[ShoppingContext] Erreur refresh balance', error);
        }
    }, []);

    const setRecipient = useCallback((recipient?: ShoppingRecipientDraft) => {
        dispatch({ type: 'SET_RECIPIENT', payload: recipient });
    }, []);

    const updateRecipientLocation = useCallback(
        (location?: { latitude: number; longitude: number; address?: string | null }) => {
            dispatch({ type: 'UPDATE_RECIPIENT_LOCATION', payload: location });
        },
        [],
    );

    const createOrder = useCallback(
        async (params: CreateOrderArgs) => {
            if (!state.items.length) {
                throw new Error('Votre panier est vide.');
            }

            if (isSubmitting) {
                return Promise.reject(new Error('Une validation est déjà en cours.'));
            }

            setIsSubmitting(true);
            try {
                await ensureBalance();

                const payload = {
                    items: state.items.map(mapItemToRequest),
                    store: params.store,
                    dropoff: params.dropoff,
                    recipient: state.recipient ? mapRecipientDraftToPayload(state.recipient) : undefined,
                    notes: params.notes ?? null,
                    currency: state.currency,
                    metadata: params.metadata ?? {},
                    estimated_total_cents: state.estimate?.estimated_total_cents ?? 0,
                    delivery_base_price_cents: params.deliveryPricing.basePriceCents,
                    delivery_distance_price_cents: params.deliveryPricing.distancePriceCents,
                    delivery_surcharge_cents: params.deliveryPricing.surchargeCents,
                    delivery_discount_cents: params.deliveryPricing.discountCents,
                    delivery_details: params.deliveryPricing.details ?? {},
                    distance_meters: params.distanceMeters ?? null,
                    estimated_duration_seconds: params.estimatedDurationSeconds ?? null,
                };

                const result = await createShoppingOrder(payload);
                dispatch({ type: 'CLEAR_ITEMS' });
                dispatch({ type: 'SET_RECIPIENT', payload: undefined });
                if (result.balance_remaining !== undefined) {
                    dispatch({ type: 'SET_BALANCE', payload: result.balance_remaining });
                }
                return result;
            } finally {
                setIsSubmitting(false);
            }
        },
        [state.items, state.currency, state.estimate, state.recipient, ensureBalance, isSubmitting],
    );

    const value = useMemo<ShoppingContextValue>(
        () => ({
            items: state.items,
            currency: state.currency,
            estimate: state.estimate,
            isEstimating: state.isEstimating,
            lastError: state.lastError,
            balance: state.balance,
            recipient: state.recipient,
            addItem,
            updateItem,
            removeItem,
            clearBasket,
            refreshEstimate,
            setCurrency,
            createOrder,
            refreshBalance,
            setRecipient,
            updateRecipientLocation,
        }),
        [
            state.items,
            state.currency,
            state.estimate,
            state.isEstimating,
            state.lastError,
            state.balance,
            state.recipient,
            addItem,
            updateItem,
            removeItem,
            clearBasket,
            refreshEstimate,
            setCurrency,
            createOrder,
            refreshBalance,
            setRecipient,
            updateRecipientLocation,
        ],
    );

    return <ShoppingContext.Provider value={value}>{children}</ShoppingContext.Provider>;
};

export const useShopping = (): ShoppingContextValue => {
    const context = useContext(ShoppingContext);
    if (!context) {
        throw new Error('useShopping doit être utilisé dans ShoppingProvider');
    }
    return context;
};

function mapItemToRequest(item: ShoppingItem): ShoppingItemRequest {
    return {
        product_id: item.productId,
        product_name: item.productName,
        characteristics: item.characteristics ?? [],
        quantity: item.quantity,
        unit: item.unit,
        estimated_price_cents: item.estimatedPriceCents,
    };
}

function mapRecipientDraftToPayload(recipient: ShoppingRecipientDraft): ShoppingRecipientPayload {
    return {
        user_id: recipient.userId,
        contact_name: recipient.contactName,
        contact_phone: recipient.contactPhone,
        notes: recipient.notes,
        chat_thread_id: recipient.chatThreadId,
        dropoff_override: recipient.dropoffOverride
            ? {
                latitude: recipient.dropoffOverride.latitude,
                longitude: recipient.dropoffOverride.longitude,
                address: recipient.dropoffOverride.address ?? null,
            }
            : undefined,
        dropoff_address:
            recipient.dropoffAddress ??
            recipient.dropoffOverride?.address ??
            undefined,
    };
}

export default ShoppingContext;

