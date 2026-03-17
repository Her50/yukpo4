/**
 * ProviderOrderManagementScreen - Gestion des commandes pour prestataire
 * Liste des commandes en attente avec actions : Valider / Rejeter / Modifier stock
 * Notifications sonores pour nouvelles commandes
 */

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { useAuth } from '../contexts/AuthContext';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { notificationSoundService } from '../services/notificationSoundService';
import { Order, orderService } from '../services/orderService';
import { modernColors } from '../theme/modernTheme';

const STATUS_LABELS: Record<string, string> = {
    pending: 'En attente',
    validated: t('providerOrderManagementScreen.validee'),
    ready: t('providerOrderManagementScreen.prete'),
    rejected: t('providerOrderManagementScreen.rejetee'),
    cancelled: t('providerOrderManagementScreen.annulee'),
};

const ProviderOrderManagementScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { t } = useLanguageSafe();

    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [lastOrderCount, setLastOrderCount] = useState(0);
    const [validatingOrderId, setValidatingOrderId] = useState<string | null>(null);
    const [rejectingOrderId, setRejectingOrderId] = useState<string | null>(null);

    const loadOrders = async () => {
        try {
            const ordersData = await orderService.getProviderPendingOrders();
            setOrders(ordersData);

            // Vérifier nouvelles commandes pour notification sonore
            const newOrdersCount = ordersData.filter(
                (o) => o.status === 'pending'
            ).length;
            if (newOrdersCount > lastOrderCount && lastOrderCount > 0) {
                // Nouvelle commande détectée
                playNotificationSound('order');
            }
            setLastOrderCount(newOrdersCount);
        } catch (err: any) {
            console.error('[ProviderOrderManagement] Erreur chargement commandes:', err);
            Alert.alert(t('message.error'), err.message || t('providerOrders.cannotLoadOrders'));
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Notification sonore avec expo-av
    const playNotificationSound = async (type: 'order' | 'courier' | 'ready') => {
        try {
            await notificationSoundService.playSound(type);
        } catch (error) {
            console.error(`[ProviderOrderManagement] Erreur lecture son ${type}:`, error);
        }
    };

    useFocusEffect(
        useCallback(() => {
            // Initialiser le service audio au focus
            notificationSoundService.initialize().catch(console.error);

            loadOrders();

            // Polling toutes les 15 secondes
            const interval = setInterval(() => {
                loadOrders();
            }, 15000);

            return () => {
                clearInterval(interval);
                // Nettoyer les sons à la sortie de l'écran (optionnel)
                // notificationSoundService.cleanup().catch(console.error);
            };
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        loadOrders();
    };

    const handleValidate = async (order: Order) => {
        Alert.alert(
            t('providerOrders.validateOrder'),
            t('providerOrders.confirmValidate'),
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.validate'),
                    onPress: async () => {
                        try {
                            setValidatingOrderId(order.id);
                            await orderService.validateOrder(order.id, {});
                            Alert.alert(t('message.success'), t('providerOrders.orderValidated'));
                            loadOrders();
                        } catch (err: any) {
                            Alert.alert(t('message.error'), err.message);
                        } finally {
                            setValidatingOrderId(null);
                        }
                    },
                },
            ]
        );
    };

    const handleReject = (order: Order) => {
        setSelectedOrder(order);
        setRejectReason('');
        setShowRejectModal(true);
    };

    const confirmReject = async () => {
        if (!selectedOrder || !rejectReason.trim()) {
            Alert.alert(t('message.error'), t('providerOrders.rejectReasonRequired'));
            return;
        }

        try {
            setRejectingOrderId(selectedOrder.id);
            await orderService.rejectOrder(selectedOrder.id, rejectReason);
            Alert.alert(t('message.success'), t('providerOrders.orderRejected'));
            setShowRejectModal(false);
            setSelectedOrder(null);
            setRejectReason('');
            loadOrders();
        } catch (err: any) {
            Alert.alert(t('message.error'), err.message);
        } finally {
            setRejectingOrderId(null);
        }
    };

    const formatDate = (dateString?: string): string => {
        if (!dateString) return 'N/A';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    const renderOrderItem = ({ item }: { item: Order }) => {
        const isPending = item.status === 'pending';
        const statusColor = isPending ? modernColors.warning : modernColors.textSecondary;

        return (
            <View style={styles.orderCard}>
                <View style={styles.orderHeader}>
                    <View>
                        <Text style={styles.orderId}>Commande #{item.id.slice(0, 8)}</Text>
                        <Text style={styles.orderDate}>{t('providerOrderManagementScreen.creeeLe')} {formatDate(item.created_at)}</Text>
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusBadgeText}>{STATUS_LABELS[item.status] || item.status}</Text>
                    </View>
                </View>

                <View style={styles.orderInfo}>
                    <Text style={styles.orderInfoText}>
                        Service ID: {item.service_id} • Produit: {item.product_index}
                    </Text>
                    {item.preparation_time_minutes && (
                        <Text style={styles.orderInfoText}>
                            Temps préparation: {item.preparation_time_minutes} min
                        </Text>
                    )}
                    {item.estimated_ready_at && (
                        <Text style={styles.orderInfoText}>
                            Prêt le: {formatDate(item.estimated_ready_at)}
                        </Text>
                    )}
                    {item.validation_deadline && (
                        <Text style={styles.deadlineText}>
                            ⏰ Délai: {formatDate(item.validation_deadline)}
                        </Text>
                    )}
                </View>

                {isPending && (
                    <View style={styles.orderActions}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.validateButton, validatingOrderId === item.id && styles.actionButtonDisabled]}
                            onPress={() => handleValidate(item)}
                            disabled={validatingOrderId === item.id || rejectingOrderId === item.id}
                            accessibilityLabel="Valider la commande"
                            accessibilityRole="button"
                            accessibilityHint="Valide cette commande en attente"
                        >
                            {validatingOrderId === item.id ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <SafeIcon name="checkmark-circle" size={18} color="#FFF" />
                            )}
                            <Text style={styles.actionButtonText}>
                                {validatingOrderId === item.id ? 'Validation...' : 'Valider'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton, rejectingOrderId === item.id && styles.actionButtonDisabled]}
                            onPress={() => handleReject(item)}
                            disabled={validatingOrderId === item.id || rejectingOrderId === item.id}
                            accessibilityLabel="Rejeter la commande"
                            accessibilityRole="button"
                            accessibilityHint="Rejette cette commande avec une raison"
                        >
                            {rejectingOrderId === item.id ? (
                                <ActivityIndicator size="small" color="#FFF" />
                            ) : (
                                <SafeIcon name="close-circle" size={18} color="#FFF" />
                            )}
                            <Text style={styles.actionButtonText}>
                                {rejectingOrderId === item.id ? 'Rejet...' : 'Rejeter'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    if (loading && orders.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('providerOrderManagement.mesCommandes')}</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('providerOrderManagement.chargement')}</Text>
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                    accessibilityLabel={t('providerOrderManagementScreen.retourt('providerOrderManagementScreen.accessibilityrolebuttonAccessibilityhintretourneAL')écran précédent"
                >
                    <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('providerOrderManagement.mesCommandes')}</Text>
                <TouchableOpacity
                    onPress={loadOrders}
                    style={styles.refreshButton}
                    accessibilityLabel="Actualiser la liste"
                    accessibilityRole="button"
                    accessibilityHint=t('providerOrderManagementScreen.rafraichitLaListeDesCommandes')
                >
                    <SafeIcon name="refresh" size={24} color={modernColors.primary} />
                </TouchableOpacity>
            </View>

            {orders.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="document-text-outline" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>{t('providerOrderManagement.aucuneCommandeEnAttente')}</Text>
                </View>
            ) : (
                <FlatList
                    data={orders}
                    renderItem={renderOrderItem}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                />
            )}

            {/* Modal rejet */}
            {showRejectModal && (
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Rejeter la commande</Text>
                        <Text style={styles.modalSubtitle}>
                            Veuillez indiquer la raison du rejet
                        </Text>
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Raison du rejet..."
                            placeholderTextColor={modernColors.textSecondary}
                            multiline
                            numberOfLines={4}
                            value={rejectReason}
                            onChangeText={setRejectReason}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.cancelButton]}
                                onPress={() => {
                                    setShowRejectModal(false);
                                    setSelectedOrder(null);
                                    setRejectReason('');
                                }}
                                accessibilityLabel={t('providerOrderManagementScreen.annulerLeRejet')}
                                accessibilityRole="button"
                                accessibilityHint="Annule le rejet de la commande"
                            >
                                <Text style={styles.cancelButtonText}>{t('providerOrderManagementScreen.annuler')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalButton, styles.confirmButton]}
                                onPress={confirmReject}
                                disabled={rejectingOrderId === selectedOrder?.id}
                                accessibilityLabel={t('providerOrderManagementScreen.confirmerLeRejet')}
                                accessibilityRole="button"
                                accessibilityHint="Confirme le rejet de la commande"
                            >
                                {rejectingOrderId === selectedOrder?.id ? (
                                    <ActivityIndicator size="small" color="#FFF" />
                                ) : null}
                                <Text style={styles.confirmButtonText}>
                                    {rejectingOrderId === selectedOrder?.id ? 'Rejet...' : 'Confirmer'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            )}
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
    refreshButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    listContent: {
        padding: 16,
    },
    orderCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    orderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    orderId: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    orderDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
    },
    statusBadgeText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    orderInfo: {
        marginBottom: 12,
    },
    orderInfoText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    deadlineText: {
        fontSize: 14,
        color: modernColors.warning,
        fontWeight: '500',
        marginTop: 4,
    },
    orderActions: {
        flexDirection: 'row',
        gap: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        gap: 6,
    },
    validateButton: {
        backgroundColor: modernColors.success,
    },
    rejectButton: {
        backgroundColor: modernColors.error,
    },
    actionButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    actionButtonDisabled: {
        opacity: 0.6,
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 24,
        width: '90%',
        maxWidth: 400,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    modalSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: modernColors.text,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 16,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    modalButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        alignItems: 'center',
    },
    cancelButton: {
        backgroundColor: modernColors.border,
    },
    cancelButtonText: {
        color: modernColors.text,
        fontSize: 16,
        fontWeight: '600',
    },
    confirmButton: {
        backgroundColor: modernColors.error,
    },
    confirmButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default ProviderOrderManagementScreen;

