import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary } from '../../types/delivery';
import SafeIcon from '../SafeIcon';
import { NativeBadge, NativeButton, NativeCard } from '../SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface ActiveDeliveryCardProps {
    delivery: DeliverySummary;
    onTrackPress: (deliveryId: string) => void;
    onEditPress: (deliveryId: string) => void;
}

const statusColorMap: Record<string, string> = {
    pending: modernColors.warning,
    requested: modernColors.warning,
    awaiting_courier: modernColors.warning,
    awaiting_courier_confirmation: modernColors.warning,
    assigned: modernColors.info,
    accepted: modernColors.info,
    en_route_pickup: modernColors.info,
    arrival_pickup: modernColors.info,
    picked_up: modernColors.info,
    shopping_pending: modernColors.info,
    shopping_in_progress: modernColors.primary,
    shopping_completed: modernColors.primary,
    en_route_delivery: modernColors.primary,
    arrival_destination: modernColors.primary,
    delivered: modernColors.success,
    completed: modernColors.success,
    cancelled: modernColors.error,
};

const iconMap: Record<string, string> = {
    pending: 'clock',
    requested: 'clock',
    awaiting_courier: 'clock',
    awaiting_courier_confirmation: 'clock',
    assigned: 'users',
    accepted: 'users',
    en_route_pickup: 'car',
    arrival_pickup: 'map-pin',
    picked_up: 'package',
    shopping_pending: 'shopping-cart',
    shopping_in_progress: 'package',
    shopping_completed: 'check',
    en_route_delivery: 'navigation',
    arrival_destination: 'map-pin',
    delivered: 'success',
    completed: 'success',
    cancelled: 'alert-circle',
};

const ActiveDeliveryCard: React.FC<ActiveDeliveryCardProps> = ({ delivery, onTrackPress, onEditPress }) => {
    const { t } = useLanguageSafe();
    const { width } = useWindowDimensions();
    const isCompactAndroid = Platform.OS === 'android' && width <= 360;

    const statusLabelMap = useMemo(
        () => ({
            pending: 'En attente',
            requested: 'En attente',
            awaiting_courier: 'Recherche coursier',
            awaiting_courier_confirmation: 'Recherche coursier',
            assigned: t('activeDeliveryCard.coursierAssigne'),
            accepted: t('activeDeliveryCard.coursierAssigne'),
            en_route_pickup: 'En route vers le retrait',
            arrival_pickup: t('activeDeliveryCard.arriveAuPointDeRetrait'),
            picked_up: t('activeDeliveryCard.colisRecupere'),
            shopping_pending: t('activeDeliveryCard.arriveAuSupermarche'),
            shopping_in_progress: 'Courses en cours',
            shopping_completed: t('activeDeliveryCard.panierValide'),
            en_route_delivery: 'En route client',
            arrival_destination: t('activeDeliveryCard.arriveADestination'),
            delivered: t('activeDeliveryCard.livre'),
            completed: t('activeDeliveryCard.termine'),
            cancelled: t('activeDeliveryCard.annule'),
        }),
        [t],
    );

    const statusLabel = statusLabelMap[delivery.status] ?? delivery.status;
    const statusColor = statusColorMap[delivery.status] ?? modernColors.primary;
    const statusIcon = iconMap[delivery.status] ?? 'clock';

    const lastCheckpoint = useMemo(() => {
        if (!delivery.checkpoints?.length) {
            return null;
        }
        return delivery.checkpoints[delivery.checkpoints.length - 1];
    }, [delivery.checkpoints]);

    const deliveryTypeLabel = delivery.kind === 'shopping' ? t('activeDeliveryCard.coursesSupermarche') : 'Livraison colis';

    const lastUpdate = delivery.lastEventAt
        ? new Date(delivery.lastEventAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : null;

    // ✅ Phase 9 - Amélioration 30 : Vérifier si dropoff est pending
    const dropoffPending = delivery.metadata?.dropoff_pending === true;

    // ✅ CORRIGÉ : Filtrer les valeurs invalides pour l'adresse
    const isValidAddress = (address: string | undefined | null): boolean => {
        if (!address) return false;
        const lowerAddress = address.toLowerCase().trim();
        return lowerAddress !== 'false' && lowerAddress !== 'null' && lowerAddress !== '' && lowerAddress !== 'undefined';
    };

    const displayAddress = isValidAddress(delivery.dropoff?.address)
        ? delivery.dropoff!.address!
        : null;

    const deliveryIdStr = delivery?.id != null ? String(delivery.id) : '';

    return (
        <NativeCard style={[styles.card, isCompactAndroid && styles.cardCompact]}>
            <View style={styles.header}>
                <NativeBadge
                    text={deliveryTypeLabel}
                    variant={delivery.kind === 'shopping' ? 'primary' : 'secondary'}
                    size="small"
                />
                <View style={[styles.statusPill, isCompactAndroid && styles.statusPillCompact]}>
                    <SafeIcon name={statusIcon} size={isCompactAndroid ? 12 : 14} color={statusColor} />
                    <Text style={[styles.statusText, isCompactAndroid && styles.statusTextCompact, { color: statusColor }]}>{statusLabel}</Text>
                </View>
            </View>

            <View style={[styles.body, isCompactAndroid && styles.bodyCompact]}>
                <View style={[styles.row, isCompactAndroid && styles.rowCompact]}>
                    <SafeIcon name="store" size={isCompactAndroid ? 14 : 16} color={modernColors.textSecondary} />
                    <Text style={[styles.locationText, isCompactAndroid && styles.locationTextCompact]} numberOfLines={1}>
                        {delivery.pickup?.label ?? t('activeDeliveryCard.supermarche')}
                    </Text>
                </View>
                <View style={[styles.row, isCompactAndroid && styles.rowCompact]}>
                    <SafeIcon
                        name="navigation"
                        size={isCompactAndroid ? 14 : 16}
                        color={dropoffPending ? modernColors.warning : modernColors.textSecondary}
                    />
                    <View style={styles.dropoffContainer}>
                        <View style={styles.dropoffHeader}>
                            <Text style={[styles.locationText, isCompactAndroid && styles.locationTextCompact]} numberOfLines={1}>
                                {delivery.dropoff?.label ?? 'Destinataire'}
                            </Text>
                            {/* ✅ Phase 9 - Amélioration 30 : Badge "Adresse à confirmer" si dropoff pending */}
                            {dropoffPending && (
                                <NativeBadge
                                    text="Adresse à confirmer"
                                    variant="warning"
                                    size="small"
                                />
                            )}
                        </View>
                        {displayAddress && (
                            <Text
                                style={[
                                    styles.dropoffAddress,
                                    isCompactAndroid && styles.dropoffAddressCompact,
                                    dropoffPending && styles.dropoffAddressPending,
                                ]}
                                numberOfLines={2}
                            >
                                {displayAddress}
                            </Text>
                        )}
                    </View>
                </View>
                {delivery.recipient?.name ? (
                    <View style={[styles.row, isCompactAndroid && styles.rowCompact]}>
                        <SafeIcon name="profile" size={isCompactAndroid ? 14 : 16} color={modernColors.textSecondary} />
                        <Text style={[styles.locationText, isCompactAndroid && styles.locationTextCompact]} numberOfLines={1}>
                            {delivery.recipient.name}
                        </Text>
                    </View>
                ) : null}
                {lastCheckpoint?.note ? (
                    <View style={[styles.noteBox, isCompactAndroid && styles.noteBoxCompact]}>
                        <SafeIcon name="info" size={isCompactAndroid ? 12 : 14} color={modernColors.textSecondary} />
                        <Text style={[styles.noteText, isCompactAndroid && styles.noteTextCompact]} numberOfLines={2}>
                            {lastCheckpoint.note}
                        </Text>
                    </View>
                ) : null}
            </View>

            <View style={[styles.footer, isCompactAndroid && styles.footerCompact]}>
                <View>
                    <Text style={[styles.footerLabel, isCompactAndroid && styles.footerLabelCompact]}>{t('activeDeliveryCard.derniereMiseAJour')}</Text>
                    <Text style={[styles.footerValue, isCompactAndroid && styles.footerValueCompact]}>{lastUpdate ?? t('activeDeliveryCard.enAttente')}</Text>
                </View>
                <View style={[styles.footerButtons, isCompactAndroid && styles.footerButtonsCompact]}>
                    {/* ✅ Phase 9 - Amélioration 30 : Bouton "Modifier l'adresse" toujours visible */}
                    <NativeButton
                        title={t('activeDeliveryCard.modifier')}
                        variant="outline"
                        size="small"
                        onPress={() => deliveryIdStr && onEditPress(deliveryIdStr)}
                        style={styles.modifyButton}
                    />
                    <NativeButton
                        title="Suivre"
                        variant="primary"
                        size="small"
                        onPress={() => deliveryIdStr && onTrackPress(deliveryIdStr)}
                    />
                </View>
            </View>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    card: {
        gap: 16,
    },
    cardCompact: {
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    statusPillCompact: {
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    statusText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    statusTextCompact: {
        fontSize: 11,
    },
    body: {
        gap: 10,
    },
    bodyCompact: {
        gap: 8,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    rowCompact: {
        gap: 6,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    locationTextCompact: {
        fontSize: 13,
    },
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        backgroundColor: modernColors.surfaceVariant,
        padding: 10,
        borderRadius: 12,
    },
    noteBoxCompact: {
        padding: 8,
        borderRadius: 10,
    },
    noteText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        flex: 1,
    },
    noteTextCompact: {
        fontSize: 12,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerCompact: {
        alignItems: 'flex-end',
    },
    footerLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    footerLabelCompact: {
        fontSize: 11,
    },
    footerValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    footerValueCompact: {
        fontSize: 13,
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    footerButtonsCompact: {
        gap: 6,
    },
    modifyButton: {
        marginRight: 0,
    },
    dropoffContainer: {
        flex: 1,
    },
    dropoffHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    dropoffAddress: {
        fontSize: 13,
        color: modernColors.textSecondary,
        fontStyle: 'normal',
    },
    dropoffAddressCompact: {
        fontSize: 12,
    },
    dropoffAddressPending: {
        color: modernColors.warning,
        fontStyle: 'italic',
    },
});

export default ActiveDeliveryCard;
