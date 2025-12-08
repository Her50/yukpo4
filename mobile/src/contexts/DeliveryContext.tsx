import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';

import * as Network from 'expo-network';

import { captureHandledError } from '../observability';
import { deliveryApi, walletApi } from '../services/api';
import websocketService from '../services/websocketService';
import {
    DeliveryLocationUpdatePayload,
    DeliveryRealtimeEvent,
    DeliveryRealtimeEventType,
    DeliveryRecipientPayload,
    DeliverySummary,
} from '../types/delivery';
import { useAuth } from './AuthContext';

interface DeliveryContextValue {
    deliveries: Record<string, DeliverySummary>;
    events: Record<string, DeliveryRealtimeEvent[]>;
    activeDeliveryId: string | null;
    setActiveDeliveryId: (deliveryId: string | null) => void;
    loading: boolean;
    error: string | null;
    isNetworkOnline: boolean;
    isWebSocketConnected: boolean;
    pendingMutationCount: number;
    retryPendingMutations: () => Promise<void>;
    refreshDelivery: (deliveryId: string, options?: { force?: boolean }) => Promise<void>;
    refreshActiveDeliveries: () => Promise<void>;
    getDeliveryById: (deliveryId: string) => DeliverySummary | null;
    getEvents: (deliveryId: string) => DeliveryRealtimeEvent[];
    registerDeliveryListener: (
        deliveryId: string,
        listener: (event: DeliveryRealtimeEvent) => void
    ) => () => void;
    assignRecipient: (deliveryId: string, payload: DeliveryRecipientPayload) => Promise<any>;
    updateRecipientLocation: (
        deliveryId: string,
        payload: DeliveryLocationUpdatePayload
    ) => Promise<any>;
    updateDeliveryStatus: (
        deliveryId: string,
        status: string,
        metadata?: Record<string, any>
    ) => Promise<any>;
    cancelDelivery: (deliveryId: string, reason?: string) => Promise<any>;
    debitWalletForDelivery: (deliveryId: string, amount: number, currency: string) => Promise<any>;
    refundDelivery: (
        deliveryId: string,
        amount: number,
        currency: string,
        reason?: string
    ) => Promise<any>;
}

const DeliveryContext = createContext<DeliveryContextValue | undefined>(undefined);

const MAX_EVENTS_PER_DELIVERY = 50;
const REFRESH_COOLDOWN_MS = 5000;
const OFFLINE_ERROR_KEYWORDS = [
    'network request failed',
    'failed to fetch',
    'internet',
    'offline',
    'host unreachable',
    'dns',
    'timeout',
];

class OfflineMutationError extends Error {
    constructor(message = 'OFFLINE_MUTATION') {
        super(message);
        this.name = 'OfflineMutationError';
    }
}

interface PendingMutation {
    key: string;
    run: () => Promise<void>;
    retries: number;
}

const buildRealtimeEvent = (message: any): DeliveryRealtimeEvent | null => {
    if (!message?.type) {
        return null;
    }

    const type = message.type as DeliveryRealtimeEventType;
    const deliveryId =
        message.delivery_id ||
        message.deliveryId ||
        message?.data?.delivery_id ||
        message?.data?.deliveryId ||
        message?.payload?.delivery_id ||
        message?.payload?.deliveryId;

    if (!deliveryId) {
        return null;
    }

    const timestamp =
        message.timestamp ||
        message?.data?.timestamp ||
        message?.payload?.timestamp ||
        new Date().toISOString();

    const payload = message.payload ?? message.data ?? message;

    return {
        type,
        deliveryId,
        timestamp,
        payload,
    };
};

const updateSummaryWithEvent = (
    summary: DeliverySummary,
    event: DeliveryRealtimeEvent
): DeliverySummary => {
    switch (event.type) {
        case 'delivery_status': {
            const nextStatus = event.payload?.status ?? event.payload;
            const checkpoints = [
                ...summary.checkpoints,
                {
                    status: nextStatus || summary.status,
                    timestamp: event.timestamp,
                    note: event.payload?.note,
                    actor: event.payload?.actor,
                    location: event.payload?.location,
                },
            ];

            return {
                ...summary,
                status: nextStatus || summary.status,
                lastEventAt: event.timestamp,
                checkpoints,
            };
        }
        case 'delivery_location': {
            const location = {
                lat: event.payload?.latitude ?? event.payload?.lat ?? summary.dropoff.location?.lat ?? 0,
                lng: event.payload?.longitude ?? event.payload?.lng ?? summary.dropoff.location?.lng ?? 0,
                accuracy: event.payload?.accuracy,
                heading: event.payload?.heading,
                speed: event.payload?.speed,
                updatedAt: event.timestamp,
                source: event.payload?.source ?? 'system',
            };

            return {
                ...summary,
                courier: summary.courier
                    ? {
                        ...summary.courier,
                        etaMinutes: event.payload?.eta ?? summary.courier.etaMinutes ?? null,
                    }
                    : summary.courier,
                recipient: summary.recipient
                    ? {
                        ...summary.recipient,
                        currentLocation:
                            event.payload?.source === 'recipient'
                                ? location
                                : summary.recipient.currentLocation,
                    }
                    : summary.recipient,
                metadata: {
                    ...summary.metadata,
                    last_location: location,
                },
                lastEventAt: event.timestamp,
            };
        }
        case 'delivery_pricing': {
            return {
                ...summary,
                pricing: {
                    ...(summary.pricing ?? {
                        estimated: null,
                        currency: event.payload?.currency ?? 'XAF',
                    }),
                    estimated: event.payload?.estimated ?? summary.pricing?.estimated ?? null,
                    finalTotal: event.payload?.final_total ?? summary.pricing?.finalTotal ?? null,
                    shoppingAdvance: event.payload?.shopping_advance ?? summary.pricing?.shoppingAdvance,
                    serviceFee: event.payload?.service_fee ?? summary.pricing?.serviceFee,
                    distanceFee: event.payload?.distance_fee ?? summary.pricing?.distanceFee,
                    tax: event.payload?.tax ?? summary.pricing?.tax,
                    tips: event.payload?.tips ?? summary.pricing?.tips,
                },
                lastEventAt: event.timestamp,
            };
        }
        case 'shopping_update': {
            const items = event.payload?.items ?? event.payload?.basket ?? summary.shopping?.items ?? [];
            return {
                ...summary,
                shopping: {
                    ...(summary.shopping ?? {
                        items: [],
                        estimate: null,
                        budgetCheck: null,
                    }),
                    items,
                    estimate: event.payload?.estimate ?? summary.shopping?.estimate ?? null,
                    comment: event.payload?.comment ?? summary.shopping?.comment,
                },
                lastEventAt: event.timestamp,
            };
        }
        case 'recipient_dropoff': {
            return {
                ...summary,
                status: event.payload?.status ?? summary.status,
                checkpoints: [
                    ...summary.checkpoints,
                    {
                        status: event.payload?.status ?? 'delivered',
                        timestamp: event.timestamp,
                        note: event.payload?.note,
                        actor: 'recipient',
                    },
                ],
                lastEventAt: event.timestamp,
            };
        }
        default:
            return summary;
    }
};

const isOfflineMessage = (message?: string | null) => {
    if (!message) {
        return false;
    }
    const lower = message.toLowerCase();
    return OFFLINE_ERROR_KEYWORDS.some(keyword => lower.includes(keyword));
};

const isOfflineApiResponse = (response: any) => {
    if (!response) {
        return false;
    }
    return isOfflineMessage(response.error ?? response.message ?? response.detail);
};

const isOfflineException = (error: unknown) => {
    if (error instanceof OfflineMutationError) {
        return true;
    }
    if (error instanceof TypeError && isOfflineMessage(error.message)) {
        return true;
    }
    if (error instanceof Error) {
        return isOfflineMessage(error.message);
    }
    if (typeof error === 'string') {
        return isOfflineMessage(error);
    }
    return false;
};

export const DeliveryProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [deliveries, setDeliveries] = useState<Record<string, DeliverySummary>>({});
    const [events, setEvents] = useState<Record<string, DeliveryRealtimeEvent[]>>({});
    const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isNetworkOnline, setIsNetworkOnline] = useState(true);
    const [isWebSocketConnected, setIsWebSocketConnected] = useState(websocketService.isConnected());
    const [pendingMutationCount, setPendingMutationCount] = useState(0);
    const listenersRef = useRef(new Map<string, Set<(event: DeliveryRealtimeEvent) => void>>());
    const lastRefreshRef = useRef(new Map<string, number>());
    const pendingMutationsRef = useRef<PendingMutation[]>([]);
    const flushingMutationsRef = useRef(false);
    const networkOnlineRef = useRef(true);
    const websocketConnectedRef = useRef(websocketService.isConnected());

    const pushEvent = useCallback((event: DeliveryRealtimeEvent) => {
        setEvents(prev => {
            const existing = prev[event.deliveryId] ?? [];
            const next = [...existing, event];
            if (next.length > MAX_EVENTS_PER_DELIVERY) {
                next.splice(0, next.length - MAX_EVENTS_PER_DELIVERY);
            }
            return {
                ...prev,
                [event.deliveryId]: next,
            };
        });

        setDeliveries(prev => {
            const summary = prev[event.deliveryId];
            if (!summary) {
                return prev;
            }

            const updatedSummary = updateSummaryWithEvent(summary, event);
            return {
                ...prev,
                [event.deliveryId]: updatedSummary,
            };
        });

        const listeners = listenersRef.current.get(event.deliveryId);
        if (listeners) {
            listeners.forEach(listener => {
                try {
                    listener(event);
                } catch (listenerError) {
                    console.error('[DeliveryContext] Listener error:', listenerError);
                }
            });
        }
    }, []);

    const refreshDelivery = useCallback(
        async (deliveryId: string, options?: { force?: boolean }) => {
            if (!deliveryId) {
                return;
            }

            const now = Date.now();
            if (!options?.force) {
                const last = lastRefreshRef.current.get(deliveryId) ?? 0;
                if (now - last < REFRESH_COOLDOWN_MS) {
                    return;
                }
            }

            lastRefreshRef.current.set(deliveryId, now);

            try {
                const response = await deliveryApi.getDeliveryById(deliveryId);
                if (response.success && response.data) {
                    setDeliveries(prev => ({
                        ...prev,
                        [deliveryId]: response.data.delivery ?? response.data,
                    }));
                    setError(null);
                } else if (response.error) {
                    setError(response.error);
                }
            } catch (refreshError) {
                console.error('[DeliveryContext] refreshDelivery error:', refreshError);
                setError(refreshError?.message ?? 'Erreur inconnu');
            }
        },
        []
    );

    const refreshActiveDeliveries = useCallback(async () => {
        if (!user?.id) {
            return;
        }

        setLoading(true);
        try {
            const response = await deliveryApi.listActiveDeliveries();
            if (response.success && response.data) {
                const nextDeliveries: Record<string, DeliverySummary> = {};
                const list = Array.isArray(response.data)
                    ? response.data
                    : response.data.deliveries ?? [];

                list.forEach((item: any) => {
                    if (!item?.id) {
                        return;
                    }
                    nextDeliveries[item.id] = item;
                });

                setDeliveries(prev => ({
                    ...nextDeliveries,
                    ...prev,
                }));
                setError(null);
            } else if (response.error) {
                setError(response.error);
            }
        } catch (listError) {
            console.error('[DeliveryContext] refreshActiveDeliveries error:', listError);
            setError(listError?.message ?? 'Erreur inconnue');
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    // Recreate scheduleRefresh with refreshed closure
    const scheduleRefreshMemo = useMemo(() => {
        return (deliveryId: string) => {
            const now = Date.now();
            const lastRefresh = lastRefreshRef.current.get(deliveryId) ?? 0;
            if (now - lastRefresh < REFRESH_COOLDOWN_MS) {
                return;
            }
            lastRefreshRef.current.set(deliveryId, now);
            refreshDelivery(deliveryId).catch(err => {
                console.error('[DeliveryContext] Failed to refresh delivery after event:', err);
            });
        };
    }, [refreshDelivery]);

    useEffect(() => {
        if (!user?.id) {
            setDeliveries({});
            setEvents({});
            setActiveDeliveryId(null);
            return;
        }

        refreshActiveDeliveries();
    }, [user?.id, refreshActiveDeliveries]);

    useEffect(() => {
        let mounted = true;

        const updateNetworkState = (online: boolean) => {
            networkOnlineRef.current = online;
            if (mounted) {
                setIsNetworkOnline(online);
            }
            if (online) {
                flushPendingMutations();
            }
        };

        const fetchInitialState = async () => {
            try {
                const state = await Network.getNetworkStateAsync();
                const online = !!state.isConnected && (state.isInternetReachable ?? true);
                updateNetworkState(online);
            } catch (error) {
                console.warn('[DeliveryContext] Unable to determine network state:', error);
            }
        };

        fetchInitialState();
        const subscription = Network.addNetworkStateListener?.((state) => {
            const online = !!state.isConnected && (state.isInternetReachable ?? true);
            updateNetworkState(online);
        });

        return () => {
            mounted = false;
            subscription?.remove?.();
        };
    }, [flushPendingMutations]);

    useEffect(() => {
        // ✅ SÉCURITÉ: Vérifier que websocketService existe
        if (!websocketService || typeof websocketService.onStatusChange !== 'function') {
            console.warn('[DeliveryContext] websocketService.onStatusChange non disponible');
            // ✅ CORRIGÉ: Retourner une fonction vide au lieu de undefined
            return () => { };
        }

        const unsubscribe = websocketService.onStatusChange((status) => {
            const connected = status === 'online';
            websocketConnectedRef.current = connected;
            setIsWebSocketConnected(connected);
            if (connected) {
                flushPendingMutations();
            }
        });

        return () => {
            // ✅ CORRIGÉ: Vérifier et appeler la fonction de cleanup
            if (unsubscribe && typeof unsubscribe === 'function') {
                try {
                    unsubscribe();
                } catch (error) {
                    console.warn('[DeliveryContext] Erreur cleanup onStatusChange:', error);
                }
            }
        };
    }, [flushPendingMutations]);

    const getDeliveryById = useCallback(
        (deliveryId: string) => {
            return deliveries[deliveryId] ?? null;
        },
        [deliveries]
    );

    const getEvents = useCallback(
        (deliveryId: string) => {
            return events[deliveryId] ?? [];
        },
        [events]
    );

    const registerDeliveryListener = useCallback(
        (deliveryId: string, listener: (event: DeliveryRealtimeEvent) => void) => {
            if (!listenersRef.current.has(deliveryId)) {
                listenersRef.current.set(deliveryId, new Set());
            }

            listenersRef.current.get(deliveryId)!.add(listener);

            return () => {
                const listeners = listenersRef.current.get(deliveryId);
                if (!listeners) {
                    return;
                }
                listeners.delete(listener);
                if (listeners.size === 0) {
                    listenersRef.current.delete(deliveryId);
                }
            };
        },
        []
    );

    const assignRecipient = useCallback(
        async (deliveryId: string, payload: DeliveryRecipientPayload) => {
            return executeMutation(`delivery:${deliveryId}:assignRecipient`, () => deliveryApi.assignRecipient(deliveryId, payload), async () => {
                await refreshDelivery(deliveryId, { force: true });
            });
        },
        [executeMutation, refreshDelivery]
    );

    const updateRecipientLocation = useCallback(
        async (deliveryId: string, payload: DeliveryLocationUpdatePayload) => {
            return executeMutation(`delivery:${deliveryId}:recipientLocation`, () => deliveryApi.updateRecipientLocation(deliveryId, payload));
        },
        [executeMutation]
    );

    const updateDeliveryStatus = useCallback(
        async (deliveryId: string, status: string, metadata?: Record<string, any>) => {
            return executeMutation(`delivery:${deliveryId}:status:${status}`, () => deliveryApi.updateStatus(deliveryId, status, metadata), async () => {
                await refreshDelivery(deliveryId, { force: true });
            });
        },
        [executeMutation, refreshDelivery]
    );

    const cancelDelivery = useCallback(
        async (deliveryId: string, reason?: string) => {
            return executeMutation(`delivery:${deliveryId}:cancel`, () => deliveryApi.cancelDelivery(deliveryId, reason), async () => {
                await refreshDelivery(deliveryId, { force: true });
            });
        },
        [executeMutation, refreshDelivery]
    );

    const debitWalletForDelivery = useCallback(
        async (deliveryId: string, amount: number, currency: string) => {
            return executeMutation(`wallet:${deliveryId}:debit`, () => walletApi.debitForDelivery(deliveryId, amount, currency));
        },
        [executeMutation]
    );

    const refundDelivery = useCallback(
        async (deliveryId: string, amount: number, currency: string, reason?: string) => {
            return executeMutation(`wallet:${deliveryId}:refund`, () => walletApi.refundDelivery(deliveryId, amount, currency, reason));
        },
        [executeMutation]
    );

    const enqueueMutation = useCallback((mutation: PendingMutation) => {
        pendingMutationsRef.current.push(mutation);
        setPendingMutationCount(pendingMutationsRef.current.length);
    }, []);

    const flushPendingMutations = useCallback(async () => {
        if (flushingMutationsRef.current) {
            return;
        }
        if (!networkOnlineRef.current || !websocketConnectedRef.current) {
            return;
        }

        flushingMutationsRef.current = true;
        try {
            while (pendingMutationsRef.current.length > 0) {
                const mutation = pendingMutationsRef.current[0];
                try {
                    await mutation.run();
                    pendingMutationsRef.current.shift();
                    setPendingMutationCount(pendingMutationsRef.current.length);
                } catch (mutationError) {
                    if (isOfflineException(mutationError)) {
                        mutation.retries += 1;
                        if (mutation.retries > 5) {
                            captureHandledError(mutationError, {
                                mutation: mutation.key,
                                retries: mutation.retries,
                            });
                            pendingMutationsRef.current.shift();
                            setPendingMutationCount(pendingMutationsRef.current.length);
                        }
                        break;
                    }

                    captureHandledError(mutationError, { mutation: mutation.key });
                    pendingMutationsRef.current.shift();
                    setPendingMutationCount(pendingMutationsRef.current.length);
                }
            }
        } finally {
            flushingMutationsRef.current = false;
        }
    }, []);

    const retryPendingMutations = useCallback(async () => {
        await flushPendingMutations();
    }, [flushPendingMutations]);

    const executeMutation = useCallback(
        async (
            key: string,
            executor: () => Promise<any>,
            onSuccess?: (response: any) => Promise<void>,
        ): Promise<any> => {
            const performExecutor = async () => {
                const response = await executor();
                if (isOfflineApiResponse(response)) {
                    throw new OfflineMutationError();
                }

                if (!response?.success && response?.error) {
                    setError(response.error);
                } else if (response?.success) {
                    setError(null);
                }

                if (response?.success && onSuccess) {
                    await onSuccess(response);
                }

                return response;
            };

            const queue = () => {
                enqueueMutation({
                    key,
                    retries: 0,
                    run: async () => {
                        await performExecutor();
                    },
                });
            };

            if (!networkOnlineRef.current || !websocketConnectedRef.current) {
                queue();
                return { success: false, queued: true, error: 'Opération en attente (hors ligne)' };
            }

            try {
                const response = await performExecutor();
                if (pendingMutationsRef.current.length > 0) {
                    flushPendingMutations();
                }
                return response;
            } catch (mutationError) {
                if (isOfflineException(mutationError)) {
                    queue();
                    return { success: false, queued: true, error: 'Opération en attente (hors ligne)' };
                }

                captureHandledError(mutationError, { mutation: key });
                throw mutationError;
            }
        },
        [enqueueMutation, flushPendingMutations]
    );

    const contextValue = useMemo<DeliveryContextValue>(
        () => ({
            deliveries,
            events,
            activeDeliveryId,
            setActiveDeliveryId,
            loading,
            error,
            isNetworkOnline,
            isWebSocketConnected,
            pendingMutationCount,
            retryPendingMutations,
            refreshDelivery,
            refreshActiveDeliveries,
            getDeliveryById,
            getEvents,
            registerDeliveryListener,
            assignRecipient,
            updateRecipientLocation,
            updateDeliveryStatus,
            cancelDelivery,
            debitWalletForDelivery,
            refundDelivery,
        }),
        [
            deliveries,
            events,
            activeDeliveryId,
            loading,
            error,
            isNetworkOnline,
            isWebSocketConnected,
            pendingMutationCount,
            retryPendingMutations,
            refreshDelivery,
            refreshActiveDeliveries,
            getDeliveryById,
            getEvents,
            registerDeliveryListener,
            assignRecipient,
            updateRecipientLocation,
            updateDeliveryStatus,
            cancelDelivery,
            debitWalletForDelivery,
            refundDelivery,
        ]
    );

    return <DeliveryContext.Provider value={contextValue}>{children}</DeliveryContext.Provider>;
};

export const useDeliveryContext = (): DeliveryContextValue => {
    const context = useContext(DeliveryContext);
    if (!context) {
        throw new Error('useDeliveryContext must be used within a DeliveryProvider');
    }
    return context;
};

export const useDelivery = (deliveryId: string | null) => {
    const context = useDeliveryContext();
    return useMemo(() => {
        if (!deliveryId) {
            return {
                delivery: null,
                events: [],
            };
        }

        return {
            delivery: context.getDeliveryById(deliveryId),
            events: context.getEvents(deliveryId),
        };
    }, [context, deliveryId]);
};


