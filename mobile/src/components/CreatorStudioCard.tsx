import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Platform,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';

import ModernGPSModal from './ModernGPSModal';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

import { useCreatorStudio } from '../hooks/useCreatorStudio';
import { CreateDeliveryRequestPayload } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { safeStringDisplay } from '../utils/displayHelpers';

const VEHICLE_OPTIONS = [
    {
        id: 1,
        label: 'Moto express',
        description: '<10 kg · <30 cm (livraisons rapides centre-ville)',
    },
    {
        id: 2,
        label: 'Tricycle',
        description: 'Jusqu’à 1 m³ · idéal colis “pas très importants”',
    },
    {
        id: 3,
        label: 'Fourgonnette',
        description: 'Déménagement léger · 3 m³ / 400 kg max',
    },
    {
        id: 4,
        label: 'Camion 4T+',
        description: 'Gros volume / tournée multi-points',
    },
];

const PREVIEW_FILTER_ALL = 'all';
const PREVIEW_FILTER_WARNINGS = 'warnings';

const extractPreviewWarnings = (value: unknown): string[] => {
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
        const maybeArray = (value as { list?: unknown }).list;
        if (Array.isArray(maybeArray)) {
            return maybeArray.filter((entry): entry is string => typeof entry === 'string');
        }
    }
    return [];
};

interface CreatorStudioCardProps {
    serviceName?: string;
    productName?: string;
}

export const CreatorStudioCard: React.FC<CreatorStudioCardProps> = ({
    serviceName,
    productName,
}) => {
    const [state, actions] = useCreatorStudio();
    const [courierError, setCourierError] = useState<string | null>(null);
    const [courierSuccess, setCourierSuccess] = useState<string | null>(null);
    const [pickupAddressInput, setPickupAddressInput] = useState<string>('');
    const [pickupLatitudeInput, setPickupLatitudeInput] = useState<string>('');
    const [pickupLongitudeInput, setPickupLongitudeInput] = useState<string>('');
    const [pickupInstructions, setPickupInstructions] = useState<string>('');
    const [dropoffAddressInput, setDropoffAddressInput] = useState<string>('');
    const [dropoffLatitudeInput, setDropoffLatitudeInput] = useState<string>('');
    const [dropoffLongitudeInput, setDropoffLongitudeInput] = useState<string>('');
    const [dropoffInstructions, setDropoffInstructions] = useState<string>('');
    const [usePassengerMode, setUsePassengerMode] = useState(false);
    const [vehicleTypeId, setVehicleTypeId] = useState<number>(1);
    const [vehicleInitialized, setVehicleInitialized] = useState(false);
    const [scheduledPickupEnabled, setScheduledPickupEnabled] = useState(false);
    const [scheduledPickupInput, setScheduledPickupInput] = useState('');
    const [showPickupGPSModal, setShowPickupGPSModal] = useState(false);
    const [showDropoffGPSModal, setShowDropoffGPSModal] = useState(false);
    const templateSpecs = state.templates;
    const billingInclusive = state.billingInclusive;
    const billingPartnerLabelValue = state.billingPartnerLabel ?? '';
    const merchantLabelFallback =
        (state.sessionMetadata['service_name'] as string | undefined) ??
        serviceName ??
        'Prestataire';
    const previewHistorySource =
        state.previewEventsFiltered && state.previewEventsFiltered.length > 0
            ? state.previewEventsFiltered
            : state.previewEvents;
    const previewFilterOptions = useMemo(() => {
        const unique = new Set<string>();
        state.previewEvents.forEach((event) => {
            if (event.template) {
                unique.add(event.template);
            }
        });
        return [
            PREVIEW_FILTER_ALL,
            PREVIEW_FILTER_WARNINGS,
            ...Array.from(unique),
        ];
    }, [state.previewEvents]);
    const recommendationDetails = useMemo(() => {
        const map = new Map<string, { reasons?: string[] }>();
        state.templateRecommendationDetails.forEach((detail) => {
            map.set(detail.id, { reasons: detail.reasons });
        });
        return map;
    }, [state.templateRecommendationDetails]);

    const inferredLocations = useMemo(() => {
        const toNumber = (value: unknown, fallback: number) => {
            if (typeof value === 'number' && Number.isFinite(value)) {
                return value;
            }
            if (typeof value === 'string') {
                const parsed = Number(value);
                if (!Number.isNaN(parsed)) {
                    return parsed;
                }
            }
            return fallback;
        };

        const pickupLatitude = toNumber(state.sessionMetadata['pickup_latitude'], 3.848);
        const pickupLongitude = toNumber(state.sessionMetadata['pickup_longitude'], 11.502);
        const dropoffLatitude = toNumber(state.sessionMetadata['dropoff_latitude'], 3.871);
        const dropoffLongitude = toNumber(state.sessionMetadata['dropoff_longitude'], 11.518);

        return {
            pickup: {
                latitude: pickupLatitude,
                longitude: pickupLongitude,
                address:
                    (state.sessionMetadata['pickup_address'] as string | undefined) ??
                    'Agence Yukpo · Akwa',
            },
            dropoff: {
                latitude: dropoffLatitude,
                longitude: dropoffLongitude,
                address:
                    (state.sessionMetadata['dropoff_address'] as string | undefined) ??
                    'Client final · Plateau',
            },
        };
    }, [state.sessionMetadata]);

    useEffect(() => {
        if (!vehicleInitialized && state.sessionMetadata['vehicle_type_id']) {
            const existing = Number(state.sessionMetadata['vehicle_type_id']);
            if (Number.isFinite(existing)) {
                setVehicleTypeId(existing);
            }
            setVehicleInitialized(true);
        }
        if (!pickupAddressInput) {
            setPickupAddressInput(inferredLocations.pickup.address ?? '');
        }
        if (!pickupLatitudeInput) {
            setPickupLatitudeInput(String(inferredLocations.pickup.latitude));
        }
        if (!pickupLongitudeInput) {
            setPickupLongitudeInput(String(inferredLocations.pickup.longitude));
        }
        if (!dropoffAddressInput) {
            setDropoffAddressInput(inferredLocations.dropoff.address ?? '');
        }
        if (!dropoffLatitudeInput) {
            setDropoffLatitudeInput(String(inferredLocations.dropoff.latitude));
        }
        if (!dropoffLongitudeInput) {
            setDropoffLongitudeInput(String(inferredLocations.dropoff.longitude));
        }
        const scheduledFromMetadata = state.sessionMetadata['scheduled_pickup_at'];
        if (
            !scheduledPickupEnabled &&
            typeof scheduledFromMetadata === 'string' &&
            scheduledFromMetadata.length > 5
        ) {
            setScheduledPickupEnabled(true);
            setScheduledPickupInput(scheduledFromMetadata.replace('T', ' ').replace('Z', ''));
        }
    }, [
        dropoffAddressInput,
        dropoffLatitudeInput,
        dropoffLongitudeInput,
        inferredLocations.dropoff.address,
        inferredLocations.dropoff.latitude,
        inferredLocations.dropoff.longitude,
        inferredLocations.pickup.address,
        inferredLocations.pickup.latitude,
        inferredLocations.pickup.longitude,
        pickupAddressInput,
        pickupLatitudeInput,
        pickupLongitudeInput,
        scheduledPickupEnabled,
        state.sessionMetadata,
        vehicleInitialized,
    ]);

    const buildCourierPayload = useCallback((): CreateDeliveryRequestPayload => {
        const parseCoord = (value: string, fallback: number, label: string): number => {
            if (!value?.trim()) {
                return fallback;
            }
            const normalized = Number(value.replace(',', '.'));
            if (Number.isFinite(normalized)) {
                return normalized;
            }
            throw new Error(`Coordonnée ${label} invalide`);
        };

        const ensureAddress = (value: string, fallback: string, label: string): string => {
            const trimmed = value?.trim();
            if (trimmed && trimmed.length >= 3) {
                return trimmed;
            }
            if (fallback && fallback.length >= 3) {
                return fallback;
            }
            throw new Error(`Adresse ${label} requise`);
        };

        const pickup = {
            latitude: parseCoord(
                pickupLatitudeInput,
                inferredLocations.pickup.latitude,
                'pickup latitude',
            ),
            longitude: parseCoord(
                pickupLongitudeInput,
                inferredLocations.pickup.longitude,
                'pickup longitude',
            ),
            address: ensureAddress(
                pickupAddressInput,
                inferredLocations.pickup.address ?? '',
                'pickup',
            ),
        };

        const dropoff = {
            latitude: parseCoord(
                dropoffLatitudeInput,
                inferredLocations.dropoff.latitude,
                'dropoff latitude',
            ),
            longitude: parseCoord(
                dropoffLongitudeInput,
                inferredLocations.dropoff.longitude,
                'dropoff longitude',
            ),
            address: ensureAddress(
                dropoffAddressInput,
                inferredLocations.dropoff.address ?? '',
                'dropoff',
            ),
        };

        let normalizedScheduledPickup: string | undefined;
        if (scheduledPickupEnabled) {
            const trimmed = scheduledPickupInput.trim();
            if (!trimmed) {
                throw new Error('Indique une date/heure de prise en charge planifiée.');
            }
            const parsed = new Date(trimmed);
            if (Number.isNaN(parsed.getTime())) {
                throw new Error('Format date/heure pickup invalide. Utilise AAAA-MM-JJ HH:MM.');
            }
            normalizedScheduledPickup = parsed.toISOString();
        }

        return {
            parcel: {
                type_id: usePassengerMode ? 99 : vehicleTypeId,
                weight_kg: usePassengerMode ? 80 : vehicleTypeId >= 3 ? 150 : 10,
                notes: usePassengerMode
                    ? `Transport passager depuis Studio · ${state.brief || 'Brief court'}`
                    : state.brief || 'Livraison express depuis le Studio',
                photos: [],
                constraints: {
                    studio_template: state.template,
                    passenger_mode: usePassengerMode,
                },
            },
            pickup,
            dropoff,
            metadata: {
                studio_session_id: state.sessionId,
                studio_brief_excerpt: state.brief?.slice(0, 240),
                studio_distribution_plan: state.distributionPlan,
                pickup_instructions: pickupInstructions?.trim() || undefined,
                dropoff_instructions: dropoffInstructions?.trim() || undefined,
                requested_delivery_mode: usePassengerMode ? 'passenger' : 'parcel',
                vehicle_type_id: vehicleTypeId,
                scheduled_pickup_at: normalizedScheduledPickup,
                billing_mode: billingInclusive ? 'merchant_inclusive' : 'standard',
                billing_partner_label: billingInclusive
                    ? billingPartnerLabelValue || merchantLabelFallback
                    : undefined,
            },
            initial_event_payload: {
                source: 'creator_studio_mobile',
                passenger_mode: usePassengerMode,
                pickup_instructions: pickupInstructions?.trim() || undefined,
                dropoff_instructions: dropoffInstructions?.trim() || undefined,
                vehicle_type_id: vehicleTypeId,
                scheduled_pickup_at: normalizedScheduledPickup,
            },
        };
    }, [
        dropoffAddressInput,
        dropoffInstructions,
        dropoffLatitudeInput,
        dropoffLongitudeInput,
        inferredLocations.dropoff,
        inferredLocations.pickup,
        pickupAddressInput,
        pickupInstructions,
        pickupLatitudeInput,
        pickupLongitudeInput,
        scheduledPickupEnabled,
        scheduledPickupInput,
        billingInclusive,
        billingPartnerLabelValue,
        merchantLabelFallback,
        state.brief,
        state.distributionPlan,
        state.sessionId,
        state.template,
        usePassengerMode,
        vehicleTypeId,
    ]);

    const handleRequestCourier = useCallback(async () => {
        try {
            setCourierError(null);
            const payload = buildCourierPayload();
            const deliveryId = await actions.requestCourier(payload);
            setCourierSuccess(`Livraison #${deliveryId?.slice(0, 8) ?? ''} créée`);
            Alert.alert('Coursier demandé', `Livraison ${deliveryId?.slice(0, 8)} en file de matching.`);
        } catch (err) {
            const message = (err as Error)?.message ?? 'Impossible de créer la livraison.';
            setCourierError(message);
        }
    }, [actions, buildCourierPayload]);

    const handleRefreshTracking = useCallback(() => {
        actions.refreshDeliveryTelemetry().catch((err: any) => {
            const message = err?.message || "Rafraîchissement tracking impossible pour le moment.";
            setCourierError(message);
            console.error('[CreatorStudioCard] Erreur refresh tracking:', err);
        });
    }, [actions]);

    const handleGenerateSuggestions = useCallback(async () => {
        try {
            setCourierError(null);
            await actions.generateSuggestions();
        } catch (err: any) {
            const message = err?.message || 'Impossible de générer les suggestions IA.';
            setCourierError(message);
            console.error('[CreatorStudioCard] Erreur suggestions:', err);
            Alert.alert('Erreur', message);
        }
    }, [actions]);

    const handleRequestPreview = useCallback(async () => {
        try {
            setCourierError(null);
            await actions.requestPreview();
        } catch (err: any) {
            const message = err?.message || 'Impossible de générer la prévisualisation.';
            setCourierError(message);
            console.error('[CreatorStudioCard] Erreur preview:', err);
            Alert.alert('Erreur', message);
        }
    }, [actions]);

    return (
        <NativeCard style={styles.card}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.kicker}>Studio créateur Yukpo</Text>
                    <Text style={styles.title}>Preview intelligente</Text>
                    <Text style={styles.subtitle}>
                        {safeStringDisplay(serviceName, 'Service')} · {safeStringDisplay(productName, 'Produit')}
                    </Text>
                </View>
                <View style={styles.badge}>
                    <SafeIcon name="sparkles" size={16} color={modernColors.primary} />
                    <Text style={styles.badgeText}>{state.currentStep.toUpperCase()}</Text>
                </View>
            </View>

            {state.sessionLoading && (
                <View style={styles.sessionStatus}>
                    <ActivityIndicator size="small" color="#e0e9ff" />
                    <Text style={styles.sessionStatusText}>Connexion au studio…</Text>
                </View>
            )}
            {state.error && !state.sessionLoading && (
                <View style={styles.errorBanner}>
                    <SafeIcon name="alert-triangle" size={14} color="#ffb4b4" />
                    <Text style={styles.errorText}>{state.error}</Text>
                </View>
            )}

            <Text style={styles.sectionLabel}>Brief & recommandations IA</Text>
            <TextInput
                style={styles.briefInput}
                placeholder="Décris ton service, les bénéfices, CTA, délais..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                multiline
                value={state.brief}
                onChangeText={actions.setBrief}
                editable={!state.sessionLoading}
            />

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        (state.previewLoading || state.sessionLoading) && styles.actionButtonDisabled,
                    ]}
                    onPress={handleGenerateSuggestions}
                    disabled={state.previewLoading || state.sessionLoading}
                >
                    {state.previewLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.actionText}>Suggestions IA</Text>
                    )}
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        (state.previewLoading || state.sessionLoading) && styles.actionButtonDisabled,
                    ]}
                    onPress={handleRequestPreview}
                    disabled={state.previewLoading || state.sessionLoading}
                >
                    {state.previewLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.actionText}>Preview 5s</Text>
                    )}
                </TouchableOpacity>
            </View>

            {state.aiSuggestions.length > 0 && (
                <View style={styles.suggestions}>
                    {state.aiSuggestions.slice(0, 2).map((suggestion) => (
                        <Text key={suggestion} style={styles.suggestionText}>
                            • {suggestion}
                        </Text>
                    ))}
                </View>
            )}

            <Text style={styles.sectionLabel}>Templates</Text>
            <View style={styles.templateControls}>
                <TouchableOpacity
                    style={[
                        styles.templateRefreshButton,
                        state.templateRecommendationsLoading && styles.templateRefreshDisabled,
                    ]}
                    disabled={state.templateRecommendationsLoading}
                    onPress={() => {
                        void actions.refreshTemplateRecommendations();
                    }}
                >
                    {state.templateRecommendationsLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.templateRefreshText}>Reco IA</Text>
                    )}
                </TouchableOpacity>
                <View style={styles.templateLockControl}>
                    <Text style={styles.templateLockLabel}>
                        {state.templateLockEnabled ? 'Verrouillé' : 'Auto'}
                    </Text>
                    <Switch
                        value={state.templateLockEnabled}
                        onValueChange={(value) => {
                            void actions.toggleTemplateLock(value);
                        }}
                        trackColor={{ false: '#4b5563', true: modernColors.primary }}
                        thumbColor="#fff"
                    />
                </View>
            </View>
            <View style={styles.templatesRow}>
                {state.templatesLoading ? (
                    <Text style={styles.loadingTemplates}>Chargement des templates…</Text>
                ) : (
                    templateSpecs.map((spec) => {
                        const active = spec.id === state.template;
                        const recommendationRank = state.templateRecommendations.indexOf(spec.id);
                        const detail = recommendationDetails.get(spec.id);
                        return (
                            <TouchableOpacity
                                key={spec.id}
                                style={[
                                    styles.templateBadge,
                                    active && styles.templateBadgeActive,
                                    state.sessionLoading && styles.templateBadgeDisabled,
                                ]}
                                onPress={() => actions.pickTemplate(spec.id)}
                                disabled={state.sessionLoading}
                            >
                                <Text style={[styles.templateText, active && styles.templateTextActive]}>
                                    {spec.label}
                                </Text>
                                <Text style={styles.templateMeta}>
                                    {spec.suggestedScenes} scènes · ~{spec.defaultDurationSeconds}s
                                </Text>
                                <View style={styles.templateBadgeFooter}>
                                    {recommendationRank >= 0 && (
                                        <Text style={styles.templateBadgeRank}>
                                            #{recommendationRank + 1}
                                        </Text>
                                    )}
                                    {state.templateLockTemplate === spec.id && (
                                        <Text style={styles.templateBadgeRank}>LOCK</Text>
                                    )}
                                </View>
                                {detail?.reasons && detail.reasons.length > 0 && (
                                    <Text style={styles.templateReason}>
                                        {detail.reasons.slice(0, 2).join(' · ')}
                                    </Text>
                                )}
                            </TouchableOpacity>
                        );
                    })
                )}
            </View>
            <Text style={styles.templateComparison}>
                Recommandé : {state.bestRecommendedTemplate ?? '—'} · Choisi :{' '}
                {state.template ?? '—'}
            </Text>

            <Text style={styles.sectionLabel}>Historique preview</Text>
            <View style={styles.previewHistoryHeader}>
                {state.hasPreviewWarnings && (
                    <View style={styles.warningBadge}>
                        <SafeIcon name="alert-triangle" size={12} color="#facc15" />
                        <Text style={styles.warningBadgeText}>Warnings</Text>
                    </View>
                )}
                <View style={styles.previewFilters}>
                    {previewFilterOptions.map((filter) => {
                        const active = state.previewTemplateFilter === filter;
                        const label =
                            filter === PREVIEW_FILTER_ALL
                                ? 'Tous'
                                : filter === PREVIEW_FILTER_WARNINGS
                                    ? 'Warnings'
                                    : filter;
                        return (
                            <TouchableOpacity
                                key={filter}
                                style={[styles.previewFilterChip, active && styles.previewFilterChipActive]}
                                onPress={() => actions.setPreviewTemplateFilter(filter)}
                            >
                                <Text
                                    style={[
                                        styles.previewFilterText,
                                        active && styles.previewFilterTextActive,
                                    ]}
                                >
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
            <View style={styles.previewHistory}>
                {state.previewEventsLoading ? (
                    <ActivityIndicator color="#94a3b8" size="small" />
                ) : previewHistorySource.length === 0 ? (
                    <Text style={styles.previewHistoryEmpty}>Aucun aperçu enregistré.</Text>
                ) : (
                    previewHistorySource.slice(0, 4).map((event) => {
                        const warnings = extractPreviewWarnings(event.warnings);
                        return (
                            <View key={event.id} style={styles.previewHistoryItem}>
                                <View style={styles.previewHistoryRow}>
                                    <View>
                                        <Text style={styles.previewHistoryTemplate}>
                                            {event.template ?? 'Timeline manuelle'}
                                        </Text>
                                        <Text style={styles.previewHistoryDate}>
                                            {new Date(event.created_at).toLocaleTimeString('fr-FR', {
                                                hour: '2-digit',
                                                minute: '2-digit',
                                            })}
                                        </Text>
                                    </View>
                                    <TouchableOpacity
                                        style={styles.previewHistoryAction}
                                        onPress={() => actions.replayPreviewFromEvent(event.id)}
                                        disabled={state.previewLoading || state.sessionLoading}
                                    >
                                        <SafeIcon name="repeat" size={12} color="#60a5fa" />
                                        <Text style={styles.previewHistoryActionText}>Relancer</Text>
                                    </TouchableOpacity>
                                </View>
                                <Text style={styles.previewHistoryMeta}>
                                    {event.clip_count} clips · ~{event.duration_seconds}s · {event.status}
                                </Text>
                                {warnings.length > 0 && (
                                    <Text style={styles.previewWarningText}>⚠ {warnings.join(' · ')}</Text>
                                )}
                            </View>
                        );
                    })
                )}
            </View>

            {state.previewReady && (
                <View style={styles.previewReady}>
                    <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                    <Text style={styles.previewText}>Preview prête · Timeline estimée 6 scènes / 28s</Text>
                </View>
            )}
            {!state.previewReady && state.sessionId && (
                <Text style={styles.previewHint}>
                    Session #{state.sessionId.slice(0, 6)} · appuie sur “Preview 5s” pour générer un aperçu.
                </Text>
            )}
            <Text style={styles.sectionLabel}>Pickup & dropoff (formulaire avancé)</Text>
            <View style={styles.vehicleSelector}>
                <Text style={styles.formKicker}>Type de véhicule</Text>
                {Platform.OS === 'ios' ? (
                    <TouchableOpacity
                        style={styles.pickerButton}
                        onPress={() => {
                            Alert.alert(
                                'Type de véhicule',
                                'Choisissez un type de véhicule',
                                VEHICLE_OPTIONS.map((option) => ({
                                    text: `${option.label} - ${option.description}`,
                                    onPress: () => {
                                        setVehicleTypeId(option.id);
                                        setCourierSuccess(null);
                                    },
                                    style: option.id === vehicleTypeId ? 'default' : undefined,
                                })),
                            );
                        }}
                    >
                        <Text style={styles.pickerButtonText}>
                            {VEHICLE_OPTIONS.find((o) => o.id === vehicleTypeId)?.label || 'Sélectionner...'}
                        </Text>
                        <SafeIcon name="chevron-down" size={16} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                ) : (
                    <View style={styles.vehicleChips}>
                        {VEHICLE_OPTIONS.map((option) => {
                            const active = option.id === vehicleTypeId;
                            return (
                                <TouchableOpacity
                                    key={option.id}
                                    style={[styles.vehicleChip, active && styles.vehicleChipActive]}
                                    onPress={() => {
                                        setVehicleTypeId(option.id);
                                        setCourierSuccess(null);
                                    }}
                                >
                                    <Text
                                        style={[
                                            styles.vehicleChipLabel,
                                            active && styles.vehicleChipLabelActive,
                                        ]}
                                    >
                                        {option.label}
                                    </Text>
                                    <Text style={styles.vehicleChipDescription}>{option.description}</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                )}
            </View>
            <View style={styles.locationForm}>
                <View style={styles.locationBlock}>
                    <View style={styles.locationHeaderRow}>
                        <Text style={styles.formKicker}>Point de collecte</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowPickupGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>GPS</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.locationInput}
                        placeholder="Adresse pickup"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={pickupAddressInput}
                        onChangeText={(value) => {
                            setPickupAddressInput(value);
                            setCourierSuccess(null);
                        }}
                    />
                    <View style={styles.coordsRow}>
                        <View style={styles.coordField}>
                            <Text style={styles.coordLabel}>Latitude</Text>
                            <TextInput
                                style={styles.coordInput}
                                keyboardType="numeric"
                                value={pickupLatitudeInput}
                                onChangeText={(value) => {
                                    setPickupLatitudeInput(value);
                                    setCourierSuccess(null);
                                }}
                                placeholder="Ex: 3.848"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                            />
                        </View>
                        <View style={styles.coordField}>
                            <Text style={styles.coordLabel}>Longitude</Text>
                            <TextInput
                                style={styles.coordInput}
                                keyboardType="numeric"
                                value={pickupLongitudeInput}
                                onChangeText={(value) => {
                                    setPickupLongitudeInput(value);
                                    setCourierSuccess(null);
                                }}
                                placeholder="Ex: 11.502"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                            />
                        </View>
                    </View>
                    <TextInput
                        style={[styles.locationInput, styles.instructionsInput]}
                        placeholder="Instructions pickup (code portail, étage...)"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={pickupInstructions}
                        onChangeText={(value) => {
                            setPickupInstructions(value);
                            setCourierSuccess(null);
                        }}
                        multiline
                    />
                </View>

                <View style={styles.locationBlock}>
                    <View style={styles.locationHeaderRow}>
                        <Text style={styles.formKicker}>Point de livraison</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowDropoffGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={14} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>GPS</Text>
                        </TouchableOpacity>
                    </View>
                    <TextInput
                        style={styles.locationInput}
                        placeholder="Adresse dropoff"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={dropoffAddressInput}
                        onChangeText={(value) => {
                            setDropoffAddressInput(value);
                            setCourierSuccess(null);
                        }}
                    />
                    <View style={styles.coordsRow}>
                        <View style={styles.coordField}>
                            <Text style={styles.coordLabel}>Latitude</Text>
                            <TextInput
                                style={styles.coordInput}
                                keyboardType="numeric"
                                value={dropoffLatitudeInput}
                                onChangeText={(value) => {
                                    setDropoffLatitudeInput(value);
                                    setCourierSuccess(null);
                                }}
                                placeholder="Ex: 3.871"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                            />
                        </View>
                        <View style={styles.coordField}>
                            <Text style={styles.coordLabel}>Longitude</Text>
                            <TextInput
                                style={styles.coordInput}
                                keyboardType="numeric"
                                value={dropoffLongitudeInput}
                                onChangeText={(value) => {
                                    setDropoffLongitudeInput(value);
                                    setCourierSuccess(null);
                                }}
                                placeholder="Ex: 11.518"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                            />
                        </View>
                    </View>
                    <TextInput
                        style={[styles.locationInput, styles.instructionsInput]}
                        placeholder="Instructions dropoff (digicode, contact secondaire...)"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        value={dropoffInstructions}
                        onChangeText={(value) => {
                            setDropoffInstructions(value);
                            setCourierSuccess(null);
                        }}
                        multiline
                    />
                </View>

                <View style={styles.passengerToggle}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.passengerTitle}>Mode transport passager</Text>
                        <Text style={styles.passengerSubtitle}>
                            Utilise la même file delivery mais taggue la requête pour transporter un passager.
                        </Text>
                    </View>
                    <Switch
                        value={usePassengerMode}
                        onValueChange={(value) => {
                            setUsePassengerMode(value);
                            setCourierSuccess(null);
                        }}
                        trackColor={{ false: 'rgba(148,163,184,0.4)', true: '#34d399' }}
                        thumbColor={usePassengerMode ? '#065f46' : '#1e293b'}
                    />
                </View>

                <View style={styles.scheduleBlock}>
                    <View style={styles.scheduleHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.passengerTitle}>Pickup programmé</Text>
                            <Text style={styles.passengerSubtitle}>
                                Planifie la prise en charge (ex. “demain 14h”) pour laisser le matching doux.
                            </Text>
                        </View>
                        <Switch
                            value={scheduledPickupEnabled}
                            onValueChange={(value) => {
                                setScheduledPickupEnabled(value);
                                if (!value) {
                                    setScheduledPickupInput('');
                                }
                                setCourierSuccess(null);
                            }}
                            trackColor={{ false: 'rgba(148,163,184,0.4)', true: '#facc15' }}
                            thumbColor={scheduledPickupEnabled ? '#78350f' : '#1e293b'}
                        />
                    </View>
                    {scheduledPickupEnabled && (
                        <TextInput
                            style={styles.scheduleInput}
                            placeholder="2025-11-15 14:30"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={scheduledPickupInput}
                            onChangeText={(value) => {
                                setScheduledPickupInput(value);
                                setCourierSuccess(null);
                            }}
                        />
                    )}
                </View>
                <View style={styles.billingBlock}>
                    <View style={styles.scheduleHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.passengerTitle}>Livraison incluse dans le tarif</Text>
                            <Text style={styles.passengerSubtitle}>
                                Aucun débit client (transport facturé au marchand / fournisseur).
                            </Text>
                        </View>
                        <Switch
                            value={billingInclusive}
                            onValueChange={(value) => {
                                actions.setBillingInclusive(value);
                                setCourierSuccess(null);
                            }}
                            trackColor={{ false: 'rgba(148,163,184,0.4)', true: '#34d399' }}
                            thumbColor={billingInclusive ? '#064e3b' : '#1e293b'}
                        />
                    </View>
                    {billingInclusive && (
                        <TextInput
                            style={styles.locationInput}
                            placeholder="Nom du marchand / service"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={billingPartnerLabelValue}
                            onChangeText={(value) => {
                                actions.setBillingPartnerLabel(value);
                                setCourierSuccess(null);
                            }}
                            editable={billingInclusive}
                        />
                    )}
                </View>
            </View>
            <View style={styles.deliveryActions}>
                <TouchableOpacity
                    style={[
                        styles.primaryAction,
                        state.deliveryActionLoading && styles.primaryActionDisabled,
                    ]}
                    onPress={handleRequestCourier}
                    disabled={state.deliveryActionLoading}
                >
                    {state.deliveryActionLoading ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.primaryActionText}>
                            {state.deliveryId ? 'Dupliquer la livraison' : 'Demander un coursier'}
                        </Text>
                    )}
                </TouchableOpacity>
                <View style={styles.secondaryActionsRow}>
                    <TouchableOpacity
                        style={[
                            styles.secondaryAction,
                            !state.deliveryId && styles.secondaryActionDisabled,
                        ]}
                        onPress={handleRefreshTracking}
                        disabled={!state.deliveryId}
                    >
                        <SafeIcon name="refresh-cw" size={14} color="#93c5fd" />
                        <Text style={styles.secondaryActionText}>Rafraîchir tracking</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.secondaryAction,
                            (!state.deliveryId || state.dropoffPending) && styles.secondaryActionDisabled,
                        ]}
                        onPress={() => {
                            actions
                                .shareDropoffLink()
                                .then(() => setCourierSuccess('Lien destinataire généré.'))
                                .catch(() => {
                                    /* erreur déjà gérée dans le hook */
                                });
                        }}
                        disabled={!state.deliveryId || state.dropoffPending}
                    >
                        <SafeIcon name="share-2" size={14} color="#bfdbfe" />
                        <Text style={styles.secondaryActionText}>
                            {state.dropoffPending ? 'Lien en attente' : 'Partager localisation client'}
                        </Text>
                    </TouchableOpacity>
                </View>
                {state.dropoffShareLink && (
                    <View style={styles.shareLink}>
                        <Text style={styles.shareLinkLabel}>Lien client à partager</Text>
                        <Text style={styles.shareLinkValue} selectable numberOfLines={2}>
                            {state.dropoffShareLink}
                        </Text>
                    </View>
                )}
                {courierSuccess && <Text style={styles.successText}>{courierSuccess}</Text>}
                {courierError && <Text style={styles.deliveryErrorText}>{courierError}</Text>}
            </View>
            {state.deliveryId && (
                <View style={styles.deliverySection}>
                    <View style={styles.deliveryHeaderRow}>
                        <View style={styles.deliveryHeaderLeft}>
                            <SafeIcon name="map-pin" size={16} color={modernColors.primary} />
                            <Text style={styles.deliveryTitle}>Livraison temps réel</Text>
                        </View>
                        <View
                            style={[
                                styles.deliveryBadgeContainer,
                                state.deliveryRealtimeConnected && styles.deliveryBadgeOnline,
                            ]}
                        >
                            <Text style={styles.deliveryBadgeLabel}>
                                {state.deliveryRealtimeConnected
                                    ? 'En direct'
                                    : state.deliveryRealtimeConnecting
                                        ? 'Connexion…'
                                        : 'Hors ligne'}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.deliverySubtitle}>
                        #{state.deliveryId.slice(0, 8)} · {state.deliveryStatus ?? 'pending'}
                    </Text>
                    <View style={styles.deliveryStatsRow}>
                        <View style={styles.deliveryStat}>
                            <Text style={styles.deliveryStatLabel}>ETA</Text>
                            <Text style={styles.deliveryStatValue}>
                                {state.deliveryEtaMinutes ? `${state.deliveryEtaMinutes} min` : '—'}
                            </Text>
                        </View>
                        <View style={styles.deliveryStat}>
                            <Text style={styles.deliveryStatLabel}>Tarif estimé</Text>
                            <Text style={styles.deliveryStatValue}>
                                {formatCurrency(state.deliveryPricing?.estimated)}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.deliveryTimeline}>
                        {state.deliveryTimeline.length === 0 ? (
                            <Text style={styles.deliveryTimelineEmpty}>
                                En attente des premiers évènements.
                            </Text>
                        ) : (
                            state.deliveryTimeline.slice(-3).map((checkpoint) => (
                                <View key={checkpoint.timestamp} style={styles.deliveryTimelineItem}>
                                    <Text style={styles.deliveryTimelineStatus}>{checkpoint.status}</Text>
                                    <Text style={styles.deliveryTimelineTime}>
                                        {new Date(checkpoint.timestamp).toLocaleTimeString('fr-FR', {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </Text>
                                </View>
                            ))
                        )}
                    </View>
                    {state.deliveryRealtimeError && (
                        <Text style={styles.deliveryErrorText}>{state.deliveryRealtimeError}</Text>
                    )}
                </View>
            )}

            <ModernGPSModal
                visible={showPickupGPSModal}
                onClose={() => setShowPickupGPSModal(false)}
                onSelect={(coordinatesString) => {
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                            setPickupLatitudeInput(lat.toString());
                            setPickupLongitudeInput(lng.toString());
                        }
                    }
                    setShowPickupGPSModal(false);
                }}
                currentLocation={
                    pickupLatitudeInput && pickupLongitudeInput
                        ? {
                            lat: parseFloat(pickupLatitudeInput) || 0,
                            lng: parseFloat(pickupLongitudeInput) || 0,
                        }
                        : undefined
                }
                title="Sélection du point de collecte"
                allowZoneSelection={false}
            />

            <ModernGPSModal
                visible={showDropoffGPSModal}
                onClose={() => setShowDropoffGPSModal(false)}
                onSelect={(coordinatesString) => {
                    const firstPoint = coordinatesString.split('|')[0].split(',');
                    if (firstPoint.length === 2) {
                        const lat = parseFloat(firstPoint[0]);
                        const lng = parseFloat(firstPoint[1]);
                        if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
                            setDropoffLatitudeInput(lat.toString());
                            setDropoffLongitudeInput(lng.toString());
                        }
                    }
                    setShowDropoffGPSModal(false);
                }}
                currentLocation={
                    dropoffLatitudeInput && dropoffLongitudeInput
                        ? {
                            lat: parseFloat(dropoffLatitudeInput) || 0,
                            lng: parseFloat(dropoffLongitudeInput) || 0,
                        }
                        : undefined
                }
                title="Sélection du point de livraison"
                allowZoneSelection={false}
            />
        </NativeCard>
    );
};

const formatCurrency = (value?: number | null, currency = 'XAF') => {
    if (typeof value !== 'number') {
        return '—';
    }
    const rounded = Math.round(value);
    return `${rounded.toLocaleString('fr-CM')} ${currency}`;
};

const styles = StyleSheet.create({
    card: {
        padding: 16,
        backgroundColor: '#0b1123',
        borderColor: 'rgba(255,255,255,0.08)',
        marginBottom: 12,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    kicker: {
        fontSize: 12,
        letterSpacing: 2,
        textTransform: 'uppercase',
        color: 'rgba(129, 167, 255, 0.85)',
    },
    title: {
        marginTop: 4,
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    subtitle: {
        marginTop: 2,
        fontSize: 13,
        color: 'rgba(255,255,255,0.7)',
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 999,
        paddingVertical: 6,
        paddingHorizontal: 12,
        gap: 6,
    },
    badgeText: {
        fontSize: 11,
        color: '#fff',
    },
    sectionLabel: {
        marginTop: 14,
        fontSize: 12,
        letterSpacing: 1,
        color: 'rgba(255,255,255,0.65)',
    },
    briefInput: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 16,
        padding: 12,
        color: '#fff',
        minHeight: 90,
        textAlignVertical: 'top',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
    },
    actionButton: {
        flex: 1,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(129,167,255,0.4)',
        paddingVertical: 10,
        alignItems: 'center',
    },
    actionButtonDisabled: {
        opacity: 0.5,
    },
    actionText: {
        color: '#e0e9ff',
        fontSize: 13,
        fontWeight: '600',
    },
    suggestions: {
        marginTop: 8,
        gap: 4,
    },
    suggestionText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    templatesRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    templateControls: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8,
        gap: 12,
    },
    templateRefreshButton: {
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.25)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    templateRefreshDisabled: {
        opacity: 0.4,
    },
    templateRefreshText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    templateLockControl: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    templateLockLabel: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    templateBadge: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
        borderRadius: 999,
        paddingHorizontal: 14,
        paddingVertical: 6,
    },
    templateBadgeActive: {
        borderColor: 'rgba(129,235,193,0.65)',
        backgroundColor: 'rgba(129,235,193,0.08)',
    },
    templateBadgeDisabled: {
        opacity: 0.5,
    },
    templateText: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.7)',
    },
    templateTextActive: {
        color: '#81ebc1',
        fontWeight: '600',
    },
    templateMeta: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
    },
    templateBadgeFooter: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 4,
    },
    templateBadgeRank: {
        fontSize: 10,
        color: '#fcd34d',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    templateReason: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.45)',
        marginTop: 2,
    },
    templateComparison: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.75)',
        marginTop: 6,
    },
    previewHistoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
    },
    warningBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(250,204,21,0.4)',
        backgroundColor: 'rgba(250,204,21,0.08)',
    },
    warningBadgeText: {
        color: '#fde68a',
        fontSize: 11,
        fontWeight: '600',
    },
    previewFilters: {
        flexDirection: 'row',
        gap: 6,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
    },
    previewFilterChip: {
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.4)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    previewFilterChipActive: {
        borderColor: '#93c5fd',
        backgroundColor: 'rgba(147,197,253,0.15)',
    },
    previewFilterText: {
        color: 'rgba(148,163,184,0.9)',
        fontSize: 11,
    },
    previewFilterTextActive: {
        color: '#e0f2fe',
        fontWeight: '600',
    },
    previewHistory: {
        marginTop: 8,
        gap: 8,
    },
    previewHistoryEmpty: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.5)',
    },
    previewHistoryItem: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        padding: 10,
        backgroundColor: 'rgba(15,23,42,0.6)',
    },
    previewHistoryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    previewHistoryTemplate: {
        fontSize: 12,
        fontWeight: '600',
        color: '#fff',
    },
    previewHistoryDate: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
    },
    previewHistoryMeta: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
        marginTop: 4,
    },
    previewHistoryAction: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(96,165,250,0.4)',
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    previewHistoryActionText: {
        color: '#93c5fd',
        fontSize: 11,
        fontWeight: '600',
    },
    previewWarningText: {
        fontSize: 11,
        color: '#facc15',
        marginTop: 4,
    },
    loadingTemplates: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    previewReady: {
        marginTop: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(129,235,193,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(129,235,193,0.4)',
        borderRadius: 16,
        padding: 12,
    },
    previewText: {
        color: '#d5ffe8',
        fontSize: 12,
    },
    previewHint: {
        marginTop: 8,
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    locationForm: {
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 12,
        backgroundColor: 'rgba(15,23,42,0.65)',
        gap: 16,
    },
    vehicleSelector: {
        marginTop: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 16,
        padding: 12,
        backgroundColor: 'rgba(12,17,32,0.8)',
        gap: 10,
    },
    vehicleChips: {
        gap: 8,
    },
    vehicleChip: {
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.25)',
        borderRadius: 14,
        padding: 12,
        backgroundColor: 'rgba(15,23,42,0.4)',
    },
    vehicleChipActive: {
        borderColor: 'rgba(99,102,241,0.7)',
        backgroundColor: 'rgba(99,102,241,0.1)',
    },
    vehicleChipLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.8)',
    },
    vehicleChipLabelActive: {
        color: '#fff',
    },
    vehicleChipDescription: {
        marginTop: 2,
        fontSize: 11,
        color: 'rgba(255,255,255,0.65)',
    },
    locationBlock: {
        gap: 8,
    },
    locationHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    formKicker: {
        fontSize: 12,
        letterSpacing: 1,
        textTransform: 'uppercase',
        color: 'rgba(147,197,253,0.9)',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.5)',
        backgroundColor: 'rgba(99,102,241,0.1)',
    },
    gpsButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: modernColors.primary,
    },
    pickerButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 12,
        backgroundColor: 'rgba(15,23,42,0.4)',
        marginTop: 8,
    },
    pickerButtonText: {
        fontSize: 14,
        color: '#fff',
        flex: 1,
    },
    locationInput: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#fff',
    },
    coordsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    coordField: {
        flex: 1,
    },
    coordLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginBottom: 4,
    },
    coordInput: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 8,
        color: '#fff',
    },
    instructionsInput: {
        minHeight: 48,
    },
    passengerToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.3)',
        borderRadius: 14,
        padding: 12,
    },
    passengerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#fff',
    },
    passengerSubtitle: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 2,
    },
    scheduleBlock: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        padding: 12,
        backgroundColor: 'rgba(12,17,32,0.85)',
        gap: 10,
    },
    scheduleHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    scheduleInput: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        color: '#fff',
    },
    billingBlock: {
        borderWidth: 1,
        borderColor: 'rgba(34,197,94,0.25)',
        borderRadius: 14,
        padding: 12,
        backgroundColor: 'rgba(6,78,59,0.35)',
        gap: 10,
    },
    deliveryActions: {
        marginTop: 16,
        gap: 8,
    },
    primaryAction: {
        borderRadius: 14,
        backgroundColor: '#4338ca',
        paddingVertical: 12,
        alignItems: 'center',
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    primaryActionDisabled: {
        opacity: 0.6,
    },
    primaryActionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    secondaryAction: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(147,197,253,0.5)',
        paddingVertical: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    secondaryActionText: {
        color: '#93c5fd',
        fontSize: 13,
        fontWeight: '600',
    },
    secondaryActionDisabled: {
        opacity: 0.5,
    },
    secondaryActionsRow: {
        flexDirection: 'row',
        gap: 8,
    },
    successText: {
        fontSize: 12,
        color: '#c6f6d5',
    },
    deliverySection: {
        marginTop: 16,
        borderWidth: 1,
        borderColor: 'rgba(99,102,241,0.3)',
        borderRadius: 16,
        padding: 12,
        backgroundColor: 'rgba(99,102,241,0.08)',
        gap: 8,
    },
    deliveryHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    deliveryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    deliveryTitle: {
        color: '#fff',
        fontWeight: '600',
        fontSize: 13,
    },
    deliveryBadgeContainer: {
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: 'rgba(148,163,184,0.5)',
    },
    deliveryBadgeOnline: {
        borderColor: 'rgba(34,197,94,0.7)',
        backgroundColor: 'rgba(22,163,74,0.15)',
    },
    deliveryBadgeLabel: {
        color: '#fff',
        fontSize: 11,
    },
    deliverySubtitle: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
    },
    deliveryStatsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4,
    },
    deliveryStat: {
        flex: 1,
    },
    deliveryStatLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
    },
    deliveryStatValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    deliveryTimeline: {
        marginTop: 8,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        padding: 8,
        gap: 6,
        backgroundColor: 'rgba(15,23,42,0.5)',
    },
    deliveryTimelineItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    deliveryTimelineStatus: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    deliveryTimelineTime: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 11,
    },
    deliveryTimelineEmpty: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
    },
    deliveryErrorText: {
        marginTop: 4,
        fontSize: 11,
        color: '#fecaca',
    },
    shareLink: {
        marginTop: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(59,130,246,0.4)',
        padding: 10,
        backgroundColor: 'rgba(30,64,175,0.35)',
    },
    shareLinkLabel: {
        fontSize: 11,
        color: 'rgba(191,219,254,0.9)',
        textTransform: 'uppercase',
        letterSpacing: 1,
    },
    shareLinkValue: {
        marginTop: 4,
        color: '#eff6ff',
        fontSize: 13,
    },
    sessionStatus: {
        marginTop: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sessionStatusText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
    },
    errorBanner: {
        marginTop: 12,
        padding: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255,77,109,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,77,109,0.3)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    errorText: {
        color: '#ffb4b4',
        fontSize: 12,
        flex: 1,
    },
});

