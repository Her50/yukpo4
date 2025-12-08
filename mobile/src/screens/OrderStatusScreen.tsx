/**
 * OrderStatusScreen - Suivi de commande avec statuts temps réel
 * Affiche le statut d'une commande (Pending → Validated → Ready → etc.)
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { Order, orderService } from '../services/orderService';
import { modernColors } from '../theme/modernTheme';

const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente de validation',
    validated: 'Validée',
    ready: 'Prête',
    rejected: 'Rejetée',
    cancelled: 'Annulée',
};

const STATUS_COLORS: Record<string, string> = {
    pending: '#F59E0B', // Orange
    validated: '#3B82F6', // Bleu
    ready: '#10B981', // Vert
    rejected: '#EF4444', // Rouge
    cancelled: '#6B7280', // Gris
};

const OrderStatusScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const orderId = (route.params as any)?.orderId as string;

    const [order, setOrder] = useState<Order | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const loadOrder = async () => {
        if (!orderId) {
            setError('ID de commande manquant');
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const orderData = await orderService.getOrder(orderId);
            setOrder(orderData);
        } catch (err: any) {
            console.error('[OrderStatusScreen] Erreur chargement commande:', err);
            setError(err.message || 'Erreur lors du chargement de la commande');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadOrder();

        // Polling toutes les 10 secondes pour mise à jour temps réel
        const interval = setInterval(() => {
            if (orderId) {
                loadOrder();
            }
        }, 10000);

        return () => {
            // ✅ SÉCURITÉ: Vérifier que interval existe avant de le nettoyer
            if (interval) {
                clearInterval(interval);
            }
        };
    }, [orderId]);

    const onRefresh = () => {
        setRefreshing(true);
        loadOrder();
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const formatPreparationTime = (minutes?: number): string => {
        if (!minutes) return 'Non défini';
        if (minutes < 60) return `${minutes} min`;
        const hours = Math.floor(minutes / 60);
        const mins = minutes % 60;
        return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
    };

    if (loading && !order) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Suivi de commande</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            </View>
        );
    }

    if (error && !order) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Suivi de commande</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.errorContainer}>
                    <SafeIcon name="alert-circle" size={48} color={modernColors.error} />
                    <Text style={styles.errorText}>{error}</Text>
                    <TouchableOpacity style={styles.retryButton} onPress={loadOrder}>
                        <Text style={styles.retryButtonText}>Réessayer</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    if (!order) {
        return null;
    }

    const statusColor = STATUS_COLORS[order.status] || modernColors.text;
    const statusLabel = STATUS_LABELS[order.status] || order.status;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    accessibilityLabel="Retour"
                    accessibilityRole="button"
                    accessibilityHint="Retourne à l'écran précédent"
                >
                    <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Suivi de commande</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView
                style={styles.content}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {/* Statut actuel */}
                <View style={styles.statusCard}>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusBadgeText}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.orderId}>Commande #{order.id.slice(0, 8)}</Text>
                </View>

                {/* Informations produit */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informations produit</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Service ID:</Text>
                        <Text style={styles.infoValue}>{order.service_id}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Produit:</Text>
                        <Text style={styles.infoValue}>Index {order.product_index}</Text>
                    </View>
                </View>

                {/* Temps de préparation */}
                {order.preparation_time_minutes && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Temps de préparation</Text>
                        <Text style={styles.preparationTime}>
                            {formatPreparationTime(order.preparation_time_minutes)}
                        </Text>
                    </View>
                )}

                {/* Date de disponibilité estimée */}
                {order.estimated_ready_at && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Prêt le</Text>
                        <Text style={styles.estimatedReady}>{formatDate(order.estimated_ready_at)}</Text>
                    </View>
                )}

                {/* Dates importantes */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Historique</Text>
                    <View style={styles.infoRow}>
                        <Text style={styles.infoLabel}>Créée le:</Text>
                        <Text style={styles.infoValue}>{formatDate(order.created_at)}</Text>
                    </View>
                    {order.validated_at && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Validée le:</Text>
                            <Text style={styles.infoValue}>{formatDate(order.validated_at)}</Text>
                        </View>
                    )}
                    {order.rejected_at && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Rejetée le:</Text>
                            <Text style={styles.infoValue}>{formatDate(order.rejected_at)}</Text>
                        </View>
                    )}
                    {order.validation_deadline && (
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>Délai validation:</Text>
                            <Text style={styles.infoValue}>{formatDate(order.validation_deadline)}</Text>
                        </View>
                    )}
                </View>

                {/* Raison de rejet */}
                {order.rejection_reason && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Raison du rejet</Text>
                        <Text style={styles.rejectionReason}>{order.rejection_reason}</Text>
                    </View>
                )}

                {/* Actions selon le statut */}
                {order.status === 'pending' && order.provider_user_id === user?.id && (
                    <View style={styles.actionsSection}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.validateButton]}
                            onPress={() => {
                                Alert.alert(
                                    'Valider la commande',
                                    'Voulez-vous valider cette commande ?',
                                    [
                                        { text: 'Annuler', style: 'cancel' },
                                        {
                                            text: 'Valider',
                                            onPress: async () => {
                                                try {
                                                    await orderService.validateOrder(order.id, {});
                                                    loadOrder();
                                                    Alert.alert('Succès', 'Commande validée');
                                                } catch (err: any) {
                                                    Alert.alert('Erreur', err.message);
                                                }
                                            },
                                        },
                                    ]
                                );
                            }}
                            accessibilityLabel="Valider la commande"
                            accessibilityRole="button"
                            accessibilityHint="Valide cette commande en attente"
                        >
                            <SafeIcon name="checkmark-circle" size={20} color="#FFF" />
                            <Text style={styles.actionButtonText}>Valider</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    content: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.error,
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 24,
        paddingHorizontal: 24,
        paddingVertical: 12,
        backgroundColor: modernColors.primary,
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    statusCard: {
        margin: 16,
        padding: 20,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        alignItems: 'center',
    },
    statusBadge: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 12,
    },
    statusBadgeText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    orderId: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    section: {
        margin: 16,
        marginTop: 0,
        padding: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    infoValue: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    preparationTime: {
        fontSize: 18,
        color: modernColors.primary,
        fontWeight: '600',
    },
    estimatedReady: {
        fontSize: 16,
        color: modernColors.success,
        fontWeight: '500',
    },
    rejectionReason: {
        fontSize: 14,
        color: modernColors.error,
        fontStyle: 'italic',
    },
    actionsSection: {
        margin: 16,
        marginTop: 0,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 8,
        gap: 8,
    },
    validateButton: {
        backgroundColor: modernColors.success,
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default OrderStatusScreen;

