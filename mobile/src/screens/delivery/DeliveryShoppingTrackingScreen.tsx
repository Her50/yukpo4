/**
 * ✅ RÉÉCRIT COMPLÈTEMENT - DeliveryShoppingTrackingScreen
 * Écran de suivi des livraisons avec courses
 * Version simplifiée et sûre sans erreurs d'import/export
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    BackHandler,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';

// ✅ Imports des composants delivery - vérifier les exports
import CourierSelectionModal from '../../components/delivery/CourierSelectionModal';
import EnhancedTrackingMap from '../../components/delivery/EnhancedTrackingMap';
import HapticTouchable from '../../components/delivery/HapticTouchable';
import InlineChat from '../../components/delivery/InlineChat';
import ParcelRejectionModal from '../../components/delivery/ParcelRejectionModal';
import ProofMediaUpload from '../../components/delivery/ProofMediaUpload';
import RouteOptimizationIndicator from '../../components/delivery/RouteOptimizationIndicator';
import ShareTrackingLink from '../../components/delivery/ShareTrackingLink';
import { SkeletonCard } from '../../components/delivery/SkeletonLoader';
import StatusIndicator from '../../components/delivery/StatusIndicator';
import TimelineStepper from '../../components/delivery/TimelineStepper';
import ToastNotification from '../../components/delivery/ToastNotification';

// ✅ Imports des composants de base
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import useDeliveryTracking from '../../hooks/useDeliveryTracking';
import { useToast } from '../../hooks/useToast';
import { deliveryApi, shoppingApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary, ParcelRejectionReason, ShoppingBasketItem } from '../../types/delivery';

type TrackingTab = 'timeline' | 'basket' | 'courier';

interface RouteParams {
    deliveryId: string;
}

// ✅ Composants inline simples et sûrs
interface SimpleButtonProps {
    title: string;
    onPress?: () => void;
    disabled?: boolean;
    variant?: 'primary' | 'secondary';
    size?: 'small' | 'medium' | 'large';
    style?: any;
}

const SimpleButton: React.FC<SimpleButtonProps> = ({ 
    title, 
    onPress, 
    disabled = false, 
    variant = 'primary', 
    size = 'medium', 
    style 
}) => {
    const buttonStyle = {
        paddingHorizontal: size === 'small' ? 12 : size === 'large' ? 20 : 16,
        paddingVertical: size === 'small' ? 8 : size === 'large' ? 16 : 12,
        backgroundColor: variant === 'primary' ? modernColors.primary : modernColors.surface,
        borderRadius: 8,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
        opacity: disabled ? 0.5 : 1,
        borderWidth: variant === 'secondary' ? 1 : 0,
        borderColor: variant === 'secondary' ? modernColors.border : undefined,
    };

    const textStyle = {
        color: variant === 'primary' ? '#FFFFFF' : modernColors.text,
        fontSize: size === 'small' ? 14 : size === 'large' ? 18 : 16,
        fontWeight: '600' as const,
    };

    return (
        <TouchableOpacity
            style={[buttonStyle, style]}
            onPress={onPress}
            disabled={disabled}
            activeOpacity={0.8}
        >
            <Text style={textStyle}>{title}</Text>
        </TouchableOpacity>
    );
};

interface SimpleBadgeProps {
    text: string;
    variant?: 'success' | 'warning' | 'error' | 'info' | 'neutral';
    size?: 'small' | 'medium';
    style?: any;
}

const SimpleBadge: React.FC<SimpleBadgeProps> = ({ 
    text, 
    variant = 'neutral', 
    size = 'medium', 
    style 
}) => {
    const getVariantColor = () => {
        switch (variant) {
            case 'success':
                return modernColors.success;
            case 'warning':
                return modernColors.warning;
            case 'error':
                return modernColors.error;
            case 'info':
                return modernColors.info;
            default:
                return modernColors.textSecondary;
        }
    };

    const badgeStyle = {
        paddingHorizontal: size === 'small' ? 6 : 8,
        paddingVertical: size === 'small' ? 2 : 4,
        backgroundColor: getVariantColor() + '20',
        borderRadius: 12,
        alignSelf: 'flex-start' as const,
        borderWidth: 1,
        borderColor: getVariantColor() + '40',
    };

    const textStyle = {
        fontSize: size === 'small' ? 10 : 12,
        fontWeight: '600' as const,
        color: getVariantColor(),
    };

    return (
        <View style={[badgeStyle, style]}>
            <Text style={textStyle}>{text}</Text>
        </View>
    );
};

interface SimpleItemCardProps {
    children: React.ReactNode;
    style?: any;
    index: number;
}

const SimpleItemCard: React.FC<SimpleItemCardProps> = ({ children, style }) => {
    return (
        <View style={style}>
            {children}
        </View>
    );
};

// ✅ Helper functions
const statusToLabel = (status: string): string => {
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

const DeliveryShoppingTrackingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { deliveryId } = (route.params as RouteParams) ?? { deliveryId: null };
    const [activeTab, setActiveTab] = useState<TrackingTab>('timeline');
    const { delivery, timeline, refresh, loading } = useDeliveryTracking(deliveryId || null);
    const { refreshDelivery, updateRecipientLocation, setActiveDeliveryId } = useDeliveryContext();
    const { user } = useAuth();
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [rejectingItem, setRejectingItem] = useState<ShoppingBasketItem | null>(null);
    const { toast, showSuccess, showError, showWarning, hideToast } = useToast();

    // ✅ Vérifications utilisateur
    const isCreator = Boolean(
        user?.id &&
        delivery?.creator_id &&
        String(delivery.creator_id) === String(user.id)
    );
    const canAssignCourier = isCreator && !delivery?.courier && (delivery?.status === 'pending' || delivery?.status === 'awaiting_courier');

    const isCurrentUserCourier = useMemo(() => {
        if (!user?.id || !delivery?.courier?.id) {
            return false;
        }
        return String(delivery.courier.id) === String(user.id);
    }, [user?.id, delivery?.courier?.id]);

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

    // ✅ Effects
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

    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (navigation.canGoBack()) {
                navigation.goBack();
                return true;
            }
            return false;
        });
        return () => backHandler.remove();
    }, [navigation]);

    // ✅ Computed values
    const shoppingItems = useMemo(() => delivery?.shopping?.items ?? [], [delivery?.shopping?.items]);

    const courierInfo = useMemo(() => {
        const summary = delivery as DeliverySummary | undefined;
        return {
            courier: summary?.courier,
            recipient: summary?.recipient,
            pricing: summary?.pricing,
        };
    }, [delivery]);

    const statusColor = useMemo(() => {
        const status = delivery?.status ?? 'pending';
        switch (status) {
            case 'delivered':
                return modernColors.success;
            case 'cancelled':
                return modernColors.error;
            case 'en_route_delivery':
            case 'shopping_completed':
                return modernColors.primary;
            case 'shopping_in_progress':
            case 'en_route_pickup':
                return modernColors.info;
            case 'awaiting_courier':
            case 'pending':
                return modernColors.warning;
            default:
                return modernColors.textSecondary;
        }
    }, [delivery?.status]);

    const estimatedDistance = useMemo(() => {
        if (!delivery?.pickup?.location || !delivery?.dropoff?.location) return null;
        const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
            const R = 6371;
            const dLat = (lat2 - lat1) * Math.PI / 180;
            const dLon = (lon2 - lon1) * Math.PI / 180;
            const a =
                Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            return R * c;
        };
        return calculateDistance(
            delivery.pickup.location.lat,
            delivery.pickup.location.lng,
            delivery.dropoff.location.lat,
            delivery.dropoff.location.lng
        );
    }, [delivery?.pickup?.location, delivery?.dropoff?.location]);

    // ✅ Handlers
    const handleRefresh = async () => {
        if (!deliveryId) return;
        try {
            await refresh({ force: true });
            showSuccess('Informations mises à jour');
        } catch (error) {
            showError('Erreur lors de la mise à jour');
        }
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
                showWarning('Position en attente - synchronisation automatique à la reconnexion');
            } else {
                showSuccess('Position partagée avec le coursier');
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

    const [updatingStatus, setUpdatingStatus] = useState(false);

    const handleUpdateStatus = async (newStatus: string) => {
        if (!deliveryId || updatingStatus) return;

        setUpdatingStatus(true);
        try {
            const response = await deliveryApi.updateStatus(deliveryId, newStatus);
            if (response.success) {
                showSuccess('Statut mis à jour avec succès');
                await refresh({ force: true });
            } else {
                showError(response.error ?? 'Impossible de mettre à jour le statut');
            }
        } catch (error: any) {
            console.error('[DeliveryShoppingTracking] Erreur mise à jour statut:', error);
            showError(error?.message ?? 'Impossible de mettre à jour le statut');
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
                return [{ label: 'Je pars vers le point de départ', status: 'en_route_pickup', icon: '🚚' }];
            case 'en_route_pickup':
                return [{ label: 'Je suis arrivé au point de départ', status: 'shopping_pending', icon: '📍' }];
            case 'shopping_pending':
                return [{ label: 'Courses en cours', status: 'shopping_in_progress', icon: '🛒' }];
            case 'shopping_in_progress':
                return [{ label: 'Courses terminées', status: 'shopping_completed', icon: '✅' }];
            case 'shopping_completed':
                return [{ label: 'Colis récupéré, en route', status: 'en_route_delivery', icon: '🚚' }];
            case 'en_route_delivery':
                return [{ label: 'Livré', status: 'delivered', icon: '✅' }];
            default:
                return [];
        }
    };

    const handleNavigation = async () => {
        if (!deliveryId) return;
        try {
            const response = await deliveryApi.getCourierNavigation(deliveryId);
            const responseData = (response as any)?.data || response;

            if (!responseData?.origin || !responseData?.destination) {
                Alert.alert('Erreur', 'Données de navigation incomplètes');
                return;
            }

            const origin = `${responseData.origin.latitude},${responseData.origin.longitude}`;
            const destination = `${responseData.destination.latitude},${responseData.destination.longitude}`;
            const googleMapsUrl = `https://www.google.com/maps/dir/${origin}/${destination}`;

            const canOpen = await Linking.canOpenURL(googleMapsUrl);
            if (canOpen) {
                await Linking.openURL(googleMapsUrl);
                showSuccess('Navigation ouverte');
            } else {
                showError('Impossible d\'ouvrir Google Maps');
            }
        } catch (error: any) {
            console.error('[DeliveryShoppingTrackingScreen] Erreur navigation:', error);
            showError('Impossible d\'ouvrir la navigation');
        }
    };

    // ✅ Loading state
    if (loading && !delivery) {
        return (
            <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
                <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
                    <SkeletonCard style={styles.skeletonMargin} />
                    <SkeletonCard style={styles.skeletonMargin} />
                    <SkeletonCard />
                </ScrollView>
            </SafeNativeView>
        );
    }

    // ✅ Tab labels
    const tabLabels: Record<TrackingTab, string> = {
        timeline: 'Timeline',
        basket: 'Panier',
        courier: 'Coursier',
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <ToastNotification
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
            <View style={styles.animatedContainer}>
                <ScrollView
                    style={styles.scroll}
                    refreshControl={
                        <RefreshControl
                            refreshing={loading}
                            onRefresh={handleRefresh}
                            tintColor={modernColors.primary}
                            colors={[modernColors.primary]}
                        />
                    }
                    showsVerticalScrollIndicator={false}
                >
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerContent}>
                            <View style={styles.headerTop}>
                                <Text style={styles.headerLabel}>Livraison</Text>
                                <SimpleBadge
                                    text={`#${delivery?.id?.slice(-6) ?? '...'}`}
                                    variant="neutral"
                                    size="small"
                                />
                            </View>
                            <View style={styles.statusRow}>
                                <StatusIndicator
                                    status={delivery?.status ?? 'pending'}
                                    size={10}
                                    showPulse={delivery?.status !== 'delivered' && delivery?.status !== 'cancelled'}
                                />
                                <Text style={styles.statusText}>
                                    {statusToLabel(delivery?.status ?? 'pending')}
                                </Text>
                            </View>
                        </View>
                        <View style={styles.headerActions}>
                            {canShareLocation ? (
                                <HapticTouchable
                                    hapticType="light"
                                    style={styles.headerActionButton}
                                    onPress={shareRecipientLocation}
                                    activeOpacity={0.7}
                                >
                                    <SafeIcon name="location" size={18} color={modernColors.primary} />
                                </HapticTouchable>
                            ) : null}
                            <HapticTouchable
                                hapticType="light"
                                style={styles.headerActionButton}
                                onPress={handleChat}
                                activeOpacity={0.7}
                            >
                                <SafeIcon name="message-circle" size={18} color={modernColors.primary} />
                            </HapticTouchable>
                        </View>
                    </View>

                    {/* Actions coursier */}
                    {isCurrentUserCourier && (
                        <View style={styles.courierActions}>
                            <Text style={styles.courierActionsTitle}>Actions coursier</Text>
                            <SimpleButton
                                title="🧭 Ouvrir la navigation"
                                variant="primary"
                                onPress={handleNavigation}
                                style={styles.statusButton}
                            />
                            {getNextStatusOptions()
                                .filter((option) => option && typeof option === 'object' && option.status && option.label)
                                .map((option) => (
                                    <SimpleButton
                                        key={option.status}
                                        title={`${option.icon || ''} ${option.label}`}
                                        variant="primary"
                                        onPress={() => handleUpdateStatus(option.status)}
                                        disabled={updatingStatus}
                                        style={styles.statusButton}
                                    />
                                ))}
                        </View>
                    )}

                    {/* Carte */}
                    <View style={styles.mapContainer}>
                        <EnhancedTrackingMap
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
                            showNavigationButton={!!(delivery?.pickup?.location && delivery?.dropoff?.location)}
                            onNavigationPress={handleNavigation}
                        />
                    </View>

                    {/* Indicateur de route */}
                    {estimatedDistance !== null && (
                        <RouteOptimizationIndicator
                            distance={estimatedDistance}
                            estimatedTime={delivery?.metadata?.estimated_duration_minutes ?? Math.round(estimatedDistance * 3)}
                            isOptimized={!!delivery?.metadata?.route_optimized}
                            trafficDelay={delivery?.metadata?.traffic_delay_minutes ?? 0}
                            style={styles.routeIndicator}
                        />
                    )}

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        {(['timeline', 'basket', 'courier'] as TrackingTab[]).map((tab, index) => {
                            const isActive = tab === activeTab;
                            return (
                                <HapticTouchable
                                    key={`tab-${tab}-${index}`}
                                    hapticType="light"
                                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                                    onPress={() => setActiveTab(tab)}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>
                                        {tabLabels[tab]}
                                    </Text>
                                </HapticTouchable>
                            );
                        })}
                    </View>

                    {/* Contenu Timeline */}
                    {activeTab === 'timeline' && (
                        <View style={styles.tabContent}>
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <SafeIcon name="clock" size={20} color={modernColors.primary} />
                                    <Text style={styles.cardTitle}>Historique de la livraison</Text>
                                </View>
                                <TimelineStepper checkpoints={timeline} currentStatus={delivery?.status ?? 'pending'} />
                            </View>

                            {deliveryId && user?.id && (
                                <InlineChat
                                    deliveryId={deliveryId}
                                    currentUserId={user.id}
                                    messages={[]}
                                    onSendMessage={async (message) => {
                                        console.log('[DeliveryShoppingTracking] Message envoyé:', message);
                                    }}
                                    style={styles.chatContainer}
                                />
                            )}

                            {deliveryId && (
                                <ShareTrackingLink
                                    deliveryId={deliveryId}
                                    deliveryTitle={`Livraison #${deliveryId.slice(-6)}`}
                                    style={styles.shareContainer}
                                />
                            )}
                        </View>
                    )}

                    {/* Contenu Basket */}
                    {activeTab === 'basket' && (
                        <View style={styles.tabContent}>
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <SafeIcon name="shopping-cart" size={20} color={modernColors.primary} />
                                    <Text style={styles.cardTitle}>Panier de courses</Text>
                                    {shoppingItems.length > 0 && (
                                        <SimpleBadge
                                            text={`${shoppingItems.length} article${shoppingItems.length > 1 ? 's' : ''}`}
                                            variant="info"
                                            size="small"
                                        />
                                    )}
                                </View>
                                {shoppingItems.length === 0 ? (
                                    <View style={styles.emptyBasket}>
                                        <SafeIcon name="shopping-cart" size={48} color={modernColors.textSecondary} />
                                        <Text style={styles.emptyBasketText}>Aucun article dans le panier</Text>
                                    </View>
                                ) : (
                                    <View style={styles.itemsList}>
                                        {shoppingItems
                                            .filter((item) => item && typeof item === 'object' && item.id)
                                            .map((item, index) => {
                                                const isRejected = item.status === 'rejected';
                                                const canReject = !isRejected &&
                                                    (delivery?.status === 'shopping_completed' ||
                                                        delivery?.status === 'en_route_delivery' ||
                                                        delivery?.status === 'delivered');

                                                return (
                                                    <SimpleItemCard
                                                        key={item.id || `item-${index}`}
                                                        style={[styles.itemCard, isRejected && styles.itemCardRejected]}
                                                        index={index}
                                                    >
                                                        <View style={styles.itemContent}>
                                                            <View style={styles.itemHeader}>
                                                                <Text style={styles.itemLabel}>{item.label}</Text>
                                                                {isRejected ? (
                                                                    <SimpleBadge
                                                                        text="Refusé"
                                                                        variant="error"
                                                                        size="small"
                                                                    />
                                                                ) : item.status === 'accepted' ? (
                                                                    <SimpleBadge
                                                                        text="Accepté"
                                                                        variant="success"
                                                                        size="small"
                                                                    />
                                                                ) : null}
                                                            </View>
                                                            <View style={styles.itemDetails}>
                                                                <View style={styles.itemDetailRow}>
                                                                    <SafeIcon name="package" size={14} color={modernColors.textSecondary} />
                                                                    <Text style={styles.itemMeta}>
                                                                        {item.quantity} {item.unit || 'unités'}
                                                                    </Text>
                                                                </View>
                                                                {(item.actualTotal || item.estimatedTotal) && (
                                                                    <View style={styles.itemDetailRow}>
                                                                        <SafeIcon name="dollar-sign" size={14} color={modernColors.textSecondary} />
                                                                        <Text style={styles.itemPrice}>
                                                                            {item.actualTotal
                                                                                ? `${item.actualTotal.toFixed(0)} ${delivery?.pricing?.currency ?? 'XAF'}`
                                                                                : `~${item.estimatedTotal?.toFixed(0) ?? 0} ${delivery?.pricing?.currency ?? 'XAF'}`}
                                                                        </Text>
                                                                    </View>
                                                                )}
                                                            </View>
                                                            {isRejected && item.rejection_reason && (
                                                                <View style={styles.rejectionBox}>
                                                                    <SafeIcon name="alert-circle" size={14} color={modernColors.error} />
                                                                    <Text style={styles.rejectionReason}>
                                                                        {getRejectionReasonLabel(item.rejection_reason)}
                                                                    </Text>
                                                                </View>
                                                            )}
                                                            {item.note && (
                                                                <View style={styles.itemNoteBox}>
                                                                    <SafeIcon name="info" size={14} color={modernColors.accent} />
                                                                    <Text style={styles.itemNote}>{item.note}</Text>
                                                                </View>
                                                            )}
                                                        </View>
                                                        {canReject && (
                                                            <SimpleButton
                                                                title="Refuser"
                                                                variant="secondary"
                                                                size="small"
                                                                onPress={() => {
                                                                    if (item && typeof item === 'object') {
                                                                        setRejectingItem(item);
                                                                    }
                                                                }}
                                                                style={styles.rejectButton}
                                                            />
                                                        )}
                                                    </SimpleItemCard>
                                                );
                                            })}
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* Contenu Courier */}
                    {activeTab === 'courier' && (
                        <View style={styles.tabContent}>
                            <View style={styles.card}>
                                <View style={styles.cardHeader}>
                                    <SafeIcon name="users" size={20} color={modernColors.primary} />
                                    <Text style={styles.cardTitle}>Informations coursier</Text>
                                </View>

                                {canAssignCourier && (
                                    <View style={styles.assignCourierSection}>
                                        <SimpleButton
                                            title="Choisir un livreur"
                                            variant="primary"
                                            onPress={() => setShowCourierModal(true)}
                                        />
                                    </View>
                                )}

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

                                {delivery?.metadata?.dropoff_pending === true && (
                                    <View style={styles.pendingAddressSection}>
                                        <View style={styles.pendingBadge}>
                                            <SafeIcon name="alert-circle" size={16} color={modernColors.warning} />
                                            <Text style={styles.pendingBadgeText}>Adresse à confirmer</Text>
                                        </View>
                                        <SimpleButton
                                            title="Modifier l'adresse"
                                            variant="secondary"
                                            onPress={shareRecipientLocation}
                                            style={styles.modifyAddressButton}
                                        />
                                    </View>
                                )}

                                <View style={styles.infoSection}>
                                    <View style={styles.infoRow}>
                                        <View style={styles.infoLabelContainer}>
                                            <SafeIcon name="user" size={16} color={modernColors.textSecondary} />
                                            <Text style={styles.detailLabel}>Coursier</Text>
                                        </View>
                                        <Text style={styles.detailValue}>
                                            {courierInfo.courier?.name ?? "En cours d'assignation"}
                                        </Text>
                                    </View>
                                    {courierInfo.courier?.phone && (
                                        <View style={styles.infoRow}>
                                            <View style={styles.infoLabelContainer}>
                                                <SafeIcon name="phone" size={16} color={modernColors.textSecondary} />
                                                <Text style={styles.detailLabel}>Téléphone</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (courierInfo.courier?.phone) {
                                                        Linking.openURL(`tel:${courierInfo.courier.phone}`);
                                                    }
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[styles.detailValue, styles.phoneLink]}>
                                                    {courierInfo.courier.phone}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                    {courierInfo.courier?.etaMinutes && (
                                        <View style={styles.infoRow}>
                                            <View style={styles.infoLabelContainer}>
                                                <SafeIcon name="clock" size={16} color={modernColors.textSecondary} />
                                                <Text style={styles.detailLabel}>Temps estimé</Text>
                                            </View>
                                            <View style={styles.etaContainer}>
                                                <Text style={styles.etaValue}>
                                                    {courierInfo.courier.etaMinutes} min
                                                </Text>
                                            </View>
                                        </View>
                                    )}
                                </View>

                                <View style={styles.separator} />

                                <View style={styles.infoSection}>
                                    <View style={styles.infoRow}>
                                        <View style={styles.infoLabelContainer}>
                                            <SafeIcon name="user" size={16} color={modernColors.textSecondary} />
                                            <Text style={styles.detailLabel}>Destinataire</Text>
                                        </View>
                                        <Text style={styles.detailValue}>
                                            {courierInfo.recipient?.name ?? 'Invité'}
                                        </Text>
                                    </View>
                                    {courierInfo.recipient?.phone && (
                                        <View style={styles.infoRow}>
                                            <View style={styles.infoLabelContainer}>
                                                <SafeIcon name="phone" size={16} color={modernColors.textSecondary} />
                                                <Text style={styles.detailLabel}>Téléphone</Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    if (courierInfo.recipient?.phone) {
                                                        Linking.openURL(`tel:${courierInfo.recipient.phone}`);
                                                    }
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Text style={[styles.detailValue, styles.phoneLink]}>
                                                    {courierInfo.recipient.phone}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                {courierInfo.pricing && (
                                    <>
                                        <View style={styles.separator} />
                                        <View style={styles.pricingSection}>
                                            <View style={styles.pricingHeader}>
                                                <SafeIcon name="dollar-sign" size={18} color={modernColors.primary} />
                                                <Text style={styles.pricingTitle}>Tarification</Text>
                                            </View>
                                            {courierInfo.pricing.estimated && (
                                                <View style={styles.pricingRow}>
                                                    <Text style={styles.pricingLabel}>Montant estimé</Text>
                                                    <Text style={styles.pricingValue}>
                                                        {courierInfo.pricing.estimated} {courierInfo.pricing.currency}
                                                    </Text>
                                                </View>
                                            )}
                                            {courierInfo.pricing.finalTotal && (
                                                <View style={[styles.pricingRow, styles.pricingRowFinal]}>
                                                    <Text style={styles.pricingLabelFinal}>Total final</Text>
                                                    <Text style={styles.pricingValueFinal}>
                                                        {courierInfo.pricing.finalTotal} {courierInfo.pricing.currency}
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    )}
                </ScrollView>
            </View>

            {/* Modals */}
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scroll: {
        flex: 1,
        padding: 20,
    },
    routeIndicator: {
        marginTop: 16,
        marginBottom: 8,
    },
    chatContainer: {
        marginTop: 16,
        marginBottom: 8,
    },
    shareContainer: {
        marginTop: 16,
        marginBottom: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: 24,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.borderLight,
    },
    headerContent: {
        flex: 1,
        gap: 8,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    animatedContainer: {
        flex: 1,
    },
    skeletonMargin: {
        marginBottom: 16,
    },
    statusText: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    headerActionButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.borderLight,
    },
    mapContainer: {
        position: 'relative',
        marginBottom: 20,
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
        padding: 20,
        gap: 16,
        marginBottom: 16,
        shadowColor: modernColors.shadow,
        shadowOpacity: 0.05,
        shadowOffset: { width: 0, height: 4 },
        shadowRadius: 10,
        elevation: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 4,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
    },
    tabContent: {
        marginBottom: 16,
    },
    itemsList: {
        gap: 12,
    },
    itemCard: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: modernColors.borderLight,
    },
    itemCardRejected: {
        backgroundColor: modernColors.error + '10',
        borderLeftWidth: 4,
        borderLeftColor: modernColors.error,
        borderColor: modernColors.error + '30',
    },
    emptyBasket: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 48,
        gap: 12,
    },
    emptyBasketText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    itemContent: {
        flex: 1,
        gap: 8,
    },
    itemHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 4,
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    itemDetails: {
        flexDirection: 'row',
        gap: 16,
        flexWrap: 'wrap',
    },
    itemDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    rejectionBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: modernColors.error + '15',
        padding: 10,
        borderRadius: 8,
        marginTop: 4,
    },
    rejectionReason: {
        fontSize: 13,
        color: modernColors.error,
        flex: 1,
        fontWeight: '500',
    },
    itemNoteBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        backgroundColor: modernColors.accent + '15',
        padding: 10,
        borderRadius: 8,
        marginTop: 4,
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
    infoSection: {
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    infoLabelContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    detailLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    detailValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'right',
        flex: 1,
    },
    phoneLink: {
        color: modernColors.primary,
        textDecorationLine: 'underline',
    },
    etaContainer: {
        backgroundColor: modernColors.primary + '15',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    etaValue: {
        fontSize: 14,
        fontWeight: '700',
        color: modernColors.primary,
    },
    pricingSection: {
        gap: 12,
    },
    pricingHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 4,
    },
    pricingTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    pricingRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
    },
    pricingRowFinal: {
        borderTopWidth: 1,
        borderTopColor: modernColors.borderLight,
        paddingTop: 12,
        marginTop: 4,
    },
    pricingLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    pricingValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    pricingLabelFinal: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    pricingValueFinal: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
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
