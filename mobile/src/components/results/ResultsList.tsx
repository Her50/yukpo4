/**
 * ResultsList - Liste de résultats pour ResultatBesoinScreen
 * Extrait de ResultatBesoinScreen pour améliorer la maintenabilité
 * Utilise FlashList pour performance optimale
 */

import { FlashList } from '@shopify/flash-list';
import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useMemo } from 'react';
import {
    ActivityIndicator,
    Animated,
    Dimensions,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { trackNavigation } from '../../services/metricsTracking';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import useDeviceType from '../../hooks/useDeviceType';
import AgenceVoyageResultCard from '../specialized/AgenceVoyageResultCard';
import CovoiturageResultCard from '../specialized/CovoiturageResultCard';
import HopitalResultCard from '../specialized/HopitalResultCard';
import LaboratoireResultCard from '../specialized/LaboratoireResultCard';
import PharmacieResultCard from '../specialized/PharmacieResultCard';
import SafeIcon from '../SafeIcon';
import SwipeableProductCard from '../SwipeableProductCard';
import TaxiResultCard from '../specialized/TaxiResultCard';
import { useLanguageSafe } from '../../contexts/LanguageContext';

const { width } = Dimensions.get('window');

interface Product {
    service_id: number;
    nom: string;
    product_vector?: string[];
    product_labels?: string[];
    location_vector?: string[];
    full_vector?: string[];
    chosen_location?: string;
    usage_count?: number;
    distance_km?: number;
    prestataire: {
        nom: string;
        avatar_url?: string;
        user_id: number;
    };
    has_variant: boolean;
    variants?: Array<{
        dimension: string;
        value: string;
        prix: number;
        devise: string;
        stock: number;
    }>;
    prix?: number;
    devise?: string;
    image?: string;
    coordinates?: { lat: number; lng: number };
    id?: number;
    is_active?: boolean;
    created_at?: string;
    user_id?: number;
    [key: string]: any; // Pour les données supplémentaires
}

interface ResultsListProps {
    products: Product[];
    loading: boolean;
    loadingMore: boolean;
    refreshing: boolean;
    hasMoreResults: boolean;
    onRefresh: () => void;
    onLoadMore: () => void;
    onProductPress: (product: Product) => void;
    onProductLike?: (product: Product, liked: boolean) => Promise<void>;
    onProductFavorite?: (product: Product, favorited: boolean) => Promise<void>;
    onProductShare?: (product: Product) => Promise<void>;
    user?: any;
    itemAnimations?: Map<number, Animated.Value>;
    getItemAnimation?: (index: number) => Animated.Value;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
    onScroll?: (event: any) => void;
}

const ResultsList: React.FC<ResultsListProps> = ({
    products,
    loading,
    loadingMore,
    refreshing,
    hasMoreResults,
    onRefresh,
    onLoadMore,
    onProductPress,
    onProductLike,
    onProductFavorite,
    onProductShare,
    user,
    itemAnimations,
    getItemAnimation,
    ListHeaderComponent,
    onScroll,
}) => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const deviceType = useDeviceType();

    // Rendre un item spécialisé ou générique
    const renderItem = useCallback(({ item, index }: { item: Product; index: number }) => {
        const searchMethod = item.search_method || '';
        const data = item.data || {};
        const type = data.type || item.type || '';

        // Pharmacie
        if (searchMethod.includes('specialized_pharmacy') || type === 'pharmacie') {
            return (
                <PharmacieResultCard
                    pharmacy={{
                        id: item.service_id,
                        service_id: item.service_id,
                        nom: data.titre_service?.valeur || item.nom || '',
                        adresse: data.adresse,
                        quartier: data.quartier,
                        ville: data.ville,
                        telephone: data.telephone,
                        whatsapp: data.whatsapp,
                        is_on_duty_now: data.is_on_duty_now,
                        distance_km: item.distance_km,
                        services: data.services,
                    }}
                    onPress={() => {
                        trackNavigation('click', {
                            itemType: 'pharmacy' as any,
                            itemId: item.service_id?.toString(),
                        });
                        (navigation as any).navigate('ServiceDetail', {
                            serviceId: item.service_id,
                        });
                    }}
                />
            );
        }

        // Hôpital
        if (searchMethod.includes('specialized_hospital') || type === 'hopital_clinique') {
            return (
                <HopitalResultCard
                    hospital={{
                        id: item.service_id,
                        service_id: item.service_id,
                        nom: data.titre_service?.valeur || item.nom || '',
                        type_etablissement: data.type_etablissement,
                        adresse: data.adresse,
                        quartier: data.quartier,
                        ville: data.ville,
                        telephone: data.telephone,
                        whatsapp: data.whatsapp,
                        is_available_now: data.is_available_now,
                        distance_km: item.distance_km,
                        prestations_medicales: data.prestations_medicales,
                        urgences_disponible: data.urgences_disponible,
                    }}
                    onPress={() => {
                        trackNavigation('click', {
                            itemType: 'hospital' as any,
                            itemId: item.service_id?.toString(),
                        });
                        (navigation as any).navigate('ServiceDetail', {
                            serviceId: item.service_id,
                        });
                    }}
                />
            );
        }

        // Laboratoire
        if (searchMethod.includes('specialized_laboratory') || type === 'laboratoire_imagerie') {
            return (
                <LaboratoireResultCard
                    laboratory={{
                        id: item.service_id,
                        service_id: item.service_id,
                        nom: data.titre_service?.valeur || item.nom || '',
                        type_laboratoire: data.type_laboratoire,
                        quartier: data.quartier,
                        ville: data.ville,
                        telephone: data.telephone,
                        whatsapp: data.whatsapp,
                        is_available_now: data.is_available_now,
                        distance_km: item.distance_km,
                        analyses_disponibles: data.analyses_disponibles,
                        imagerie_disponible: data.imagerie_disponible,
                    }}
                    onPress={() => {
                        trackNavigation('click', {
                            itemType: 'laboratory' as any,
                            itemId: item.service_id?.toString(),
                        });
                        (navigation as any).navigate('ServiceDetail', {
                            serviceId: item.service_id,
                        });
                    }}
                />
            );
        }

        // Agence de voyage
        if (searchMethod.includes('specialized_travel_agency') || type === 'agence_voyage') {
            const busTickets = item.bus_tickets || item.tickets || null;
            return (
                <AgenceVoyageResultCard
                    agency={{
                        id: item.service_id,
                        service_id: item.service_id,
                        nom_agence: data.titre_service?.valeur || item.nom || '',
                        quartier: data.quartier,
                        ville: data.ville,
                        telephone: data.telephone,
                        whatsapp: data.whatsapp,
                        peut_emettre_tickets_bus: data.peut_emettre_tickets_bus,
                        distance_km: item.distance_km,
                        services_voyage: data.services_voyage,
                        compagnies_bus: data.compagnies_bus,
                    }}
                    busTickets={busTickets}
                    onPress={() => {
                        trackNavigation('click', {
                            itemType: 'travel_agency' as any,
                            itemId: item.service_id?.toString(),
                        });
                        (navigation as any).navigate('ServiceDetail', {
                            serviceId: item.service_id,
                        });
                    }}
                />
            );
        }

        // Covoiturage
        if (searchMethod.includes('specialized_covoiturage') || type === 'covoiturage') {
            return (
                <CovoiturageResultCard
                    covoiturage={{
                        id: item.service_id,
                        service_id: item.service_id,
                        depart: data.depart || '',
                        destination: data.destination || '',
                        date_depart: data.date_depart || '',
                        heure_depart: data.heure_depart || '',
                        nombre_places: data.nombre_places || 4,
                        places_disponibles: data.places_disponibles || 0,
                        prix_par_place: data.prix_par_place || 0,
                        devise: data.devise || 'XAF',
                        distance_km: item.distance_km,
                    }}
                    onPress={() => {
                        trackNavigation('click', {
                            itemType: 'covoiturage' as any,
                            itemId: item.service_id?.toString(),
                        });
                        (navigation as any).navigate('ServiceDetail', {
                            serviceId: item.service_id,
                        });
                    }}
                />
            );
        }

        // Taxi
        if (searchMethod.includes('specialized_taxi') || type === 'taxi_ville') {
            return (
                <TaxiResultCard
                    taxi={{
                        id: item.service_id,
                        service_id: item.service_id,
                        nom_chauffeur: data.titre_service?.valeur || data.nom_chauffeur,
                        telephone: data.telephone || '',
                        whatsapp: data.whatsapp,
                        zone_intervention: data.zone_intervention,
                        is_available_now: data.is_available_now,
                        is_on_duty: data.is_on_duty,
                        distance_km: item.distance_km,
                    }}
                    onPress={() => {
                        trackNavigation('click', {
                            itemType: 'taxi' as any,
                            itemId: item.service_id?.toString(),
                        });
                        (navigation as any).navigate('ServiceDetail', {
                            serviceId: item.service_id,
                        });
                    }}
                />
            );
        }

        // Produit générique avec SwipeableProductCard
        const itemIndex = products.findIndex((p) => p.service_id === item.service_id);
        const itemAnim = getItemAnimation ? getItemAnimation(itemIndex) : undefined;

        const animatedStyle = itemAnim
            ? {
                  opacity: itemAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, 1],
                  }),
                  transform: [
                      {
                          translateY: itemAnim.interpolate({
                              inputRange: [0, 1],
                              outputRange: [30, 0],
                          }),
                      },
                  ],
              }
            : undefined;

        const AnimatedWrapper = itemAnim ? Animated.View : View;

        return (
            <AnimatedWrapper style={animatedStyle}>
                <SwipeableProductCard
                    product={item}
                    service={{
                        ...item,
                        data: item.data || {},
                        user: item.user || null,
                        prestataire: item.prestataire || null,
                    } as any}
                    onPress={() => {
                        hapticPress();
                        trackNavigation('click', {
                            itemType: 'product',
                            itemId: item.service_id?.toString(),
                        });
                        onProductPress(item);
                    }}
                    onLike={async (liked) => {
                        if (onProductLike) {
                            await onProductLike(item, liked);
                        }
                    }}
                    onFavorite={async (favorited) => {
                        if (onProductFavorite) {
                            await onProductFavorite(item, favorited);
                        }
                    }}
                    onShare={async () => {
                        if (onProductShare) {
                            await onProductShare(item);
                        }
                    }}
                />
            </AnimatedWrapper>
        );
    }, [products, navigation, getItemAnimation, onProductPress, onProductLike, onProductFavorite, onProductShare]);

    // Footer avec loader pour "charger plus"
    const renderFooter = useCallback(() => {
        if (loadingMore) {
            return (
                <View style={styles.loadMoreContainer}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                    <Text style={styles.loadMoreText}>{t('resultsList.chargement')}</Text>
                </View>
            );
        }
        if (!hasMoreResults && products.length > 0) {
            return (
                <View style={styles.endOfResultsContainer}>
                    <Text style={styles.endOfResultsText}>
                        Tous les {products.length} résultats affichés
                    </Text>
                </View>
            );
        }
        return <View style={{ height: 16 }} />;
    }, [loadingMore, hasMoreResults, products.length]);

    // Empty state
    const renderEmpty = useCallback(() => {
        if (loading) {
            return (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>{t('resultsList.rechercheEnCours')}</Text>
                </View>
            );
        }

        return (
            <View style={styles.emptyState}>
                <SafeIcon name="package-x" size={64} color="#D1D5DB" />
                <Text style={styles.emptyTitle}>{t('resultsList.aucunResultat')}</Text>
                <Text style={styles.emptyText}>
                    Essayez avec d'autres mots-clés ou ajustez les filtres
                </Text>
            </View>
        );
    }, [loading]);

    return (
        <FlashList
            data={products}
            keyExtractor={(item) => `${item.service_id}`}
            estimatedItemSize={260}
            numColumns={deviceType.columns}
            ItemSeparatorComponent={() => (
                <View
                    style={{
                        height: deviceType.isTablet ? 16 : 12,
                        width: deviceType.isTablet && deviceType.columns > 1 ? 16 : 0,
                    }}
                />
            )}
            onEndReached={() => {
                if (!loadingMore && hasMoreResults && products.length > 0) {
                    onLoadMore();
                }
            }}
            onEndReachedThreshold={0.5}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor={modernColors.primary}
                />
            }
            renderItem={renderItem}
            ListHeaderComponent={ListHeaderComponent}
            ListFooterComponent={renderFooter}
            ListEmptyComponent={renderEmpty}
            contentContainerStyle={styles.listContent}
            keyboardShouldPersistTaps="handled"
            estimatedListSize={{ height: 800, width }}
            onScroll={onScroll}
            scrollEventThrottle={16}
        />
    );
};

const styles = StyleSheet.create({
    listContent: {
        paddingBottom: 80,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 60,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 40,
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#374151',
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    loadMoreContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
        gap: 12,
    },
    loadMoreText: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    endOfResultsContainer: {
        paddingVertical: 20,
        alignItems: 'center',
    },
    endOfResultsText: {
        fontSize: 12,
        color: modernColors.textTertiary,
        fontStyle: 'italic',
    },
});

export default ResultsList;

