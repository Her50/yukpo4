import React, { useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme/theme';

const TestNotificationScreen: React.FC = () => {
    const [notifications, setNotifications] = useState([
        {
            id: '1',
            type: 'success',
            title: 'Service créé avec succès',
            message: 'Votre service "Coiffure à domicile" a été publié',
            timestamp: 'Il y a 2 heures',
            isRead: false,
        },
        {
            id: '2',
            type: 'info',
            title: 'Nouvelle interaction',
            message: 'Vous avez reçu un message pour votre service',
            timestamp: 'Il y a 4 heures',
            isRead: false,
        },
        {
            id: '3',
            type: 'warning',
            title: 'Budget faible',
            message: 'Votre solde de tokens est faible (500 XAF restants)',
            timestamp: 'Il y a 1 jour',
            isRead: true,
        },
        {
            id: '4',
            type: 'error',
            title: 'Erreur de paiement',
            message: 'Le paiement pour votre service a échoué',
            timestamp: 'Il y a 2 jours',
            isRead: true,
        },
    ]);

    const getNotificationIcon = (type: string) => {
        switch (type) {
            case 'success': return '✅';
            case 'info': return 'ℹ️';
            case 'warning': return '⚠️';
            case 'error': return '❌';
            default: return '📢';
        }
    };

    const getNotificationColor = (type: string) => {
        switch (type) {
            case 'success': return '#10B981';
            case 'info': return '#3B82F6';
            case 'warning': return '#F59E0B';
            case 'error': return '#EF4444';
            default: return '#6B7280';
        }
    };

    const markAsRead = (id: string) => {
        setNotifications(prev =>
            prev.map(notif =>
                notif.id === id ? { ...notif, isRead: true } : notif
            )
        );
    };

    const markAllAsRead = () => {
        setNotifications(prev =>
            prev.map(notif => ({ ...notif, isRead: true }))
        );
        Alert.alert('Succès', 'Toutes les notifications ont été marquées comme lues');
    };

    const clearAll = () => {
        Alert.alert(
            'Confirmer',
            'Voulez-vous supprimer toutes les notifications ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => setNotifications([])
                }
            ]
        );
    };

    const unreadCount = notifications.filter(n => !n.isRead).length;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>🔔 Notifications</Text>
                <Text style={styles.subtitle}>
                    {unreadCount > 0 ? `${unreadCount} non lue(s)` : 'Toutes lues'}
                </Text>
            </View>

            <View style={styles.actionsContainer}>
                <TouchableOpacity style={styles.actionButton} onPress={markAllAsRead}>
                    <Text style={styles.actionButtonText}>Tout marquer comme lu</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionButton, styles.clearButton]} onPress={clearAll}>
                    <Text style={[styles.actionButtonText, styles.clearButtonText]}>Tout supprimer</Text>
                </TouchableOpacity>
            </View>

            <View style={styles.notificationsContainer}>
                {notifications.length === 0 ? (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>📭</Text>
                        <Text style={styles.emptyTitle}>Aucune notification</Text>
                        <Text style={styles.emptyText}>
                            Vous n'avez pas encore de notifications
                        </Text>
                    </View>
                ) : (
                    notifications.map((notification) => (
                        <TouchableOpacity
                            key={notification.id}
                            style={[
                                styles.notificationCard,
                                !notification.isRead && styles.unreadCard
                            ]}
                            onPress={() => markAsRead(notification.id)}
                        >
                            <View style={styles.notificationHeader}>
                                <View style={styles.notificationIcon}>
                                    <Text style={styles.iconText}>
                                        {getNotificationIcon(notification.type)}
                                    </Text>
                                </View>
                                <View style={styles.notificationContent}>
                                    <Text style={styles.notificationTitle}>
                                        {notification.title}
                                    </Text>
                                    <Text style={styles.notificationMessage}>
                                        {notification.message}
                                    </Text>
                                    <Text style={styles.notificationTime}>
                                        {notification.timestamp}
                                    </Text>
                                </View>
                                {!notification.isRead && (
                                    <View style={[
                                        styles.unreadDot,
                                        { backgroundColor: getNotificationColor(notification.type) }
                                    ]} />
                                )}
                            </View>
                        </TouchableOpacity>
                    ))
                )}
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
    actionsContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 12,
    },
    actionButton: {
        flex: 1,
        backgroundColor: theme.colors.primary,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    clearButton: {
        backgroundColor: '#EF4444',
    },
    actionButtonText: {
        color: 'white',
        fontSize: 14,
        fontWeight: '600',
    },
    clearButtonText: {
        color: 'white',
    },
    notificationsContainer: {
        padding: 16,
    },
    notificationCard: {
        backgroundColor: 'white',
        borderRadius: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    unreadCard: {
        borderLeftWidth: 4,
        borderLeftColor: theme.colors.primary,
    },
    notificationHeader: {
        flexDirection: 'row',
        padding: 16,
        alignItems: 'flex-start',
    },
    notificationIcon: {
        marginRight: 12,
    },
    iconText: {
        fontSize: 24,
    },
    notificationContent: {
        flex: 1,
    },
    notificationTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 4,
    },
    notificationMessage: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
    },
    notificationTime: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        marginTop: 4,
    },
    emptyContainer: {
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
    },
});

export default TestNotificationScreen;






