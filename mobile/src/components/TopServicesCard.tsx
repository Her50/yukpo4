import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';

interface TopService {
    id: string;
    title: string;
    category: string;
    views: number;
    interactions: number;
    rating?: number;
    status: 'active' | 'inactive' | 'pending';
}

interface TopServicesCardProps {
    services: TopService[];
    onServicePress?: (service: TopService) => void;
    onViewAllPress?: () => void;
}

const TopServicesCard: React.FC<TopServicesCardProps> = ({
    services,
    onServicePress,
    onViewAllPress
}) => {
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active': return '#10B981';
            case 'inactive': return '#EF4444';
            case 'pending': return '#F59E0B';
            default: return '#6B7280';
        }
    };

    const getStatusText = (status: string) => {
        switch (status) {
            case 'active': return 'Actif';
            case 'inactive': return 'Inactif';
            case 'pending': return 'En attente';
            default: return 'Inconnu';
        }
    };

    const formatNumber = (num: number) => {
        return num.toLocaleString('fr-FR');
    };

    if (services.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>Services les Plus Performants</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>💼</Text>
                    <Text style={styles.emptyTitle}>Aucun service</Text>
                    <Text style={styles.emptyText}>
                        Créez votre premier service pour voir les statistiques de performance
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Services les Plus Performants</Text>
                {onViewAllPress && (
                    <TouchableOpacity onPress={onViewAllPress} style={styles.viewAllButton}>
                        <Text style={styles.viewAllText}>Voir tout</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {services.map((service, index) => (
                    <TouchableOpacity
                        key={service.id}
                        style={styles.serviceCard}
                        onPress={() => onServicePress?.(service)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.serviceHeader}>
                            <View style={styles.rankContainer}>
                                <Text style={styles.rankText}>#{index + 1}</Text>
                            </View>
                            <View style={[
                                styles.statusBadge,
                                { backgroundColor: getStatusColor(service.status) }
                            ]}>
                                <Text style={styles.statusText}>
                                    {getStatusText(service.status)}
                                </Text>
                            </View>
                        </View>

                        <View style={styles.serviceContent}>
                            <Text style={styles.serviceTitle} numberOfLines={2}>
                                {service.title}
                            </Text>
                            <Text style={styles.serviceCategory} numberOfLines={1}>
                                {service.category}
                            </Text>

                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>👁️</Text>
                                    <Text style={styles.statValue}>{formatNumber(service.views)}</Text>
                                    <Text style={styles.statLabel}>vues</Text>
                                </View>

                                <View style={styles.statItem}>
                                    <Text style={styles.statIcon}>💬</Text>
                                    <Text style={styles.statValue}>{formatNumber(service.interactions)}</Text>
                                    <Text style={styles.statLabel}>interactions</Text>
                                </View>
                            </View>

                            {service.rating && typeof service.rating === 'number' && (
                                <View style={styles.ratingContainer}>
                                    <Text style={styles.ratingIcon}>⭐</Text>
                                    <Text style={styles.ratingText}>{service.rating.toFixed(1)}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>
                ))}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: 'white',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    viewAllButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        backgroundColor: theme.colors.primary,
        borderRadius: 16,
    },
    viewAllText: {
        color: 'white',
        fontSize: 12,
        fontWeight: '600',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 32,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 20,
    },
    scrollContent: {
        paddingRight: 16,
    },
    serviceCard: {
        width: 200,
        backgroundColor: '#F8F9FA',
        borderRadius: 12,
        padding: 16,
        marginRight: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    serviceHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    rankContainer: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: theme.colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rankText: {
        color: 'white',
        fontSize: 12,
        fontWeight: 'bold',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '600',
    },
    serviceContent: {
        flex: 1,
    },
    serviceTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 4,
        lineHeight: 20,
    },
    serviceCategory: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        marginBottom: 12,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    statItem: {
        alignItems: 'center',
        flex: 1,
    },
    statIcon: {
        fontSize: 16,
        marginBottom: 4,
    },
    statValue: {
        fontSize: 14,
        fontWeight: 'bold',
        color: theme.colors.text,
    },
    statLabel: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
    },
    ratingIcon: {
        fontSize: 14,
        marginRight: 4,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: theme.colors.text,
    },
});

export default TopServicesCard;


