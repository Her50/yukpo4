import { useNavigation } from '@react-navigation/native';
import React from 'react';
import { Image, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useFeatureFlags } from '../../contexts/FeatureFlagContext';
import useGlobalPromos from '../../hooks/useGlobalPromos';
import { modernColors } from '../../theme/modernTheme';
import { NativeButton, NativeCard } from '../NativeDesign';
import SafeIcon from '../SafeIcon';

const getSnapshotImage = (snapshot: any): string | undefined => {
    if (!snapshot) return undefined;
    const images = snapshot.images;
    if (Array.isArray(images) && images.length > 0) {
        if (typeof images[0] === 'string') {
            return images[0];
        }
        if (typeof images[0]?.url === 'string') {
            return images[0].url;
        }
    }
    if (typeof snapshot.cover === 'string') {
        return snapshot.cover;
    }
    return undefined;
};

const formatPrice = (value?: number | null) => {
    if (!value) return 'Prix spécial à découvrir';
    return `${value.toLocaleString('fr-FR')} CFA`;
};

const GlobalPromoHighlightsComponent: React.FC = () => {
    const navigation = useNavigation<any>();
    const { entries, events, selectedEvent, loadingEvents, loadingEntries, loading, error, refresh } = useGlobalPromos();
    const { isEnabled } = useFeatureFlags();
    const [isInitialized, setIsInitialized] = React.useState(false);

    // ✅ CORRIGÉ: Construire catalog à partir de entries et selectedEvent
    const catalog = React.useMemo(() => {
        if (!selectedEvent || !entries || entries.length === 0) {
            return [];
        }
        // Construire le catalog en combinant entries avec l'event sélectionné
        return entries.map(entry => ({
            entry,
            event: selectedEvent,
            product: entry.product || null
        }));
    }, [entries, selectedEvent]);

    // ✅ CORRIGÉ: Éviter le flash rapide au démarrage
    React.useEffect(() => {
        const isLoading = loadingEvents || loadingEntries;
        if (!isLoading && !isInitialized) {
            // Attendre que le chargement initial soit terminé avant d'afficher
            const timer = setTimeout(() => {
                setIsInitialized(true);
            }, 300); // Petit délai pour éviter le flash
            return () => {
                // ✅ SÉCURITÉ: Vérifier que timer existe avant de le nettoyer
                if (timer) {
                    clearTimeout(timer);
                }
            };
        }
    }, [loadingEvents, loadingEntries, isInitialized]);

    // ✅ CORRIGÉ: Ne rien afficher pendant le chargement initial pour éviter le flash
    const isLoading = loadingEvents || loadingEntries;
    if (isLoading && !isInitialized) {
        return null;
    }

    // ✅ CORRIGÉ: Toujours afficher les promotions (le flag est activé par défaut)
    // if (!isEnabled('global_promos')) {
    //     return null;
    // }

    // Sécurité: s'assurer que catalog est toujours un tableau
    const safeCatalog = Array.isArray(catalog) ? catalog : [];

    if (error && !safeCatalog.length) {
        return (
            <NativeCard style={styles.card}>
                <Text style={styles.title}>🔥 Black Friday collectif</Text>
                <Text style={styles.errorText}>{error}</Text>
                <NativeButton title="Réessayer" onPress={refresh} variant="secondary" />
            </NativeCard>
        );
    }

    if (!safeCatalog.length && !isLoading) {
        return null;
    }

    return (
        <NativeCard style={styles.card}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.kicker}>Nouveauté plateforme</Text>
                    <Text style={styles.title}>🔥 Black Friday collectif</Text>
                    <Text style={styles.subtitle}>Intégrez les promos officielles Yukpo et boostez vos ventes</Text>
                </View>
                <View style={{ gap: 8 }}>
                    <NativeButton
                        title={isLoading ? 'Chargement...' : 'Actualiser'}
                        onPress={refresh}
                        variant="ghost"
                        disabled={isLoading}
                        size="sm"
                    />
                    <NativeButton
                        title="Voir tout"
                        onPress={() => navigation.navigate('GlobalPromoCatalog')}
                        size="sm"
                        variant="secondary"
                    />
                    <NativeButton
                        title="Ajouter mon service"
                        onPress={() => navigation.navigate('GlobalPromoSubmission')}
                        size="sm"
                    />
                </View>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.carousel}
            >
                {safeCatalog.map((item) => {
                    // ✅ SÉCURITÉ: Vérifier que item et ses propriétés existent
                    if (!item || !item.entry || !item.event) {
                        return null;
                    }

                    const snapshot = item.product?.snapshot ?? {};
                    const imageUri = getSnapshotImage(snapshot);

                    // ✅ CORRIGÉ: S'assurer que serviceId est une string valide
                    const serviceId = item.entry?.serviceId != null ? String(item.entry.serviceId) : '0';
                    const title =
                        snapshot.title ||
                        snapshot.nom_service ||
                        `Service #${serviceId}`;

                    // ✅ CORRIGÉ: S'assurer que badge est toujours une string
                    const badge =
                        snapshot.badge ||
                        item.event?.displayName ||
                        'Promo nationale';

                    // ✅ SÉCURITÉ: Vérifier que entry.id existe pour la key
                    const itemKey = item.entry?.id || item.entry?.serviceId || Math.random().toString();

                    return (
                        <TouchableOpacity
                            key={itemKey}
                            style={styles.promoCard}
                            activeOpacity={0.9}
                            onPress={() => {
                                // ✅ SÉCURITÉ: Vérifier que serviceId existe avant navigation
                                const navServiceId = item.entry?.serviceId;
                                const navEventId = item.event?.id;
                                if (navServiceId && navEventId) {
                                    navigation.navigate('ServiceDetail', {
                                        serviceId: String(navServiceId),
                                        promoCampaignId: String(navEventId),
                                    });
                                }
                            }}
                        >
                            {imageUri ? (
                                <Image source={{ uri: imageUri }} style={styles.image} />
                            ) : (
                                <View style={[styles.image, styles.imagePlaceholder]}>
                                    <SafeIcon name="sparkles" size={28} color="#fff" />
                                </View>
                            )}
                            <View style={styles.promoContent}>
                                <Text style={styles.badge}>{badge || 'Promo'}</Text>
                                <Text style={styles.promoTitle} numberOfLines={2}>
                                    {title || 'Service'}
                                </Text>
                                <View style={styles.priceRow}>
                                    <Text style={styles.priceText}>{formatPrice(item.entry?.promoPriceCfa)}</Text>
                                    {item.entry?.discountPercentage != null && item.entry.discountPercentage > 0 && (
                                        <Text style={styles.discount}>
                                            -{String(item.entry.discountPercentage)}%
                                        </Text>
                                    )}
                                </View>
                                <Text style={styles.promoFooter}>
                                    {item.event?.status === 'live'
                                        ? '⚡ Actif maintenant'
                                        : 'Programmation centralisée'}
                                </Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>
        </NativeCard>
    );
};

const GlobalPromoHighlights = React.memo(GlobalPromoHighlightsComponent);

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
        backgroundColor: '#0F172A',
        borderColor: '#1E293B',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        gap: 12,
    },
    kicker: {
        fontSize: 12,
        letterSpacing: 1,
        color: '#C7D2FE',
        textTransform: 'uppercase',
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
        marginTop: 4,
    },
    subtitle: {
        fontSize: 13,
        color: '#E2E8F0',
        marginTop: 4,
    },
    errorText: {
        color: modernColors.danger,
        marginBottom: 8,
    },
    carousel: {
        paddingVertical: 4,
        gap: 12,
    },
    promoCard: {
        width: 220,
        borderRadius: 16,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        overflow: 'hidden',
    },
    image: {
        height: 120,
        width: '100%',
    },
    imagePlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
    },
    promoContent: {
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 6,
    },
    badge: {
        alignSelf: 'flex-start',
        fontSize: 11,
        fontWeight: '600',
        color: '#0F172A',
        backgroundColor: '#E0F2FE',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 999,
    },
    promoTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#F8FAFC',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    priceText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FACC15',
    },
    discount: {
        fontSize: 13,
        fontWeight: '700',
        color: '#22D3EE',
    },
    promoFooter: {
        fontSize: 12,
        color: '#CBD5F5',
    },
});

GlobalPromoHighlights.displayName = 'GlobalPromoHighlights';

export default GlobalPromoHighlights;

