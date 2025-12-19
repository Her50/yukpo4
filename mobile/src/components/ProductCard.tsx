import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useRef, useState } from 'react';
import { Alert, Dimensions, FlatList, Image, Linking, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Video, ResizeMode } from 'expo-av';
import { getCategoryConfig, getCategoryStyle, getCategoryTerminology } from '../config/categoryConfig';
import { apiPost } from '../services/api';
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
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [videoStatus, setVideoStatus] = useState<any>({});
    const carouselRef = useRef<FlatList>(null);
    const videoRef = useRef<Video>(null);
    const autoScrollTimer = useRef<NodeJS.Timeout | null>(null);

    // Récupérer la configuration intelligente de la catégorie
    const categoryConfig = getCategoryConfig(product.type || 'default');
    const categoryStyle = getCategoryStyle(product.type || 'default');
    const terminology = getCategoryTerminology(product.type || 'default');

    // Extraire les images et vidéos - Vidéos en premier
    const images = product.images || product.imagesRealisations || [];
    const videos = product.videos || product.videosRealisations || [];
    const allMedia = [
        ...videos.map((v: string) => ({ type: 'video', uri: v })),
        ...images.map((i: string) => ({ type: 'image', uri: i }))
    ];
    const hasMedia = allMedia.length > 0;
    const mainImage = images[0] || null;
    const hasVideo = videos.length > 0;

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

    // Rendu du média (vidéo ou image)
    const renderMediaItem = ({ item, index }: { item: { type: string; uri: string }; index: number }) => {
        if (item.type === 'video') {
                return (
                <View style={styles.mediaItem}>
                    <Video
                        ref={index === currentMediaIndex ? videoRef : null}
                        source={{ uri: item.uri }}
                        style={styles.mediaVideo}
                        resizeMode={ResizeMode.COVER}
                        isLooping={false}
                        shouldPlay={index === currentMediaIndex}
                        onPlaybackStatusUpdate={(status) => {
                            if (index === currentMediaIndex) {
                                setVideoStatus(status);
                                if (status.didJustFinish) {
                                    // Passer à l'élément suivant après la fin de la vidéo
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
                return (
            <View style={styles.mediaItem}>
                <Image source={{ uri: item.uri }} style={styles.mediaImage} resizeMode="cover" />
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
                {/* Carousel automatique d'images et vidéos */}
                <View style={styles.imageContainer}>
                    {hasMedia ? (
                        <FlatList
                            ref={carouselRef}
                            data={allMedia}
                            renderItem={renderMediaItem}
                            keyExtractor={(item, index) => `${item.type}-${index}`}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            scrollEnabled={false}
                            onMomentumScrollEnd={(event) => {
                                const index = Math.round(event.nativeEvent.contentOffset.x / (width * 0.4));
                                setCurrentMediaIndex(index);
                            }}
                            getItemLayout={(data, index) => ({
                                length: width * 0.4,
                                offset: width * 0.4 * index,
                                index,
                            })}
                        />
                    ) : (
                        <View style={[styles.mainImage, styles.noImageContainer]}>
                            <SafeIcon name="package" size={24} color="#D1D5DB" />
                        </View>
                    )}

                    {/* Indicateurs de pagination */}
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
                            <SafeIcon name="image" size={8} color="#FFFFFF" />
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
                    {displayGPS && (
                        <View style={styles.locationContainer}>
                            <SafeIcon name="map-pin" size={14} color="#EF4444" />
                            <Text style={styles.locationText} numberOfLines={1}>
                                {product.quartier || product.ville || 'Localisation disponible'}
                            </Text>
                            {product.distance && (
                                <Text style={styles.distanceText}>• {product.distance.toFixed(1)} km</Text>
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
                            <SafeIcon name="share-2" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.shares || 0}</Text>
                        </View>
                        <TouchableOpacity
                            style={styles.statItem}
                            onPress={() => setShowRatingModal(true)}
                        >
                            <SafeIcon name="star" size={12} color="#F59E0B" />
                            <Text style={[styles.statText, styles.ratingText]}>
                                {product.rating || service.rating || '—'}
                            </Text>
                            {(product.reviews || product.reviews_count || 0) > 0 && (
                                <Text style={styles.reviewsCountText}>
                                    ({product.reviews || product.reviews_count || 0})
                                </Text>
                            )}
                        </TouchableOpacity>
                        <View style={styles.statItem}>
                            <SafeIcon name="message-square" size={12} color="#6B7280" />
                            <Text style={styles.statText}>{product.reviews || product.reviews_count || 0}</Text>
                        </View>
                    </View>

                    {/* Informations prestataire */}
                    {prestataire && (
                        <View style={styles.prestataireInfo}>
                            <View style={styles.prestataireAvatar}>
                                {prestataire.avatar ? (
                                    <Image source={{ uri: prestataire.avatar }} style={styles.avatarImage} />
                                ) : (
                                    <SafeIcon name="user" size={16} color="#6B7280" />
                                )}
                            </View>
                            <Text style={styles.prestataireName} numberOfLines={1}>
                                {prestataire.name || 'Prestataire'}
                            </Text>
                            {prestataire.isOnline && (
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

                        {/* Bouton Me livrer */}
                        <TouchableOpacity
                            style={[styles.deliveryButton, { backgroundColor: categoryStyle.secondaryColor || '#10B981' }]}
                            onPress={() => setShowFindCourierModal(true)}
                        >
                            <SafeIcon name="truck" size={18} color="#FFFFFF" />
                            <Text style={styles.deliveryButtonText}>Me livrer</Text>
                        </TouchableOpacity>

                        <View style={styles.secondaryActions}>
                            {/* Bouton Galerie */}
                            {(images.length > 0 || videos.length > 0) && (
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
                                onPress={() => {
                                    // TODO: Implémenter partage
                                }}
                            >
                                <SafeIcon name="share-2" size={16} color="#6B7280" />
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
                            Alert.alert('Chat', `Ouvrir une conversation avec ${userName} ?`);
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
    statText: {
        fontSize: 9,
        color: '#6B7280',
        fontWeight: '600',
    },
    ratingText: {
        color: '#F59E0B',
        fontWeight: '700',
    },
    reviewsCountText: {
        fontSize: 10,
        color: '#9CA3AF',
        marginLeft: 2,
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
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 4,
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
    },
    paginationDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.5)',
    },
    paginationDotActive: {
        backgroundColor: '#FFFFFF',
        width: 6,
        height: 6,
        borderRadius: 3,
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
});

export default ProductCard;

