import React from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ResultsHeaderProps {
    title: string;
    resultsCount: number;
    onGeolocationPress?: () => void;
    onPriceFilterPress?: () => void;
    onSortPress?: () => void;
    sortBy?: string;
}

const ResultsHeader: React.FC<ResultsHeaderProps> = ({
    title,
    resultsCount,
    onGeolocationPress,
    onPriceFilterPress,
    onSortPress,
    sortBy = 'pertinence'
}) => {
    return (
        <View style={styles.container}>
            {/* Titre principal */}
            <Text style={styles.title}>{title}</Text>

            {/* Statistiques */}
            <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                    <Text style={styles.statIcon}>✅</Text>
                    <Text style={styles.statText}>
                        {resultsCount} service{resultsCount > 1 ? 's' : 't('resultsHeader.trouveresultscount1')s' : ''}
                    </Text>
                </View>
                <View style={styles.statItem}>
                    <Text style={styles.statIcon}>⏱️</Text>
                    <Text style={styles.statText}>{t('resultsHeader.resultatsEnTempsReel')}</Text>
                </View>
            </View>

            {/* Boutons d'action */}
            <View style={styles.actionsContainer}>
                <TouchableOpacity
                    style={styles.geolocationButton}
                    onPress={onGeolocationPress}
                >
                    <Text style={styles.geolocationButtonText}>
                        Activer la géolocalisation pour trier par proximité
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.priceFilterButton}
                    onPress={onPriceFilterPress}
                >
                    <Text style={styles.priceFilterIcon}>$</Text>
                    <Text style={styles.priceFilterButtonText}>{t('resultsHeader.filtreParPrix')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.sortButton}
                    onPress={onSortPress}
                >
                    <Text style={styles.sortButtonText}>Trier par {sortBy}</Text>
                    <Text style={styles.sortArrow}>▼</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        padding: 20,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
        gap: 20,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statIcon: {
        fontSize: 16,
        color: theme.colors.primary,
    },
    statText: {
        fontSize: 14,
        color: theme.colors.text,
        fontWeight: '500',
    },
    actionsContainer: {
        gap: 12,
    },
    geolocationButton: {
        backgroundColor: '#3B82F6',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    geolocationButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    priceFilterButton: {
        backgroundColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 6,
    },
    priceFilterIcon: {
        color: 'white',
        fontSize: 16,
        fontWeight: 'bold',
    },
    priceFilterButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    sortButton: {
        backgroundColor: 'white',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 6,
    },
    sortButtonText: {
        color: theme.colors.text,
        fontSize: 14,
        fontWeight: '500',
    },
    sortArrow: {
        color: theme.colors.textSecondary,
        fontSize: 12,
    },
});

export default ResultsHeader;

