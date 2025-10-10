import { Brain, Clock, DollarSign, TrendingUp } from 'phosphor-react-native';
import React from 'react';
import ReactNative from 'react-native';
import { Card } from 'react-native-paper';
import { theme } from '../theme/theme';

const { StyleSheet, Text, View } = ReactNative;

interface GlobalIAStatsPanelProps {
    stats?: {
        totalServices: number;
        totalTokens: number;
        averageCost: number;
        successRate: number;
    };
    compact?: boolean;
}

const GlobalIAStatsPanel: React.FC<GlobalIAStatsPanelProps> = ({
    stats = {
        totalServices: 0,
        totalTokens: 0,
        averageCost: 0,
        successRate: 0
    },
    compact = false
}) => {
    const statItems = [
        {
            icon: <Brain size={20} color={theme.colors.primary} />,
            label: 'Services créés',
            value: stats.totalServices.toString(),
            color: theme.colors.primary
        },
        {
            icon: <DollarSign size={20} color="#10B981" />,
            label: 'Tokens utilisés',
            value: stats.totalTokens.toString(),
            color: '#10B981'
        },
        {
            icon: <TrendingUp size={20} color="#F59E0B" />,
            label: 'Coût moyen',
            value: `${stats.averageCost} tokens`,
            color: '#F59E0B'
        },
        {
            icon: <Clock size={20} color="#8B5CF6" />,
            label: 'Taux de succès',
            value: `${stats.successRate}%`,
            color: '#8B5CF6'
        }
    ];

    if (compact) {
        return (
            <View style={styles.compactContainer}>
                <Brain size={16} color={theme.colors.primary} />
                <Text style={styles.compactText}>
                    {stats.totalServices} services, {stats.totalTokens} tokens
                </Text>
            </View>
        );
    }

    return (
        <Card style={styles.container}>
            <Card.Content>
                <View style={styles.header}>
                    <Brain size={24} color={theme.colors.primary} />
                    <Text style={styles.title}>Statistiques IA</Text>
                </View>

                <View style={styles.statsGrid}>
                    {statItems.map((item, index) => (
                        <View key={index} style={styles.statItem}>
                            <View style={[styles.statIcon, { backgroundColor: `${item.color}15` }]}>
                                {item.icon}
                            </View>
                            <Text style={styles.statValue}>{item.value}</Text>
                            <Text style={styles.statLabel}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                <View style={styles.summary}>
                    <Text style={styles.summaryText}>
                        Votre IA a généré {stats.totalServices} services avec un taux de succès de {stats.successRate}%
                    </Text>
                </View>
            </Card.Content>
        </Card>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 8,
        backgroundColor: 'white',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginLeft: 8,
    },
    statsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    statItem: {
        width: '48%',
        alignItems: 'center',
        padding: 12,
        marginBottom: 12,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    statIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    statValue: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
    summary: {
        padding: 12,
        backgroundColor: '#f0f8ff',
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: theme.colors.primary,
    },
    summaryText: {
        fontSize: 14,
        color: theme.colors.text,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    compactContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 8,
        backgroundColor: '#f8f9fa',
        borderRadius: 8,
    },
    compactText: {
        fontSize: 12,
        color: theme.colors.text,
        marginLeft: 4,
    },
});

export default GlobalIAStatsPanel;


