import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, Platform, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';

import AnimatedDeliveryCard from '../../components/delivery/AnimatedDeliveryCard';
import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import HapticTouchable from '../../components/delivery/HapticTouchable';
import SkeletonDeliveryCard from '../../components/delivery/SkeletonDeliveryCard';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { notificationSoundService } from '../../services/notificationSoundService';
import { modernColors } from '../../theme/modernTheme';
import { useScreenEnter } from '../../utils/animations';

const DeliveryHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const { width } = useWindowDimensions();
    const isCompactAndroid = Platform.OS === 'android' && width <= 360;
    const {
        deliveries,
        refreshActiveDeliveries,
        setActiveDeliveryId,
        loading,
        isNetworkOnline,
        isWebSocketConnected,
        pendingMutationCount,
        retryPendingMutations,
    } = useDeliveryContext();
    const { isEnabled } = useFeatureFlags();
    const [refreshing, setRefreshing] = useState(false);
    const [navigating, setNavigating] = useState(false);
    const prevDeliveryCountRef = useRef(0);

    // ✅ CORRIGÉ: Utiliser useScreenEnter directement comme hook React (pas dans try/catch)
    // Les hooks React doivent être appelés de manière inconditionnelle
    const screenEnterStyle = useScreenEnter();
    // ✅ CORRIGÉ: S'assurer que screenEnterStyle a toujours une propriété style valide
    // Protection supplémentaire contre les erreurs d'animation
    const safeScreenEnterStyle = React.useMemo(() => {
        try {
            if (screenEnterStyle && screenEnterStyle.style) {
                return screenEnterStyle.style;
            }
        } catch (error) {
            console.warn('[DeliveryHomeScreen] Erreur screenEnterStyle:', error);
        }
        return {};
    }, [screenEnterStyle]);

    useFocusEffect(
        useCallback(() => {
            // ✅ FIX 2026-03-03: Initialiser le service audio pour les notifications coursier
            notificationSoundService.initialize().catch(console.error);

            // ✅ CORRIGÉ: Vérifier que refreshActiveDeliveries existe avant de l'appeler
            if (typeof refreshActiveDeliveries === 'function') {
                refreshActiveDeliveries();
            } else {
                console.warn('[DeliveryHomeScreen] ⚠️ refreshActiveDeliveries n\'est pas disponible');
            }
            // ✅ CORRIGÉ : Réinitialiser l'état navigating quand l'écran devient actif
            setNavigating(false);

            // ✅ FIX 2026-03-03: Polling pour détecter de nouvelles livraisons (coursier)
            const interval = setInterval(() => {
                if (typeof refreshActiveDeliveries === 'function') {
                    refreshActiveDeliveries();
                }
            }, 15000);

            return () => clearInterval(interval);
        }, [refreshActiveDeliveries])
    );

    // ✅ FIX 2026-03-03: Détecter nouvelles livraisons et jouer le son
    useEffect(() => {
        const currentCount = Object.keys(deliveries).length;
        if (currentCount > prevDeliveryCountRef.current && prevDeliveryCountRef.current > 0) {
            notificationSoundService.playSoundWithVibration('delivery_request').catch(console.error);
        }
        prevDeliveryCountRef.current = currentCount;
    }, [deliveries]);

    // ✅ CORRIGÉ: Gestion du bouton retour Android
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            // ✅ CORRIGÉ: Vérifier que navigation et canGoBack existent
            if (navigation && typeof navigation.canGoBack === 'function' && navigation.canGoBack()) {
                if (typeof navigation.goBack === 'function') {
                    navigation.goBack();
                    return true;
                }
            }
            return false;
        });

        return () => {
            if (backHandler && typeof backHandler.remove === 'function') {
                backHandler.remove();
            }
        };
    }, [navigation]);

    const activeDeliveries = useMemo(() => {
        return Object.values(deliveries)
            .sort((a, b) => {
                const aTime = a.lastEventAt ?? a.checkpoints?.slice(-1)[0]?.timestamp ?? '';
                const bTime = b.lastEventAt ?? b.checkpoints?.slice(-1)[0]?.timestamp ?? '';
                return bTime.localeCompare(aTime);
            });
    }, [deliveries]);

    const handleRefresh = useCallback(async () => {
        // ✅ CORRIGÉ: Vérifier que refreshActiveDeliveries existe avant de l'appeler
        if (typeof refreshActiveDeliveries !== 'function') {
            console.warn('[DeliveryHomeScreen] ⚠️ refreshActiveDeliveries n\'est pas disponible');
            setRefreshing(false);
            return;
        }

        setRefreshing(true);
        try {
            await refreshActiveDeliveries();
        } catch (error) {
            console.error('[DeliveryHomeScreen] ❌ Erreur refresh:', error);
        } finally {
            setRefreshing(false);
        }
    }, [refreshActiveDeliveries]);

    // ✅ OPTIMISÉ: Navigation immédiate sans délai artificiel
    const handleStartShopping = useCallback(() => {
        if (navigating) return;

        // ✅ CORRIGÉ: Vérifier que navigation existe et a la méthode navigate
        if (!navigation || typeof navigation.navigate !== 'function') {
            console.error('[DeliveryHomeScreen] ❌ navigation.navigate n\'est pas disponible');
            Alert.alert(t('message.error'), t('deliveryHome.navigationUnavailable'));
            return;
        }

        console.log('[DeliveryHomeScreen] 🛒 Navigation vers DeliveryShoppingFlow');
        setNavigating(true);

        try {
            // Navigation vers le nouveau flux shopping amélioré
            navigation.navigate('DeliveryShoppingFlowNew' as never);
            console.log('[DeliveryHomeScreen] ✅ Navigation réussie vers DeliveryShoppingFlowNew');
            // ✅ OPTIMISÉ: Réinitialiser immédiatement (pas de setTimeout)
            setNavigating(false);
        } catch (error: any) {
            console.error('[DeliveryHomeScreen] ❌ Erreur navigation:', error);
            setNavigating(false); // Réinitialiser en cas d'erreur
            Alert.alert(
                t('message.error'),
                t('deliveryHome.cannotOpenShoppingFlow'),
                [{ text: 'OK' }]
            );
        }
    }, [navigation, navigating]);

    const handleStartParcel = useCallback(() => {
        if (navigating) return;

        // ✅ CORRIGÉ: Vérifier que navigation existe et a la méthode navigate
        if (!navigation || typeof navigation.navigate !== 'function') {
            console.error('[DeliveryHomeScreen] ❌ navigation.navigate n\'est pas disponible');
            Alert.alert(t('message.error'), t('deliveryHome.navigationUnavailable'));
            return;
        }

        console.log('[DeliveryHomeScreen] 📦 Navigation vers DeliveryParcelFlowNew');
        setNavigating(true);

        try {
            // ✅ NOUVEAU: Navigation vers le nouveau flux amélioré
            navigation.navigate('DeliveryParcelFlowNew' as never);
            console.log('[DeliveryHomeScreen] ✅ Navigation réussie vers DeliveryParcelFlowNew');
            // ✅ OPTIMISÉ: Réinitialiser immédiatement (pas de setTimeout)
            setNavigating(false);
        } catch (error: any) {
            console.error('[DeliveryHomeScreen] ❌ Erreur navigation:', error);
            setNavigating(false); // Réinitialiser en cas d'erreur
            Alert.alert(
                t('message.error'),
                t('deliveryHome.cannotOpenParcelFlow'),
                [{ text: 'OK' }]
            );
        }
    }, [navigation, navigating]);

    const handleOpenDeliveryTracking = useCallback((deliveryId: string) => {
        if (navigating) return;

        const id = deliveryId != null && deliveryId !== '' ? String(deliveryId) : '';
        if (!id) {
            Alert.alert(t('message.error'), t('deliveryHome.cannotOpenTracking'));
            return;
        }

        // ✅ CORRIGÉ: Vérifier que navigation existe et a la méthode navigate
        if (!navigation || typeof navigation.navigate !== 'function') {
            console.error('[DeliveryHomeScreen] ❌ navigation.navigate n\'est pas disponible');
            Alert.alert(t('message.error'), t('deliveryHome.navigationUnavailable'));
            return;
        }

        // ✅ CORRIGÉ: Vérifier que setActiveDeliveryId existe
        if (typeof setActiveDeliveryId !== 'function') {
            console.error('[DeliveryHomeScreen] ❌ setActiveDeliveryId n\'est pas disponible');
            Alert.alert(t('message.error'), t('deliveryHome.functionUnavailable'));
            return;
        }

        console.log('[DeliveryHomeScreen] 📍 Ouverture livraison:', id);
        setNavigating(true);
        setActiveDeliveryId(id);

        try {
            // Navigation directe vers le tracking
            navigation.navigate('DeliveryShoppingTracking', { deliveryId: id });
            console.log('[DeliveryHomeScreen] ✅ Navigation réussie vers DeliveryShoppingTracking');
            // ✅ OPTIMISÉ: Réinitialiser immédiatement (pas de setTimeout)
            setNavigating(false);
        } catch (error: any) {
            console.error('[DeliveryHomeScreen] ❌ Erreur navigation:', error);
            setNavigating(false); // Réinitialiser en cas d'erreur
            Alert.alert(
                t('message.error'),
                t('deliveryHome.cannotOpenTracking'),
                [{ text: 'OK' }]
            );
        }
    }, [navigation, setActiveDeliveryId, navigating]);

    const handleOpenDeliveryEdit = useCallback((deliveryId: string) => {
        if (navigating) return;
        const id = deliveryId != null && deliveryId !== '' ? String(deliveryId) : '';
        if (!id) {
            Alert.alert(t('message.error'), t('deliveryHome.cannotOpenTracking'));
            return;
        }

        const targetDelivery = activeDeliveries.find((d) => String(d.id) === id);
        if (!targetDelivery) {
            Alert.alert(t('message.error'), t('deliveryHome.cannotOpenTracking'));
            return;
        }

        if (targetDelivery.status === 'delivered' || targetDelivery.status === 'completed' || targetDelivery.status === 'cancelled') {
            Alert.alert(
                t('message.error'),
                t('deliveryHome.editUnavailableAfterCompletion', 'Cette livraison ne peut plus être modifiée.')
            );
            return;
        }

        try {
            setNavigating(true);
            if (targetDelivery.kind === 'parcel') {
                navigation.navigate('DeliveryParcelFlowNew' as never, {
                    mode: 'edit',
                    deliveryId: id,
                    fromActiveDelivery: true,
                } as never);
            } else {
                navigation.navigate('ShoppingPickupDrop' as never, {
                    mode: 'edit',
                    deliveryId: id,
                    fromActiveDelivery: true,
                } as never);
            }
            setNavigating(false);
        } catch (error: any) {
            console.error('[DeliveryHomeScreen] ❌ Erreur navigation edition:', error);
            setNavigating(false);
            Alert.alert(
                t('message.error'),
                t('deliveryHome.cannotOpenEditFlow') || "Impossible d'ouvrir l'écran de modification.",
                [{ text: 'OK' }]
            );
        }
    }, [activeDeliveries, navigation, navigating, t]);

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <Animated.View style={[styles.animatedContainer, safeScreenEnterStyle as any]}>
                <ScrollView
                    contentContainerStyle={[styles.scroll, isCompactAndroid && styles.scrollCompact]}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing && !loading} onRefresh={handleRefresh} />
                    }
                >
                    <DeliveryAvatarBubble
                        message="Livraison intelligente Yukpo"
                        subtitle={t('deliveryHome.orchestreTesCoursesSupermarcheTracking')}
                    />

                    {/* ✅ CORRIGÉ: Afficher uniquement si réseau offline (pas pour WebSocket limité) */}
                    {!isNetworkOnline && (
                        <NativeCard style={[styles.card, isCompactAndroid && styles.cardCompact, styles.warningCard]}>
                            <Text style={[styles.warningTitle, isCompactAndroid && styles.warningTitleCompact]}>
                                Connexion réseau indisponible
                            </Text>
                            <Text style={[styles.warningSubtitle, isCompactAndroid && styles.warningSubtitleCompact]}>
                                Votre connexion internet est indisponible. Les actions seront synchronisées automatiquement dès le retour en ligne.
                            </Text>
                            <NativeButton
                                title={t('deliveryHome.verifierLaConnexion')}
                                variant='outline'
                                onPress={() => {
                                    console.log('[DeliveryHomeScreen] 🔄 Tentative de reconnexion...');
                                    if (typeof retryPendingMutations === 'function') {
                                        retryPendingMutations();
                                    } else {
                                        console.warn('[DeliveryHomeScreen] ⚠️ retryPendingMutations n\'est pas disponible');
                                    }
                                }}
                                size='small'
                                disabled={!isNetworkOnline}
                            />
                        </NativeCard>
                    )}

                    {pendingMutationCount > 0 && (
                        <NativeCard style={[styles.card, isCompactAndroid && styles.cardCompact, styles.infoCard]}>
                            <Text style={[styles.infoTitle, isCompactAndroid && styles.infoTitleCompact]}>Actions en attente</Text>
                            <Text style={[styles.infoSubtitle, isCompactAndroid && styles.infoSubtitleCompact]}>
                                {pendingMutationCount} action(s) seront rejouées automatiquement dès que la connexion sera rétablie.
                            </Text>
                            <NativeButton
                                title='Forcer la synchronisation'
                                variant='ghost'
                                onPress={() => {
                                    console.log('[DeliveryHomeScreen] 🔄 Forçage synchronisation...');
                                    if (typeof retryPendingMutations === 'function') {
                                        retryPendingMutations();
                                    } else {
                                        console.warn('[DeliveryHomeScreen] ⚠️ retryPendingMutations n\'est pas disponible');
                                    }
                                }}
                                size='small'
                                disabled={!isNetworkOnline}
                            />
                        </NativeCard>
                    )}

                    {/* ✅ CORRIGÉ: Livraisons actives EN HAUT */}
                    {activeDeliveries.length > 0 && (
                        <>
                            <View style={styles.sectionHeader}>
                                <Text style={[styles.sectionTitle, isCompactAndroid && styles.sectionTitleCompact]}>{t('deliveryHome.vosLivraisonsActives')}</Text>
                                <TouchableOpacity
                                    onPress={handleRefresh}
                                    disabled={loading || refreshing}
                                    style={[styles.refreshButton, (loading || refreshing) && styles.refreshButtonDisabled]}
                                >
                                    <SafeIcon
                                        name="refresh"
                                        size={16}
                                        color={(loading || refreshing) ? modernColors.textSecondary : modernColors.primary}
                                    />
                                    <Text style={[
                                        styles.refreshButtonText,
                                        (loading || refreshing) && styles.refreshButtonTextDisabled
                                    ]}>
                                        Actualiser
                                    </Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[styles.deliveriesList, isCompactAndroid && styles.deliveriesListCompact]}>
                                {activeDeliveries.map((delivery, index) => (
                                    <AnimatedDeliveryCard
                                        key={delivery.id}
                                        delivery={delivery}
                                        onTrackPress={handleOpenDeliveryTracking}
                                        onEditPress={handleOpenDeliveryEdit}
                                        index={index}
                                    />
                                ))}
                            </View>
                        </>
                    )}

                    {loading && activeDeliveries.length === 0 && (
                        <View style={styles.loadingState}>
                            <SkeletonDeliveryCard />
                            <SkeletonDeliveryCard />
                            <SkeletonDeliveryCard />
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Section pour créer une nouvelle livraison */}
                    <View style={styles.sectionHeader}>
                        <Text style={[styles.sectionTitle, isCompactAndroid && styles.sectionTitleCompact]}>{t('deliveryHome.nouvelleLivraison')}</Text>
                    </View>

                    {/* ✅ CORRIGÉ: Livraison de colis AVANT courses supermarché */}
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>{t('deliveryHome.livraisonDeColis')}</Text>
                        <Text style={styles.cardSubtitle}>
                            Précisez les caractéristiques du colis que vous souhaitez faire transporter par un coursier.
                        </Text>
                        <HapticTouchable
                            hapticType="medium"
                            onPress={handleStartParcel}
                            disabled={navigating}
                        >
                            <NativeButton
                                title={t('deliveryHome.expedierUnColis')}
                                variant="primary"
                                onPress={handleStartParcel}
                                disabled={navigating}
                                style={styles.actionButton}
                            />
                        </HapticTouchable>
                    </NativeCard>

                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>{t('deliveryHome.coursesSupermarche')}</Text>
                        <Text style={styles.cardSubtitle}>
                            Compose ton panier, nous avançons l'achat et tu suis ton coursier en direct.'
                        </Text>
                        <HapticTouchable
                            hapticType="medium"
                            onPress={handleStartShopping}
                            disabled={navigating}
                        >
                            <NativeButton
                                title={t('deliveryHome.commanderAuSupermarche')}
                                variant="outline"
                                onPress={handleStartShopping}
                                disabled={navigating}
                                style={styles.actionButton}
                            />
                        </HapticTouchable>
                    </NativeCard>

                    {/* ✅ Afficher état vide seulement si pas de livraisons */}
                    {!loading && activeDeliveries.length === 0 && (
                        <View style={styles.emptyState}>
                            <View style={styles.emptyIconContainer}>
                                <SafeIcon name="package" size={48} color={modernColors.textSecondary} />
                            </View>
                            <Text style={styles.emptyTitle}>{t('deliveryHome.aucuneLivraisonEnCours')}</Text>
                            <Text style={styles.emptySubtitle}>
                                Lance une commande supermarché ou une livraison de colis pour suivre ton coursier en temps réel.
                            </Text>
                        </View>
                    )}
                </ScrollView>
            </Animated.View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    animatedContainer: {
        flex: 1,
    },
    scroll: {
        padding: 20,
        gap: 20,
        paddingBottom: 120,
    },
    scrollCompact: {
        padding: 14,
        gap: 14,
        paddingBottom: 96,
    },
    card: {
        gap: 12,
    },
    cardCompact: {
        gap: 8,
    },
    cardTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    cardSubtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    sectionTitleCompact: {
        fontSize: 16,
    },
    emptyState: {
        alignItems: 'center',
        gap: 12,
        paddingVertical: 24,
        paddingHorizontal: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 16,
    },
    loadingState: {
        alignItems: 'center',
        gap: 10,
        paddingVertical: 24,
        paddingHorizontal: 16,
        backgroundColor: modernColors.surface,
        borderRadius: 16,
    },
    loadingText: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    emptySubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    warningCard: {
        borderWidth: 1,
        borderColor: '#FACC15',
        backgroundColor: '#FEFCE8',
    },
    warningTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#854D0E',
    },
    warningTitleCompact: {
        fontSize: 14,
    },
    warningSubtitle: {
        fontSize: 13,
        color: '#854D0E',
    },
    warningSubtitleCompact: {
        fontSize: 12,
    },
    infoCard: {
        borderWidth: 1,
        borderColor: '#38BDF8',
        backgroundColor: '#ECFEFF',
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0C4A6E',
    },
    infoTitleCompact: {
        fontSize: 14,
    },
    infoSubtitle: {
        fontSize: 13,
        color: '#0C4A6E',
    },
    infoSubtitleCompact: {
        fontSize: 12,
    },
    actionButton: {
        marginTop: 8,
    },
    refreshButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
    },
    refreshButtonDisabled: {
        opacity: 0.5,
    },
    refreshButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    refreshButtonTextDisabled: {
        color: modernColors.textSecondary,
    },
    emptyIconContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: modernColors.surfaceVariant,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyStateButton: {
        marginTop: 8,
    },
    deliveriesList: {
        gap: 16,
    },
    deliveriesListCompact: {
        gap: 10,
    },
});

export default DeliveryHomeScreen;
