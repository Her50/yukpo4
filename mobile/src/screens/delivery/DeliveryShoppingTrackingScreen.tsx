import { useNavigation, useRoute } from '@react-navigation/native';
import * as Location from 'expo-location';
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import { notificationSoundService } from '../../services/notificationSoundService';

import CourierDifficultyModal from '../../components/delivery/CourierDifficultyModal';
import CourierSelectionModal from '../../components/delivery/CourierSelectionModal';
import EnhancedTrackingMap from '../../components/delivery/EnhancedTrackingMap';
import InlineChat from '../../components/delivery/InlineChat';
import ParcelRejectionModal from '../../components/delivery/ParcelRejectionModal';
import ProofMediaUpload from '../../components/delivery/ProofMediaUpload';
import RouteOptimizationIndicator from '../../components/delivery/RouteOptimizationIndicator';
import ShareTrackingLink from '../../components/delivery/ShareTrackingLink';
import { SkeletonCard } from '../../components/delivery/SkeletonLoader';
import StatusIndicator from '../../components/delivery/StatusIndicator';
import TimelineStepper from '../../components/delivery/TimelineStepper';
import ToastNotification from '../../components/delivery/ToastNotification';

import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import useDeliveryTracking from '../../hooks/useDeliveryTracking';
import { useToast } from '../../hooks/useToast';
import { deliveryApi, shoppingApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { DeliverySummary, ParcelRejectionReason, ShoppingBasketItem } from '../../types/delivery';
import { useLanguageSafe } from '../../contexts/LanguageContext';

type TabType = 'timeline' | 'basket' | 'courier';

interface RouteParams {
    deliveryId: string | number;
}

const DeliveryShoppingTrackingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const params = route.params as RouteParams | undefined;
    const deliveryId =
        params?.deliveryId !== undefined && params?.deliveryId !== null
            ? String(params.deliveryId)
            : null;

    const [activeTab, setActiveTab] = useState<TabType>('timeline');
    const [showCourierModal, setShowCourierModal] = useState(false);
    const [rejectingItem, setRejectingItem] = useState<ShoppingBasketItem | null>(null);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [showDifficultyModal, setShowDifficultyModal] = useState(false);
    const [acceptingDelivery, setAcceptingDelivery] = useState(false);

    const { delivery, timeline, refresh, loading } = useDeliveryTracking(deliveryId);
    const { refreshDelivery, updateRecipientLocation, setActiveDeliveryId } = useDeliveryContext();
    const { user } = useAuth();
    const { t } = useLanguageSafe();
    const { toast, showSuccess, showError, showWarning, hideToast } = useToast();
    const prevStatusRef = useRef<string | null>(null);

    // ✅ Notifications contextuelles vocales (son + TTS + push locale) pour TOUS les changements de statut
    useEffect(() => {
        const currentStatus = delivery?.status;
        const prevStatus = prevStatusRef.current;

        if (currentStatus && prevStatus && currentStatus !== prevStatus) {
            const courierName = delivery?.courier?.name;
            const etaMinutes = delivery?.courier?.etaMinutes ?? undefined;
            const destination = delivery?.dropoff?.address;
            const itemCount = delivery?.shopping?.items?.length;
            const pickupAddress = delivery?.pickup?.address ?? delivery?.pickup?.formatted_address ?? undefined;
            const deliveryAddress = delivery?.dropoff?.address ?? delivery?.dropoff?.formatted_address ?? undefined;
            const details = { courierName, etaMinutes, destination, itemCount, pickupAddress, deliveryAddress };

            // Mapper les statuts de livraison vers les types d'événements contextuels
            const statusToEvent: Record<string, string> = {
                assigned: 'courier_found',
                accepted: 'courier_found',
                en_route_pickup: 'courier_en_route_pickup',
                arrival_pickup: 'courier_arrived_pickup',
                picked_up: 'courier_picked_up',
                shopping_pending: 'courier_arrived_pickup',
                shopping_in_progress: 'shopping_in_progress',
                shopping_completed: 'shopping_completed',
                en_route_delivery: 'courier_en_route_delivery',
                arrival_destination: 'courier_arrived_destination',
                delivered: 'delivery_completed',
                completed: 'delivery_completed',
                cancelled: 'delivery_cancelled',
            };

            const eventType = statusToEvent[currentStatus];
            if (eventType) {
                notificationSoundService.notifyDeliveryEvent(eventType, details).catch(console.error);
            }

            // Toast visuel aussi
            if (currentStatus === 'assigned' || currentStatus === 'accepted') {
                showSuccess(`Coursier trouvé${courierName ? ` : ${courierName}` : ''} !`);
            } else if (currentStatus === 'delivered' || currentStatus === 'completed') {
                showSuccess('Livraison terminée !');
            } else if (currentStatus === 'en_route_delivery') {
                showSuccess('Coursier en route vers vous !');
            } else if (currentStatus === 'arrival_destination') {
                showSuccess('Coursier arrivé à destination !');
            }
        }

        if (currentStatus) {
            prevStatusRef.current = currentStatus;
        }
    }, [delivery?.status]);

    useEffect(() => {
        if (!deliveryId) return;
        notificationSoundService.initialize().catch(console.error);
        refreshDelivery(deliveryId, { force: true }).catch(console.error);
        setActiveDeliveryId(deliveryId);
        return () => setActiveDeliveryId(null);
    }, [deliveryId, refreshDelivery, setActiveDeliveryId]);

    useEffect(() => {
        const handler = BackHandler.addEventListener('hardwareBackPress', () => {
            if (navigation.canGoBack()) {
                navigation.goBack();
                return true;
            }
            return false;
        });
        return () => handler.remove();
    }, [navigation]);

    const isCreator = useMemo(() => {
        return user?.id && delivery?.creator_id && String(delivery.creator_id) === String(user.id);
    }, [user?.id, delivery?.creator_id]);

    const isCourier = useMemo(() => {
        return user?.id && delivery?.courier?.id && String(delivery.courier.id) === String(user.id);
    }, [user?.id, delivery?.courier?.id]);

    // ✅ NOUVEAU : Vérifier si le coursier peut accepter cette course (a été notifié)
    const canAcceptDelivery = useMemo(() => {
        if (!user?.id || !delivery) return false;
        if (delivery.status !== 'awaiting_courier_confirmation') return false;

        // Vérifier si le coursier actuel a été notifié
        const notifiedUserIds = delivery.metadata?.notified_user_ids as number[] | undefined;
        return notifiedUserIds?.includes(Number(user.id)) ?? false;
    }, [user?.id, delivery?.status, delivery?.metadata]);

    const shoppingItems = useMemo(() => delivery?.shopping?.items || [], [delivery?.shopping?.items]);

    const courierInfo = useMemo(() => {
        const summary = delivery as DeliverySummary | undefined;
        return {
            courier: summary?.courier,
            recipient: summary?.recipient,
            pricing: summary?.pricing,
        };
    }, [delivery]);

    const distance = useMemo(() => {
        const pickup = delivery?.pickup?.location;
        const dropoff = delivery?.dropoff?.location;
        if (!pickup || !dropoff) return null;

        const R = 6371;
        const dLat = ((dropoff.lat - pickup.lat) * Math.PI) / 180;
        const dLon = ((dropoff.lng - pickup.lng) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((pickup.lat * Math.PI) / 180) *
            Math.cos((dropoff.lat * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }, [delivery?.pickup?.location, delivery?.dropoff?.location]);

    const handleRefresh = async () => {
        if (!deliveryId) return;
        try {
            await refresh({ force: true });
            showSuccess('Mise à jour réussie');
        } catch {
            showError('Erreur de mise à jour');
        }
    };

    const handleShareLocation = async () => {
        try {
            const { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Autorisez la localisation');
                return;
            }

            const position = await Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced,
            });

            await updateRecipientLocation(deliveryId!, {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
                accuracy: position.coords.accuracy ?? undefined,
                heading: position.coords.heading ?? undefined,
                speed: position.coords.speed ?? undefined,
                source: 'recipient',
            });

            showSuccess('Position partagée');
        } catch (error: any) {
            showError(error?.message || 'Erreur');
        }
    };

    const handleNavigation = async () => {
        if (!deliveryId) return;

        try {
            // ✅ CORRIGÉ: Utiliser les données directement depuis delivery au lieu de l'API
            const pickup = delivery?.pickup?.location;
            const dropoff = delivery?.dropoff?.location;

            // Déterminer l'origine et la destination selon le statut
            let origin: { lat: number; lng: number } | null = null;
            let destination: { lat: number; lng: number } | null = null;

            const status = delivery?.status;

            // Si le coursier n'a pas encore récupéré, aller au pickup
            if (status === 'assigned' || status === 'awaiting_courier' || status === 'awaiting_courier_confirmation' || status === 'en_route_pickup') {
                // Essayer d'utiliser la position GPS actuelle du coursier comme origine
                try {
                    const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
                    if (permissionStatus === 'granted') {
                        const currentPosition = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });
                        origin = {
                            lat: currentPosition.coords.latitude,
                            lng: currentPosition.coords.longitude,
                        };
                    }
                } catch (gpsError) {
                    console.warn('[DeliveryTracking] Erreur récupération GPS coursier:', gpsError);
                    // Continuer avec pickup comme origine si GPS échoue
                }

                // Si pas de GPS, utiliser la position du coursier depuis delivery ou le pickup
                if (!origin) {
                    origin = delivery?.metadata?.last_location
                        ? { lat: delivery.metadata.last_location.lat, lng: delivery.metadata.last_location.lng }
                        : pickup ? { lat: pickup.lat, lng: pickup.lng } : null;
                }

                destination = pickup ? { lat: pickup.lat, lng: pickup.lng } : null;
            }
            // Si le coursier a récupéré, aller au dropoff
            else if (status === 'shopping_completed' || status === 'en_route_delivery') {
                // Utiliser la position GPS actuelle du coursier comme origine
                try {
                    const { status: permissionStatus } = await Location.requestForegroundPermissionsAsync();
                    if (permissionStatus === 'granted') {
                        const currentPosition = await Location.getCurrentPositionAsync({
                            accuracy: Location.Accuracy.Balanced,
                        });
                        origin = {
                            lat: currentPosition.coords.latitude,
                            lng: currentPosition.coords.longitude,
                        };
                    }
                } catch (gpsError) {
                    console.warn('[DeliveryTracking] Erreur récupération GPS coursier:', gpsError);
                    // Continuer avec pickup comme origine si GPS échoue
                }

                // Si pas de GPS, utiliser la position du coursier depuis delivery ou le pickup
                if (!origin) {
                    origin = delivery?.metadata?.last_location
                        ? { lat: delivery.metadata.last_location.lat, lng: delivery.metadata.last_location.lng }
                        : pickup ? { lat: pickup.lat, lng: pickup.lng } : null;
                }

                destination = dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null;
            }
            // Par défaut, utiliser pickup -> dropoff
            else {
                origin = pickup ? { lat: pickup.lat, lng: pickup.lng } : null;
                destination = dropoff ? { lat: dropoff.lat, lng: dropoff.lng } : null;
            }

            // ✅ CORRIGÉ: Vérification améliorée avec messages d'erreur spécifiques
            if (!origin || !destination) {
                const missingData = [];
                if (!origin) missingData.push('origine');
                if (!destination) missingData.push('destination');

                Alert.alert(
                    'Données incomplètes',
                    `Impossible de démarrer la navigation : ${missingData.join(' et ')} manquante(s).\n\nVérifiez que les adresses de pickup et dropoff sont bien définies.`,
                    [{ text: 'OK' }]
                );
                return;
            }

            // ✅ CORRIGÉ: Validation des coordonnées GPS
            if (
                !Number.isFinite(origin.lat) || !Number.isFinite(origin.lng) ||
                !Number.isFinite(destination.lat) || !Number.isFinite(destination.lng) ||
                origin.lat < -90 || origin.lat > 90 ||
                origin.lng < -180 || origin.lng > 180 ||
                destination.lat < -90 || destination.lat > 90 ||
                destination.lng < -180 || destination.lng > 180
            ) {
                Alert.alert('Erreur', 'Coordonnées GPS invalides');
                return;
            }

            // Construire l'URL Google Maps
            const url = `https://www.google.com/maps/dir/${origin.lat},${origin.lng}/${destination.lat},${destination.lng}`;

            const canOpen = await Linking.canOpenURL(url);
            if (canOpen) {
                await Linking.openURL(url);
                showSuccess('Navigation ouverte');
            } else {
                // ✅ CORRIGÉ: Essayer avec d'autres applications de navigation
                const appleMapsUrl = `http://maps.apple.com/?daddr=${destination.lat},${destination.lng}&saddr=${origin.lat},${origin.lng}`;
                const canOpenApple = await Linking.canOpenURL(appleMapsUrl);

                if (canOpenApple) {
                    await Linking.openURL(appleMapsUrl);
                    showSuccess('Navigation ouverte');
                } else {
                    showError('Aucune application de navigation disponible');
                }
            }
        } catch (error: any) {
            console.error('[DeliveryTracking] Erreur navigation:', error);
            showError(error?.message || 'Erreur lors de l\'ouverture de la navigation');
        }
    };

    const handleUpdateStatus = async (status: string) => {
        if (!deliveryId || updatingStatus) return;
        setUpdatingStatus(true);
        try {
            const response = await deliveryApi.updateStatus(deliveryId, status);
            if (response.success) {
                showSuccess('Statut mis à jour');
                await refresh({ force: true });
            } else {
                showError(response.error || 'Erreur');
            }
        } catch (error: any) {
            showError('Erreur');
        } finally {
            setUpdatingStatus(false);
        }
    };

    // ✅ NOUVEAU : Accepter une course
    const handleAcceptDelivery = async () => {
        if (!deliveryId || acceptingDelivery) return;

        Alert.alert(
            'Accepter la course',
            'Êtes-vous sûr de vouloir accepter cette course ?',
            [
                { text: t('common.cancel'), style: 'cancel' },
                {
                    text: t('common.accept'),
                    style: 'default',
                    onPress: async () => {
                        setAcceptingDelivery(true);
                        try {
                            const response = await deliveryApi.acceptDelivery(deliveryId);
                            if (response.success) {
                                showSuccess('Course acceptée avec succès !');
                                await refresh({ force: true });
                            } else {
                                showError(response.error || 'Erreur lors de l\'acceptation');
                            }
                        } catch (error: any) {
                            console.error('Erreur acceptation course:', error);
                            showError(error.message || 'Erreur lors de l\'acceptation');
                        } finally {
                            setAcceptingDelivery(false);
                        }
                    },
                },
            ]
        );
    };

    const getStatusOptions = () => {
        const status = delivery?.status;
        if (!status) return [];
        switch (status) {
            case 'assigned':
            case 'awaiting_courier':
            case 'awaiting_courier_confirmation':
                return [{ label: 'En route vers départ', status: 'en_route_pickup', icon: '🚚' }];
            case 'en_route_pickup':
                return [{ label: 'Arrivé au départ', status: 'shopping_pending', icon: '📍' }];
            case 'shopping_pending':
                return [{ label: 'Courses en cours', status: 'shopping_in_progress', icon: '🛒' }];
            case 'shopping_in_progress':
                return [{ label: 'Courses terminées', status: 'shopping_completed', icon: '✅' }];
            case 'shopping_completed':
                return [{ label: 'En route livraison', status: 'en_route_delivery', icon: '🚚' }];
            case 'en_route_delivery':
                return [{ label: 'Livré', status: 'delivered', icon: '✅' }];
            default:
                return [];
        }
    };

    const statusLabel = (status: string) => {
        const labels: Record<string, string> = {
            pending: 'En attente',
            awaiting_courier: 'Recherche coursier',
            assigned: 'Coursier assigné',
            en_route_pickup: 'En route départ',
            shopping_pending: 'Arrivé marché',
            shopping_in_progress: 'Courses en cours',
            shopping_completed: 'Panier validé',
            en_route_delivery: 'En route livraison',
            delivered: 'Livré',
            cancelled: 'Annulé',
        };
        return labels[status] || status;
    };

    if (loading && !delivery) {
        return (
            <SafeNativeView style={styles.container}>
                <ScrollView style={styles.scroll}>
                    <SkeletonCard style={styles.skeleton} />
                    <SkeletonCard style={styles.skeleton} />
                    <SkeletonCard />
                </ScrollView>
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.container}>
            <ToastNotification
                visible={toast.visible}
                message={toast.message}
                type={toast.type}
                onClose={hideToast}
            />
            <ScrollView
                style={styles.scroll}
                refreshControl={
                    <RefreshControl
                        refreshing={loading}
                        onRefresh={handleRefresh}
                        tintColor={modernColors.primary}
                    />
                }
            >
                <View style={styles.header}>
                    <View style={styles.headerLeft}>
                        <Text style={styles.title}>
                            Livraison #
                            {delivery?.id != null ? String(delivery.id).slice(-6) : '...'}
                        </Text>
                        <View style={styles.statusRow}>
                            <StatusIndicator
                                status={delivery?.status || 'pending'}
                                size={10}
                                showPulse={delivery?.status !== 'delivered' && delivery?.status !== 'cancelled'}
                            />
                            <Text style={styles.statusText}>{statusLabel(delivery?.status || 'pending')}</Text>
                        </View>
                    </View>
                    <View style={styles.headerActions}>
                        {delivery?.recipient?.canShareLocation && (
                            <TouchableOpacity style={styles.iconButton} onPress={handleShareLocation}>
                                <SafeIcon name="location" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.iconButton}
                            onPress={() => navigation.navigate('MesInteractions', { focusDeliveryId: deliveryId })}
                        >
                            <SafeIcon name="message-circle" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {isCourier && (
                    <View style={styles.courierSection}>
                        <Text style={styles.sectionTitle}>Actions coursier</Text>
                        {/* ✅ NOUVEAU : Bouton pour accepter la course (si notifié) */}
                        {canAcceptDelivery && (
                            <TouchableOpacity
                                style={[styles.button, styles.acceptButton, acceptingDelivery && styles.buttonDisabled]}
                                onPress={handleAcceptDelivery}
                                disabled={acceptingDelivery}
                            >
                                <Text style={styles.buttonText}>
                                    {acceptingDelivery ? '⏳ Acceptation...' : '✅ Accepter la course'}
                                </Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity style={styles.button} onPress={handleNavigation}>
                            <Text style={styles.buttonText}>🧭 Ouvrir navigation</Text>
                        </TouchableOpacity>
                        {getStatusOptions().map((opt) => (
                            <TouchableOpacity
                                key={opt.status}
                                style={[styles.button, updatingStatus && styles.buttonDisabled]}
                                onPress={() => handleUpdateStatus(opt.status)}
                                disabled={updatingStatus}
                            >
                                <Text style={styles.buttonText}>
                                    {opt.icon} {opt.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                        {/* ✅ NOUVEAU : Bouton pour signaler une difficulté */}
                        <TouchableOpacity
                            style={[styles.button, styles.difficultyButton]}
                            onPress={() => setShowDifficultyModal(true)}
                        >
                            <Text style={styles.buttonText}>⚠️ Signaler une difficulté</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <View style={styles.mapWrapper}>
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
                        courierLocation={delivery?.metadata?.last_location || null}
                        recipientLocation={delivery?.recipient?.currentLocation || null}
                        waypoints={delivery?.metadata?.route_points || []}
                        showNavigationButton={!!(delivery?.pickup?.location && delivery?.dropoff?.location)}
                        onNavigationPress={handleNavigation}
                    />
                </View>

                {distance !== null && (
                    <RouteOptimizationIndicator
                        distance={distance}
                        estimatedTime={delivery?.metadata?.estimated_duration_minutes || Math.round(distance * 3)}
                        isOptimized={!!delivery?.metadata?.route_optimized}
                        trafficDelay={delivery?.metadata?.traffic_delay_minutes || 0}
                        style={styles.routeIndicator}
                    />
                )}

                <View style={styles.tabs}>
                    {(['timeline', 'basket', 'courier'] as TabType[]).map((tab) => (
                        <TouchableOpacity
                            key={tab}
                            style={[styles.tab, activeTab === tab && styles.tabActive]}
                            onPress={() => setActiveTab(tab)}
                        >
                            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                                {tab === 'timeline' ? 'Timeline' : tab === 'basket' ? 'Panier' : 'Coursier'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {activeTab === 'timeline' && (
                    <View style={styles.tabContent}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="clock" size={20} color={modernColors.primary} />
                                <Text style={styles.cardTitle}>Historique</Text>
                            </View>
                            <TimelineStepper checkpoints={timeline} currentStatus={delivery?.status || 'pending'} />
                        </View>
                        {deliveryId && user?.id && (
                            <InlineChat
                                deliveryId={deliveryId}
                                currentUserId={user.id}
                                messages={[]}
                                onSendMessage={async () => { }}
                                style={styles.chat}
                            />
                        )}
                        {deliveryId && (
                            <ShareTrackingLink
                                deliveryId={deliveryId}
                                deliveryTitle={`Livraison #${String(deliveryId).slice(-6)}`}
                                style={styles.share}
                            />
                        )}
                    </View>
                )}

                {activeTab === 'basket' && (
                    <View style={styles.tabContent}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="shopping-cart" size={20} color={modernColors.primary} />
                                <Text style={styles.cardTitle}>Panier ({shoppingItems.length})</Text>
                            </View>
                            {shoppingItems.length === 0 ? (
                                <View style={styles.empty}>
                                    <Text style={styles.emptyText}>Aucun article</Text>
                                </View>
                            ) : (
                                <View style={styles.items}>
                                    {shoppingItems.map((item, idx) => {
                                        const rejected = item.status === 'rejected';
                                        const canReject =
                                            !rejected &&
                                            (delivery?.status === 'shopping_completed' ||
                                                delivery?.status === 'en_route_delivery' ||
                                                delivery?.status === 'delivered');

                                        return (
                                            <View key={item.id || idx} style={[styles.item, rejected && styles.itemRejected]}>
                                                <View style={styles.itemContent}>
                                                    <Text style={styles.itemLabel}>{item.label}</Text>
                                                    {rejected && item.rejection_reason && (
                                                        <Text style={styles.rejectionText}>
                                                            Refusé: {item.rejection_reason}
                                                        </Text>
                                                    )}
                                                    <View style={styles.itemMeta}>
                                                        <Text style={styles.itemMetaText}>
                                                            {item.quantity} {item.unit || 'unités'}
                                                        </Text>
                                                        {(item.actualTotal || item.estimatedTotal) && (
                                                            <Text style={styles.itemPrice}>
                                                                {item.actualTotal
                                                                    ? `${item.actualTotal.toFixed(0)} ${delivery?.pricing?.currency || 'XAF'}`
                                                                    : `~${item.estimatedTotal?.toFixed(0) || 0} ${delivery?.pricing?.currency || 'XAF'}`}
                                                            </Text>
                                                        )}
                                                    </View>
                                                </View>
                                                {canReject && (
                                                    <TouchableOpacity
                                                        style={styles.rejectButton}
                                                        onPress={() => setRejectingItem(item)}
                                                    >
                                                        <Text style={styles.rejectButtonText}>Refuser</Text>
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>
                    </View>
                )}

                {activeTab === 'courier' && (
                    <View style={styles.tabContent}>
                        <View style={styles.card}>
                            <View style={styles.cardHeader}>
                                <SafeIcon name="users" size={20} color={modernColors.primary} />
                                <Text style={styles.cardTitle}>Informations</Text>
                            </View>

                            {isCreator && !delivery?.courier && (
                                <TouchableOpacity
                                    style={styles.button}
                                    onPress={() => setShowCourierModal(true)}
                                >
                                    <Text style={styles.buttonText}>Choisir un livreur</Text>
                                </TouchableOpacity>
                            )}

                            {/* Bouton vérification coursier pour le prestataire */}
                            {!isCourier && delivery?.courier && deliveryId &&
                                (delivery?.status === 'assigned' || delivery?.status === 'en_route_pickup' || delivery?.status === 'arrival_pickup' || delivery?.status === 'shopping_pending') && (
                                    <TouchableOpacity
                                        style={[styles.button, { backgroundColor: '#EEF2FF', borderWidth: 1, borderColor: modernColors.primary + '40' }]}
                                        onPress={() => (navigation as any).navigate('ProviderCourierVerification', { deliveryId })}
                                    >
                                        <Text style={[styles.buttonText, { color: modernColors.primary }]}>🛡️ Vérifier l'identité du coursier</Text>
                                    </TouchableOpacity>
                                )}

                            {isCourier && (
                                <View style={styles.mediaSection}>
                                    {(delivery?.status === 'en_route_pickup' ||
                                        delivery?.status === 'shopping_completed' ||
                                        delivery?.status === 'en_route_delivery' ||
                                        delivery?.status === 'delivered') && (
                                            <ProofMediaUpload
                                                deliveryId={deliveryId!}
                                                proofType="pickup"
                                                isCourier={true}
                                                onMediaUpdated={() => refresh({ force: true })}
                                            />
                                        )}
                                    {(delivery?.status === 'en_route_delivery' ||
                                        delivery?.status === 'delivered') && (
                                            <ProofMediaUpload
                                                deliveryId={deliveryId!}
                                                proofType="delivery"
                                                isCourier={true}
                                                onMediaUpdated={() => refresh({ force: true })}
                                            />
                                        )}
                                </View>
                            )}

                            {!isCourier && deliveryId && (
                                <View style={styles.mediaSection}>
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

                            <View style={styles.info}>
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Coursier:</Text>
                                    <Text style={styles.infoValue}>
                                        {courierInfo.courier?.name || 'En attente'}
                                    </Text>
                                </View>
                                {courierInfo.courier?.phone && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Téléphone:</Text>
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`tel:${courierInfo.courier.phone}`)}
                                        >
                                            <Text style={styles.infoLink}>{courierInfo.courier.phone}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                <View style={styles.infoRow}>
                                    <Text style={styles.infoLabel}>Destinataire:</Text>
                                    <Text style={styles.infoValue}>
                                        {courierInfo.recipient?.name || 'Invité'}
                                    </Text>
                                </View>
                                {courierInfo.recipient?.phone && (
                                    <View style={styles.infoRow}>
                                        <Text style={styles.infoLabel}>Téléphone:</Text>
                                        <TouchableOpacity
                                            onPress={() => Linking.openURL(`tel:${courierInfo.recipient.phone}`)}
                                        >
                                            <Text style={styles.infoLink}>{courierInfo.recipient.phone}</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                                {courierInfo.pricing && (
                                    <>
                                        <View style={styles.separator} />
                                        <View style={styles.infoRow}>
                                            <Text style={styles.infoLabel}>Total:</Text>
                                            <Text style={styles.infoValueBold}>
                                                {courierInfo.pricing.finalTotal || courierInfo.pricing.estimated}{' '}
                                                {courierInfo.pricing.currency}
                                            </Text>
                                        </View>
                                    </>
                                )}
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            {deliveryId && (
                <CourierSelectionModal
                    visible={showCourierModal}
                    onClose={() => setShowCourierModal(false)}
                    deliveryId={deliveryId}
                    onSuccess={() => refresh({ force: true }).catch(console.error)}
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

            {/* ✅ NOUVEAU : Modal de signalement de difficulté */}
            <CourierDifficultyModal
                visible={showDifficultyModal}
                onClose={() => setShowDifficultyModal(false)}
                deliveryId={deliveryId}
                onSuccess={async () => {
                    setShowDifficultyModal(false);
                    showSuccess('Difficulté signalée. Un nouveau coursier va prendre le relais.');
                    await refresh({ force: true });
                }}
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    scroll: {
        flex: 1,
        padding: 16,
    },
    skeleton: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerLeft: {
        flex: 1,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    statusRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    statusText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    headerActions: {
        flexDirection: 'row',
        gap: 8,
    },
    iconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    courierSection: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 20,
        gap: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 8,
    },
    button: {
        backgroundColor: modernColors.primary,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
    },
    mapWrapper: {
        height: 250,
        borderRadius: 12,
        overflow: 'hidden',
        marginBottom: 16,
    },
    routeIndicator: {
        marginBottom: 16,
    },
    tabs: {
        flexDirection: 'row',
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 8,
        padding: 4,
        marginBottom: 16,
    },
    tab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: 'center',
    },
    tabActive: {
        backgroundColor: modernColors.surface,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    tabTextActive: {
        color: modernColors.primary,
    },
    tabContent: {
        gap: 16,
    },
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        gap: 16,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    chat: {
        marginTop: 0,
    },
    share: {
        marginTop: 0,
    },
    empty: {
        paddingVertical: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    items: {
        gap: 12,
    },
    item: {
        backgroundColor: modernColors.surfaceVariant,
        borderRadius: 8,
        padding: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    itemRejected: {
        backgroundColor: modernColors.error + '10',
        borderLeftWidth: 4,
        borderLeftColor: modernColors.error,
    },
    itemContent: {
        flex: 1,
        gap: 8,
    },
    itemLabel: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    rejectionText: {
        fontSize: 12,
        color: modernColors.error,
    },
    itemMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    itemMetaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    rejectButton: {
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: modernColors.error,
        borderRadius: 6,
        alignSelf: 'flex-start',
    },
    rejectButtonText: {
        color: '#FFF',
        fontSize: 12,
        fontWeight: '600',
    },
    mediaSection: {
        gap: 16,
        marginTop: 16,
    },
    info: {
        gap: 12,
        marginTop: 16,
    },
    infoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    infoLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
        fontWeight: '500',
    },
    infoValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    infoValueBold: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
    },
    infoLink: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
        textDecorationLine: 'underline',
    },
    separator: {
        height: 1,
        backgroundColor: modernColors.border,
        marginVertical: 8,
    },
    difficultyButton: {
        backgroundColor: '#EF4444',
        borderColor: '#EF4444',
    },
    acceptButton: {
        backgroundColor: '#10B981',
        borderColor: '#10B981',
    },
});

export default DeliveryShoppingTrackingScreen;
