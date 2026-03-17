// ✅ Composant sélection assurance pour réservation covoiturage
// Date: 2025-01-29

import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { SafeIcon } from '../SafeIcon';

interface InsuranceSelectorProps {
    onSelect: (coverageType: 'basic' | 'premium' | 'full') => void;
    selected?: 'basic' | 'premium' | 'full';
}

export const InsuranceSelector: React.FC<InsuranceSelectorProps> = ({
    onSelect,
    selected,
}) => {
    const { t } = useLanguageSafe();
    const options = [
        {
            type: 'basic' as const,
            name: 'Basic',
            amount: '50,000 XAF',
            description: 'Couverture de base',
            icon: 'shield',
        },
        {
            type: 'premium' as const,
            name: 'Premium',
            amount: '200,000 XAF',
            description: t('insuranceSelector.couvertureEtendue'),
            icon: 'shield-check',
        },
        {
            type: 'full' as const,
            name: 'Full',
            amount: '500,000 XAF',
            description: t('insuranceSelector.couvertureComplete'),
            icon: 'shield-star',
        },
    ];

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Assurance passager</Text>
            <Text style={styles.subtitle}>Choisissez votre niveau de couverture</Text>

            {options.map((option) => (
                <TouchableOpacity
                    key={option.type}
                    onPress={() => onSelect(option.type)}
                    style={[
                        styles.option,
                        selected === option.type && styles.optionSelected,
                    ]}
                >
                    <View style={styles.optionContent}>
                        <SafeIcon name={option.icon} size={24} color={selected === option.type ? '#6366F1' : '#9CA3AF'} />
                        <View style={styles.optionText}>
                            <Text style={[styles.optionName, selected === option.type && styles.optionNameSelected]}>
                                {option.name}
                            </Text>
                            <Text style={styles.optionAmount}>{option.amount}</Text>
                            <Text style={styles.optionDescription}>{option.description}</Text>
                        </View>
                        {selected === option.type && (
                            <SafeIcon name="check-circle" size={24} color="#6366F1" />
                        )}
                    </View>
                </TouchableOpacity>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 16,
    },
    option: {
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        backgroundColor: '#fff',
    },
    optionSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    optionContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    optionText: {
        flex: 1,
        marginLeft: 12,
    },
    optionName: {
        fontSize: 18,
        fontWeight: '600',
        marginBottom: 4,
    },
    optionNameSelected: {
        color: '#6366F1',
    },
    optionAmount: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#10B981',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 14,
        color: '#6B7280',
    },
});

