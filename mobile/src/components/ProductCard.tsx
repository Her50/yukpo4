import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, FlatList, Image, Linking, Modal, ScrollView, Share, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { useServiceStats } from '../hooks/useServiceStats';
import { apiGet, apiPost } from '../services/api';
import { mediaService } from '../services/mediaService';
import FindCourierModal from './delivery/FindCourierModal';
import ProductCommentsSection from './ProductCommentsSection';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ProductCardProps {
    product: any;
    service: any;
    prestataire?: any;
    onPress?: () => void;
    onChatPress?: () => void;
    onGalleryPress?: () => void;
    onWhatsAppPress?: () => void;
    onDeliveryPress?: () => void;
}

const ProductCard: React.FC<ProductCardProps> = ({
    product,
    service,
    prestataire,
    onPress,
    onChatPress,
    onGalleryPress,
    onWhatsAppPress,
    onDeliveryPress,
}) => {
    const [showAllImages, setShowAllImages] = useState(false);
    const [showFindCourierModal, setShowFindCourierModal] = useState(false);
    const [showRatingModal, setShowRatingModal] = useState(false);
    const [checkingAvailability, setCheckingAvailability] = useState(false);
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [videoStatus, setVideoStatus] = useState<any>({});
    const [mediaErrors, setMediaErrors] = useState<Set<number>>(new Set());
    const carouselRef = useRef<FlatList>(null);
    const videoRef = useRef<Video>(null);
    const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

    // ✅ NOUVEAU: Récupérer les stats actualisées du service (inclut rating et totalRatings)
    const serviceIdForStats = service?.id || service?.service_id;
    const serviceCreatedAt = service?.date_creation || service?.created_at || new Date().toISOString();
    const numericServiceId = serviceIdForStats ? parseInt(serviceIdForStats.toString(), 10) : 0;
    const { stats: serviceStats } = useServiceStats(numericServiceId > 0 ? numericServiceId : 0, serviceCreatedAt);
    
    // ✅ NOUVEAU: État pour les statistiques des commentaires (mis à jour depuis ProductCommentsSection)
    const [commentStats, setCommentStats] = useState<{
        total_comments: number;
        rating_count: number;
        average_rating: number;
    } | null>(null);

    // Récupérer la configuration intelligente de la catégorie
    const categoryConfig = getCategoryConfig(product.type || 'default');
    const categoryStyle = getCategoryStyle(product.type || 'default');
    const terminology = getCategoryTerminology(product.type || 'default');

    // ✅ RÉÉCRIT COMPLÈTEMENT: États pour les médias chargés depuis l'API
    const [loadedImages, setLoadedImages] = useState<string[]>([]);
    const [loadedVideos, setLoadedVideos] = useState<string[]>([]);
    const [mediaLoading, setMediaLoading] = useState(true);

    // ✅ RÉÉCRIT: Fonction pour normaliser un champ média (gère tableaux, objets, strings)
    const normalizeMediaField = (field: any): string[] => {
        if (!field) return [];
        
        // Si c'est un tableau
        if (Array.isArray(field)) {
            return field
                .map((item: any) => {
                    // Si l'item est un objet avec valeur
                    if (item && typeof item === 'object' && item.valeur) {
                        return item.valeur;
                    }
                    // Si l'item est une string
                    if (typeof item === 'string' && item.trim().length > 0) {
                        return item.trim();
                    }
                    return null;
                })
                .filter((item: string | null): item is string => item !== null);
        }
        
        // Si c'est un objet avec valeur
        if (typeof field === 'object' && field.valeur) {
            return [field.valeur];
        }
        
        // Si c'est une string
        if (typeof field === 'string' && field.trim().length > 0) {
            return [field.trim()];
        }
        
        return [];
    };

    // ✅ RÉÉCRIT: Charger les médias depuis l'API si nécessaire
    useEffect(() => {
        const loadMedia = async () => {
            setMediaLoading(true);
            
            try {
                // 1. Essayer d'extraire depuis les champs directs du produit
                let images: string[] = [];
                let videos: string[] = [];
                
                // Extraire depuis product.images, product.imagesRealisations, etc.
                images = [
                    ...normalizeMediaField(product.images),
                    ...normalizeMediaField(product.imagesRealisations),
                    ...normalizeMediaField(product.images_realisations),
                ];
                
                videos = [
                    ...normalizeMediaField(product.videos),
                    ...normalizeMediaField(product.videosRealisations),
                    ...normalizeMediaField(product.videos_realisations),
                ];
                
                // 2. Si pas de médias dans le produit, charger depuis l'API
                const serviceId = service?.id || service?.service_id;
                const productIndex = typeof product.product_index === 'number' 
                    ? product.product_index 
                    : (typeof product.index === 'number' ? product.index : null);
                
                // Si on a un serviceId et un productIndex, charger depuis l'API
                if (serviceId && productIndex !== null && productIndex !== undefined && (images.length === 0 && videos.length === 0)) {
                    try {
                        // Charger images depuis API
                        const imagesResp = await apiGet(`/api/media/product/${serviceId}/${productIndex}/images`);
                        if (imagesResp?.success && imagesResp?.data) {
                            const apiImages = imagesResp.data.images || imagesResp.data.Images || imagesResp.images || [];
                            if (Array.isArray(apiImages) && apiImages.length > 0) {
                                images = apiImages.filter((img: any) => img && typeof img === 'string' && img.trim().length > 0);
                            }
                        }
                        
                        // Charger vidéos depuis API
                        const videosResp = await apiGet(`/api/media/product/${serviceId}/${productIndex}/videos`);
                        if (videosResp?.success && videosResp?.data) {
                            const apiVideos = videosResp.data.videos || videosResp.data.Videos || videosResp.videos || [];
                            if (Array.isArray(apiVideos) && apiVideos.length > 0) {
                                videos = apiVideos.filter((vid: any) => vid && typeof vid === 'string' && vid.trim().length > 0);
                            }
                        }
                    } catch (apiError) {
                        console.warn('[ProductCard] Erreur chargement médias API:', apiError);
                        // Continuer avec les médias extraits directement
                    }
                }
                
                // 3. Transformer les chemins en URLs valides via mediaService
                const processedImages = images
                    .map((img: string) => {
                        try {
                            const url = mediaService.getImageUrl(img);
                            return url && url.trim().length > 0 ? url : null;
                        } catch (e) {
                            console.warn('[ProductCard] Erreur conversion image URL:', img, e);
                            return null;
                        }
                    })
                    .filter((url: string | null): url is string => url !== null);
                
                const processedVideos = videos
                    .map((vid: string) => {
                        try {
                            const url = mediaService.getVideoUrl(vid);
                            return url && url.trim().length > 0 ? url : null;
                        } catch (e) {
                            console.warn('[ProductCard] Erreur conversion video URL:', vid, e);
                            return null;
                        }
                    })
                    .filter((url: string | null): url is string => url !== null);
                
                setLoadedImages(processedImages);
                setLoadedVideos(processedVideos);
                // Réinitialiser les erreurs quand les médias changent
                setMediaErrors(new Set());
                
                if (__DEV__) {
                    console.log('[ProductCard] Médias chargés:', {
                        serviceId,
                        productIndex,
                        imagesCount: processedImages.length,
                        videosCount: processedVideos.length,
                        images: processedImages.slice(0, 2),
                        videos: processedVideos.slice(0, 2),
                    });
                }
            } catch (error) {
                console.error('[ProductCard] Erreur chargement médias:', error);
                setLoadedImages([]);
                setLoadedVideos([]);
                setMediaErrors(new Set());
            } finally {
                setMediaLoading(false);
            }
        };
        
        loadMedia();
    }, [product, service?.id, service?.service_id, product.product_index, product.index]);
    
    // Construire la liste des médias avec validation
    const allMedia = [
        ...loadedVideos.map((v: string) => ({ type: 'video', uri: v })),
        ...loadedImages.map((i: string) => ({ type: 'image', uri: i }))
    ].filter((media) => media.uri && media.uri.trim().length > 0);
    
    const hasMedia = allMedia.length > 0;
    const mainImage = loadedImages[0] || null;
    const hasVideo = loadedVideos.length > 0;

    // GPS prioritaire : produit > service gps_fixe > service gps
    const productGPS = product.gps || product.gpsFixe;
    const serviceGPS = service.data?.gps_fixe?.valeur || service.data?.gps_fixe || service.gps;
    const displayGPS = productGPS || serviceGPS;

    // Formater le prix
    const formatPrice = () => {
        if (!product.prix) return null;
        const devise = product.devise || 'FCFA';
        return `${parseFloat(product.prix).toLocaleString()} ${devise}`;
    };

    // Obtenir l'icône et la couleur par type
    const getTypeStyle = () => {
        const styles = {
            immobilier_batiment: { icon: 'home', color: '#3B82F6', bg: '#EFF6FF', label: 'Immobilier' },
            immobilier_terrain: { icon: 'map', color: '#10B981', bg: '#D1FAE5', label: 'Terrain' },
            hotellerie: { icon: 'building', color: '#EC4899', bg: '#FCE7F3', label: 'Hôtel' },
            automobile: { icon: 'car', color: '#F59E0B', bg: '#FEF3C7', label: 'Auto' },
            ticket_voyage: { icon: 'bus', color: '#8B5CF6', bg: '#F3E8FF', label: 'Voyage' },
            covoiturage: { icon: 'users', color: '#EC4899', bg: '#FCE7F3', label: 'Covoiturage' },
            vetement: { icon: 'shopping-bag', color: '#EF4444', bg: '#FEE2E2', label: 'Vêtement' },
            chaussure: { icon: 'shoe-prints', color: '#F97316', bg: '#FFEDD5', label: 'Chaussure' },
            electromenager: { icon: 'zap', color: '#14B8A6', bg: '#CCFBF1', label: 'Électro' },
            image_son: { icon: 'tv', color: '#9C27B0', bg: '#F3E5F5', label: 'Image/Son' },
            telephone: { icon: 'smartphone', color: '#FF9800', bg: '#FFF3E0', label: 'Téléphone' },
            ordinateur: { icon: 'monitor', color: '#00BCD4', bg: '#E0F7FA', label: 'Ordinateur' },
            mobilier: { icon: 'box', color: '#F97316', bg: '#FFEDD5', label: 'Mobilier' },
            decoration: { icon: 'image', color: '#E91E63', bg: '#FCE4EC', label: 'Déco' },
            ustensiles_cuisine: { icon: 'coffee', color: '#FF5722', bg: '#FFEBEE', label: 'Ustensiles' },
            aliments: { icon: 'pizza', color: '#84CC16', bg: '#ECFCCB', label: 'Aliment' },
            assurance: { icon: 'shield', color: '#14B8A6', bg: '#CCFBF1', label: 'Assurance' },
            livres_fournitures: { icon: 'book', color: '#6366F1', bg: '#E0E7FF', label: 'Livre' },
            quincaillerie: { icon: 'tool', color: '#64748B', bg: '#F1F5F9', label: 'Quincaillerie' },
            pharmacie: { icon: 'activity', color: '#059669', bg: '#D1FAE5', label: 'Pharmacie' },
            hopital_clinique: { icon: 'heart', color: '#DC2626', bg: '#FEE2E2', label: 'Hôpital' },
            prestation_service: { icon: 'briefcase', color: '#8B5CF6', bg: '#F3E8FF', label: 'Service' },
            cosmetique_parfum: { icon: 'sparkle', color: '#EC4899', bg: '#FCE7F3', label: 'Cosmétique' },
            bijoux: { icon: 'gem', color: '#F59E0B', bg: '#FEF3C7', label: 'Bijoux' },
            coiffure_beaute: { icon: 'scissors', color: '#E91E63', bg: '#FCE4EC', label: 'Coiffure' },
            autre: { icon: 'package', color: '#6B7280', bg: '#F3F4F6', label: 'Produit' }
        };
        return styles[product.type] || styles.autre;
    };

    const typeStyle = getTypeStyle();

    // Auto-scroll du carousel
    useEffect(() => {
        if (allMedia.length <= 1) return;

        const startAutoScroll = () => {
            if (autoScrollTimer.current) {
                clearInterval(autoScrollTimer.current);
            }

            autoScrollTimer.current = setInterval(() => {
                setCurrentMediaIndex((prev) => {
                    const next = (prev + 1) % allMedia.length;
                    carouselRef.current?.scrollToIndex({ index: next, animated: true });
                    return next;
                });
            }, allMedia[currentMediaIndex]?.type === 'video' ? 8000 : 4000); // 8s pour vidéo, 4s pour image
        };

        startAutoScroll();
        return () => {
            if (autoScrollTimer.current) {
                clearInterval(autoScrollTimer.current);
            }
        };
    }, [allMedia.length, currentMediaIndex]);

    // Gérer la lecture vidéo
    useEffect(() => {
        if (allMedia[currentMediaIndex]?.type === 'video' && videoRef.current) {
            videoRef.current.playAsync();
        } else if (videoRef.current) {
            videoRef.current.pauseAsync();
        }
    }, [currentMediaIndex]);

    // ✅ RÉÉCRIT: Rendu du média avec gestion d'erreur améliorée
    const renderMediaItem = ({ item, index }: { item: { type: string; uri: string }; index: number }) => {
        const hasError = mediaErrors.has(index);
        const itemWidth = width * 0.4;
        
        if (!item.uri || item.uri.trim().length === 0) {
            return (
                <View style={[styles.mediaItem, { width: itemWidth, height: 90 }]}>
                    <View style={[styles.mediaImage, styles.noImageContainer]}>
                        <SafeIcon name="image" size={20} color="#D1D5DB" />
                    </View>
                </View>
            );
        }

        if (item.type === 'video') {
            if (hasError) {
                return (
                    <View style={[styles.mediaItem, { width: itemWidth, height: 90 }]}>
                        <View style={[styles.mediaVideo, styles.noImageContainer]}>
                            <SafeIcon name="video" size={20} color="#D1D5DB" />
                            <Text style={styles.errorText}>Erreur vidéo</Text>
                        </View>
                    </View>
                );
            }
            
            return (
                <View style={[styles.mediaItem, { width: itemWidth, height: 90 }]}>
                    <Video
                        ref={index === currentMediaIndex ? videoRef : null}
                        source={{ uri: item.uri }}
                        style={styles.mediaVideo}
                        resizeMode={ResizeMode.COVER}
                        isLooping={false}
                        shouldPlay={index === currentMediaIndex}
                        useNativeControls={false}
                        onError={(error) => {
                            console.error('[ProductCard] Erreur lecture vidéo:', item.uri, error);
                            setMediaErrors(prev => new Set(prev).add(index));
                        }}
                        onLoadStart={() => {
                            setMediaErrors(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(index);
                                return newSet;
                            });
                        }}
                        onPlaybackStatusUpdate={(status) => {
                            if (index === currentMediaIndex) {
                                setVideoStatus(status);
                                if (status.didJustFinish) {
                                    setTimeout(() => {
                                        const next = (currentMediaIndex + 1) % allMedia.length;
                                        setCurrentMediaIndex(next);
                                        carouselRef.current?.scrollToIndex({ index: next, animated: true });
                                    }, 500);
                                }
                            }
                        }}
                    />
                </View>
            );
        }
        
        if (hasError) {
            return (
                <View style={[styles.mediaItem, { width: itemWidth, height: 90 }]}>
                    <View style={[styles.mediaImage, styles.noImageContainer]}>
                        <SafeIcon name="image" size={20} color="#D1D5DB" />
                        <Text style={styles.errorText}>Erreur image</Text>
                    </View>
                </View>
            );
        }
        
        return (
            <View style={[styles.mediaItem, { width: itemWidth, height: 90 }]}>
                <Image 
                    source={{ uri: item.uri }} 
                    style={styles.mediaImage} 
                    resizeMode="cover"
                    onError={(error) => {
                        console.error('[ProductCard] Erreur chargement image:', item.uri, error);
                        setMediaErrors(prev => new Set(prev).add(index));
                    }}
                    onLoadStart={() => {
                        setMediaErrors(prev => {
                            const newSet = new Set(prev);
                            newSet.delete(index);
                            return newSet;
                        });
                    }}
                />
            </View>
        );
    };

    // Rendu générique des détails du produit (sans catégorie spécifique)
    const renderProductDetails = () => {
        // Liste des champs génériques à afficher (sans dépendre de product.type)
        const genericFields = [
            { key: 'marque', icon: 'tag', label: null },
            { key: 'modele', icon: 'package', label: null },
            { key: 'couleur', icon: 'droplet', label: null },
            { key: 'taille', icon: 'maximize', label: 'Taille' },
            { key: 'etat', icon: 'check-circle', label: null },
            { key: 'etatProduit', icon: 'check-circle', label: null },
            { key: 'quartier', icon: 'map-pin', label: null },
            { key: 'ville', icon: 'map-pin', label: null },
            { key: 'origine', icon: 'globe', label: null },
            { key: 'certification', icon: 'award', label: null },
            { key: 'unite', icon: 'package', label: 'Unité' },
        ];

        const availableFields = genericFields.filter(field => product[field.key]);

        if (availableFields.length === 0) {
            return null;
        }

        return (
            <View style={styles.detailsGrid}>
                {availableFields.slice(0, 6).map((field) => (
                    <View key={field.key} style={styles.detailChip}>
                        <SafeIcon name={field.icon as any} size={10} color="#6B7280" />
                                <Text style={styles.detailText}>
                            {field.label ? `${field.label} ` : ''}{product[field.key]}
                                </Text>
                            </View>
                ))}
                    </View>
                );
    };

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.95}
        >
            <View style={styles.cardContent}>
                {/* ✅ RÉÉCRIT: Carousel automatique d'images et vidéos avec chargement depuis API */}
                <View style={styles.imageContainer}>
                    {mediaLoading ? (
                        <View style={[styles.mainImage, styles.noImageContainer]}>
                            <ActivityIndicator size="small" color="#6366F1" />
                        </View>
                    ) : hasMedia ? (
                        <>
                            <FlatList
                                ref={carouselRef}
                                data={allMedia}
                                renderItem={renderMediaItem}
                                keyExtractor={(item, index) => `media-${item.type}-${index}-${item.uri?.substring(0, 20) || 'empty'}`}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                scrollEnabled={allMedia.length > 1}
                                snapToInterval={width * 0.4}
                                decelerationRate="fast"
                                bounces={false}
                                onMomentumScrollEnd={(event) => {
                                    const itemWidth = width * 0.4;
                                    const index = Math.round(event.nativeEvent.contentOffset.x / itemWidth);
                                    if (index >= 0 && index < allMedia.length) {
                                        setCurrentMediaIndex(index);
                                    }
                                }}
                                onScrollToIndexFailed={(info) => {
                                    const wait = new Promise(resolve => setTimeout(resolve, 500));
                                    wait.then(() => {
                                        if (carouselRef.current && info.index < allMedia.length) {
                                            carouselRef.current.scrollToIndex({ index: info.index, animated: true });
                                        }
                                    });
                                }}
                                getItemLayout={(data, index) => {
                                    const itemWidth = width * 0.4;
                                    return {
                                        length: itemWidth,
                                        offset: itemWidth * index,
                                        index,
                                    };
                                }}
                                style={styles.mediaList}
                                contentContainerStyle={styles.mediaListContainer}
                                nestedScrollEnabled={true}
                            />
                            {/* Indicateur de scroll visible */}
                            {allMedia.length > 1 && (
                                <View style={styles.scrollIndicator}>
                                    <SafeIcon name="chevron-left" size={12} color="#FFFFFF" />
                                    <Text style={styles.scrollIndicatorText}>Glisser</Text>
                                    <SafeIcon name="chevron-right" size={12} color="#FFFFFF" />
                                </View>
                            )}
                        </>
                    ) : (
                        <View style={[styles.mainImage, styles.noImageContainer]}>
                            <SafeIcon name="image" size={24} color="#D1D5DB" />
                        </View>
                    )}

                    {/* ✅ AMÉLIORÉ: Indicateurs de pagination plus visibles */}
                    {allMedia.length > 1 && (
                        <View style={styles.paginationDots}>
                            {allMedia.map((_, index) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.paginationDot,
                                        index === currentMediaIndex && styles.paginationDotActive,
                                    ]}
                                />
                            ))}
                            {/* ✅ NOUVEAU: Compteur visible */}
                            <View style={styles.paginationCounter}>
                                <Text style={styles.paginationCounterText}>
                                    {currentMediaIndex + 1}/{allMedia.length}
                                </Text>
                            </View>
                        </View>
                    )}

                    {/* Badge type de produit */}
                    <View style={[styles.typeBadge, { backgroundColor: typeStyle.bg }]}>
                        <SafeIcon name={typeStyle.icon} size={8} color={typeStyle.color} />
                        <Text style={[styles.typeText, { color: typeStyle.color }]}>{typeStyle.label}</Text>
                    </View>

                    {/* ✅ Badge PROMOTION si produit en promotion */}
                    {(product.en_promotion || product.promotion_active) && (
                        <View style={styles.promoBadge}>
                            <LinearGradient
                                colors={['#F59E0B', '#EF4444']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.promoBadgeGradient}
                            >
                                <SafeIcon name="zap" size={8} color="#FFFFFF" />
                                <Text style={styles.promoText}>PROMO</Text>
                            </LinearGradient>
                        </View>
                    )}

                    {/* Badge nombre de médias */}
                    {allMedia.length > 1 && (
                        <TouchableOpacity
                            style={styles.mediaCountBadge}
                            onPress={onGalleryPress}
                            activeOpacity={0.8}
                        >
                            <SafeIcon name="grid" size={8} color="#FFFFFF" />
                            <Text style={styles.mediaCountText}>{allMedia.length}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Informations du produit */}
                <View style={styles.infoContainer}>
                    {/* Nom du produit */}
                    <Text style={styles.productName} numberOfLines={2}>
                        {product.nom || product.name || product.titre || 'Produit'}
                    </Text>

                    {/* Description courte */}
                    {product.description && (
                        <Text style={styles.productDescription} numberOfLines={2}>
                            {product.description}
                        </Text>
                    )}

                    {/* Détails spécifiques par type */}
                    {renderProductDetails()}

                    {/* Prix */}
                    {formatPrice() && (
                        <View style={styles.priceContainer}>
                            <LinearGradient
                                colors={['#3B82F6', '#1D4ED8']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.priceGradient}
                            >
                                <SafeIcon name="tag" size={16} color="#FFFFFF" />
                                <Text style={styles.priceText}>{formatPrice()}</Text>
                            </LinearGradient>
                        </View>
                    )}

                    {/* GPS et distance */}
                    {(displayGPS || product.distance) && (
                        <View style={styles.locationContainer}>
                            <SafeIcon name="map-pin" size={14} color="#EF4444" />
                            <Text style={styles.locationText} numberOfLines={1}>
                                {product.quartier || product.ville || (displayGPS ? 'Localisation disponible' : '')}
                            </Text>
                            {product.distance !== undefined && product.distance !== null && (
                                <Text style={styles.distanceText}>• {typeof product.distance === 'number' ? product.distance.toFixed(1) : product.distance} km</Text>
                            )}
                        </View>
                    )}

                    {/* Statistiques */}
                    <View style={styles.statsContainer}>
                        <View style={styles.statItem}>
                            <SafeIcon name="eye" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.views || service.views || 0}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <SafeIcon name="share" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.shares || 0}</Text>
                        </View>
                        <TouchableOpacity
                            style={[styles.statItem, styles.ratingStatItem]}
                            onPress={() => setShowRatingModal(true)}
                        >
                            <SafeIcon name="star" size={12} color="#F59E0B" weight="fill" />
                            <View style={styles.ratingContainer}>
                                <Text style={[styles.statText, styles.ratingText]}>
                                    {(() => {
                                        // ✅ AMÉLIORÉ: Priorité aux stats des commentaires, puis serviceStats, puis fallback
                                        const rating = commentStats?.average_rating 
                                            || serviceStats?.rating 
                                            || product.rating 
                                            || service?.rating 
                                            || 0;
                                        
                                        // Formater le score avec 1 décimale si disponible
                                        if (rating && typeof rating === 'number' && rating > 0) {
                                            return rating.toFixed(1);
                                        }
                                        return '0.0';
                                    })()}
                                </Text>
                                {(() => {
                                    const reviewCount = commentStats?.rating_count 
                                        || commentStats?.total_comments 
                                        || serviceStats?.totalRatings 
                                        || product.reviews_count 
                                        || product.reviews 
                                        || service?.reviews_count 
                                        || 0;
                                    if (reviewCount > 0) {
                                        return (
                                            <Text style={styles.reviewsCountText}>
                                                ({reviewCount})
                                            </Text>
                                        );
                                    }
                                    return null;
                                })()}
                            </View>
                        </TouchableOpacity>
                        <View style={styles.statItem}>
                            <SafeIcon name="message-square" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.reviews || product.reviews_count || 0}</Text>
                        </View>
                    </View>

                    {/* Informations prestataire */}
                    {(prestataire || service?.user_id) && (
                        <View style={styles.prestataireInfo}>
                            <View style={styles.prestataireAvatar}>
                                {prestataire && (prestataire.avatar || (prestataire as any).avatar_url || (prestataire as any).photo_profil) ? (
                                    <Image 
                                        source={{ uri: prestataire.avatar || (prestataire as any).avatar_url || (prestataire as any).photo_profil }} 
                                        style={styles.avatarImage} 
                                    />
                                ) : (
                                    <SafeIcon name="user" size={16} color="#6B7280" />
                                )}
                            </View>
                            <Text style={styles.prestataireName} numberOfLines={1}>
                                {/* ✅ CORRIGÉ: Extraire le nom réel du prestataire (nom_complet en priorité) */}
                                {prestataire 
                                    ? ((prestataire as any).nom_complet || prestataire.name || (prestataire as any).nom || `Prestataire ${(prestataire as any).id || service?.user_id || ''}`)
                                    : (service?.user_id ? `Prestataire ${service.user_id}` : 'Prestataire')
                                }
                            </Text>
                            {prestataire?.isOnline && (
                                <View style={styles.onlineIndicator} />
                            )}
                        </View>
                    )}

                    {/* Actions */}
                    <View style={styles.actions}>
                        {/* Bouton Chat principal - TOUJOURS PRIORITAIRE */}
                        <TouchableOpacity
                            style={[styles.chatButton, { backgroundColor: categoryStyle.primaryColor }]}
                            onPress={onChatPress}
                        >
                            <SafeIcon name="message-square" size={18} color="#FFFFFF" />
                            <Text style={styles.chatButtonText}>Discuter</Text>
                        </TouchableOpacity>

                        {/* ✅ REFACTORISÉ: Bouton Me livrer - Même logique que ChatModalMobile */}
                        {(() => {
                            // ✅ SIMPLIFIÉ: Afficher le bouton si on a un service valide
                            // Vérifier plusieurs sources pour les produits
                            const hasProducts = !!(
                                service?.data?.produits ||
                                service?.produits ||
                                (service?.id || service?.service_id)
                            );
                            
                            // Exclure uniquement les services/prestations
                            const isServiceType = service?.data?.type === 'prestation_service' || 
                                                 service?.data?.type === 'service' ||
                                                 service?.type === 'prestation_service' ||
                                                 service?.type === 'service';
                            
                            const shouldShow = hasProducts && !isServiceType;
                            
                            if (__DEV__) {
                                console.log('[ProductCard] Bouton "Me livrer" - Évaluation:', {
                                    hasProducts,
                                    isServiceType,
                                    shouldShow,
                                    serviceId: service?.id || service?.service_id,
                                    serviceType: service?.data?.type || service?.type
                                });
                            }
                            
                            return shouldShow;
                        })() && (
                            <TouchableOpacity
                                style={[styles.deliveryButton, { backgroundColor: categoryStyle.secondaryColor || '#10B981' }]}
                                onPress={() => {
                                    // Vérifier qu'on a bien un produit avant d'ouvrir le modal
                                    const productForDelivery = service?.data?.produits?.[0] || service?.produits?.[0] || product;
                                    if (!productForDelivery && !service?.id && !service?.service_id) {
                                        Alert.alert('Erreur', 'Produit non disponible pour la livraison');
                                        return;
                                    }
                                    setShowFindCourierModal(true);
                                }}
                            >
                                <SafeIcon name="truck" size={18} color="#FFFFFF" />
                                <Text style={styles.deliveryButtonText}>Me livrer</Text>
                            </TouchableOpacity>
                        )}

                        <View style={styles.secondaryActions}>
                            {/* Bouton Galerie */}
                            {(loadedImages.length > 0 || loadedVideos.length > 0) && (
                                <TouchableOpacity
                                    style={styles.actionIconButton}
                                    onPress={onGalleryPress}
                                >
                                    <SafeIcon name="image" size={16} color="#8B5CF6" />
                                </TouchableOpacity>
                            )}

                            {/* Bouton Téléphone */}
                            {prestataire?.telephone && (
                                <TouchableOpacity
                                    style={styles.actionIconButton}
                                    onPress={async () => {
                                        const phoneNumber = prestataire?.telephone;
                                        if (phoneNumber) {
                                            try {
                                                const telUrl = `tel:${phoneNumber.replace(/\s+/g, '')}`;
                                                const canOpen = await Linking.canOpenURL(telUrl);
                                                if (canOpen) {
                                                    await Linking.openURL(telUrl);
                                                } else {
                                                    Alert.alert('Erreur', 'Impossible de passer l\'appel');
                                                }
                                            } catch (error) {
                                                Alert.alert('Erreur', 'Impossible d\'ouvrir l\'application téléphone');
                                            }
                                        }
                                    }}
                                >
                                    <SafeIcon name="phone" size={16} color="#10B981" />
                                </TouchableOpacity>
                            )}

                            <TouchableOpacity
                                style={styles.actionIconButton}
                                onPress={async () => {
                                    // ✅ NOUVEAU: Implémentation du partage
                                    try {
                                        const shareContent = {
                                            message: `${product.nom || product.name || 'Produit'}\n${product.description || ''}\n\nDécouvrez ce produit sur Yukpomnang`,
                                            title: product.nom || product.name || 'Produit',
                                        };
                                        await Share.share(shareContent);
                                    } catch (error: any) {
                                        console.error('[ProductCard] Erreur partage:', error);
                                        // Ne pas afficher d'alerte si l'utilisateur a annulé
                                        if (error?.message !== 'User did not share') {
                                            Alert.alert('Erreur', 'Impossible de partager ce produit');
                                        }
                                    }
                                }}
                            >
                                <SafeIcon name="share" size={16} color="#6366F1" />
                            </TouchableOpacity>

                            {/* ✅ NOUVEAU: Bouton Avis */}
                            <TouchableOpacity
                                style={styles.actionIconButton}
                                onPress={() => setShowRatingModal(true)}
                            >
                                <SafeIcon name="star" size={16} color="#F59E0B" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>

            {/* Modal de recherche de coursier */}
            <FindCourierModal
                visible={showFindCourierModal}
                onClose={() => setShowFindCourierModal(false)}
                product={product}
                service={service}
                onSuccess={(deliveryId) => {
                    Alert.alert('✅ Livraison créée', 'Votre demande de livraison a été créée avec succès');
                    setShowFindCourierModal(false);
                }}
            />

            {/* ✅ NOUVEAU: Modal d'avis et commentaires avec échanges modernes */}
            <Modal
                visible={showRatingModal}
                animationType="slide"
                presentationStyle="pageSheet"
                onRequestClose={() => setShowRatingModal(false)}
            >
                <View style={styles.ratingModalContainer}>
                    <View style={styles.ratingModalHeader}>
                        <Text style={styles.ratingModalTitle}>Avis et commentaires</Text>
                        <TouchableOpacity
                            style={styles.ratingModalCloseButton}
                            onPress={() => setShowRatingModal(false)}
                        >
                            <SafeIcon name="x" size={24} color="#1F2937" />
                        </TouchableOpacity>
                    </View>
                    <ProductCommentsSection
                        serviceId={service?.id || product?.service_id || 0}
                        serviceTitle={product?.nom || service?.titre || 'Produit'}
                        mode="full"
                        onOpenChat={(userId, userName, userAvatar) => {
                            // Optionnel: Ouvrir un chat privé avec l'utilisateur
                            if (onChatPress) {
                                onChatPress();
                            }
                        }}
                        onStatsUpdate={(stats) => {
                            // ✅ NOUVEAU: Mettre à jour les statistiques dans ProductCard
                            setCommentStats(stats);
                        }}
                    />
                </View>
            </Modal>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        marginHorizontal: 16,
        marginVertical: 8,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 12,
        elevation: 5,
        overflow: 'hidden',
    },
    cardContent: {
        flexDirection: 'row',
    },
    imageContainer: {
        width: width * 0.4,
        height: 90,
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 12,
    },
    mediaList: {
        width: width * 0.4,
        height: 90,
    },
    mediaListContainer: {
        alignItems: 'center',
        paddingHorizontal: 0,
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    noImageContainer: {
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    typeBadge: {
        position: 'absolute',
        top: 4,
        left: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    typeText: {
        fontSize: 8,
        fontWeight: '600',
    },
    promoBadge: {
        position: 'absolute',
        top: 24,
        left: 4,
        borderRadius: 6,
        overflow: 'hidden',
    },
    promoBadgeGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
    },
    promoText: {
        fontSize: 8,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    videoIndicator: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        borderRadius: 12,
        padding: 4,
    },
    imageCountBadge: {
        position: 'absolute',
        bottom: 4,
        left: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    imageCountText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600',
    },
    infoContainer: {
        flex: 1,
        padding: 8,
        justifyContent: 'space-between',
    },
    productName: {
        fontSize: 13,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 2,
    },
    productDescription: {
        fontSize: 10,
        color: '#6B7280',
        lineHeight: 14,
        marginBottom: 4,
    },
    detailsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginBottom: 4,
    },
    detailChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    detailText: {
        fontSize: 9,
        color: '#4B5563',
        fontWeight: '500',
    },
    priceContainer: {
        marginBottom: 4,
    },
    priceGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    priceText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    locationContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    locationText: {
        fontSize: 11,
        color: '#EF4444',
        fontWeight: '500',
        flex: 1,
    },
    distanceText: {
        fontSize: 11,
        color: '#6B7280',
        fontWeight: '600',
    },
    prestataireInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    prestataireAvatar: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    avatarImage: {
        width: '100%',
        height: '100%',
    },
    prestataireName: {
        fontSize: 11,
        color: '#4B5563',
        fontWeight: '500',
        flex: 1,
    },
    onlineIndicator: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        paddingVertical: 4,
        marginBottom: 4,
        backgroundColor: '#F9FAFB',
        borderRadius: 6,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    ratingStatItem: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    statText: {
        fontSize: 9,
        color: '#6B7280',
        fontWeight: '600',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    ratingText: {
        color: '#F59E0B',
        fontWeight: '700',
        fontSize: 11,
    },
    reviewsCountText: {
        fontSize: 9,
        color: '#9CA3AF',
        fontWeight: '500',
    },
    actions: {
        flexDirection: 'column',
        gap: 8,
    },
    chatButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#3B82F6',
        paddingVertical: 6,
        borderRadius: 8,
    },
    chatButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    deliveryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        backgroundColor: '#10B981',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        marginTop: 4,
        minHeight: 36,
        shadowColor: '#10B981',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
        borderWidth: 1,
        borderColor: '#059669',
    },
    deliveryButtonText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    secondaryActions: {
        flexDirection: 'row',
        gap: 8,
        justifyContent: 'space-between',
    },
    actionIconButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    // Styles pour les prestations de service
    prestationsContainer: {
        gap: 8,
    },
    prestationsSectionTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 4,
    },
    prestationItem: {
        backgroundColor: '#F9FAFB',
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: '#8B5CF6',
        marginBottom: 6,
    },
    prestationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    prestationName: {
        fontSize: 13,
        fontWeight: '600',
        color: '#1F2937',
        flex: 1,
    },
    prestationPrice: {
        fontSize: 12,
        fontWeight: '600',
        color: '#8B5CF6',
        marginBottom: 3,
    },
    prestationDescription: {
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 15,
    },
    // Styles pour logo et bannière
    bannerContainer: {
        width: '100%',
        height: 80,
        marginBottom: 8,
        borderRadius: 12,
        overflow: 'hidden',
    },
    bannerImage: {
        width: '100%',
        height: '100%',
    },
    logoOverlay: {
        position: 'absolute',
        bottom: 8,
        left: 8,
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFFFF',
        borderWidth: 2,
        borderColor: '#FFFFFF',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
        elevation: 5,
    },
    logoImage: {
        width: '100%',
        height: '100%',
    },
    // ✅ NOUVEAU: Styles pour prestations médicales et déménagement
    detailsSection: {
        marginTop: 12,
    },
    prestationLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 6,
    },
    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    tag: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    tagText: {
        fontSize: 11,
        color: '#3B82F6',
        fontWeight: '500',
    },
    // ✅ NOUVEAU: Styles pour le modal d'avis
    ratingModalContainer: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    ratingModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    ratingModalTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#1F2937',
    },
    ratingModalCloseButton: {
        padding: 8,
    },
    ratingModalContent: {
        flex: 1,
        padding: 16,
    },
    planningPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    highlightChip: {
        backgroundColor: '#FEF2F2',
        borderColor: '#FCA5A5',
    },
    successChip: {
        backgroundColor: '#F0FDF4',
        borderColor: '#86EFAC',
    },
    successText: {
        color: '#10B981',
    },
    // Styles pour déménagement
    servicesInclus: {
        marginTop: 8,
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    serviceTag: {
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    serviceTagText: {
        fontSize: 11,
        color: '#15803D',
        fontWeight: '500',
    },
    // Styles pour cosmétique & bijoux
    ingredientsContainer: {
        marginTop: 8,
    },
    ingredientsText: {
        fontSize: 11,
        color: '#6B7280',
        lineHeight: 15,
        fontStyle: 'italic',
    },
    certificateChip: {
        backgroundColor: '#F0FDF4',
        borderColor: '#BBF7D0',
    },
    certificateText: {
        color: '#15803D',
        fontWeight: '600',
    },
    // Styles pour le carousel
    mediaItem: {
        width: width * 0.4,
        height: 90,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaVideo: {
        width: '100%',
        height: '100%',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    paginationDots: {
        position: 'absolute',
        bottom: 4,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderRadius: 12,
        marginHorizontal: 4,
    },
    paginationDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.6)',
    },
    paginationDotActive: {
        backgroundColor: '#FFFFFF',
        width: 8,
        height: 8,
        borderRadius: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.3,
        shadowRadius: 2,
        elevation: 2,
    },
    paginationCounter: {
        marginLeft: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    paginationCounterText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#1F2937',
    },
    scrollIndicator: {
        position: 'absolute',
        top: 4,
        right: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    scrollIndicatorText: {
        fontSize: 9,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    mediaCountBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    mediaCountText: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '600',
    },
    errorText: {
        fontSize: 8,
        color: '#EF4444',
        marginTop: 4,
        textAlign: 'center',
    },
});

export default ProductCard;

