import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { theme } from '../theme/theme';

const TestDashboardScreen: React.FC = () => {
    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>📊 Dashboard Test</Text>
                <Text style={styles.subtitle}>Écran de test pour vérifier l'affichage</Text>
            </View>

            <View style={styles.content}>
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Services Actifs</Text>
                    <Text style={styles.cardValue}>5</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Vues Total</Text>
                    <Text style={styles.cardValue}>1,234</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Interactions</Text>
                    <Text style={styles.cardValue}>89</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>Budget Consommé</Text>
                    <Text style={styles.cardValue}>2,500 XAF</Text>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F9FA',
    },
    header: {
        backgroundColor: theme.colors.primary,
        padding: 20,
        paddingTop: 40,
    },
    title: {
        fontSize: 28,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    content: {
        padding: 16,
        gap: 12,
    },
    card: {
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cardTitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    cardValue: {
        fontSize: 24,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
});

export default TestDashboardScreen;









