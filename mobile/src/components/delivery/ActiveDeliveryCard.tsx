import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary } from '../../types/delivery';
import SafeIcon from '../SafeIcon';
import { NativeBadge, NativeButton, NativeCard } from '../SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface ActiveDeliveryCardProps {
    delivery: DeliverySummary;
    onPress: (deliveryId: string) => void;
}

const statusLabelMap: Record<string, string> = {
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
};

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

const ActiveDeliveryCard: React.FC<ActiveDeliveryCardProps> = ({ delivery, onPress }) => {
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

    return (
        <NativeCard style={styles.card}>
            <View style={styles.header}>
                <NativeBadge
                    text={deliveryTypeLabel}
                    variant={delivery.kind === 'shopping' ? 'primary' : 'secondary'}
                    size="small"
                />
                <View style={styles.statusPill}>
                    <SafeIcon name={statusIcon} size={14} color={statusColor} />
                    <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
                </View>
            </View>

            <View style={styles.body}>
                <View style={styles.row}>
                    <SafeIcon name="store" size={16} color={modernColors.textSecondary} />
                    <Text style={styles.locationText}>{delivery.pickup?.label ?? t('activeDeliveryCard.supermarche')}</Text>
                </View>
                <View style={styles.row}>
                    <SafeIcon
                        name="navigation"
                        size={16}
                        color={dropoffPending ? modernColors.warning : modernColors.textSecondary}
                    />
                    <View style={styles.dropoffContainer}>
                        <View style={styles.dropoffHeader}>
                            <Text style={styles.locationText}>{delivery.dropoff?.label ?? 'Destinataire'}</Text>
                            {/* ✅ Phase 9 - Amélioration 30 : Badge "Adresse à confirmer" si dropoff pending */}
                            {dropoffPending && (
                                <NativeBadge
                                    text=t('activeDeliveryCard.adresseAConfirmer')
                                    variant="warning"
                                    size="small"
                                />
                            )}
                        </View>
                        {displayAddress && (
                            <Text style={[styles.dropoffAddress, dropoffPending && styles.dropoffAddressPending]}>
                                {displayAddress}
                            </Text>
                        )}
                    </View>
                </View>
                {delivery.recipient?.name ? (
                    <View style={styles.row}>
                        <SafeIcon name="profile" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.locationText}>{delivery.recipient.name}</Text>
                    </View>
                ) : null}
                {lastCheckpoint?.note ? (
                    <View style={styles.noteBox}>
                        <SafeIcon name="info" size={14} color={modernColors.textSecondary} />
                        <Text style={styles.noteText}>{lastCheckpoint.note}</Text>
                    </View>
                ) : null}
            </View>

            <View style={styles.footer}>
                <View>
                    <Text style={styles.footerLabel}>{t('activeDeliveryCard.derniereMiseAJour')}</Text>
                    <Text style={styles.footerValue}>{lastUpdate ?? t('activeDeliveryCard.enAttente')}</Text>
                </View>
                <View style={styles.footerButtons}>
                    {/* ✅ Phase 9 - Amélioration 30 : Bouton "Modifier l'adresse" toujours visible */}
                    <NativeButton
                        title={t('activeDeliveryCard.modifier')}
                        variant="outline"
                        size="small"
                        onPress={() => onPress(delivery.id)}
                        style={styles.modifyButton}
                    />
                    <NativeButton
                        title="Suivre"
                        variant="primary"
                        size="small"
                        onPress={() => onPress(delivery.id)}
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
    statusText: {
        fontSize: 13,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    body: {
        gap: 10,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    locationText: {
        fontSize: 14,
        color: modernColors.text,
        flex: 1,
    },
    noteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        backgroundColor: modernColors.surfaceVariant,
        padding: 10,
        borderRadius: 12,
    },
    noteText: {
        fontSize: 13,
        color: modernColors.textSecondary,
        flex: 1,
    },
    footer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    footerLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    footerValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    footerButtons: {
        flexDirection: 'row',
        gap: 8,
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
    dropoffAddressPending: {
        color: modernColors.warning,
        fontStyle: 'italic',
    },
});

export default ActiveDeliveryCard;
