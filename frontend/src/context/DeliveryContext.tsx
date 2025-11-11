import { useUser } from '@/hooks/useUser';
import {
    updateRecipientLocation as apiUpdateRecipientLocation,
    assignDeliveryRecipient,
    cancelDelivery,
    getDeliveryById,
    listActiveDeliveries,
    refundDelivery,
    updateDeliveryStatus,
} from '@/services/deliveryApi';
import { websocketService } from '@/services/websocketService';
import {
    DeliveryLocationUpdatePayload,
    DeliveryRealtimeEvent,
    DeliveryRecipientPayload,
    DeliverySummary,
} from '@/types/delivery';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

const MAX_EVENTS = 50;
const REFRESH_COOLDOWN = 4000;

type DeliveryListener = (event: DeliveryRealtimeEvent) => void;

export interface DeliveryChatMessage {
    id: string;
    author: 'client' | 'courier' | 'recipient' | 'system';
    content: string;
    timestamp: string;
    status: 'pending' | 'sent' | 'delivered' | 'error';
}

interface ChatState {
    messages: DeliveryChatMessage[];
    typing: boolean;
    connected: boolean;
}

interface DeliveryContextValue {
    deliveries: Record<string, DeliverySummary>;
    events: Record<string, DeliveryRealtimeEvent[]>;
    activeDeliveryId: string | null;
    loading: boolean;
    error?: string | null;
    setActiveDeliveryId: (deliveryId: string | null) => void;
    refreshActiveDeliveries: (opts?: { force?: boolean }) => Promise<void>;
    refreshDelivery: (deliveryId: string, opts?: { force?: boolean }) => Promise<void>;
    getDelivery: (deliveryId: string) => DeliverySummary | null;
    getEvents: (deliveryId: string) => DeliveryRealtimeEvent[];
    registerListener: (deliveryId: string, listener: DeliveryListener) => () => void;
    assignRecipient: (deliveryId: string, payload: DeliveryRecipientPayload) => Promise<any>;
    updateRecipientLocation: (
        deliveryId: string,
        payload: DeliveryLocationUpdatePayload,
    ) => Promise<void>;
    updateStatus: (
        deliveryId: string,
        status: string,
        metadata?: Record<string, unknown>,
    ) => Promise<any>;
    cancel: (deliveryId: string, reason?: string) => Promise<any>;
    refund: (deliveryId: string, amount: number, currency: string, reason?: string) => Promise<any>;
    ensureChatChannel: (deliveryId: string) => void;
    getChatMessages: (deliveryId: string) => DeliveryChatMessage[];
    isChatTyping: (deliveryId: string) => boolean;
    isChatConnected: (deliveryId: string) => boolean;
    sendChatMessage: (
        deliveryId: string,
        content: string,
    ) => Promise<{ success: boolean; messageId: string }>;
    notifyChatTyping: (deliveryId: string) => void;
}

const DeliveryContext = createContext<DeliveryContextValue | undefined>(undefined);

const buildEvent = (message: any): DeliveryRealtimeEvent | null => {
    if (!message?.type) {
        return null;
    }

    const deliveryId =
        message.deliveryId ||
        message.delivery_id ||
        message?.data?.delivery_id ||
        message?.payload?.delivery_id;

    if (!deliveryId) {
        return null;
    }

    const timestamp =
        message.timestamp ||
        message?.data?.timestamp ||
        message?.payload?.timestamp ||
        new Date().toISOString();

    return {
        type: message.type,
        deliveryId: String(deliveryId),
        timestamp,
        payload: message.payload ?? message.data ?? message,
    };
};

export const DeliveryProvider = ({ children }: { children: React.ReactNode }) => {
    const { user } = useUser();
    const [deliveries, setDeliveries] = useState<Record<string, DeliverySummary>>({});
    const [events, setEvents] = useState<Record<string, DeliveryRealtimeEvent[]>>({});
    const [activeDeliveryId, setActiveDeliveryId] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [chatState, setChatState] = useState<Record<string, ChatState>>({});

    const listeners = useRef(new Map<string, Set<DeliveryListener>>());
    const lastRefresh = useRef(new Map<string, number>());
    const connectionMap = useRef(new Map<string, string>());
    const chatConnectionMap = useRef(new Map<string, string>());
    const chatTypingTimeouts = useRef(new Map<string, ReturnType<typeof setTimeout>>());

    const pushEvent = useCallback((event: DeliveryRealtimeEvent) => {
        setEvents(prev => {
            const existing = prev[event.deliveryId] ?? [];
            const next = [...existing, event].slice(-MAX_EVENTS);
            return { ...prev, [event.deliveryId]: next };
        });

        const delivery = deliveries[event.deliveryId];
        if (delivery) {
            setDeliveries(prev => ({
                ...prev,
                [event.deliveryId]: applyEventToDelivery(delivery, event),
            }));
        }

        const deliveryListeners = listeners.current.get(event.deliveryId);
        deliveryListeners?.forEach(listener => {
            try {
                listener(event);
            } catch (err) {
                console.error('[DeliveryContext] listener error', err);
            }
        });
    }, [deliveries]);

    const connectDeliveryWs = useCallback(
        (deliveryId: string) => {
            if (!deliveryId) return;
            if (connectionMap.current.has(deliveryId)) {
                return;
            }

            const connectionId = websocketService.connect({
                type: 'deliveryTracking',
                clientId: deliveryId,
                autoReconnect: true,
                onMessage: (message: any) => {
                    const event = buildEvent(message);
                    if (event) {
                        pushEvent(event);
                    }
                },
            });
            connectionMap.current.set(deliveryId, connectionId);
        },
        [pushEvent],
    );

    const disconnectDeliveryWs = useCallback((deliveryId: string) => {
        const connectionId = connectionMap.current.get(deliveryId);
        if (connectionId) {
            websocketService.disconnect(connectionId);
            connectionMap.current.delete(deliveryId);
        }
    }, []);

    const updateChatState = useCallback(
        (deliveryId: string, updater: (current: ChatState) => ChatState) => {
            setChatState(prev => {
                const current = prev[deliveryId] ?? {
                    messages: [],
                    typing: false,
                    connected: false,
                };
                return {
                    ...prev,
                    [deliveryId]: updater(current),
                };
            });
        },
        [],
    );

    const handleChatMessageEvent = useCallback(
        (deliveryId: string, message: any) => {
            switch (message.type) {
                case 'chat_message': {
                    const payload = message.payload ?? {};
                    const chatMessage: DeliveryChatMessage = {
                        id: payload.id ?? crypto.randomUUID(),
                        author: payload.author ?? 'system',
                        content: payload.content ?? '',
                        timestamp: payload.timestamp ?? new Date().toISOString(),
                        status: 'delivered',
                    };
                    updateChatState(deliveryId, state => ({
                        ...state,
                        messages: [...state.messages, chatMessage].slice(-MAX_EVENTS),
                    }));
                    break;
                }
                case 'chat_ack': {
                    const messageId = message.payload?.message_id;
                    if (!messageId) break;
                    updateChatState(deliveryId, state => ({
                        ...state,
                        messages: state.messages.map(item =>
                            item.id === messageId ? { ...item, status: 'delivered' } : item,
                        ),
                    }));
                    break;
                }
                case 'chat_typing':
                case 'typing': {
                    updateChatState(deliveryId, state => ({ ...state, typing: true }));
                    const timeout = chatTypingTimeouts.current.get(deliveryId);
                    if (timeout) {
                        clearTimeout(timeout);
                    }
                    const newTimeout = setTimeout(() => {
                        updateChatState(deliveryId, state => ({ ...state, typing: false }));
                        chatTypingTimeouts.current.delete(deliveryId);
                    }, 2000);
                    chatTypingTimeouts.current.set(deliveryId, newTimeout);
                    break;
                }
                default:
                    break;
            }
        },
        [updateChatState],
    );

    const connectChatWs = useCallback(
        (deliveryId: string) => {
            if (!deliveryId) return;
            if (chatConnectionMap.current.has(deliveryId)) {
                return;
            }

            const connectionId = websocketService.connect({
                type: 'chat',
                clientId: `delivery-${deliveryId}`,
                autoReconnect: true,
                onOpen: () =>
                    updateChatState(deliveryId, state => ({
                        ...state,
                        connected: true,
                    })),
                onClose: () => {
                    updateChatState(deliveryId, state => ({
                        ...state,
                        connected: false,
                    }));
                    chatConnectionMap.current.delete(deliveryId);
                },
                onMessage: (message: any) => {
                    handleChatMessageEvent(deliveryId, message);
                },
                onError: () =>
                    updateChatState(deliveryId, state => ({
                        ...state,
                        connected: false,
                    })),
            });
            chatConnectionMap.current.set(deliveryId, connectionId);
        },
        [handleChatMessageEvent, updateChatState],
    );

    const ensureChatChannel = useCallback(
        (deliveryId: string) => {
            updateChatState(deliveryId, state => state);
            connectChatWs(deliveryId);
        },
        [connectChatWs, updateChatState],
    );

    const sendChatMessage = useCallback(
        async (deliveryId: string, content: string) => {
            const trimmed = content.trim();
            if (!trimmed) {
                return { success: false, messageId: '' };
            }

            ensureChatChannel(deliveryId);
            const messageId = crypto.randomUUID();
            const timestamp = new Date().toISOString();

            updateChatState(deliveryId, state => ({
                ...state,
                messages: [
                    ...state.messages,
                    {
                        id: messageId,
                        author: 'client',
                        content: trimmed,
                        timestamp,
                        status: 'pending',
                    },
                ].slice(-MAX_EVENTS),
            }));

            const connectionId = chatConnectionMap.current.get(deliveryId);
            const payload = {
                type: 'chat_message',
                payload: {
                    id: messageId,
                    delivery_id: deliveryId,
                    author: 'client',
                    content: trimmed,
                    timestamp,
                },
            };

            const success =
                connectionId && websocketService.send(connectionId, payload);

            if (!success) {
                updateChatState(deliveryId, state => ({
                    ...state,
                    messages: state.messages.map(item =>
                        item.id === messageId ? { ...item, status: 'error' } : item,
                    ),
                }));
                return { success: false, messageId };
            }

            updateChatState(deliveryId, state => ({
                ...state,
                messages: state.messages.map(item =>
                    item.id === messageId ? { ...item, status: 'sent' } : item,
                ),
            }));

            return { success: true, messageId };
        },
        [ensureChatChannel, updateChatState],
    );

    const notifyChatTyping = useCallback(
        (deliveryId: string) => {
            ensureChatChannel(deliveryId);
            const connectionId = chatConnectionMap.current.get(deliveryId);
            if (!connectionId) return;
            websocketService.send(connectionId, {
                type: 'typing',
                payload: {
                    delivery_id: deliveryId,
                },
            });
        },
        [ensureChatChannel],
    );

    const refreshDelivery = useCallback(
        async (deliveryId: string, opts?: { force?: boolean }) => {
            if (!deliveryId) return;

            const now = Date.now();
            if (!opts?.force) {
                const last = lastRefresh.current.get(deliveryId) ?? 0;
                if (now - last < REFRESH_COOLDOWN) {
                    return;
                }
            }

            lastRefresh.current.set(deliveryId, now);
            try {
                const data = await getDeliveryById(deliveryId);
                setDeliveries(prev => ({ ...prev, [deliveryId]: data }));
                setError(null);
                connectDeliveryWs(deliveryId);
            } catch (err) {
                console.error('[DeliveryContext] unable to refresh delivery', err);
                setError(err instanceof Error ? err.message : 'Erreur rafraîchissement livraison');
            }
        },
        [connectDeliveryWs],
    );

    const refreshActiveDeliveries = useCallback(
        async (opts?: { force?: boolean }) => {
            if (!user) return;
            if (!opts?.force && loading) return;

            setLoading(true);
            try {
                const list = await listActiveDeliveries();
                const map = Object.fromEntries(list.map(item => [item.id, item]));
                setDeliveries(prev => ({ ...map, ...prev }));
                list.forEach(item => {
                    connectDeliveryWs(item.id);
                });
                setError(null);
            } catch (err) {
                console.error('[DeliveryContext] unable to load deliveries', err);
                setError(err instanceof Error ? err.message : 'Impossible de charger les livraisons');
            } finally {
                setLoading(false);
            }
        },
        [user, loading, connectDeliveryWs],
    );

    const getDelivery = useCallback(
        (deliveryId: string) => deliveries[deliveryId] ?? null,
        [deliveries],
    );

    const getEvents = useCallback(
        (deliveryId: string) => events[deliveryId] ?? [],
        [events],
    );

    const registerListener = useCallback(
        (deliveryId: string, listener: DeliveryListener) => {
            if (!listeners.current.has(deliveryId)) {
                listeners.current.set(deliveryId, new Set());
            }
            listeners.current.get(deliveryId)!.add(listener);

            return () => {
                listeners.current.get(deliveryId)?.delete(listener);
                if (listeners.current.get(deliveryId)?.size === 0) {
                    listeners.current.delete(deliveryId);
                }
            };
        },
        [],
    );

    const assignRecipient = useCallback(
        async (deliveryId: string, payload: DeliveryRecipientPayload) => {
            const response = await assignDeliveryRecipient(deliveryId, payload);
            await refreshDelivery(deliveryId, { force: true });
            return response;
        },
        [refreshDelivery],
    );

    const updateRecipientLocation = useCallback(
        async (deliveryId: string, payload: DeliveryLocationUpdatePayload) => {
            await apiUpdateRecipientLocation(deliveryId, payload);
            await refreshDelivery(deliveryId, { force: true });
        },
        [refreshDelivery],
    );

    const updateStatus = useCallback(
        async (deliveryId: string, status: string, metadata?: Record<string, unknown>) => {
            const result = await updateDeliveryStatus(deliveryId, status, metadata);
            await refreshDelivery(deliveryId, { force: true });
            return result;
        },
        [refreshDelivery],
    );

    const cancel = useCallback(
        async (deliveryId: string, reason?: string) => {
            const result = await cancelDelivery(deliveryId, reason);
            await refreshDelivery(deliveryId, { force: true });
            return result;
        },
        [refreshDelivery],
    );

    const refund = useCallback(
        async (deliveryId: string, amount: number, currency: string, reason?: string) => {
            const result = await refundDelivery(deliveryId, amount, currency, reason);
            await refreshDelivery(deliveryId, { force: true });
            return result;
        },
        [refreshDelivery],
    );

    useEffect(() => {
        return () => {
            connectionMap.current.forEach(connectionId => websocketService.disconnect(connectionId));
            connectionMap.current.clear();
            chatConnectionMap.current.forEach(connectionId => websocketService.disconnect(connectionId));
            chatConnectionMap.current.clear();
            chatTypingTimeouts.current.forEach(timeout => clearTimeout(timeout));
            chatTypingTimeouts.current.clear();
            listeners.current.clear();
        };
    }, []);

    useEffect(() => {
        if (!user) {
            setDeliveries({});
            setEvents({});
            setActiveDeliveryId(null);
            connectionMap.current.forEach(id => websocketService.disconnect(id));
            connectionMap.current.clear();
            return;
        }
        refreshActiveDeliveries({ force: true });
    }, [user, refreshActiveDeliveries]);

    const value = useMemo<DeliveryContextValue>(
        () => ({
            deliveries,
            events,
            activeDeliveryId,
            loading,
            error,
            setActiveDeliveryId,
            refreshActiveDeliveries,
            refreshDelivery,
            getDelivery,
            getEvents,
            registerListener,
            assignRecipient,
            updateRecipientLocation,
            updateStatus,
            cancel,
            refund,
            ensureChatChannel,
            getChatMessages: (deliveryId: string) => chatState[deliveryId]?.messages ?? [],
            isChatTyping: (deliveryId: string) => chatState[deliveryId]?.typing ?? false,
            isChatConnected: (deliveryId: string) => chatState[deliveryId]?.connected ?? false,
            sendChatMessage,
            notifyChatTyping,
        }),
        [
            deliveries,
            events,
            activeDeliveryId,
            loading,
            error,
            refreshActiveDeliveries,
            refreshDelivery,
            getDelivery,
            getEvents,
            registerListener,
            assignRecipient,
            updateRecipientLocation,
            updateStatus,
            cancel,
            refund,
            chatState,
            ensureChatChannel,
            sendChatMessage,
            notifyChatTyping,
        ],
    );

    return <DeliveryContext.Provider value={value}>{children}</DeliveryContext.Provider>;
};

export const useDeliveryContext = (): DeliveryContextValue => {
    const context = useContext(DeliveryContext);
    if (!context) {
        throw new Error('useDeliveryContext must be used within a DeliveryProvider');
    }
    return context;
};

const applyEventToDelivery = (delivery: DeliverySummary, event: DeliveryRealtimeEvent): DeliverySummary => {
    switch (event.type) {
        case 'delivery_status': {
            const status = event.payload?.status ?? delivery.status;
            const note = event.payload?.note;
            const checkpoint: DeliveryCheckpoint = {
                status,
                timestamp: event.timestamp,
                note,
                actor: event.payload?.actor,
                location: event.payload?.location,
            };
            return {
                ...delivery,
                status,
                checkpoints: [...delivery.checkpoints, checkpoint],
                lastEventAt: event.timestamp,
            };
        }
        case 'delivery_location': {
            const location = event.payload;
            return {
                ...delivery,
                courier: delivery.courier
                    ? {
                        ...delivery.courier,
                        etaMinutes: event.payload?.eta ?? delivery.courier.etaMinutes ?? null,
                    }
                    : delivery.courier,
                recipient:
                    event.payload?.source === 'recipient' && delivery.recipient
                        ? {
                            ...delivery.recipient,
                            currentLocation: {
                                latitude: location.latitude,
                                longitude: location.longitude,
                                timestamp: event.timestamp,
                                accuracy: location.accuracy,
                                heading: location.heading,
                                source: location.source,
                            },
                        }
                        : delivery.recipient,
                lastEventAt: event.timestamp,
            };
        }
        case 'delivery_pricing': {
            return {
                ...delivery,
                pricing: {
                    ...(delivery.pricing ?? { currency: event.payload?.currency ?? 'XAF' }),
                    estimatedTotal: event.payload?.estimated ?? delivery.pricing?.estimatedTotal ?? null,
                    finalTotal: event.payload?.final_total ?? delivery.pricing?.finalTotal ?? null,
                    shoppingAdvance: event.payload?.shopping_advance ?? delivery.pricing?.shoppingAdvance,
                    serviceFee: event.payload?.service_fee ?? delivery.pricing?.serviceFee,
                    distanceFee: event.payload?.distance_fee ?? delivery.pricing?.distanceFee,
                    tips: event.payload?.tips ?? delivery.pricing?.tips,
                },
                lastEventAt: event.timestamp,
            };
        }
        case 'shopping_update': {
            return {
                ...delivery,
                shopping: event.payload
                    ? {
                        items: event.payload.items ?? delivery.shopping?.items ?? [],
                        estimatedTotalCents:
                            event.payload.estimated_total_cents ?? delivery.shopping?.estimatedTotalCents ?? null,
                        finalTotalCents:
                            event.payload.final_total_cents ?? delivery.shopping?.finalTotalCents ?? null,
                        currency: event.payload.currency ?? delivery.shopping?.currency ?? 'XAF',
                        comment: event.payload.comment ?? delivery.shopping?.comment ?? null,
                    }
                    : delivery.shopping,
                lastEventAt: event.timestamp,
            };
        }
        case 'recipient_dropoff': {
            const checkpoint: DeliveryCheckpoint = {
                status: event.payload?.status ?? 'delivered',
                timestamp: event.timestamp,
                note: event.payload?.note,
                actor: 'recipient',
            };
            return {
                ...delivery,
                status: checkpoint.status,
                checkpoints: [...delivery.checkpoints, checkpoint],
                lastEventAt: event.timestamp,
            };
        }
        default:
            return delivery;
    }
};

type DeliveryCheckpoint = DeliverySummary['checkpoints'][number];

export default DeliveryContext;


