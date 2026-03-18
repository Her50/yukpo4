import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface ActivityItem {
    id: string;
    type: 'view' | 'message' | 'call' | 'service_created' | 'service_updated' | 'rating';
    title: string;
    description: string;
    timestamp: string;
    serviceId?: string;
    metadata?: any;
}

interface RecentActivityCardProps {
    activities: ActivityItem[];
    onActivityPress?: (activity: ActivityItem) => void;
    onViewAllPress?: () => void;
}

const RecentActivityCard: React.FC<RecentActivityCardProps> = ({
    activities,
    onActivityPress,
    onViewAllPress
}) => {
    const getActivityIcon = (type: string) => {
        switch (type) {
            case 'view': return '\uD83D\uDC41️';
            case 'message': return '\uD83D\uDCAC';
            case 'call': return '\uD83D\uDCDE';
            case 'service_created': return '✨';
            case 'service_updated': return '✏️';
            case 'rating': return '⭐';
            default: return '\uD83D\uDCCB';
        }
    };

    const getActivityColor = (type: string) => {
        switch (type) {
            case 'view': return '#3B82F6';
            case 'message': return '#10B981';
            case 'call': return '#8B5CF6';
            case 'service_created': return '#F59E0B';
            case 'service_updated': return '#EF4444';
            case 'rating': return '#F97316';
            default: return '#6B7280';
        }
    };

    const formatTime = (timestamp: string) => {
        const now = new Date();
        const date = new Date(timestamp);
        const diff = now.getTime() - date.getTime();

        const minutes = Math.floor(diff / (1000 * 60));
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));

        if (minutes < 60) return `Il y a ${minutes} min`;
        if (hours < 24) return `Il y a ${hours}h`;
        if (days < 7) return `Il y a ${days}j`;

        return date.toLocaleDateString('fr-FR', {
            day: 'numeric',
            month: 'short'
        });
    };

    if (activities.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <Text style={styles.title}>{t('recentActivityCard.activiteRecente')}</Text>
                </View>
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>\uD83D\uDCCA</Text>
                    <Text style={styles.emptyTitle}>{t('recentActivityCard.aucuneActivite')}</Text>
                    <Text style={styles.emptyText}>
                        Vos interactions et activités récentes apparaîtront ici
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t('recentActivityCard.activiteRecente')}</Text>
                {onViewAllPress && (
                    <TouchableOpacity onPress={onViewAllPress} style={styles.viewAllButton}>
                        <Text style={styles.viewAllText}>{t('recentActivityCard.voirTout')}</Text>
                    </TouchableOpacity>
                )}
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
            >
                {activities.map((activity, index) => (
                    <TouchableOpacity
                        key={activity.id || index}
                        style={styles.activityItem}
                        onPress={() => onActivityPress?.(activity)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.activityIconContainer}>
                            <Text style={styles.activityIcon}>
                                {getActivityIcon(activity.type)}
                            </Text>
                        </View>

                        <View style={styles.activityContent}>
                            <Text style={styles.activityTitle} numberOfLines={1}>
                                {activity.title}
                            </Text>
                            <Text style={styles.activityDescription} numberOfLines={2}>
                                {activity.description}
                            </Text>
                            <Text style={styles.activityTime}>
                                {formatTime(activity.timestamp)}
                            </Text>
                        </View>

                        <View style={[
                            styles.activityIndicator,
                            { backgroundColor: getActivityColor(activity.type) }
                        ]} />
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
        paddingBottom: 8,
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        position: 'relative',
    },
    activityIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    activityIcon: {
        fontSize: 20,
    },
    activityContent: {
        flex: 1,
    },
    activityTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    activityDescription: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        lineHeight: 16,
        marginBottom: 4,
    },
    activityTime: {
        fontSize: 10,
        color: theme.colors.textSecondary,
    },
    activityIndicator: {
        position: 'absolute',
        right: 0,
        top: 16,
        width: 4,
        height: 20,
        borderRadius: 2,
    },
});

export default RecentActivityCard;


