// ✅ NOUVEAU Phase 5.2: Composant de filtres pour la gestion des services spécialisés
// Différent de SearchFilters.tsx qui est pour la recherche publique
// Filtres: type, statut, date de création

import React, { useEffect, useState } from 'react';
import {
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeButton } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

export interface ServiceFilters {
    type?: string; // "pharmacie", "hopital", etc. ou "all"
    status?: 'all' | 'active' | 'inactive';
    dateRange?: 'all' | 'today' | 'week' | 'month' | 'year';
    [key: string]: any;
}

interface Props {
    visible: boolean;
    onClose: () => void;
    onApply: (filters: ServiceFilters) => void;
    initialFilters?: ServiceFilters;
}

const ServiceFilters: React.FC<Props> = ({
    visible,
    onClose,
    onApply,
    initialFilters,
}) => {
    const [filters, setFilters] = useState<ServiceFilters>(
        initialFilters || {
            type: 'all',
            status: 'all',
            dateRange: 'all',
        }
    );

    useEffect(() => {
        if (initialFilters) {
            setFilters(initialFilters);
        }
    }, [initialFilters]);

    const serviceTypes = [
        { value: 'all', label: 'Tous les types', icon: '📋' },
        { value: 'pharmacie', label: 'Pharmacie', icon: '💊' },
        { value: 'hopital', label: 'Hôpital', icon: '🏥' },
        { value: 'laboratoire', label: 'Laboratoire', icon: '🔬' },
        { value: 'banque_sang', label: 'Banque de Sang', icon: '🩸' },
        { value: 'agence_voyage', label: 'Agence de Voyage', icon: '🚌' },
        { value: 'covoiturage', label: 'Covoiturage', icon: '🚗' },
        { value: 'taxi', label: 'Taxi', icon: '🚕' },
    ];

    const statusOptions = [
        { value: 'all', label: 'Tous', icon: '📊' },
        { value: 'active', label: 'Actifs', icon: '✅' },
        { value: 'inactive', label: 'Inactifs', icon: '❌' },
    ];

    const dateRanges = [
        { value: 'all', label: 'Toutes les dates', icon: '📅' },
        { value: 'today', label: "Aujourd'hui", icon: '🕐' },
        { value: 'week', label: 'Cette semaine', icon: '📆' },
        { value: 'month', label: 'Ce mois', icon: '🗓️' },
        { value: 'year', label: 'Cette année', icon: '📅' },
    ];

    const handleApply = () => {
        onApply(filters);
        onClose();
    };

    const handleReset = () => {
        const resetFilters: ServiceFilters = {
            type: 'all',
            status: 'all',
            dateRange: 'all',
        };
        setFilters(resetFilters);
        onApply(resetFilters);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Filtres</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.textPrimary} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Filtre par type */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Type de service</Text>
                            <View style={styles.optionsGrid}>
                                {serviceTypes.map((type) => (
                                    <TouchableOpacity
                                        key={type.value}
                                        style={[
                                            styles.optionChip,
                                            filters.type === type.value && styles.optionChipActive,
                                        ]}
                                        onPress={() => setFilters({ ...filters, type: type.value })}
                                    >
                                        <Text style={styles.optionIcon}>{type.icon}</Text>
                                        <Text
                                            style={[
                                                styles.optionLabel,
                                                filters.type === type.value && styles.optionLabelActive,
                                            ]}
                                        >
                                            {type.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Filtre par statut */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Statut</Text>
                            <View style={styles.optionsRow}>
                                {statusOptions.map((status) => (
                                    <TouchableOpacity
                                        key={status.value}
                                        style={[
                                            styles.statusChip,
                                            filters.status === status.value && styles.statusChipActive,
                                        ]}
                                        onPress={() => setFilters({ ...filters, status: status.value as any })}
                                    >
                                        <Text style={styles.statusIcon}>{status.icon}</Text>
                                        <Text
                                            style={[
                                                styles.statusLabel,
                                                filters.status === status.value && styles.statusLabelActive,
                                            ]}
                                        >
                                            {status.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Filtre par date */}
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Date de création</Text>
                            <View style={styles.optionsRow}>
                                {dateRanges.map((range) => (
                                    <TouchableOpacity
                                        key={range.value}
                                        style={[
                                            styles.dateChip,
                                            filters.dateRange === range.value && styles.dateChipActive,
                                        ]}
                                        onPress={() => setFilters({ ...filters, dateRange: range.value as any })}
                                    >
                                        <Text style={styles.dateIcon}>{range.icon}</Text>
                                        <Text
                                            style={[
                                                styles.dateLabel,
                                                filters.dateRange === range.value && styles.dateLabelActive,
                                            ]}
                                        >
                                            {range.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    </ScrollView>

                    {/* Footer avec boutons */}
                    <View style={styles.footer}>
                        <NativeButton
                            variant="secondary"
                            onPress={handleReset}
                            style={styles.resetButton}
                        >
                            <Text style={styles.resetButtonText}>Réinitialiser</Text>
                        </NativeButton>
                        <NativeButton
                            variant="primary"
                            onPress={handleApply}
                            style={styles.applyButton}
                        >
                            <Text style={styles.applyButtonText}>Appliquer</Text>
                        </NativeButton>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 12,
    },
    optionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    optionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        minWidth: '45%',
        marginBottom: 8,
    },
    optionChipActive: {
        backgroundColor: modernColors.primary + '15',
        borderColor: modernColors.primary,
    },
    optionIcon: {
        fontSize: 18,
        marginRight: 6,
    },
    optionLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    optionLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    optionsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    statusChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    statusChipActive: {
        backgroundColor: modernColors.primary + '15',
        borderColor: modernColors.primary,
    },
    statusIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    statusLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    statusLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    dateChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 8,
    },
    dateChipActive: {
        backgroundColor: modernColors.primary + '15',
        borderColor: modernColors.primary,
    },
    dateIcon: {
        fontSize: 16,
        marginRight: 6,
    },
    dateLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    dateLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    resetButton: {
        flex: 1,
    },
    resetButtonText: {
        color: '#374151',
        fontSize: 16,
        fontWeight: '600',
    },
    applyButton: {
        flex: 1,
    },
    applyButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ServiceFilters;



