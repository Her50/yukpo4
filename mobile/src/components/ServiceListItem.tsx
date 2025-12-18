// ✅ NOUVEAU: Composant liste pour afficher un service spécialisé en mode liste

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface ServiceListItemProps {
    service: {
        id: number;
        service_id: number;
        type: string;
        nom: string;
        is_active: boolean;
        is_available_now?: boolean;
        created_at: string;
        metadata?: any;
    };
    onPress: () => void;
    onEdit?: () => void;
}

const ServiceListItem: React.FC<ServiceListItemProps> = ({ service, onPress, onEdit }) => {
    const typeLabels: Record<string, string> = {
        pharmacie: 'Pharmacie',
        hopital: 'Hôpital',
        laboratoire: 'Laboratoire',
        banque_sang: 'Banque de Sang',
        agence_voyage: 'Agence',
        covoiturage: 'Covoiturage',
        taxi: 'Taxi',
    };

    const typeIcons: Record<string, string> = {
        pharmacie: 'Pill',
        hopital: 'Hospital',
        laboratoire: 'Microscope',
        banque_sang: 'Droplet',
        agence_voyage: 'Bus',
        covoiturage: 'Users',
        taxi: 'Car',
    };

    const typeColors: Record<string, string> = {
        pharmacie: '#10B981',
        hopital: '#EF4444',
        laboratoire: '#3B82F6',
        banque_sang: '#DC2626',
        agence_voyage: '#F59E0B',
        covoiturage: '#8B5CF6',
        taxi: '#F97316',
    };

    const typeColor = typeColors[service.type] || modernColors.primary;
    const typeIcon = typeIcons[service.type] || 'circle';
    const typeLabel = typeLabels[service.type] || service.type;

    return (
        <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
            <NativeCard style={styles.listItem}>
                <View style={styles.listItemContent}>
                    <View style={[styles.iconContainer, { backgroundColor: typeColor + '15' }]}>
                        <SafeIcon name={typeIcon} size={20} color={typeColor} type="lucide" />
                    </View>

                    <View style={styles.listItemInfo}>
                        <Text style={styles.serviceName} numberOfLines={1}>
                            {service.nom}
                        </Text>
                        <View style={styles.listItemMeta}>
                            <Text style={styles.typeText}>{typeLabel}</Text>
                            <View
                                style={[
                                    styles.statusBadge,
                                    {
                                        backgroundColor: service.is_active
                                            ? modernColors.success + '20'
                                            : modernColors.warning + '20',
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.statusText,
                                        {
                                            color: service.is_active
                                                ? modernColors.success
                                                : modernColors.warning,
                                        },
                                    ]}
                                >
                                    {service.is_active ? 'Actif' : 'Inactif'}
                                </Text>
                            </View>
                            {service.is_available_now && (
                                <View style={styles.availableIndicator}>
                                    <SafeIcon
                                        name="clock"
                                        size={12}
                                        color={modernColors.success}
                                        type="lucide"
                                    />
                                </View>
                            )}
                        </View>
                    </View>

                    {onEdit && (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            style={styles.editButton}
                        >
                            <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </NativeCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    listItem: {
        marginBottom: 8,
    },
    listItemContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listItemInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    listItemMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    typeText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    statusBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 10,
        fontWeight: '600',
    },
    availableIndicator: {
        marginLeft: 4,
    },
    editButton: {
        padding: 4,
    },
});

export default ServiceListItem;

