// ✅ Composant filtres matching intelligent pour covoiturage
// Date: 2025-01-29

import React, { useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { NativeButton } from '../SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface IntelligentMatchingFiltersProps {
    onApply: (filters: MatchingFilters) => void;
    initialFilters?: MatchingFilters;
}

export interface MatchingFilters {
    fumeur_autorise: boolean;
    animaux_autorises: boolean;
    bagages_autorises: boolean;
    climatisation_preferee: boolean;
    horaire_flexible: boolean;
    prix_max?: number;
    horaire_depart_prefere?: string; // Format HH:MM
}

export const IntelligentMatchingFilters: React.FC<IntelligentMatchingFiltersProps> = ({
    onApply,
    initialFilters,
}) => {
        const { t } = useLanguageSafe();
const [filters, setFilters] = useState<MatchingFilters>(
        initialFilters || {
            fumeur_autorise: false,
            animaux_autorises: false,
            bagages_autorises: false,
            climatisation_preferee: false,
            horaire_flexible: false,
        }
    );

    const updateFilter = (key: keyof MatchingFilters, value: boolean | number | string) => {
        setFilters({ ...filters, [key]: value });
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>{t('intelligentMatchingFilters.preferencesDeRecherche')}</Text>

            <View style={styles.filterRow}>
                <Text style={styles.label}>{t('intelligentMatchingFilters.fumeurAutorise')}</Text>
                <Switch
                    value={filters.fumeur_autorise}
                    onValueChange={(value) => updateFilter('fumeur_autorise', value)}
                />
            </View>

            <View style={styles.filterRow}>
                <Text style={styles.label}>{t('intelligentMatchingFilters.animauxAutorises')}</Text>
                <Switch
                    value={filters.animaux_autorises}
                    onValueChange={(value) => updateFilter('animaux_autorises', value)}
                />
            </View>

            <View style={styles.filterRow}>
                <Text style={styles.label}>{t('intelligentMatchingFilters.bagagesAutorises')}</Text>
                <Switch
                    value={filters.bagages_autorises}
                    onValueChange={(value) => updateFilter('bagages_autorises', value)}
                />
            </View>

            <View style={styles.filterRow}>
                <Text style={styles.label}>{t('intelligentMatchingFilters.climatisationPreferee')}</Text>
                <Switch
                    value={filters.climatisation_preferee}
                    onValueChange={(value) => updateFilter('climatisation_preferee', value)}
                />
            </View>

            <View style={styles.filterRow}>
                <Text style={styles.label}>{t('intelligentMatchingFilters.horaireFlexible30min')}</Text>
                <Switch
                    value={filters.horaire_flexible}
                    onValueChange={(value) => updateFilter('horaire_flexible', value)}
                />
            </View>

            <NativeButton
                variant="primary"
                onPress={() => onApply(filters)}
                style={styles.applyButton}
            >
                Appliquer les filtres
            </NativeButton>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#fff',
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f0f0',
    },
    label: {
        fontSize: 16,
        flex: 1,
    },
    applyButton: {
        marginTop: 16,
    },
});

