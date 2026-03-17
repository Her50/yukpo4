// ✅ Composant badge score compatibilité
// Date: 2025-01-29

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface CompatibilityScoreBadgeProps {
    score: number; // 0-100
    size?: 'small' | 'medium' | 'large';
}

export const CompatibilityScoreBadge: React.FC<CompatibilityScoreBadgeProps> = ({
    score,
    size = 'medium',
}) => {
    const getScoreColor = (score: number) => {
    const { t } = useLanguageSafe();
        if (score >= 80) return '#10B981'; // Vert
        if (score >= 60) return '#F59E0B'; // Orange
        return '#EF4444'; // Rouge
    };

    const getScoreLabel = (score: number) => {
        if (score >= 90) return 'Excellent';
        if (score >= 80) return t('compatibilityScoreBadge.tresBon');
        if (score >= 70) return 'Bon';
        if (score >= 60) return 'Correct';
        return 'Faible';
    };

    const color = getScoreColor(score);
    const label = getScoreLabel(score);

    return (
        <View style={styles.container}>
            <View style={[styles.scoreCircle, { borderColor: color }]}>
                <Text style={[styles.scoreText, { color }]}>{Math.round(score)}</Text>
            </View>
            <Text style={[styles.label, { color }]}>{label}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
    },
    scoreCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        borderWidth: 3,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    scoreText: {
        fontSize: 20,
        fontWeight: 'bold',
    },
    label: {
        fontSize: 12,
        fontWeight: '600',
        marginTop: 4,
    },
});

