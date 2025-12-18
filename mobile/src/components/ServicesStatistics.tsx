// ✅ NOUVEAU: Composant pour afficher les statistiques agrégées des services spécialisés

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';

interface ServicesStatisticsProps {
    total: number;
    active: number;
    inactive: number;
    by_type: Record<string, number>;
}

const ServicesStatistics: React.FC<ServicesStatisticsProps> = ({
    total,
    active,
    inactive,
    by_type,
}) => {
    const typeLabels: Record<string, string> = {
        pharmacie: 'Pharmacies',
        hopital: 'Hôpitaux',
        laboratoire: 'Laboratoires',
        banque_sang: 'Banques de Sang',
        agence_voyage: 'Agences',
        covoiturage: 'Covoiturages',
        taxi: 'Taxis',
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

    const typesWithCount = Object.entries(by_type)
        .filter(([_, count]) => count > 0)
        .sort(([_, a], [__, b]) => b - a);

    return (
        <NativeCard style={styles.container}>
            <Text style={styles.title}>Statistiques</Text>

            {/* KPIs principaux */}
            <View style={styles.kpiContainer}>
                <View style={styles.kpiItem}>
                    <Text style={styles.kpiValue}>{total}</Text>
                    <Text style={styles.kpiLabel}>Total</Text>
                </View>
                <View style={styles.kpiItem}>
                    <Text style={[styles.kpiValue, { color: modernColors.success }]}>
                        {active}
                    </Text>
                    <Text style={styles.kpiLabel}>Actifs</Text>
                </View>
                <View style={styles.kpiItem}>
                    <Text style={[styles.kpiValue, { color: modernColors.warning }]}>
                        {inactive}
                    </Text>
                    <Text style={styles.kpiLabel}>Inactifs</Text>
                </View>
            </View>

            {/* Répartition par type */}
            {typesWithCount.length > 0 && (
                <View style={styles.typesContainer}>
                    <Text style={styles.typesTitle}>Répartition par type</Text>
                    {typesWithCount.map(([type, count]) => (
                        <View key={type} style={styles.typeItem}>
                            <View style={styles.typeItemLeft}>
                                <View
                                    style={[
                                        styles.typeIconContainer,
                                        { backgroundColor: typeColors[type] + '15' },
                                    ]}
                                >
                                    <SafeIcon
                                        name={typeIcons[type] || 'circle'}
                                        size={16}
                                        color={typeColors[type] || modernColors.primary}
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.typeLabel}>
                                    {typeLabels[type] || type}
                                </Text>
                            </View>
                            <Text style={styles.typeCount}>{count}</Text>
                        </View>
                    ))}
                </View>
            )}
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 20,
        margin: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 16,
    },
    kpiContainer: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        marginBottom: 24,
        paddingBottom: 24,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    kpiItem: {
        alignItems: 'center',
    },
    kpiValue: {
        fontSize: 28,
        fontWeight: '700',
        color: modernColors.primary,
    },
    kpiLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    typesContainer: {
        marginTop: 8,
    },
    typesTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    typeItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    typeItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    typeIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeLabel: {
        fontSize: 14,
        color: '#111827',
    },
    typeCount: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
});

export default ServicesStatistics;

