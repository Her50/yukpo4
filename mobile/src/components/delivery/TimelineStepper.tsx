import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { modernColors } from '../../theme/modernTheme';
import { DeliveryCheckpoint, DeliveryStatus } from '../../types/delivery';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface TimelineStepperProps {
    checkpoints: DeliveryCheckpoint[];
    currentStatus: DeliveryStatus;
}

const STATUS_ORDER: DeliveryStatus[] = [
    'pending',
    'requested',
    'awaiting_courier',
    'awaiting_courier_confirmation',
    'assigned',
    'accepted',
    'en_route_pickup',
    'arrival_pickup',
    'picked_up',
    'shopping_pending',
    'shopping_in_progress',
    'shopping_completed',
    'en_route_delivery',
    'arrival_destination',
    'delivered',
    'completed',
    'cancelled',
];

const STATUS_ICON: Partial<Record<DeliveryStatus, string>> = {
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
    en_route_delivery: 'location',
    arrival_destination: 'map-pin',
    delivered: 'success',
    completed: 'success',
    cancelled: 'error',
};

const TimelineStepper: React.FC<TimelineStepperProps> = ({ checkpoints, currentStatus }) => {
    const timeline = useMemo(() => {
    const { t } = useLanguageSafe();
        const entries = STATUS_ORDER.map(status => {
            const match = checkpoints.find(item => item.status === status);
            return {
                status,
                timestamp: match?.timestamp ?? null,
                note: match?.note,
                actor: match?.actor,
                location: match?.location,
            };
        });
        return entries.filter(entry => entry.timestamp || STATUS_ORDER.indexOf(entry.status) <= STATUS_ORDER.indexOf(currentStatus));
    }, [checkpoints, currentStatus]);

    return (
        <View style={styles.container}>
            {timeline.map((entry, index) => {
                const isActive = entry.status === currentStatus;
                const isCompleted =
                    STATUS_ORDER.indexOf(entry.status) < STATUS_ORDER.indexOf(currentStatus) ||
                    entry.status === 'delivered';
                const iconName = STATUS_ICON[entry.status] ?? 'clock';

                return (
                    <View key={entry.status} style={styles.stepRow}>
                        <View style={styles.iconColumn}>
                            <View
                                style={[
                                    styles.iconContainer,
                                    isActive && styles.iconContainerActive,
                                    isCompleted && styles.iconContainerCompleted,
                                ]}
                            >
                                <SafeIcon
                                    name={iconName}
                                    size={18}
                                    color={isCompleted || isActive ? '#fff' : modernColors.textSecondary}
                                />
                            </View>
                            {index < timeline.length - 1 ? (
                                <View style={[styles.connector, isCompleted && styles.connectorCompleted]} />
                            ) : null}
                        </View>
                        <View style={styles.contentColumn}>
                            <Text style={[styles.statusLabel, isActive && styles.statusLabelActive]}>
                                {statusToLabel(entry.status)}
                            </Text>
                            {entry.timestamp ? (
                                <Text style={styles.timestamp}>
                                    {new Date(entry.timestamp).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit',
                                    })}
                                </Text>
                            ) : null}
                            {entry.note ? <Text style={styles.note}>{entry.note}</Text> : null}
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const statusToLabel = (status: DeliveryStatus): string => {
    switch (status) {
        case 'pending':
        case 'requested':
            return t('timelineStepper.commandeCreee');
        case 'awaiting_courier':
        case 'awaiting_courier_confirmation':
            return 'Recherche de coursier';
        case 'assigned':
        case 'accepted':
            return t('timelineStepper.coursierAssigne');
        case 'en_route_pickup':
            return 'Coursier en route vers le pickup';
        case 'arrival_pickup':
            return t('timelineStepper.arriveAuPointDeRetrait');
        case 'picked_up':
            return t('timelineStepper.colisRecupere');
        case 'shopping_pending':
            return t('timelineStepper.enAttenteAuSupermarche');
        case 'shopping_in_progress':
            return 'Shopping en cours';
        case 'shopping_completed':
            return t('timelineStepper.shoppingTermine');
        case 'en_route_delivery':
            return 'En route vers le destinataire';
        case 'arrival_destination':
            return t('timelineStepper.arriveADestination');
        case 'delivered':
            return t('timelineStepper.livraisonEffectuee');
        case 'completed':
            return t('timelineStepper.livraisonTerminee');
        case 'cancelled':
            return t('timelineStepper.commandeAnnulee');
        default:
            return status;
    }
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    stepRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    iconColumn: {
        alignItems: 'center',
    },
    iconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        borderWidth: 2,
        borderColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
    },
    iconContainerActive: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary,
    },
    iconContainerCompleted: {
        borderColor: modernColors.success,
        backgroundColor: modernColors.success,
    },
    connector: {
        width: 2,
        flex: 1,
        backgroundColor: modernColors.border,
        marginTop: 4,
    },
    connectorCompleted: {
        backgroundColor: modernColors.success,
    },
    contentColumn: {
        flex: 1,
        gap: 4,
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    statusLabelActive: {
        color: modernColors.text,
    },
    timestamp: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    note: {
        fontSize: 12,
        color: modernColors.accent,
    },
});

export default TimelineStepper;
