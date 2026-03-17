/**
 * Composant de remplacement pour les composants manquants
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface MissingComponentProps {
    name: string;
    message?: string;
}

export const MissingComponent: React.FC<MissingComponentProps> = ({
    name,
    message = t('missingComponent.composantEnCoursDeDeveloppement')
}) => {
    return (
        <View style={styles.container}>
            <Text style={styles.title}>⚠️ Composant manquant</Text>
            <Text style={styles.name}>{name}</Text>
            <Text style={styles.message}>{message}</Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#FEF3C7',
        borderRadius: 8,
        margin: 8,
        borderLeftWidth: 4,
        borderLeftColor: '#F59E0B',
    },
    title: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#92400E',
        marginBottom: 4,
    },
    name: {
        fontSize: 14,
        color: '#92400E',
        fontWeight: '600',
        marginBottom: 8,
    },
    message: {
        fontSize: 12,
        color: '#92400E',
        fontStyle: 'italic',
    },
});

export default MissingComponent;
