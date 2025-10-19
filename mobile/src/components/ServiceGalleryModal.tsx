// Migration vers Lucide React Native pour un design moderne
import { Download, Image, Images, Play, Share, Video, X } from 'phosphor-react-native';
import * as React from 'react';
import { useState } from 'react';
import { Alert, Dimensions, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Badge, Card, Paragraph, Title } from 'react-native-paper';
import { theme } from '../theme/theme';

const { width, height } = Dimensions.get('window');

interface Service {
    id: string;
    titre: string;
    description: string;
    user_id: string;
    data?: any;
    [key: string]: any;
}

interface ServiceGalleryModalProps {
    visible: boolean;
    service: Service | null;
    onClose: () => void;
}

const ServiceGalleryModal: React.FC<ServiceGalleryModalProps> = ({
    visible,
    service,
    onClose
}) => {
    const [selectedImageIndex, setSelectedImageIndex] = useState(0);
    const [images, setImages] = useState<string[]>([]);
    const [videos, setVideos] = useState<string[]>([]);
    const [categorizedMedia, setCategorizedMedia] = useState<{
        branding: { images: string[], videos: string[] },
        products: { images: string[], videos: string[], byType: Record<string, { images: string[], videos: string[] }> },
        realisations: { images: string[], videos: string[] }
    }>({
        branding: { images: [], videos: [] },
        products: { images: [], videos: [], byType: {} },
        realisations: { images: [], videos: [] }
    });

    React.useEffect(() => {
        if (visible && service) {
            loadMedia();
        }
    }, [visible, service]);

    const loadMedia = () => {
        if (!service) return;

        // Catégories de médias
        const branding: { images: string[], videos: string[] } = { images: [], videos: [] };
        const products: { images: string[], videos: string[], byType: Record<string, { images: string[], videos: string[] }> } = {
            images: [],
            videos: [],
            byType: {}
        };
        const realisations: { images: string[], videos: string[] } = { images: [], videos: [] };

        // 1. Logo et bannière (Branding/Identité visuelle)
        const logo = extractMediaFromField(service.data?.logo);
        const banner = extractMediaFromField(service.data?.banner) || extractMediaFromField(service.data?.banniere);
        if (logo.length > 0) branding.images.push(...logo);
        if (banner.length > 0) branding.images.push(...banner);

        // 2. Réalisations générales du service
        const serviceImages = extractMediaFromField(service.data?.images_realisations) || [];
        const serviceVideos = extractMediaFromField(service.data?.videos) || [];
        realisations.images.push(...serviceImages);
        realisations.videos.push(...serviceVideos);

        // 3. Médias des produits (organisés par type de produit)
        const productsList = service.data?.produits || [];
        if (Array.isArray(productsList)) {
            productsList.forEach((product: any) => {
                const productType = product.type || 'autre';
                const productTypeLabel = getProductTypeLabel(productType);

                // Initialiser la catégorie si elle n'existe pas
                if (!products.byType[productTypeLabel]) {
                    products.byType[productTypeLabel] = { images: [], videos: [] };
                }

                // Images du produit
                if (product.images && Array.isArray(product.images)) {
                    products.images.push(...product.images);
                    products.byType[productTypeLabel].images.push(...product.images);
                }

                // Vidéos du produit
                if (product.videos && Array.isArray(product.videos)) {
                    products.videos.push(...product.videos);
                    products.byType[productTypeLabel].videos.push(...product.videos);
                }

                // Images de réalisations (pour prestations de service)
                if (product.imagesRealisations && Array.isArray(product.imagesRealisations)) {
                    products.images.push(...product.imagesRealisations);
                    products.byType[productTypeLabel].images.push(...product.imagesRealisations);
                }

                // Vidéos de réalisations (pour prestations de service)
                if (product.videosRealisations && Array.isArray(product.videosRealisations)) {
                    products.videos.push(...product.videosRealisations);
                    products.byType[productTypeLabel].videos.push(...product.videosRealisations);
                }
            });
        }

        // Combiner toutes les images et vidéos pour l'affichage global
        const allImages = [...branding.images, ...products.images, ...realisations.images];
        const allVideos = [...branding.videos, ...products.videos, ...realisations.videos];

        setImages(allImages);
        setVideos(allVideos);
        setCategorizedMedia({ branding, products, realisations });
    };

    const getProductTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            'immobilier_batiment': '🏢 Immobilier Bâtiment',
            'immobilier_terrain': '🏞️ Immobilier Terrain',
            'automobile': '🚗 Automobile',
            'ticket_voyage': '🚌 Tickets de Voyage',
            'covoiturage': '🚕 Covoiturage',
            'vetement': '👔 Vêtements',
            'chaussure': '👟 Chaussures',
            'electromenager': '📱 Électroménager',
            'mobilier': '🪑 Mobilier',
            'aliments': '🍕 Alimentation',
            'livres_fournitures': '📚 Livres & Fournitures',
            'quincaillerie': '🔧 Quincaillerie',
            'prestation_service': '💼 Prestations de Service',
            'autre': '📦 Autres Produits'
        };
        return labels[type] || '📦 Autres Produits';
    };

    const extractMediaFromField = (field: any): string[] => {
        if (!field) return [];

        if (typeof field === 'string') {
            try {
                const parsed = JSON.parse(field);
                return Array.isArray(parsed) ? parsed : [field];
            } catch {
                return [field];
            }
        }

        if (Array.isArray(field)) {
            return field;
        }

        if (field && typeof field === 'object' && field.valeur) {
            if (Array.isArray(field.valeur)) {
                return field.valeur;
            }
            return [field.valeur];
        }

        return [];
    };

    const handleImagePress = (index: number) => {
        setSelectedImageIndex(index);
    };

    const handleVideoPress = (videoUrl: string) => {
        Alert.alert(
            "Vidéo",
            "Fonctionnalité de lecture vidéo à implémenter",
            [
                { text: "Annuler", style: "cancel" },
                { text: "Ouvrir", onPress: () => console.log("Ouvrir vidéo:", videoUrl) }
            ]
        );
    };

    const handleShare = () => {
        Alert.alert("Partage", "Fonctionnalité de partage à implémenter");
    };

    const handleDownload = () => {
        Alert.alert("Téléchargement", "Fonctionnalité de téléchargement à implémenter");
    };

    if (!visible || !service) return null;

    const allMedia = [...images, ...videos];
    const hasMedia = allMedia.length > 0;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <X size={24} color={theme.colors.text} />
                    </TouchableOpacity>

                    <View style={styles.headerInfo}>
                        <Title style={styles.headerTitle}>Galerie du service</Title>
                        <Text style={styles.headerSubtitle}>{service.titre}</Text>
                    </View>

                    <View style={styles.headerActions}>
                        <TouchableOpacity onPress={handleShare} style={styles.actionButton}>
                            <Share size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleDownload} style={styles.actionButton}>
                            <Download size={20} color={theme.colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Media counter */}
                {hasMedia && (
                    <View style={styles.counterContainer}>
                        <Text style={styles.counterText}>
                            {selectedImageIndex + 1} / {allMedia.length}
                        </Text>
                        <View style={styles.mediaTypeContainer}>
                            {images.length > 0 && (
                                <Badge style={styles.mediaTypeBadge}>
                                    <Image size={12} color="white" />
                                    <Text style={styles.mediaTypeText}> {images.length}</Text>
                                </Badge>
                            )}
                            {videos.length > 0 && (
                                <Badge style={styles.mediaTypeBadge}>
                                    <Video size={12} color="white" />
                                    <Text style={styles.mediaTypeText}> {videos.length}</Text>
                                </Badge>
                            )}
                        </View>
                    </View>
                )}

                {/* Main content */}
                {!hasMedia ? (
                    <View style={styles.emptyContainer}>
                        <Images size={64} color="#9E9E9E" />
                        <Title style={styles.emptyTitle}>Aucun média disponible</Title>
                        <Paragraph style={styles.emptyText}>
                            Ce service ne contient pas d'images ou de vidéos pour le moment.
                        </Paragraph>
                    </View>
                ) : (
                    <ScrollView style={styles.content}>
                        {/* Main image/video display */}
                        <View style={styles.mainMediaContainer}>
                            {allMedia[selectedImageIndex] && (
                                <TouchableOpacity
                                    style={styles.mainMedia}
                                    onPress={() => {
                                        const isVideo = selectedImageIndex >= images.length;
                                        if (isVideo) {
                                            handleVideoPress(allMedia[selectedImageIndex]);
                                        }
                                    }}
                                >
                                    <Image
                                        source={{ uri: allMedia[selectedImageIndex] }}
                                        style={styles.mainImage}
                                        resizeMode="cover"
                                    />
                                    {selectedImageIndex >= images.length && (
                                        <View style={styles.videoOverlay}>
                                            <Play size={48} color="rgba(255, 255, 255, 0.8)" />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Organized sections */}
                        <View style={styles.sectionsContainer}>
                            {/* Section: Identité Visuelle */}
                            {(categorizedMedia.branding.images.length > 0 || categorizedMedia.branding.videos.length > 0) && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionIcon}>🎨</Text>
                                        <Text style={styles.sectionTitle}>Identité Visuelle</Text>
                                        <Text style={styles.sectionCount}>
                                            {categorizedMedia.branding.images.length + categorizedMedia.branding.videos.length}
                                        </Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaThumbnails}>
                                        {categorizedMedia.branding.images.map((uri, idx) => (
                                            <TouchableOpacity
                                                key={`branding-img-${idx}`}
                                                style={styles.thumbnail}
                                                onPress={() => handleImagePress(allMedia.indexOf(uri))}
                                            >
                                                <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                            </TouchableOpacity>
                                        ))}
                                        {categorizedMedia.branding.videos.map((uri, idx) => (
                                            <TouchableOpacity
                                                key={`branding-vid-${idx}`}
                                                style={styles.thumbnail}
                                                onPress={() => handleImagePress(allMedia.indexOf(uri))}
                                            >
                                                <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                                <View style={styles.thumbnailVideoIcon}>
                                                    <Video size={16} color="white" />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}

                            {/* Section: Produits (par type) */}
                            {Object.keys(categorizedMedia.products.byType).length > 0 && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionIcon}>📦</Text>
                                        <Text style={styles.sectionTitle}>Produits</Text>
                                        <Text style={styles.sectionCount}>
                                            {categorizedMedia.products.images.length + categorizedMedia.products.videos.length}
                                        </Text>
                                    </View>
                                    {Object.entries(categorizedMedia.products.byType).map(([typeLabel, media]) => {
                                        const totalMedia = media.images.length + media.videos.length;
                                        if (totalMedia === 0) return null;

                                        return (
                                            <View key={typeLabel} style={styles.subSection}>
                                                <Text style={styles.subSectionTitle}>{typeLabel}</Text>
                                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaThumbnails}>
                                                    {media.images.map((uri, idx) => (
                                                        <TouchableOpacity
                                                            key={`${typeLabel}-img-${idx}`}
                                                            style={styles.thumbnail}
                                                            onPress={() => handleImagePress(allMedia.indexOf(uri))}
                                                        >
                                                            <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                                        </TouchableOpacity>
                                                    ))}
                                                    {media.videos.map((uri, idx) => (
                                                        <TouchableOpacity
                                                            key={`${typeLabel}-vid-${idx}`}
                                                            style={styles.thumbnail}
                                                            onPress={() => handleImagePress(allMedia.indexOf(uri))}
                                                        >
                                                            <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                                            <View style={styles.thumbnailVideoIcon}>
                                                                <Video size={16} color="white" />
                                                            </View>
                                                        </TouchableOpacity>
                                                    ))}
                                                </ScrollView>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}

                            {/* Section: Réalisations */}
                            {(categorizedMedia.realisations.images.length > 0 || categorizedMedia.realisations.videos.length > 0) && (
                                <View style={styles.section}>
                                    <View style={styles.sectionHeader}>
                                        <Text style={styles.sectionIcon}>🖼️</Text>
                                        <Text style={styles.sectionTitle}>Réalisations</Text>
                                        <Text style={styles.sectionCount}>
                                            {categorizedMedia.realisations.images.length + categorizedMedia.realisations.videos.length}
                                        </Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaThumbnails}>
                                        {categorizedMedia.realisations.images.map((uri, idx) => (
                                            <TouchableOpacity
                                                key={`real-img-${idx}`}
                                                style={styles.thumbnail}
                                                onPress={() => handleImagePress(allMedia.indexOf(uri))}
                                            >
                                                <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                            </TouchableOpacity>
                                        ))}
                                        {categorizedMedia.realisations.videos.map((uri, idx) => (
                                            <TouchableOpacity
                                                key={`real-vid-${idx}`}
                                                style={styles.thumbnail}
                                                onPress={() => handleImagePress(allMedia.indexOf(uri))}
                                            >
                                                <Image source={{ uri }} style={styles.thumbnailImage} resizeMode="cover" />
                                                <View style={styles.thumbnailVideoIcon}>
                                                    <Video size={16} color="white" />
                                                </View>
                                            </TouchableOpacity>
                                        ))}
                                    </ScrollView>
                                </View>
                            )}
                        </View>

                        {/* Service info */}
                        <Card style={styles.serviceInfoCard}>
                            <Card.Content>
                                <Title style={styles.serviceTitle}>{service.titre}</Title>
                                <Paragraph style={styles.serviceDescription}>
                                    {service.description}
                                </Paragraph>

                                <View style={styles.mediaStats}>
                                    <View style={styles.statItem}>
                                        <Image size={16} color={theme.colors.primary} />
                                        <Text style={styles.statText}>{images.length} image{images.length > 1 ? 's' : ''}</Text>
                                    </View>
                                    <View style={styles.statItem}>
                                        <Video size={16} color={theme.colors.primary} />
                                        <Text style={styles.statText}>{videos.length} vidéo{videos.length > 1 ? 's' : ''}</Text>
                                    </View>
                                </View>
                            </Card.Content>
                        </Card>
                    </ScrollView>
                )}
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: theme.colors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    closeButton: {
        padding: 8,
    },
    headerInfo: {
        flex: 1,
        marginLeft: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
    },
    headerSubtitle: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginTop: 2,
    },
    headerActions: {
        flexDirection: 'row',
    },
    actionButton: {
        padding: 8,
        marginLeft: 4,
    },
    counterContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#f8f9fa',
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
    },
    counterText: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.text,
    },
    mediaTypeContainer: {
        flexDirection: 'row',
    },
    mediaTypeBadge: {
        backgroundColor: theme.colors.primary,
        marginLeft: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    mediaTypeText: {
        color: 'white',
        fontSize: 12,
        marginLeft: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: theme.colors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        lineHeight: 24,
    },
    content: {
        flex: 1,
    },
    mainMediaContainer: {
        flex: 1,
        backgroundColor: '#000',
    },
    mainMedia: {
        flex: 1,
        position: 'relative',
    },
    mainImage: {
        width: '100%',
        height: '100%',
    },
    videoOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
    },
    thumbnailContainer: {
        maxHeight: 80,
        backgroundColor: 'white',
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    thumbnailContent: {
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    thumbnail: {
        width: 60,
        height: 60,
        marginRight: 8,
        borderRadius: 8,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    selectedThumbnail: {
        borderColor: theme.colors.primary,
    },
    thumbnailImage: {
        width: '100%',
        height: '100%',
    },
    thumbnailVideoIcon: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 4,
        padding: 2,
    },
    serviceInfoCard: {
        margin: 16,
        elevation: 2,
    },
    serviceTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 8,
    },
    serviceDescription: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        lineHeight: 20,
        marginBottom: 12,
    },
    mediaStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    statText: {
        marginLeft: 4,
        fontSize: 12,
        color: theme.colors.textSecondary,
    },
    sectionsContainer: {
        padding: 16,
        gap: 20,
    },
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 2,
        borderBottomColor: theme.colors.primary,
    },
    sectionIcon: {
        fontSize: 20,
        marginRight: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        flex: 1,
    },
    sectionCount: {
        fontSize: 14,
        fontWeight: '600',
        color: theme.colors.primary,
        backgroundColor: theme.colors.surface,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
    },
    subSection: {
        marginBottom: 12,
        paddingLeft: 8,
    },
    subSectionTitle: {
        fontSize: 13,
        fontWeight: '500',
        color: theme.colors.textSecondary,
        marginBottom: 8,
    },
    mediaThumbnails: {
        maxHeight: 80,
    },
});

export default ServiceGalleryModal;












