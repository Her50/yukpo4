/**
 * QuickSortBar - Barre de tri rapide pour ResultatBesoinScreen
 * Extrait de ResultatBesoinScreen pour améliorer la maintenabilité
 */

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../../theme/modernTheme';
import { hapticSelect } from '../../utils/hapticFeedback';
import SafeIcon from '../SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type SortOption = 'pertinence' | 'proximite' | 'prix_asc' | 'prix_desc';

interface QuickSortBarProps {
    sortBy: SortOption;
    onSortChange: (sort: SortOption) => void;
}

const QuickSortBar: React.FC<QuickSortBarProps> = ({
    sortBy,
    onSortChange,
}) => {
    return (
        <View style={styles.quickSortRow}>
            <TouchableOpacity
                style={[styles.quickSortPill, sortBy === 'pertinence' && styles.quickSortPillActive]}
                onPress={() => {
                    hapticSelect();
                    onSortChange('pertinence');
                }}
                activeOpacity={0.7}
            >
                <SafeIcon
                    name="zap"
                    size={16}
                    color={sortBy === 'pertinence' ? '#FFFFFF' : modernColors.primary}
                />
                <Text style={[styles.quickSortText, sortBy === 'pertinence' && styles.quickSortTextActive]}>
                    Pertinence
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.quickSortPill, sortBy === 'proximite' && styles.quickSortPillActive]}
                onPress={() => {
                    hapticSelect();
                    onSortChange('proximite');
                }}
                activeOpacity={0.7}
            >
                <SafeIcon
                    name="map-pin"
                    size={16}
                    color={sortBy === 'proximite' ? '#FFFFFF' : modernColors.primary}
                />
                <Text style={[styles.quickSortText, sortBy === 'proximite' && styles.quickSortTextActive]}>
                    Proximité
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={[styles.quickSortPill, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.quickSortPillActive]}
                onPress={() => {
                    hapticSelect();
                    if (sortBy === 'prix_asc') {
                        onSortChange('prix_desc');
                    } else if (sortBy === 'prix_desc') {
                        onSortChange('pertinence');
                    } else {
                        onSortChange('prix_asc');
                    }
                }}
                activeOpacity={0.7}
            >
                <SafeIcon
                    name={sortBy === 'prix_desc' ? 'arrow-down' : 'arrow-up'}
                    size={16}
                    color={(sortBy === 'prix_asc' || sortBy === 'prix_desc') ? '#FFFFFF' : modernColors.primary}
                />
                <Text style={[styles.quickSortText, (sortBy === 'prix_asc' || sortBy === 'prix_desc') && styles.quickSortTextActive]}>
                    Prix {sortBy === 'prix_desc' ? '↓' : sortBy === 'prix_asc' ? '↑' : ''}
                </Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    quickSortRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 8,
        paddingBottom: 12,
        gap: 8,
    },
    quickSortPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#D1D5DB',
    },
    quickSortPillActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    quickSortText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
    },
    quickSortTextActive: {
        color: '#FFFFFF',
    },
});

export default QuickSortBar;

