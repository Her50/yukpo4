import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';

import ActiveDeliveryCard from '../../components/delivery/ActiveDeliveryCard';
import DeliveryAvatarBubble from '../../components/delivery/DeliveryAvatarBubble';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import { modernColors } from '../../theme/modernTheme';

const DeliveryHomeScreen: React.FC = () => {
    const navigation = useNavigation<any>();
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

    useFocusEffect(
        useCallback(() => {
            refreshActiveDeliveries();
        }, [refreshActiveDeliveries])
    );

    const activeDeliveries = useMemo(() => {
        return Object.values(deliveries)
            .sort((a, b) => {
                const aTime = a.lastEventAt ?? a.checkpoints?.slice(-1)[0]?.timestamp ?? '';
                const bTime = b.lastEventAt ?? b.checkpoints?.slice(-1)[0]?.timestamp ?? '';
                return bTime.localeCompare(aTime);
            });
    }, [deliveries]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await refreshActiveDeliveries();
        setRefreshing(false);
    }, [refreshActiveDeliveries]);

    const handleStartShopping = () => {
        console.log('[DeliveryHomeScreen] 🛒 Navigation vers DeliveryShoppingFlow');
        try {
            // ✅ CORRIGÉ: Utiliser getParent() pour naviguer depuis Tab Navigator vers Stack Navigator
            const parentNavigation = navigation.getParent();
            if (parentNavigation) {
                parentNavigation.navigate('DeliveryShoppingFlow');
                console.log('[DeliveryHomeScreen] ✅ Navigation réussie vers DeliveryShoppingFlow via parent');
            } else {
                // Fallback: essayer navigation directe
                navigation.navigate('DeliveryShoppingFlow');
                console.log('[DeliveryHomeScreen] ✅ Navigation réussie vers DeliveryShoppingFlow (directe)');
            }
        } catch (error) {
            console.error('[DeliveryHomeScreen] ❌ Erreur navigation vers DeliveryShoppingFlow:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir le flux de commande. Veuillez réessayer.');
        }
    };

    const handleStartParcel = () => {
        console.log('[DeliveryHomeScreen] 📦 Tentative d\'ouverture du flux colis');
        // ✅ CORRIGÉ: Si delivery_v2 est activé, naviguer vers le flux colis
        if (isEnabled('delivery_v2')) {
            try {
                // TODO: Naviguer vers le flux colis quand il sera implémenté
                // navigation.navigate('DeliveryParcelFlow');
                Alert.alert(
                    'Flux colis (beta)',
                    'Le flux de livraison de colis est en cours de finalisation. Utilise les courses supermarché pour tester le suivi temps réel.'
                );
            } catch (error) {
                console.error('[DeliveryHomeScreen] ❌ Erreur navigation vers flux colis:', error);
                Alert.alert('Erreur', 'Impossible d\'ouvrir le flux de livraison de colis.');
            }
        } else {
            Alert.alert(
                'Flux colis en préparation',
                'Nous finalisons les derniers écrans pour les livraisons de colis. Utilise les courses supermarché pour tester le suivi temps réel.'
            );
        }
    };

    const handleOpenDelivery = (deliveryId: string) => {
        setActiveDeliveryId(deliveryId);
        try {
            // ✅ CORRIGÉ: Utiliser getParent() pour naviguer depuis Tab Navigator vers Stack Navigator
            const parentNavigation = navigation.getParent();
            if (parentNavigation) {
                parentNavigation.navigate('DeliveryShoppingTracking', { deliveryId });
            } else {
                navigation.navigate('DeliveryShoppingTracking', { deliveryId });
            }
        } catch (error) {
            console.error('[DeliveryHomeScreen] ❌ Erreur navigation vers DeliveryShoppingTracking:', error);
            Alert.alert('Erreur', 'Impossible d\'ouvrir le suivi de livraison.');
        }
    };

    return (
        <SafeNativeView style={styles.container} backgroundColor={modernColors.background}>
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

                {(!isNetworkOnline || !isWebSocketConnected) && (
                    <NativeCard style={[styles.card, styles.warningCard]}>
                        <Text style={styles.warningTitle}>Connexion limitée</Text>
                        <Text style={styles.warningSubtitle}>
                            {isNetworkOnline
                                ? 'Reconnexion au canal temps réel en cours. Les données se resynchroniseront automatiquement.'
                                : 'Connexion réseau indisponible. Les actions seront synchronisées dès le retour en ligne.'}
                        </Text>
                        <NativeButton
                            title='Retenter la synchronisation'
                            variant='outline'
                            onPress={retryPendingMutations}
                            size='small'
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
                            onPress={retryPendingMutations}
                            size='small'
                        />
                    </NativeCard>
                )}

                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Courses supermarché</Text>
                    <Text style={styles.cardSubtitle}>
                        Compose ton panier, nous avançons l'achat et tu suis ton coursier en direct.
                    </Text>
                    <NativeButton
                        title="Commander au supermarché"
                        variant="primary"
                        onPress={handleStartShopping}
                        style={styles.actionButton}
                    />
                </NativeCard>

                {/* ✅ CORRIGÉ: Toujours afficher le flux colis, mais avec message adapté selon feature flag */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Livraison de colis</Text>
                    <Text style={styles.cardSubtitle}>
                        {isEnabled('delivery_v2')
                            ? 'Expédie un colis ou un document avec le nouveau flux de livraison intelligente (beta).'
                            : 'Envoie un colis ou un document avec suivi en temps réel. Le flux est opérationnel via les courses supermarché.'}
                    </Text>
                    <NativeButton
                        title={isEnabled('delivery_v2') ? "Nouveau flux colis (beta)" : "Utiliser les courses supermarché"}
                        variant={isEnabled('delivery_v2') ? "outline" : "primary"}
                        onPress={isEnabled('delivery_v2') ? handleStartParcel : handleStartShopping}
                        style={styles.actionButton}
                    />
                </NativeCard>

                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Vos livraisons actives</Text>
                    <NativeButton
                        title="Actualiser"
                        size="small"
                        variant="ghost"
                        onPress={handleRefresh}
                        disabled={loading || refreshing}
                    />
                </View>

                {loading && activeDeliveries.length === 0 ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator size="small" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Chargement des livraisons en cours...</Text>
                    </View>
                ) : activeDeliveries.length === 0 ? (
                    <View style={styles.emptyState}>
                        <Text style={styles.emptyTitle}>Aucune livraison en cours</Text>
                        <Text style={styles.emptySubtitle}>
                            Lance une commande supermarché pour suivre ton coursier en temps réel.
                        </Text>
                        <NativeButton title="Nouvelle commande" onPress={handleStartShopping} />
                    </View>
                ) : (
                    activeDeliveries.map(delivery => (
                        <ActiveDeliveryCard key={delivery.id} delivery={delivery} onPress={handleOpenDelivery} />
                    ))
                )}
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
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
});

export default DeliveryHomeScreen;
