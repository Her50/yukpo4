import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { config } from '../config/environment';
import { useAuth } from '../contexts/AuthContext';
import { recordPreviewMetrics } from '../observability';
import { CreateDeliveryRequestPayload, deliveryApi } from '../services/api';
import {
    CreateStudioSessionPayload,
    studioService,
    TemplateRecommendationRequest,
    TimelineClipInput,
    UpdateStudioSessionPayload,
} from '../services/studioService';
import type {
    StoryTemplateSpec,
    StudioPreviewEvent,
    StudioPreviewMetrics,
    TemplateRecommendationItem,
} from '../types/VideoGeneration';
import type {
    DeliveryCheckpoint,
    DeliveryPricingBreakdown,
    DeliveryRealtimeEvent,
    DeliverySummary,
} from '../types/delivery';

type StudioStep = 'brief' | 'assets' | 'audio' | 'timeline' | 'distribution';

interface CreatorStudioState {
    currentStep: StudioStep;
    brief: string;
    aiSuggestions: string[];
    previewLoading: boolean;
    previewReady: boolean;
    template: string | null;
    distributionPlan: string[];
    sessionId?: string;
    sessionLoading: boolean;
    error?: string | null;
    templates: StoryTemplateSpec[];
    templatesLoading: boolean;
    previewEvents: StudioPreviewEvent[];
    previewEventsLoading: boolean;
    previewMetrics?: StudioPreviewMetrics;
    previewMetricsLoading: boolean;
    sessionMetadata: Record<string, unknown>;
    deliveryId?: string | null;
    deliveryStatus?: string | null;
    deliveryEtaMinutes?: number | null;
    deliveryPricing: DeliveryPricingBreakdown | null;
    deliveryTimeline: DeliveryCheckpoint[];
    deliveryEvents: DeliveryRealtimeEvent[];
    deliveryRealtimeConnected: boolean;
    deliveryRealtimeConnecting: boolean;
    deliveryRealtimeError?: string | null;
    deliveryActionLoading: boolean;
    dropoffPending: boolean;
    dropoffShareLink?: string | null;
    dropoffShareToken?: string | null;
    billingInclusive: boolean;
    billingPartnerLabel?: string | null;
    templateRecommendations: string[];
    templateRecommendationDetails: TemplateRecommendationItem[];
    templateRecommendationsLoading: boolean;
    templateLockEnabled: boolean;
    templateLockTemplate?: string | null;
    bestRecommendedTemplate?: string | null;
    previewTemplateFilter: string;
    previewEventsFiltered: StudioPreviewEvent[];
    hasPreviewWarnings: boolean;
}

interface CreatorStudioActions {
    setBrief: (text: string) => void;
    generateSuggestions: () => Promise<void>;
    requestPreview: () => Promise<void>;
    pickTemplate: (template: string) => void;
    goToStep: (next: StudioStep) => void;
    linkDelivery: (deliveryId: string) => Promise<void>;
    requestCourier: (payload: CreateDeliveryRequestPayload) => Promise<string | null>;
    refreshDeliveryTelemetry: () => Promise<void>;
    shareDropoffLink: () => Promise<void>;
    refreshTemplateRecommendations: () => Promise<void>;
    toggleTemplateLock: (enabled: boolean) => Promise<void>;
    setBillingInclusive: (value: boolean) => void;
    setBillingPartnerLabel: (value: string) => void;
    setPreviewTemplateFilter: (value: string) => void;
    replayPreviewFromEvent: (eventId: number) => Promise<void>;
}

const DEFAULT_DISTRIBUTION = ['TikTok impulsion', 'Stories Instagram', 'WhatsApp Broadcast'];
const FALLBACK_TEMPLATES: StoryTemplateSpec[] = [
    {
        id: 'blog',
        label: 'Blog / Chronicle',
        description: 'Annonces éditoriales & nouveautés.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 30,
        suggestedScenes: 3,
    },
    {
        id: 'tutorial',
        label: 'Tutoriel',
        description: 'Pas-à-pas pour expliquer un service.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 36,
        suggestedScenes: 4,
    },
    {
        id: 'testimonial',
        label: 'Témoignage',
        description: 'Preuve sociale rapide.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 28,
        suggestedScenes: 3,
    },
    {
        id: 'comparison',
        label: 'Comparatif',
        description: 'Avant/après pour montrer la valeur.',
        recommendedCategories: [],
        tones: [],
        ctas: [],
        defaultDurationSeconds: 32,
        suggestedScenes: 4,
    },
];

const MAX_DELIVERY_EVENTS = 50;
const DEFAULT_WS_RECONNECT_MS = 2000;

const extractDeliveryIdFromMetadata = (
    metadata?: Record<string, unknown> | null,
): string | null => {
    if (!metadata) {
        return null;
    }
    const candidate =
        metadata['delivery_id'] ??
        metadata['deliveryId'] ??
        metadata['linked_delivery_id'] ??
        metadata['linkedDeliveryId'];
    return typeof candidate === 'string' && candidate.length > 0 ? candidate : null;
};

const centsToCurrency = (value?: number | null): number | null => {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return null;
    }
    return value / 100;
};

const extractWarnings = (value: unknown): string[] => {
    if (!value) {
        return [];
    }
    if (Array.isArray(value)) {
        return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
    }
    if (typeof value === 'string') {
        return value.length > 0 ? [value] : [];
    }
    if (typeof value === 'object') {
        const maybeList = (value as { list?: unknown }).list;
        if (Array.isArray(maybeList)) {
            return maybeList.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
        }
    }
    return [];
};

const normalizeDeliveryWsMessage = (message: any): DeliveryRealtimeEvent | null => {
    if (!message || !message.delivery_id) {
        return null;
    }
    const { delivery_id: deliveryId, timestamp = new Date().toISOString() } = message;
    const payload = message.event;
    if (!payload?.event) {
        return null;
    }

    switch (payload.event) {
        case 'status':
            return {
                type: 'delivery_status',
                deliveryId,
                timestamp,
                payload: {
                    status: payload.status,
                    note: payload.cancel_reason,
                },
            };
        case 'location':
            return {
                type: 'delivery_location',
                deliveryId,
                timestamp,
                payload: {
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    speed: payload.speed_kmh,
                    heading: payload.bearing,
                    accuracy: payload.accuracy_meters,
                    source: 'courier',
                },
            };
        case 'pricing': {
            const currency = payload.currency ?? 'XAF';
            const base = payload.base_price_cents ?? 0;
            const distance = payload.distance_price_cents ?? 0;
            const surcharge = payload.surcharge_cents ?? 0;
            const discount = payload.discount_cents ?? 0;
            const shopping = payload.shopping_cost_cents ?? 0;
            const shoppingDiscount = payload.shopping_discount_cents ?? 0;
            const estimated =
                base + distance + surcharge - discount + shopping - shoppingDiscount;
            return {
                type: 'delivery_pricing',
                deliveryId,
                timestamp,
                payload: {
                    currency,
                    base_fee: centsToCurrency(base),
                    distance_fee: centsToCurrency(distance),
                    service_fee: centsToCurrency(surcharge),
                    tax: null,
                    tips: null,
                    estimated: centsToCurrency(estimated),
                    final_total: centsToCurrency(estimated),
                    shopping_advance: centsToCurrency(shopping),
                },
            };
        }
        case 'recipient_dropoff':
            return {
                type: 'recipient_dropoff',
                deliveryId,
                timestamp,
                payload: {
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    address: payload.address,
                },
            };
        case 'wallet_update':
            return {
                type: 'wallet_update',
                deliveryId,
                timestamp,
                payload: {
                    balance: centsToCurrency(payload.balance_cents),
                    reason: payload.reason,
                },
            };
        // ✅ Phase 9 - Amélioration 29 : Notification prestataire quand client fournit adresse
        case 'dropoff_address_provided':
            return {
                type: 'dropoff_address_provided',
                deliveryId,
                timestamp,
                payload: {
                    latitude: payload.latitude,
                    longitude: payload.longitude,
                    address: payload.address,
                },
            };
        default:
            return null;
    }
};

const applyRealtimeEventToSummary = (
    summary: DeliverySummary,
    event: DeliveryRealtimeEvent,
): DeliverySummary => {
    switch (event.type) {
        case 'delivery_status': {
            const nextStatus = event.payload?.status ?? summary.status;
            const checkpoints: DeliveryCheckpoint[] = [
                ...(summary.checkpoints ?? []),
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
                checkpoints,
                lastEventAt: event.timestamp,
            };
        }
        case 'delivery_location': {
            const location = {
                lat: event.payload?.latitude ?? summary.dropoff.location?.lat ?? 0,
                lng: event.payload?.longitude ?? summary.dropoff.location?.lng ?? 0,
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
            const nextPricing: DeliveryPricingBreakdown = {
                ...(summary.pricing ?? {
                    estimated: null,
                    currency: event.payload?.currency ?? 'XAF',
                }),
                estimated: event.payload?.estimated ?? summary.pricing?.estimated ?? null,
                finalTotal: event.payload?.final_total ?? summary.pricing?.finalTotal ?? null,
                shoppingAdvance:
                    event.payload?.shopping_advance ?? summary.pricing?.shoppingAdvance,
                serviceFee: event.payload?.service_fee ?? summary.pricing?.serviceFee,
                distanceFee: event.payload?.distance_fee ?? summary.pricing?.distanceFee,
                tax: event.payload?.tax ?? summary.pricing?.tax,
                tips: event.payload?.tips ?? summary.pricing?.tips,
            };
            return {
                ...summary,
                pricing: nextPricing,
                lastEventAt: event.timestamp,
            };
        }
        case 'shopping_update': {
            const items = event.payload?.items ?? summary.shopping?.items ?? [];
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
            const checkpoints: DeliveryCheckpoint[] = [
                ...(summary.checkpoints ?? []),
                {
                    status: event.payload?.status ?? 'delivered',
                    timestamp: event.timestamp,
                    note: event.payload?.note,
                    actor: 'recipient',
                },
            ];
            return {
                ...summary,
                status: event.payload?.status ?? summary.status,
                checkpoints,
                lastEventAt: event.timestamp,
            };
        }
        // ✅ Phase 9 - Amélioration 29 : Notification prestataire quand client fournit adresse
        case 'dropoff_address_provided': {
            const checkpoints: DeliveryCheckpoint[] = [
                ...(summary.checkpoints ?? []),
                {
                    status: summary.status,
                    timestamp: event.timestamp,
                    note: 'Adresse de livraison confirmée par le client',
                    actor: 'recipient',
                },
            ];
            return {
                ...summary,
                dropoff: {
                    ...summary.dropoff,
                    location: {
                        lat: event.payload?.latitude ?? summary.dropoff.location?.lat ?? 0,
                        lng: event.payload?.longitude ?? summary.dropoff.location?.lng ?? 0,
                    },
                    address: event.payload?.address ?? summary.dropoff.address,
                },
                metadata: {
                    ...summary.metadata,
                    dropoff_pending: false,
                    dropoff_confirmed_at: event.timestamp,
                },
                checkpoints,
                lastEventAt: event.timestamp,
            };
        }
        default:
            return summary;
    }
};

const buildDeliveryWsUrl = (baseUrl: string, deliveryId: string): string => {
    try {
        const parsed = new URL(baseUrl);
        parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
        parsed.pathname = `/api/delivery/${deliveryId}/ws`;
        parsed.search = '';
        parsed.hash = '';
        return parsed.toString();
    } catch {
        const normalizedBase = baseUrl.replace(/\/$/, '');
        const wsBase = normalizedBase.startsWith('http')
            ? normalizedBase.replace(/^http/, 'ws')
            : `wss://${normalizedBase}`;
        return `${wsBase}/api/delivery/${deliveryId}/ws`;
    }
};

const isDeliverySummary = (value: unknown): value is DeliverySummary => {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const candidate = value as Partial<DeliverySummary>;
    return typeof candidate.id === 'string' && typeof candidate.status === 'string';
};

const unwrapDeliverySummary = (payload: unknown): DeliverySummary | null => {
    if (!payload) {
        return null;
    }
    if (isDeliverySummary(payload)) {
        return payload;
    }
    if (typeof payload === 'object' && payload !== null && 'delivery' in payload) {
        const container = payload as { delivery?: unknown };
        if (typeof container.delivery !== 'undefined') {
            return unwrapDeliverySummary(container.delivery);
        }
    }
    return null;
};

const extractBrief = (value: unknown): string => {
    if (typeof value === 'string') {
        return value;
    }
    if (value && typeof value === 'object' && 'raw' in value) {
        const rawValue = (value as { raw?: unknown }).raw;
        if (typeof rawValue === 'string') {
            return rawValue;
        }
    }
    return '';
};

const TEMPLATE_FILTER_ALL = 'all';
const TEMPLATE_FILTER_WARNINGS = 'warnings';

export const useCreatorStudio = (): [CreatorStudioState, CreatorStudioActions] => {
    const { user } = useAuth();
    const apiBaseUrl = config.API_BASE_URL;
    const [currentStep, setCurrentStep] = useState<StudioStep>('brief');
    const [brief, setBriefState] = useState('');
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewReady, setPreviewReady] = useState(false);
    const [template, setTemplate] = useState<string | null>(null);
    const [distributionPlan, setDistributionPlan] = useState<string[]>(DEFAULT_DISTRIBUTION);
    const [sessionId, setSessionId] = useState<string | undefined>();
    const [sessionLoading, setSessionLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [templates, setTemplates] = useState<StoryTemplateSpec[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(true);
    const [previewEvents, setPreviewEvents] = useState<StudioPreviewEvent[]>([]);
    const [previewEventsLoading, setPreviewEventsLoading] = useState(false);
    const [previewMetrics, setPreviewMetrics] = useState<StudioPreviewMetrics | undefined>(undefined);
    const [previewMetricsLoading, setPreviewMetricsLoading] = useState(false);
    const [sessionMetadata, setSessionMetadata] = useState<Record<string, unknown>>({});
    const sessionMetadataRef = useRef<Record<string, unknown>>({});
    const [linkedDeliveryId, setLinkedDeliveryId] = useState<string | null>(null);
    const [deliverySummary, setDeliverySummary] = useState<DeliverySummary | null>(null);
    const [deliveryEvents, setDeliveryEvents] = useState<DeliveryRealtimeEvent[]>([]);
    const [deliveryRealtimeConnected, setDeliveryRealtimeConnected] = useState(false);
    const [deliveryRealtimeConnecting, setDeliveryRealtimeConnecting] = useState(false);
    const [deliveryRealtimeError, setDeliveryRealtimeError] = useState<string | null>(null);
    const [deliveryActionLoading, setDeliveryActionLoading] = useState(false);
    const [dropoffPending, setDropoffPending] = useState(false);
    const [dropoffShareLink, setDropoffShareLink] = useState<string | null>(null);
    const [dropoffShareToken, setDropoffShareToken] = useState<string | null>(null);
    const [billingInclusive, setBillingInclusive] = useState(false);
    const [billingPartnerLabel, setBillingPartnerLabel] = useState<string | null>(null);
    const [templateRecommendations, setTemplateRecommendations] = useState<string[]>([]);
    const [templateRecommendationDetails, setTemplateRecommendationDetails] = useState<
        TemplateRecommendationItem[]
    >([]);
    const [templateRecommendationsLoading, setTemplateRecommendationsLoading] = useState(false);
    const [previewTemplateFilter, setPreviewTemplateFilter] = useState<string>(TEMPLATE_FILTER_ALL);
    const deliverySocketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const reconnectAttemptsRef = useRef(0);
    const templateOptions = templates.length > 0 ? templates : FALLBACK_TEMPLATES;
    const computeDropoffShareLink = useCallback(
        (token?: string | null) => {
            if (!token) {
                return null;
            }
            const base = apiBaseUrl.replace(/\/api(?:\/)?$/, '');
            return `${base}/delivery/public/${token}`;
        },
        [apiBaseUrl],
    );
    const templateLockEnabled = Boolean(
        (sessionMetadata['template_lock_enabled'] as boolean | undefined) ?? false,
    );
    const templateLockTemplate =
        (sessionMetadata['template_lock_template'] as string | undefined) ?? null;
    const bestRecommendedTemplate = templateRecommendations[0] ?? null;
    const filteredPreviewEvents = useMemo(() => {
        if (previewTemplateFilter === TEMPLATE_FILTER_ALL) {
            return previewEvents;
        }
        if (previewTemplateFilter === TEMPLATE_FILTER_WARNINGS) {
            return previewEvents.filter((event) => extractWarnings(event.warnings).length > 0);
        }
        const normalized = previewTemplateFilter.toLowerCase();
        return previewEvents.filter((event) =>
            (event.template ?? '').toLowerCase().includes(normalized),
        );
    }, [previewEvents, previewTemplateFilter]);
    const hasPreviewWarnings = useMemo(
        () => previewEvents.some((event) => extractWarnings(event.warnings).length > 0),
        [previewEvents],
    );

    const cleanupDeliverySocket = useCallback(() => {
        if (reconnectTimerRef.current) {
            clearTimeout(reconnectTimerRef.current);
            reconnectTimerRef.current = null;
        }
        if (deliverySocketRef.current) {
            try {
                deliverySocketRef.current.close(1000, 'cleanup');
            } catch (closeError) {
                console.warn('[CreatorStudio] Unable to close delivery socket gracefully', closeError);
            }
            deliverySocketRef.current = null;
        }
    }, []);

    const connectDeliveryRealtime = useCallback(
        async (deliveryId: string) => {
            if (!deliveryId) {
                return;
            }
            cleanupDeliverySocket();
            setDeliveryRealtimeConnecting(true);
            setDeliveryRealtimeError(null);
            const token = user?.token ?? (await AsyncStorage.getItem('auth_token'));
            if (!token) {
                setDeliveryRealtimeConnecting(false);
                setDeliveryRealtimeError('Authentification requise pour le suivi livraison.');
                return;
            }

            const wsUrl = buildDeliveryWsUrl(apiBaseUrl, deliveryId);
            try {
                const socket: WebSocket = new (WebSocket as any)(wsUrl, undefined, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                deliverySocketRef.current = socket;

                socket.onopen = () => {
                    reconnectAttemptsRef.current = 0;
                    setDeliveryRealtimeConnecting(false);
                    setDeliveryRealtimeConnected(true);
                    setDeliveryRealtimeError(null);
                };

                socket.onmessage = (event) => {
                    try {
                        const parsed = JSON.parse(event.data);
                        if (parsed?.event === 'connected') {
                            setDeliveryRealtimeConnecting(false);
                            setDeliveryRealtimeConnected(true);
                            return;
                        }
                        const normalized = normalizeDeliveryWsMessage(parsed);
                        if (!normalized) {
                            return;
                        }
                        setDeliveryRealtimeConnected(true);
                        setDeliveryEvents((prev) => {
                            const next = [...prev, normalized];
                            if (next.length > MAX_DELIVERY_EVENTS) {
                                next.splice(0, next.length - MAX_DELIVERY_EVENTS);
                            }
                            return next;
                        });
                        setDeliverySummary((prev) =>
                            prev ? applyRealtimeEventToSummary(prev, normalized) : prev,
                        );

                        // ✅ Phase 9 - Amélioration 29 : Notification toast quand adresse confirmée
                        if (normalized.type === 'dropoff_address_provided') {
                            const { Alert } = require('react-native');
                            Alert.alert(
                                '📍 Adresse de livraison confirmée',
                                'Le client a fourni son adresse de livraison. La livraison peut maintenant être assignée à un coursier.',
                                [{ text: 'OK' }]
                            );
                        }
                    } catch (parseError) {
                        console.warn('[CreatorStudio] Invalid delivery WS message', parseError);
                        setDeliveryRealtimeError('Message temps réel livraison invalide.');
                    }
                };

                socket.onerror = (wsError) => {
                    console.warn('[CreatorStudio] WebSocket delivery error', wsError);
                    setDeliveryRealtimeError('Connexion WebSocket delivery interrompue.');
                    setDeliveryRealtimeConnecting(false);
                };

                socket.onclose = (closeEvent) => {
                    deliverySocketRef.current = null;
                    setDeliveryRealtimeConnected(false);
                    if (closeEvent.code !== 1000 && linkedDeliveryId === deliveryId) {
                        const attempt = reconnectAttemptsRef.current + 1;
                        reconnectAttemptsRef.current = attempt;
                        const delay = Math.min(DEFAULT_WS_RECONNECT_MS * attempt, 15000);
                        reconnectTimerRef.current = setTimeout(() => {
                            if (linkedDeliveryId === deliveryId) {
                                void connectDeliveryRealtime(deliveryId);
                            }
                        }, delay);
                    } else {
                        setDeliveryRealtimeConnecting(false);
                    }
                };
            } catch (connectionError) {
                console.error('[CreatorStudio] Unable to open delivery WS', connectionError);
                setDeliveryRealtimeConnecting(false);
                setDeliveryRealtimeConnected(false);
                setDeliveryRealtimeError('Impossible d’ouvrir la connexion de tracking.');
                throw connectionError;
            }
        },
        [apiBaseUrl, cleanupDeliverySocket, linkedDeliveryId, user?.token],
    );

    const pickTemplateSpec = useCallback(
        (templateId: string) =>
            templateOptions.find((spec) => spec.id === templateId) ?? templateOptions[0],
        [templateOptions],
    );

    useEffect(() => {
        let cancelled = false;
        const loadTemplates = async () => {
            setTemplatesLoading(true);
            try {
                const list = await studioService.listTemplates();
                if (!cancelled) {
                    setTemplates(list);
                }
            } catch (err) {
                console.error('[CreatorStudio][mobile] template fetch failed', err);
            } finally {
                if (!cancelled) {
                    setTemplatesLoading(false);
                }
            }
        };
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        loadTemplates().catch(error => {
            console.error('[useCreatorStudio] Erreur loadTemplates:', error);
        });
        return () => {
            cancelled = true;
        };
    }, []);

    useEffect(() => {
        const metadata = sessionMetadata;
        const pending = Boolean(metadata['dropoff_pending']);
        setDropoffPending(pending);
        const token =
            typeof metadata['dropoff_share_token'] === 'string'
                ? (metadata['dropoff_share_token'] as string)
                : null;
        const explicitLink =
            typeof metadata['dropoff_share_link'] === 'string'
                ? (metadata['dropoff_share_link'] as string)
                : null;
        setDropoffShareToken(token);
        setDropoffShareLink(explicitLink ?? computeDropoffShareLink(token));
    }, [computeDropoffShareLink, sessionMetadata]);

    useEffect(() => {
        const inclusive = Boolean(sessionMetadata['billing_inclusive']);
        setBillingInclusive(inclusive);
        const partner = sessionMetadata['billing_partner_label'];
        setBillingPartnerLabel(
            typeof partner === 'string' && partner.length > 0 ? partner : null,
        );
    }, [sessionMetadata]);

    useEffect(() => {
        if (!linkedDeliveryId) {
            setDeliverySummary(null);
            setDeliveryEvents([]);
            setDeliveryRealtimeConnected(false);
            setDeliveryRealtimeConnecting(false);
            setDeliveryRealtimeError(null);
            cleanupDeliverySocket();
            return;
        }

        let aborted = false;
        setDeliveryRealtimeError(null);
        setDeliveryRealtimeConnecting(true);
        setDeliveryEvents([]);

        const bootstrapDelivery = async () => {
            try {
                const response = await deliveryApi.getDeliveryById(linkedDeliveryId);
                if (aborted) {
                    return;
                }
                if (response.success) {
                    const summary = unwrapDeliverySummary(response.data);
                    if (summary) {
                        setDeliverySummary(summary);
                        setDeliveryRealtimeError(null);
                    } else if (response.error) {
                        setDeliveryRealtimeError(response.error);
                    } else {
                        setDeliveryRealtimeError("Réponse livraison inattendue.");
                    }
                } else if (response.error) {
                    setDeliveryRealtimeError(response.error);
                }
            } catch (deliveryError) {
                if (!aborted) {
                    setDeliveryRealtimeError(
                        (deliveryError as Error)?.message ?? 'Impossible de charger la livraison.',
                    );
                }
            } finally {
                if (!aborted) {
                    void connectDeliveryRealtime(linkedDeliveryId);
                }
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        bootstrapDelivery().catch(error => {
            console.error('[useCreatorStudio] Erreur bootstrapDelivery:', error);
        });

        return () => {
            aborted = true;
            cleanupDeliverySocket();
        };
    }, [cleanupDeliverySocket, connectDeliveryRealtime, linkedDeliveryId]);

    const persistSession = useCallback(
        async (payload: UpdateStudioSessionPayload) => {
            if (!sessionId) {
                return;
            }
            try {
                await studioService.updateSession(sessionId, payload);
            } catch (err) {
                console.warn('[CreatorStudio][mobile] Update session failed', err);
            }
        },
        [sessionId],
    );

    const updateSessionMetadata = useCallback(
        async (patch: Record<string, unknown>) => {
            sessionMetadataRef.current = {
                ...sessionMetadataRef.current,
                ...patch,
            };
            setSessionMetadata(sessionMetadataRef.current);
            await persistSession({ metadata: sessionMetadataRef.current });
        },
        [persistSession],
    );

    const linkDeliveryInternal = useCallback(
        async (deliveryId: string, summary?: DeliverySummary | null) => {
            if (!deliveryId) {
                return;
            }
            setLinkedDeliveryId(deliveryId);
            if (summary) {
                setDeliverySummary(summary);
            }
            setDeliveryEvents([]);
            const normalizedBase = apiBaseUrl.replace(/\/$/, '');
            await updateSessionMetadata({
                delivery_id: deliveryId,
                delivery_tracking_url: `${normalizedBase}/delivery/${deliveryId}`,
                delivery_linked_at: new Date().toISOString(),
            });
        },
        [apiBaseUrl, updateSessionMetadata],
    );

    const hydrateSession = useCallback(async (targetId: string) => {
        const aggregate = await studioService.getSession(targetId);
        setSessionId(aggregate.session.id);
        const metadata =
            (aggregate.session.metadata as Record<string, unknown> | undefined) ?? {};
        sessionMetadataRef.current = metadata;
        setSessionMetadata(metadata);
        const metadataDeliveryId = extractDeliveryIdFromMetadata(metadata);
        setLinkedDeliveryId(metadataDeliveryId);
        setBriefState(extractBrief(aggregate.session.brief));
        if (
            Array.isArray(aggregate.session.distribution_plan) &&
            aggregate.session.distribution_plan.length > 0
        ) {
            setDistributionPlan(
                (aggregate.session.distribution_plan as unknown[]).map((entry) => String(entry)),
            );
        }
        setTemplate(aggregate.session.recommended_templates?.[0] ?? null);
        setTemplateRecommendations(aggregate.session.recommended_templates ?? []);
        const snapshotRaw = metadata['template_recommendations_snapshot'];
        if (Array.isArray(snapshotRaw)) {
            const normalized = snapshotRaw
                .map((entry) => {
                    if (entry && typeof entry === 'object' && 'id' in entry) {
                        const detail = entry as Partial<TemplateRecommendationItem>;
                        return {
                            id: String(detail.id ?? ''),
                            label: String(detail.label ?? ''),
                            description: String(detail.description ?? ''),
                            score: Number(detail.score ?? 0),
                            reasons: Array.isArray(detail.reasons)
                                ? (detail.reasons as string[])
                                : [],
                        } as TemplateRecommendationItem;
                    }
                    if (typeof entry === 'string') {
                        return {
                            id: entry,
                            label: entry,
                            description: '',
                            score: 0,
                            reasons: [],
                        } as TemplateRecommendationItem;
                    }
                    return null;
                })
                .filter(Boolean) as TemplateRecommendationItem[];
            if (normalized.length > 0) {
                setTemplateRecommendationDetails(normalized);
                setTemplateRecommendations(normalized.map((item) => item.id));
            }
        } else {
            setTemplateRecommendationDetails([]);
        }
        setPreviewReady(
            aggregate.session.preview_status === 'ready' ||
            Boolean(aggregate.session.preview_public_url),
        );
        setPreviewEventsLoading(true);
        try {
            const events = await studioService.listPreviewEvents(targetId);
            setPreviewEvents(events);
        } catch (err) {
            console.warn('[CreatorStudio][mobile] preview events unavailable', err);
        } finally {
            setPreviewEventsLoading(false);
        }

        setPreviewMetricsLoading(true);
        try {
            const metrics = await studioService.getPreviewMetrics(targetId);
            setPreviewMetrics(metrics);
        } catch (err) {
            console.warn('[CreatorStudio][mobile] preview metrics unavailable', err);
        } finally {
            setPreviewMetricsLoading(false);
        }
    }, []);

    useEffect(() => {
        let cancelled = false;
        const bootstrap = async () => {
            setSessionLoading(true);
            setError(null);
            try {
                const sessions = await studioService.listSessions();
                if (cancelled) {
                    return;
                }
                if (sessions.length > 0) {
                    await hydrateSession(sessions[0].id);
                } else {
                    const payload: CreateStudioSessionPayload = {
                        brief: { raw: '' },
                        distribution_plan: DEFAULT_DISTRIBUTION,
                    };
                    const aggregate = await studioService.createSession(payload);
                    if (!cancelled) {
                        setSessionId(aggregate.session.id);
                        setBriefState('');
                        sessionMetadataRef.current = {};
                        setSessionMetadata({});
                        setLinkedDeliveryId(null);
                        setDeliverySummary(null);
                        setDeliveryEvents([]);
                    }
                }
            } catch (err) {
                if (!cancelled) {
                    setError((err as Error).message);
                }
            } finally {
                if (!cancelled) {
                    setSessionLoading(false);
                }
            }
        };

        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        bootstrap().catch(error => {
            console.error('[useCreatorStudio] Erreur bootstrap:', error);
        });
        return () => {
            cancelled = true;
        };
    }, [hydrateSession]);

    const setBrief = useCallback(
        (text: string) => {
            setBriefState(text);
            void persistSession({ brief: { raw: text } });
        },
        [persistSession],
    );

    const buildTimelinePayload = useCallback((): TimelineClipInput[] => {
        const activeTemplate = template ?? templateOptions[0]?.id ?? 'blog';
        const spec = pickTemplateSpec(activeTemplate);
        const scenesCount = Math.max(1, spec?.suggestedScenes ?? 6);
        const durationSeconds = spec?.defaultDurationSeconds ?? 28;
        const perScene = Math.max(4, Math.round(durationSeconds / scenesCount));
        const immersiveTemplates = ['IntroPulse', 'ProductShowcase', 'GlowCTA'];

        return Array.from({ length: scenesCount }).map((_, index) => {
            const immersiveTemplate = immersiveTemplates[Math.min(index, immersiveTemplates.length - 1)];
            return {
                position: index,
                lane: activeTemplate,
                duration_seconds: perScene,
                payload: {
                    id: `scene-${index + 1}`,
                    template: immersiveTemplate,
                    durationInFrames: perScene * 30,
                    assets: {
                        headline:
                            index === 0
                                ? brief || 'Concept Yukpo Studio'
                                : aiSuggestions[index] ?? 'Séquence narrative',
                        body: index === scenesCount - 1 ? 'CTA Yukpo Studio' : undefined,
                    },
                    transition: {
                        type: index === 0 ? 'orbit-3d' : 'hard-cut',
                        durationInFrames: 18,
                    },
                },
            } satisfies TimelineClipInput;
        });
    }, [aiSuggestions, brief, pickTemplateSpec, template, templateOptions]);

    const buildTemplateRecommendationPayload = useCallback((): TemplateRecommendationRequest => {
        const outlineSource =
            aiSuggestions.length > 0
                ? aiSuggestions
                : brief
                    .split(/[\n\.!?]/)
                    .map((entry) => entry.trim())
                    .filter((entry) => entry.length > 0);
        const script_outline =
            outlineSource.length > 0 ? outlineSource.slice(0, 6) : ['Concept Yukpo Studio'];
        const rawHints = sessionMetadata['ai_template_hints'];

        const businessContext = {
            service_category: sessionMetadata['service_category'] as string | undefined,
            tone:
                (sessionMetadata['template_tone'] as string | undefined) ||
                (sessionMetadata['tone'] as string | undefined),
            cta_label: sessionMetadata['cta_label'] as string | undefined,
            delivery_sla_minutes:
                (sessionMetadata['delivery_sla_minutes'] as number | undefined) ??
                (deliverySummary?.courier?.etaMinutes ?? undefined),
            stock_level: sessionMetadata['inventory_stock'] as number | undefined,
            promotion_active: sessionMetadata['promotion_active'] as boolean | undefined,
            price_label: sessionMetadata['price_label'] as string | undefined,
            target_audience: sessionMetadata['target_audience'] as string | undefined,
        };

        return {
            script_outline,
            product_name: (sessionMetadata['product_name'] as string | undefined) ?? 'Studio Yukpo',
            headline: brief || (sessionMetadata['headline'] as string | undefined),
            call_to_action: sessionMetadata['cta_label'] as string | undefined,
            style:
                (sessionMetadata['template_tone'] as string | undefined) ??
                (sessionMetadata['tone'] as string | undefined),
            duration_seconds: sessionMetadata['template_duration_seconds'] as number | undefined,
            template_id: templateLockEnabled ? template ?? templateLockTemplate : undefined,
            business_context: businessContext,
            ai_hints: Array.isArray(rawHints)
                ? (rawHints as string[]).filter((hint) => typeof hint === 'string')
                : [],
        };
    }, [
        aiSuggestions,
        brief,
        deliverySummary,
        sessionMetadata,
        template,
        templateLockEnabled,
        templateLockTemplate,
    ]);

    const setPreviewTemplateFilterValue = useCallback((value: string) => {
        setPreviewTemplateFilter(value);
    }, []);

    const generateSuggestions = useCallback(async () => {
        if (!sessionId) {
            setError('Session Studio non disponible. Veuillez patienter...');
            return;
        }
        setPreviewLoading(true);
        setError(null);
        try {
            // TODO: Remplacer par un vrai appel backend quand l'endpoint sera créé
            // const response = await studioService.generateSuggestions(sessionId, { brief });
            // setAiSuggestions(response.suggestions);

            // Temporaire : Suggestions hardcodées en attendant l'endpoint backend
            await new Promise((resolve) => setTimeout(resolve, 500));
            const suggestions = [
                'Hook express avec stock limité + CTA livraison',
                'Ajouter scène USP (3s) avant CTA',
                'Prévoir variante voix + texte pour WhatsApp',
            ];
            setAiSuggestions(suggestions);
            await persistSession({
                ai_recommendations: suggestions,
            });
        } catch (err) {
            const message = (err as Error)?.message || 'Impossible de générer les suggestions IA.';
            setError(message);
            console.error('[CreatorStudio] Erreur suggestions:', err);
        } finally {
            setPreviewLoading(false);
        }
    }, [persistSession, sessionId, template, templateOptions]);

    const refreshTemplateRecommendations = useCallback(async () => {
        if (!sessionId) {
            return;
        }
        setTemplateRecommendationsLoading(true);
        try {
            const payload = buildTemplateRecommendationPayload();
            const response = await studioService.recommendTemplates(sessionId, payload);
            setTemplateRecommendations(response.ordered.map((item) => item.id));
            setTemplateRecommendationDetails(response.ordered);
            await persistSession({
                recommended_templates: response.ordered.map((item) => item.id),
            });
            await updateSessionMetadata({
                template_recommendations_snapshot: response.ordered,
                template_recommendations_at: new Date().toISOString(),
            });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setTemplateRecommendationsLoading(false);
        }
    }, [buildTemplateRecommendationPayload, persistSession, sessionId, updateSessionMetadata]);

    const toggleTemplateLock = useCallback(
        async (enabled: boolean) => {
            const fallbackTemplate = template ?? templateOptions[0]?.id ?? null;
            await updateSessionMetadata({
                template_lock_enabled: enabled,
                template_lock_template: enabled ? fallbackTemplate : null,
            });
            if (enabled && fallbackTemplate && fallbackTemplate !== template) {
                setTemplate(fallbackTemplate);
            }
        },
        [template, templateOptions, updateSessionMetadata],
    );

    useEffect(() => {
        if (!sessionId || sessionLoading) {
            return;
        }
        if (templateRecommendations.length > 0 || templateRecommendationsLoading) {
            return;
        }
        // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
        refreshTemplateRecommendations().catch(error => {
            console.error('[useCreatorStudio] Erreur refreshTemplateRecommendations:', error);
        });
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [
        refreshTemplateRecommendations,
        sessionId,
        sessionLoading,
        templateRecommendations.length,
        templateRecommendationsLoading,
    ]);

    const refreshDeliveryTelemetry = useCallback(async () => {
        if (!linkedDeliveryId) {
            return;
        }
        try {
            const response = await deliveryApi.getDeliveryById(linkedDeliveryId);
            if (response.success) {
                const summary = unwrapDeliverySummary(response.data);
                if (summary) {
                    setDeliverySummary(summary);
                    setDeliveryRealtimeError(null);
                } else if (response.error) {
                    setDeliveryRealtimeError(response.error);
                } else {
                    setDeliveryRealtimeError('Réponse livraison inattendue.');
                }
            } else if (response.error) {
                setDeliveryRealtimeError(response.error);
            }
        } catch (refreshError) {
            setDeliveryRealtimeError(
                (refreshError as Error)?.message ?? 'Impossible de rafraîchir la livraison.',
            );
        }
    }, [linkedDeliveryId]);

    const requestPreview = useCallback(async () => {
        if (!sessionId) {
            return;
        }
        setPreviewLoading(true);
        setError(null);
        try {
            const previewStart = Date.now();
            const timelinePayload = buildTimelinePayload();
            await studioService.saveTimeline(sessionId, timelinePayload);
            const preview = await studioService.requestPreview(sessionId);
            setPreviewReady(preview.status === 'ready');
            if (preview.preview_url) {
                setDistributionPlan((previous) =>
                    Array.isArray(previous) && previous.length > 0 ? previous : DEFAULT_DISTRIBUTION,
                );
            }
            await hydrateSession(sessionId);
            const events = await studioService.listPreviewEvents(sessionId);
            setPreviewEvents(events);
            const metrics = await studioService.getPreviewMetrics(sessionId);
            setPreviewMetrics(metrics);
            const latencyMs = Date.now() - previewStart;
            recordPreviewMetrics({
                template: preview.template ?? template,
                durationSeconds: preview.duration_seconds,
                clipCount: preview.clip_count,
                warnings: preview.warnings,
                latencyMs,
            });
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setPreviewLoading(false);
        }
    }, [buildTimelinePayload, hydrateSession, sessionId, template]);

    const replayPreviewFromEvent = useCallback(
        async (eventId: number) => {
            if (!sessionId) {
                return;
            }
            const targetEvent = previewEvents.find((event) => event.id === eventId);
            await updateSessionMetadata({
                replay_source_event_id: eventId,
                replay_source_template: targetEvent?.template ?? null,
                replay_source_generated_at: targetEvent?.created_at ?? null,
            });
            await requestPreview();
        },
        [previewEvents, requestPreview, sessionId, updateSessionMetadata],
    );

    const pickTemplate = useCallback(
        (nextTemplate: string) => {
            setTemplate(nextTemplate);
            if (templateRecommendations.length === 0) {
                void persistSession({ recommended_templates: [nextTemplate] });
            }
            if (templateLockEnabled) {
                void updateSessionMetadata({
                    template_lock_template: nextTemplate,
                });
            }
        },
        [persistSession, templateLockEnabled, templateRecommendations.length, updateSessionMetadata],
    );

    const linkDelivery = useCallback(
        async (deliveryId: string) => {
            await linkDeliveryInternal(deliveryId);
        },
        [linkDeliveryInternal],
    );

    const requestCourier = useCallback(
        async (payload: CreateDeliveryRequestPayload) => {
            setDeliveryActionLoading(true);
            setDeliveryRealtimeError(null);
            try {
                const metadataPatch = {
                    studio_session_id: sessionId,
                    studio_template: template ?? templateOptions[0]?.id ?? null,
                    studio_distribution_plan: distributionPlan,
                    studio_brief_snapshot: brief,
                    billing_mode: billingInclusive ? 'merchant_inclusive' : 'standard',
                    billing_partner_label: billingInclusive
                        ? billingPartnerLabel || sessionMetadata['service_name'] || 'Merchant'
                        : undefined,
                };
                const enrichedPayload: CreateDeliveryRequestPayload = {
                    ...payload,
                    metadata: {
                        ...(payload.metadata ?? {}),
                        ...metadataPatch,
                    },
                    initial_event_payload: {
                        ...(payload.initial_event_payload ?? {}),
                        source: 'creator_studio',
                        checkpoints_hint: templateOptions.length,
                    },
                };
                const response = await deliveryApi.createDeliveryRequest(enrichedPayload);
                if (!response.success) {
                    throw new Error(response.error ?? 'Création livraison impossible.');
                }
                const summary = unwrapDeliverySummary(response.data);
                if (!summary?.id) {
                    throw new Error('Identifiant livraison absent dans la réponse.');
                }
                const deliveryId = summary.id;
                await linkDeliveryInternal(deliveryId, summary);
                return deliveryId;
            } catch (creationError) {
                const message =
                    (creationError as Error)?.message ?? 'Impossible de créer la livraison.';
                setDeliveryRealtimeError(message);
                throw creationError;
            } finally {
                setDeliveryActionLoading(false);
            }
        },
        [
            billingInclusive,
            billingPartnerLabel,
            brief,
            distributionPlan,
            linkDeliveryInternal,
            sessionId,
            sessionMetadata,
            template,
            templateOptions,
        ],
    );

    const setBillingInclusiveValue = useCallback(
        (value: boolean) => {
            setBillingInclusive(value);
            const patch: Record<string, unknown> = {
                billing_inclusive: value,
            };
            if (!value) {
                setBillingPartnerLabel(null);
                patch.billing_partner_label = null;
            }
            void updateSessionMetadata(patch);
        },
        [updateSessionMetadata],
    );

    const setBillingPartnerLabelValue = useCallback(
        (value: string) => {
            const normalized = value.trim();
            const next = normalized.length > 0 ? normalized : null;
            setBillingPartnerLabel(next);
            const patch: Record<string, unknown> = {
                billing_partner_label: next,
            };
            if (next) {
                setBillingInclusive(true);
                patch.billing_inclusive = true;
            } else {
                setBillingInclusive(false);
                patch.billing_inclusive = false;
            }
            void updateSessionMetadata(patch);
        },
        [updateSessionMetadata],
    );

    const shareDropoffLink = useCallback(async () => {
        if (!linkedDeliveryId) {
            setDeliveryRealtimeError('Aucune livraison liée.');
            return;
        }
        setDeliveryActionLoading(true);
        setDeliveryRealtimeError(null);
        try {
            const response = await deliveryApi.shareDropoffLink(linkedDeliveryId);
            if (!response.success || !response.data) {
                throw new Error(response.error ?? 'Impossible de générer le lien destinataire.');
            }
            const { tracking_token, share_url, dropoff_pending } = response.data;
            const computedLink = share_url ?? computeDropoffShareLink(tracking_token);
            setDropoffPending(dropoff_pending);
            setDropoffShareToken(tracking_token);
            setDropoffShareLink(computedLink);
            await updateSessionMetadata({
                dropoff_pending,
                dropoff_share_token: tracking_token,
                dropoff_share_link: computedLink,
                dropoff_share_generated_at: new Date().toISOString(),
            });
        } catch (shareError) {
            const message =
                (shareError as Error)?.message ?? 'Impossible de générer le lien destinataire.';
            setDeliveryRealtimeError(message);
            throw shareError;
        } finally {
            setDeliveryActionLoading(false);
        }
    }, [computeDropoffShareLink, linkedDeliveryId, updateSessionMetadata]);

    const goToStep = useCallback((next: StudioStep) => {
        setCurrentStep(next);
    }, []);

    const state = useMemo<CreatorStudioState>(
        () => ({
            currentStep,
            brief,
            aiSuggestions,
            previewLoading,
            previewReady,
            template,
            distributionPlan,
            sessionId,
            sessionLoading,
            error,
            templates: templateOptions,
            templatesLoading,
            previewEvents,
            previewEventsLoading,
            previewMetrics,
            previewMetricsLoading,
            sessionMetadata,
            deliveryId: linkedDeliveryId,
            deliveryStatus: deliverySummary?.status ?? null,
            deliveryEtaMinutes: deliverySummary?.courier?.etaMinutes ?? null,
            deliveryPricing: deliverySummary?.pricing ?? null,
            deliveryTimeline: deliverySummary?.checkpoints ?? [],
            deliveryEvents,
            deliveryRealtimeConnected,
            deliveryRealtimeConnecting,
            deliveryRealtimeError,
            deliveryActionLoading,
            dropoffPending,
            dropoffShareLink,
            dropoffShareToken,
            billingInclusive,
            billingPartnerLabel,
            templateRecommendations,
            templateRecommendationDetails,
            templateRecommendationsLoading,
            templateLockEnabled,
            templateLockTemplate,
            bestRecommendedTemplate,
            previewTemplateFilter,
            previewEventsFiltered: filteredPreviewEvents,
            hasPreviewWarnings,
        }),
        [
            aiSuggestions,
            brief,
            currentStep,
            distributionPlan,
            error,
            previewLoading,
            previewReady,
            sessionId,
            sessionLoading,
            template,
            templateOptions,
            templatesLoading,
            previewEvents,
            previewEventsLoading,
            previewMetrics,
            previewMetricsLoading,
            sessionMetadata,
            linkedDeliveryId,
            deliverySummary,
            deliveryEvents,
            deliveryRealtimeConnected,
            deliveryRealtimeConnecting,
            deliveryRealtimeError,
            deliveryActionLoading,
            dropoffPending,
            dropoffShareLink,
            dropoffShareToken,
            billingInclusive,
            billingPartnerLabel,
            templateRecommendations,
            templateRecommendationDetails,
            templateRecommendationsLoading,
            templateLockEnabled,
            templateLockTemplate,
            bestRecommendedTemplate,
            previewTemplateFilter,
            filteredPreviewEvents,
            hasPreviewWarnings,
        ],
    );

    const actions: CreatorStudioActions = {
        setBrief,
        generateSuggestions,
        requestPreview,
        pickTemplate,
        goToStep,
        linkDelivery,
        requestCourier,
        refreshDeliveryTelemetry,
        shareDropoffLink,
        refreshTemplateRecommendations,
        toggleTemplateLock,
        setBillingInclusive: setBillingInclusiveValue,
        setBillingPartnerLabel: setBillingPartnerLabelValue,
        setPreviewTemplateFilter: setPreviewTemplateFilterValue,
        replayPreviewFromEvent,
    };

    return [state, actions];
};
