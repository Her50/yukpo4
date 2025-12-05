// ✅ NOUVEAU: Composant carte pour afficher un service spécialisé en mode carte

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface ServiceCardProps {
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

const ServiceCard: React.FC<ServiceCardProps> = ({ service, onPress, onEdit }) => {
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
            <NativeCard style={[styles.card, { borderLeftColor: typeColor }]}>
                <View style={styles.cardHeader}>
                    <View style={[styles.iconContainer, { backgroundColor: typeColor + '15' }]}>
                        <SafeIcon name={typeIcon} size={24} color={typeColor} type="lucide" />
                    </View>
                    {onEdit && (
                        <TouchableOpacity
                            onPress={(e) => {
                                e.stopPropagation();
                                onEdit();
                            }}
                            style={styles.editButton}
                        >
                            <SafeIcon name="edit" size={18} color={modernColors.primary} />
                        </TouchableOpacity>
                    )}
                </View>

                <Text style={styles.serviceName} numberOfLines={2}>
                    {service.nom}
                </Text>

                <View style={styles.cardFooter}>
                    <View style={styles.typeBadge}>
                        <Text style={[styles.typeText, { color: typeColor }]}>
                            {typeLabel}
                        </Text>
                    </View>
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
                </View>

                {service.is_available_now && (
                    <View style={styles.availableBadge}>
                        <SafeIcon name="clock" size={12} color={modernColors.success} type="lucide" />
                        <Text style={styles.availableText}>Disponible maintenant</Text>
                    </View>
                )}
            </NativeCard>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 12,
        borderLeftWidth: 4,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    editButton: {
        padding: 4,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    cardFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    typeBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 12,
        fontWeight: '600',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    availableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        gap: 6,
    },
    availableText: {
        fontSize: 12,
        color: modernColors.success,
        fontWeight: '600',
    },
});

export default ServiceCard;
