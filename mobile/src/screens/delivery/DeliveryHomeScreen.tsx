import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, BackHandler, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

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

    const handleOpenDelivery = useCallback((deliveryId: string) => {
        if (navigating) return;

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

        console.log('[DeliveryHomeScreen] 📍 Ouverture livraison:', deliveryId);
        setNavigating(true);
        setActiveDeliveryId(deliveryId);

        try {
            // Navigation directe vers le tracking
            navigation.navigate('DeliveryShoppingTracking', { deliveryId });
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

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
            <Animated.View style={[styles.animatedContainer, safeScreenEnterStyle as any]}>
                <ScrollView
                    contentContainerStyle={styles.scroll}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing && !loading} onRefresh={handleRefresh} />
                    }
                >
                    <DeliveryAvatarBubble
                        message="Livraison intelligente Yukpo"
                        subtitle="Orchestre tes courses supermarché, tracking temps réel et notifications destinataire."
                    />

                    {/* ✅ CORRIGÉ: Afficher uniquement si réseau offline (pas pour WebSocket limité) */}
                    {!isNetworkOnline && (
                        <NativeCard style={[styles.card, styles.warningCard]}>
                            <Text style={styles.warningTitle}>
                                Connexion réseau indisponible
                            </Text>
                            <Text style={styles.warningSubtitle}>
                                Votre connexion internet est indisponible. Les actions seront synchronisées automatiquement dès le retour en ligne.
                            </Text>
                            <NativeButton
                                title="Vérifier la connexion"
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
                        <NativeCard style={[styles.card, styles.infoCard]}>
                            <Text style={styles.infoTitle}>Actions en attente</Text>
                            <Text style={styles.infoSubtitle}>
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
                                <Text style={styles.sectionTitle}>Vos livraisons actives</Text>
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
                            <View style={styles.deliveriesList}>
                                {activeDeliveries.map((delivery, index) => (
                                    <AnimatedDeliveryCard
                                        key={delivery.id}
                                        delivery={delivery}
                                        onPress={handleOpenDelivery}
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

                    {/* ✅ PHASE 3: Sous-dashboard Livres Scolaires pour l'utilisateur */}
                    <BookUserSubDashboard onRefresh={handleRefresh} />

                    {/* ✅ NOUVEAU: Section pour créer une nouvelle livraison */}
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Nouvelle livraison</Text>
                    </View>

                    {/* ✅ CORRIGÉ: Livraison de colis AVANT courses supermarché */}
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>Livraison de colis</Text>
                        <Text style={styles.cardSubtitle}>
                            Précisez les caractéristiques du colis que vous souhaitez faire transporter par un coursier.
                        </Text>
                        <HapticTouchable
                            hapticType="medium"
                            onPress={handleStartParcel}
                            disabled={navigating}
                        >
                            <NativeButton
                                title="Expédier un colis"
                                variant="primary"
                                onPress={handleStartParcel}
                                disabled={navigating}
                                style={styles.actionButton}
                            />
                        </HapticTouchable>
                    </NativeCard>

                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>Courses supermarché</Text>
                        <Text style={styles.cardSubtitle}>
                            Compose ton panier, nous avançons l'achat et tu suis ton coursier en direct.
                        </Text>
                        <HapticTouchable
                            hapticType="medium"
                            onPress={handleStartShopping}
                            disabled={navigating}
                        >
                            <NativeButton
                                title="Commander au supermarché"
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
                            <Text style={styles.emptyTitle}>Aucune livraison en cours</Text>
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
    card: {
        gap: 12,
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
    warningSubtitle: {
        fontSize: 13,
        color: '#854D0E',
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
    infoSubtitle: {
        fontSize: 13,
        color: '#0C4A6E',
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
});

export default DeliveryHomeScreen;
