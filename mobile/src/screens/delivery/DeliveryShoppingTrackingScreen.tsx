import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import CourierSelectionModal from '../../components/delivery/CourierSelectionModal';
import DeliveryTrackingMap from '../../components/delivery/DeliveryTrackingMap';
import ParcelRejectionModal from '../../components/delivery/ParcelRejectionModal';
import ProofMediaUpload from '../../components/delivery/ProofMediaUpload';
import TimelineStepper from '../../components/delivery/TimelineStepper';
import { NativeButton } from '../../components/NativeDesign';
import { SafeIcon } from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import useDeliveryTracking from '../../hooks/useDeliveryTracking';
import { deliveryApi, shoppingApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary, ParcelRejectionReason, ShoppingBasketItem } from '../../types/delivery';

type TrackingTab = 'timeline' | 'basket' | 'courier';

interface RouteParams {
    deliveryId: string;
}

const DeliveryShoppingTrackingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { deliveryId } = (route.params as RouteParams) ?? { deliveryId: null };
    const [activeTab, setActiveTab] = useState('timeline' as TrackingTab);
    const { delivery, timeline, refresh, loading } = useDeliveryTracking(deliveryId || null);
    const { refreshDelivery, updateRecipientLocation, setActiveDeliveryId } = useDeliveryContext();
    const { user } = useAuth();
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [rejectingItem, setRejectingItem] = useState<ShoppingBasketItem | null>(null);

    // ✅ Phase 9 - Amélioration 28 : Vérifier si l'utilisateur est le créateur
    const isCreator = user && delivery && delivery.creator_id && String(delivery.creator_id) === String(user.id);
    const canAssignCourier = isCreator && !delivery?.courier && (delivery?.status === 'pending' || delivery?.status === 'awaiting_courier');

    useEffect(() => {
        if (!deliveryId) return;
        refreshDelivery(deliveryId, { force: true }).catch(err =>
            console.error('[DeliveryShoppingTracking] initial refresh error', err)
        );
        setActiveDeliveryId(deliveryId);
        return () => {
            setActiveDeliveryId(null);
        };
    }, [deliveryId, refreshDelivery, setActiveDeliveryId]);

    const shoppingItems = useMemo(() => delivery?.shopping?.items ?? [], [delivery?.shopping?.items]);

    const courierInfo = useMemo(() => {
        const summary = delivery as DeliverySummary | undefined;
        return {
            courier: summary?.courier,
            recipient: summary?.recipient,
            pricing: summary?.pricing,
        };
    }, [delivery]);

    // ✅ RECOMMANDATION 4: Vérifier si l'utilisateur actuel est le coursier
    const isCurrentUserCourier = useMemo(() => {
        if (!user?.id || !delivery?.courier?.id) {
            return false;
        }
        return String(user.id) === String(delivery.courier.id);
    }, [user?.id, delivery?.courier?.id]);

    // ✅ Phase 9 - Amélioration : Déterminer si on peut ajouter des médias
    const canAddPickupMedia = isCurrentUserCourier && (
        delivery?.status === 'en_route_pickup' ||
        delivery?.status === 'shopping_completed' ||
        delivery?.status === 'en_route_delivery' ||
        delivery?.status === 'delivered'
    );

    const canAddDeliveryMedia = isCurrentUserCourier && (
        delivery?.status === 'en_route_delivery' ||
        delivery?.status === 'delivered'
    );

    const handleRefresh = async () => {
        if (!deliveryId) return;
        await refresh({ force: true });
    };

    const canShareLocation =
        !!deliveryId &&
        !!delivery?.recipient?.canShareLocation &&
        (!!delivery?.recipient?.id
            ? String(delivery.recipient.id) === String(user?.id)
            : true);

    const shareRecipientLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Autorise la localisation pour partager ta position.');
                return;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            const result = await updateRecipientLocation(deliveryId!, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy ?? undefined,
                heading: position.coords.heading ?? undefined,
                speed: position.coords.speed ?? undefined,
                source: 'recipient',
            });

            if (result?.queued) {
                Alert.alert(
                    'Position en attente',
                    'Connexion interrompue : ta localisation sera envoyée automatiquement dès le retour du réseau.',
                );
            } else {
                Alert.alert('Position partagée', 'Ta localisation a été transmise au coursier.');
            }
        } catch (error: any) {
            console.error('[DeliveryShoppingTracking] shareRecipientLocation error', error);
            Alert.alert('Erreur', error?.message ?? 'Impossible de partager la position.');
        }
    };

    const handleChat = () => {
        navigation.navigate('MesInteractions', {
            focusDeliveryId: deliveryId,
        });
    };

    // ✅ RECOMMANDATION 4: Fonctions pour changer le statut (pour le coursier)
    const [updatingStatus, setUpdatingStatus] = useState(false);

    const handleUpdateStatus = async (newStatus: string) => {
        if (!deliveryId || updatingStatus) return;

        setUpdatingStatus(true);
        try {
            const response = await deliveryApi.updateStatus(deliveryId, newStatus);
            if (response.success) {
                Alert.alert('Statut mis à jour', 'Le statut de la livraison a été mis à jour.');
                await refresh({ force: true });
            } else {
                Alert.alert('Erreur', response.error ?? 'Impossible de mettre à jour le statut.');
            }
        } catch (error: any) {
            console.error('[DeliveryShoppingTracking] Erreur mise à jour statut:', error);
            Alert.alert('Erreur', error?.message ?? 'Impossible de mettre à jour le statut.');
        } finally {
            setUpdatingStatus(false);
        }
    };

    const getNextStatusOptions = (): Array<{ label: string; status: string; icon: string }> => {
        const currentStatus = delivery?.status;
        if (!currentStatus) return [];

        switch (currentStatus) {
            case 'assigned':
            case 'awaiting_courier':
                return [
                    { label: 'Je pars vers le point de départ', status: 'en_route_pickup', icon: '🚚' },
                ];
            case 'en_route_pickup':
                return [
                    { label: 'Je suis arrivé au point de départ', status: 'shopping_pending', icon: '📍' },
                ];
            case 'shopping_pending':
                return [
                    { label: 'Courses en cours', status: 'shopping_in_progress', icon: '🛒' },
                ];
            case 'shopping_in_progress':
                return [
                    { label: 'Courses terminées', status: 'shopping_completed', icon: '✅' },
                ];
            case 'shopping_completed':
                return [
                    { label: 'Colis récupéré, en route', status: 'en_route_delivery', icon: '🚚' },
                ];
            case 'en_route_delivery':
                return [
                    { label: 'Livré', status: 'delivered', icon: '✅' },
                ];
            default:
                return [];
        }
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <ScrollView
                style={styles.scroll}
                refreshControl={<RefreshControl refreshing={loading} onRefresh={handleRefresh} />}
            >
                <View style={styles.header}>
                    <View>
                        <Text style={styles.title}>
                            Livraison #{delivery?.id?.slice(-6) ?? '...'}
                        </Text>
                        <Text style={styles.subtitle}>
                            Statut: {statusToLabel(delivery?.status ?? 'pending')}
                        </Text>
                    </View>
                    <View style={styles.headerActions}>
                        {canShareLocation ? (
                            <NativeButton
                                title='Partager ma position'
                                variant='secondary'
                                onPress={shareRecipientLocation}
                            />
                        ) : null}
                        <NativeButton title='Contacter' variant='outline' onPress={handleChat} />
                    </View>

                    {/* ✅ RECOMMANDATION 4: Boutons de changement de statut pour le coursier */}
                    {isCurrentUserCourier && (
                        <View style={styles.courierActions}>
                            <Text style={styles.courierActionsTitle}>Actions coursier</Text>
                            {getNextStatusOptions().map((option) => (
                                <NativeButton
                                    key={option.status}
                                    title={`${option.icon} ${option.label}`}
                                    variant="primary"
                                    onPress={() => handleUpdateStatus(option.status)}
                                    disabled={updatingStatus}
                                    style={styles.statusButton}
                                />
                            ))}
                        </View>
                    )}
                </View>

                <DeliveryTrackingMap
                    pickup={
                        delivery?.pickup?.location
                            ? {
                                lat: delivery.pickup.location.lat,
                                lng: delivery.pickup.location.lng,
                                label: delivery.pickup.label,
                            }
                            : null
                    }
                    dropoff={
                        delivery?.dropoff?.location
                            ? {
                                lat: delivery.dropoff.location.lat,
                                lng: delivery.dropoff.location.lng,
                                label: delivery.dropoff.label,
                            }
                            : null
                    }
                    courierLocation={delivery?.metadata?.last_location ?? null}
                    recipientLocation={delivery?.recipient?.currentLocation ?? null}
                    waypoints={delivery?.metadata?.route_points ?? []}
                />

                <View style={styles.tabs}>
                    {renderTabButton('timeline', 'Timeline', activeTab, setActiveTab)}
                    {renderTabButton('basket', 'Panier', activeTab, setActiveTab)}
                    {renderTabButton('courier', 'Coursier', activeTab, setActiveTab)}
                </View>

                {activeTab === 'timeline' ? (
                    <View style={styles.card}>
                        <TimelineStepper checkpoints={timeline} currentStatus={delivery?.status ?? 'pending'} />
                    </View>
                ) : null}

                {activeTab === 'basket' ? (
                    <View style={styles.card}>
                        {shoppingItems.map(item => {
                            const isRejected = item.status === 'rejected';
                            const canReject = !isRejected &&
                                (delivery?.status === 'shopping_completed' ||
                                    delivery?.status === 'en_route_delivery' ||
                                    delivery?.status === 'delivered');

                            return (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.itemRow,
                                        isRejected && styles.itemRowRejected
                                    ]}
                                >
                                    <View style={styles.itemContent}>
                                        <View style={styles.itemHeader}>
                                            <Text style={styles.itemLabel}>{item.label}</Text>
                                            {isRejected && (
                                                <View style={styles.rejectedBadge}>
                                                    <SafeIcon name="x-circle" size={16} color={modernColors.error} />
                                                    <Text style={styles.rejectedText}>Refusé</Text>
                                                </View>
                                            )}
                                            {item.status === 'accepted' && (
                                                <View style={styles.acceptedBadge}>
                                                    <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                                                    <Text style={styles.acceptedText}>Accepté</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.itemMeta}>
                                            {item.quantity} {item.unit || 'unités'}
                                            {item.actualTotal
                                                ? ` • ${item.actualTotal.toFixed(0)} ${delivery?.pricing?.currency ?? 'XAF'}`
                                                : item.estimatedTotal
                                                    ? ` • ~${item.estimatedTotal.toFixed(0)} ${delivery?.pricing?.currency ?? 'XAF'}`
                                                    : ''}
                                        </Text>
                                        {isRejected && item.rejection_reason && (
                                            <Text style={styles.rejectionReason}>
                                                Raison : {getRejectionReasonLabel(item.rejection_reason)}
                                            </Text>
                                        )}
                                        {item.note ? <Text style={styles.itemNote}>{item.note}</Text> : null}
                                    </View>
                                    {canReject && (
                                        <NativeButton
                                            title="Refuser"
                                            variant="secondary"
                                            size="small"
                                            onPress={() => setRejectingItem(item)}
                                            style={styles.rejectButton}
                                        />
                                    )}
                                </View>
                            );
                        })}
                    </View>
                ) : null}

                {activeTab === 'courier' ? (
                    <View style={styles.card}>
                        {/* ✅ Phase 9 - Amélioration 28 : Bouton pour choisir un livreur */}
                        {canAssignCourier && (
                            <View style={styles.assignCourierSection}>
                                <NativeButton
                                    title="Choisir un livreur"
                                    variant="primary"
                                    onPress={() => setShowCourierModal(true)}
                                />
                            </View>
                        )}

                        {/* ✅ Phase 9 - Amélioration : Médias de preuve de récupération et livraison */}
                        {isCurrentUserCourier && (canAddPickupMedia || canAddDeliveryMedia) && (
                            <View style={{ marginTop: 16, gap: 16 }}>
                                {canAddPickupMedia && (
                                    <ProofMediaUpload
                                        deliveryId={deliveryId!}
                                        proofType="pickup"
                                        isCourier={true}
                                        onMediaUpdated={() => refresh({ force: true })}
                                    />
                                )}
                                {canAddDeliveryMedia && (
                                    <ProofMediaUpload
                                        deliveryId={deliveryId!}
                                        proofType="delivery"
                                        isCourier={true}
                                        onMediaUpdated={() => refresh({ force: true })}
                                    />
                                )}
                            </View>
                        )}

                        {/* ✅ Phase 9 - Amélioration : Affichage des médias pour le client/créateur */}
                        {!isCurrentUserCourier && deliveryId && (
                            <View style={{ marginTop: 16, gap: 16 }}>
                                <ProofMediaUpload
                                    deliveryId={deliveryId}
                                    proofType="pickup"
                                    isCourier={false}
                                    onMediaUpdated={() => refresh({ force: true })}
                                />
                                <ProofMediaUpload
                                    deliveryId={deliveryId}
                                    proofType="delivery"
                                    isCourier={false}
                                    onMediaUpdated={() => refresh({ force: true })}
                                />
                            </View>
                        )}
                        {/* ✅ Phase 9 - Amélioration 30 : Badge et bouton pour dropoff pending */}
                        {delivery?.metadata?.dropoff_pending === true && (
                            <View style={styles.pendingAddressSection}>
                                <View style={styles.pendingBadge}>
                                    <SafeIcon name="alert-circle" size={16} color={modernColors.warning} />
                                    <Text style={styles.pendingBadgeText}>Adresse à confirmer</Text>
                                </View>
                                <NativeButton
                                    title="Modifier l'adresse"
                                    variant="secondary"
                                    onPress={shareRecipientLocation}
                                    style={styles.modifyAddressButton}
                                />
                            </View>
                        )}
                        <View style={styles.infoRow}>
                            <Text style={styles.detailLabel}>Coursier</Text>
                            <Text style={styles.detailValue}>
                                {courierInfo.courier?.name ?? "En cours d'assignation"}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.detailLabel}>Téléphone</Text>
                            <Text style={styles.detailValue}>
                                {courierInfo.courier?.phone ?? 'Non disponible'}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.detailLabel}>ETA</Text>
                            <Text style={styles.detailValue}>
                                {courierInfo.courier?.etaMinutes
                                    ? `${courierInfo.courier.etaMinutes} min`
                                    : 'Calcul en cours'}
                            </Text>
                        </View>
                        <View style={styles.separator} />
                        <View style={styles.infoRow}>
                            <Text style={styles.detailLabel}>Destinataire</Text>
                            <Text style={styles.detailValue}>
                                {courierInfo.recipient?.name ?? 'Invité'}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.detailLabel}>Téléphone destinataire</Text>
                            <Text style={styles.detailValue}>
                                {courierInfo.recipient?.phone ?? 'Non partagé'}
                            </Text>
                        </View>
                        {courierInfo.pricing ? (
                            <>
                                <View style={styles.separator} />
                                <View style={styles.infoRow}>
                                    <Text style={styles.detailLabel}>Montant estimé</Text>
                                    <Text style={styles.detailValue}>
                                        {courierInfo.pricing.estimated ?? '—'} {courierInfo.pricing.currency}
                                    </Text>
                                </View>
                                <View style={styles.infoRow}>
                                    <Text style={styles.detailLabel}>Total final</Text>
                                    <Text style={styles.detailValue}>
                                        {courierInfo.pricing.finalTotal ?? '—'} {courierInfo.pricing.currency}
                                    </Text>
                                </View>
                            </>
                        ) : null}
                    </View>
                ) : null}
            </ScrollView>

            {/* ✅ Phase 9 - Amélioration 28 : Modal de sélection de coursier */}
            {deliveryId && (
                <CourierSelectionModal
                    visible={showCourierModal}
                    onClose={() => setShowCourierModal(false)}
                    deliveryId={deliveryId}
                    onSuccess={() => {
                        refresh({ force: true }).catch(console.error);
                    }}
                />
            )}

            {/* ✅ Phase 9 - Amélioration : Modal de refus de produit */}
            {rejectingItem && delivery?.orderId && (
                <ParcelRejectionModal
                    visible={!!rejectingItem}
                    onClose={() => setRejectingItem(null)}
                    productName={rejectingItem.label}
                    onConfirm={async (reason: ParcelRejectionReason) => {
                        await shoppingApi.rejectItem(delivery.orderId!, rejectingItem.id, reason);
                        setRejectingItem(null);
                        await refresh({ force: true });
                    }}
                />
            )}
        </SafeNativeView>
    );
};

// Fonction helper pour obtenir le label d'une raison de refus
function getRejectionReasonLabel(reason: ParcelRejectionReason): string {
    const labels: Record<ParcelRejectionReason, string> = {
        damaged: 'Produit endommagé',
        wrong_item: 'Mauvais produit',
        expired: 'Produit périmé',
        wrong_quantity: 'Mauvaise quantité',
        wrong_size: 'Mauvaise taille',
        wrong_color: 'Mauvaise couleur',
        quality_issue: 'Problème de qualité',
        not_ordered: 'Non commandé',
        duplicate: 'Doublon',
        other: 'Autre raison',
    };
    return labels[reason] || reason;
}

const renderTabButton = (
    tab: TrackingTab,
    label: string,
    activeTab: TrackingTab,
    onChange: (tab: TrackingTab) => void
) => {
    const isActive = tab === activeTab;
    return (
        <TouchableOpacity
            key={tab}
            style={[styles.tabButton, isActive && styles.tabButtonActive]}
            onPress={() => onChange(tab)}
        >
            <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{label}</Text>
        </TouchableOpacity>
    );
};

const statusToLabel = (status: string) => {
    switch (status) {
        case 'pending':
            return 'En attente';
        case 'awaiting_courier':
            return 'Recherche coursier';
        case 'assigned':
            return 'Coursier assigné';
        case 'en_route_pickup':
            return 'En route vers le marché';
        case 'shopping_pending':
            return 'Arrivé au marché';
        case 'shopping_in_progress':
            return 'Courses en cours';
        case 'shopping_completed':
            return 'Panier validé';
        case 'en_route_delivery':
            return 'En route vers le client';
        case 'delivered':
            return 'Livré';
        case 'cancelled':
            return 'Annulé';
        default:
            return status;
    }
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flex: 1,
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: '700',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 999,
        padding: 4,
        marginVertical: 20,
    },
    tabButton: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 999,
        alignItems: 'center',
    },
    tabButtonActive: {
        backgroundColor: modernColors.surface,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.1,
        shadowOffset: { width: 0, height: 2 },
        shadowRadius: 4,
        elevation: 3,
    },
    tabLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    tabLabelActive: {
        color: modernColors.primary,
    },
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        gap: 16,
        marginBottom: 16,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 3,
    },
    itemRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 4,
        paddingVertical: 8,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: modernColors.borderLight,
    },
    itemRowRejected: {
        backgroundColor: modernColors.error + '10',
        borderLeftWidth: 3,
        borderLeftColor: modernColors.error,
        paddingLeft: 12,
    },
    itemContent: {
        flex: 1,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
        flexWrap: 'wrap',
    },
    itemLabel: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    rejectedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.error + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    rejectedText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.error,
    },
    acceptedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: modernColors.success + '20',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    acceptedText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.success,
    },
    rejectionReason: {
        fontSize: 12,
        color: modernColors.error,
        marginTop: 4,
        fontStyle: 'italic',
    },
    rejectButton: {
        marginLeft: 12,
        minWidth: 80,
    },
    itemMeta: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    itemNote: {
        fontSize: 12,
        color: modernColors.accent,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    detailLabel: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    detailValue: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
    },
    separator: {
        height: 1,
        backgroundColor: modernColors.borderLight,
    },
    courierActions: {
        backgroundColor: modernColors.surface,
        borderRadius: 16,
        padding: 16,
        marginTop: 16,
        gap: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    assignCourierSection: {
        marginBottom: 16,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.borderLight,
    },
    pendingAddressSection: {
        marginBottom: 16,
        padding: 12,
        backgroundColor: modernColors.warning + '10',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.warning + '30',
    },
    pendingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8,
    },
    pendingBadgeText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.warning,
    },
    modifyAddressButton: {
        marginTop: 4,
    },
    courierActionsTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    statusButton: {
        marginTop: 4,
    },
});

export default DeliveryShoppingTrackingScreen;


