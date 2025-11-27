// 🖼️ Modal pour sélectionner des images/vidéos de la galerie produit et les envoyer dans le chat
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

const { width } = Dimensions.get('window');

interface ProductGalleryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    onSelectMedia: (selectedUrls: string[]) => void;
}

const ProductGalleryPickerModal: React.FC<ProductGalleryPickerModalProps> = ({
    visible,
    onClose,
    service,
    onSelectMedia
}) => {
    const [media, setMedia] = useState<any[]>([]);
    const [selectedMedia, setSelectedMedia] = useState<Set<string>>(new Set());
    const [filter, setFilter] = useState<'all' | 'images' | 'videos' | 'products'>('all');

    useEffect(() => {
        if (visible && service) {
            loadMedia();
        } else {
            // Réinitialiser la sélection quand le modal se ferme
            setSelectedMedia(new Set());
        }
    }, [visible, service]);

    const loadMedia = async () => {
        const mediaList: any[] = [];

        // Logo
        if (service.data?.logo?.valeur) {
            mediaList.push({
                type: 'image',
                url: service.data.logo.valeur,
                category: 'branding',
                description: 'Logo'
            });
        }

        // Banner
        if (service.data?.banner?.valeur) {
            mediaList.push({
                type: 'image',
                url: service.data.banner.valeur,
                category: 'branding',
                description: 'Bannière'
            });
        }

        // ✅ NOUVEAU: Charger médias depuis API /api/media/product par produit
        const produits = service.data?.produits?.valeur || service.data?.produits || [];
        if (Array.isArray(produits) && service.id) {
            for (let idx = 0; idx < produits.length; idx++) {
                const product = produits[idx];
                const productName = product.nom || `Produit ${idx + 1}`;

                try {
                    // Charger images depuis API
                    const { apiGet } = await import('../services/api');
                    const imagesResp = await apiGet(`/api/media/product/${service.id}/${idx}/images`);

                    // ✅ CORRIGÉ: Vérifier que response.data existe et contient images
                    if (imagesResp.success && imagesResp.data) {
                        const images = imagesResp.data.images || imagesResp.data.Images || imagesResp.images || [];
                        if (Array.isArray(images) && images.length > 0) {
                            images.forEach((img: string, imgIdx: number) => {
                                if (img && typeof img === 'string') {
                                    mediaList.push({
                                        type: 'image',
                                        url: img,
                                        category: 'products',
                                        description: `${productName} - Image ${imgIdx + 1}`,
                                        productName: productName,
                                        productIndex: idx
                                    });
                                }
                            });
                        }
                    }

                    // Charger vidéos depuis API
                    const videosResp = await apiGet(`/api/media/product/${service.id}/${idx}/videos`);
                    // ✅ CORRIGÉ: Vérifier que response.data existe et contient videos
                    if (videosResp.success && videosResp.data) {
                        const videos = videosResp.data.videos || videosResp.data.Videos || videosResp.videos || [];
                        if (Array.isArray(videos) && videos.length > 0) {
                            videos.forEach((vid: string, vidIdx: number) => {
                                if (vid && typeof vid === 'string') {
                                    mediaList.push({
                                        type: 'video',
                                        url: vid,
                                        category: 'products',
                                        description: `${productName} - Vidéo ${vidIdx + 1}`,
                                        productName: productName,
                                        productIndex: idx
                                    });
                                }
                            });
                        }
                    }
                } catch (error) {
                    console.log(`[ProductGalleryPickerModal] Fallback JSON pour produit ${idx}:`, error);
                    // ✅ Fallback: Utiliser images/videos depuis JSON si API échoue
                    if (product.images && Array.isArray(product.images)) {
                        product.images.forEach((img: string, imgIdx: number) => {
                            mediaList.push({
                                type: 'image',
                                url: img,
                                category: 'products',
                                description: `${productName} - Image ${imgIdx + 1}`,
                                productName: productName,
                                productIndex: idx
                            });
                        });
                    }
                    if (product.videos && Array.isArray(product.videos)) {
                        product.videos.forEach((vid: string, vidIdx: number) => {
                            mediaList.push({
                                type: 'video',
                                url: vid,
                                category: 'products',
                                description: `${productName} - Vidéo ${vidIdx + 1}`,
                                productName: productName,
                                productIndex: idx
                            });
                        });
                    }
                }

                // Images de réalisations (toujours depuis JSON)
                if (product.imagesRealisations && Array.isArray(product.imagesRealisations)) {
                    product.imagesRealisations.forEach((img: string, imgIdx: number) => {
                        mediaList.push({
                            type: 'image',
                            url: img,
                            category: 'realisations',
                            description: `${productName} - Réalisation ${imgIdx + 1}`,
                            productName: productName,
                            productIndex: idx
                        });
                    });
                }
            }
        }

        setMedia(mediaList);
    };

    const toggleMediaSelection = (url: string) => {
        const newSelection = new Set(selectedMedia);
        if (newSelection.has(url)) {
            newSelection.delete(url);
        } else {
            // Limiter à 5 sélections max
            if (newSelection.size >= 5) {
                Alert.alert('Limite atteinte', 'Vous ne pouvez sélectionner que 5 médias maximum');
                return;
            }
            newSelection.add(url);
        }
        setSelectedMedia(newSelection);
    };

    const handleConfirm = () => {
        const selectedUrls = Array.from(selectedMedia);
        onSelectMedia(selectedUrls);
        setSelectedMedia(new Set());
        onClose();
    };

    const filteredMedia = media.filter(item => {
        if (filter === 'all') return true;
        if (filter === 'images') return item.type === 'image';
        if (filter === 'videos') return item.type === 'video';
        if (filter === 'products') return item.category === 'products';
        return true;
    });

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
                        <SafeIcon name="x" size={24} color="#374151" />
                    </TouchableOpacity>

                    <View style={styles.headerTitle}>
                        <SafeIcon name="image" size={24} color={modernColors.primary} />
                        <Text style={styles.title}>Galerie du service</Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleConfirm}
                        disabled={selectedMedia.size === 0}
                        style={[styles.confirmButton, selectedMedia.size === 0 && styles.confirmButtonDisabled]}
                    >
                        <Text style={[styles.confirmText, selectedMedia.size === 0 && styles.confirmTextDisabled]}>
                            Envoyer ({selectedMedia.size})
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Filtres */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersContainer}>
                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'all' && styles.filterButtonActive]}
                        onPress={() => setFilter('all')}
                    >
                        <Text style={[styles.filterText, filter === 'all' && styles.filterTextActive]}>
                            Tout ({media.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'images' && styles.filterButtonActive]}
                        onPress={() => setFilter('images')}
                    >
                        <Text style={[styles.filterText, filter === 'images' && styles.filterTextActive]}>
                            Images ({media.filter(m => m.type === 'image').length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'videos' && styles.filterButtonActive]}
                        onPress={() => setFilter('videos')}
                    >
                        <Text style={[styles.filterText, filter === 'videos' && styles.filterTextActive]}>
                            Vidéos ({media.filter(m => m.type === 'video').length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.filterButton, filter === 'products' && styles.filterButtonActive]}
                        onPress={() => setFilter('products')}
                    >
                        <Text style={[styles.filterText, filter === 'products' && styles.filterTextActive]}>
                            Produits ({media.filter(m => m.category === 'products').length})
                        </Text>
                    </TouchableOpacity>
                </ScrollView>

                {/* Grille de médias */}
                <ScrollView style={styles.content} contentContainerStyle={styles.gridContainer}>
                    {filteredMedia.length === 0 ? (
                        <View style={styles.emptyState}>
                            <SafeIcon name="image" size={64} color="#D1D5DB" />
                            <Text style={styles.emptyText}>Aucun média disponible</Text>
                        </View>
                    ) : (
                        filteredMedia.map((item, index) => {
                            const isSelected = selectedMedia.has(item.url);
                            return (
                                <TouchableOpacity
                                    key={`${item.url}-${index}`}
                                    style={[
                                        styles.mediaItem,
                                        isSelected && styles.mediaItemSelected
                                    ]}
                                    onPress={() => toggleMediaSelection(item.url)}
                                    activeOpacity={0.8}
                                >
                                    {item.type === 'image' ? (
                                        <Image
                                            source={{ uri: item.url }}
                                            style={styles.mediaImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.videoContainer}>
                                            <Image
                                                source={{ uri: item.url }}
                                                style={styles.mediaImage}
                                                resizeMode="cover"
                                            />
                                            <View style={styles.videoOverlay}>
                                                <SafeIcon name="play" size={24} color="#FFFFFF" />
                                            </View>
                                        </View>
                                    )}

                                    {/* ✅ CORRIGÉ : Indicateur de sélection avec meilleure visibilité */}
                                    <View style={[styles.selectionIndicator, isSelected && styles.selectionIndicatorActive]}>
                                        {isSelected ? (
                                            <SafeIcon name="check" size={16} color="#FFFFFF" />
                                        ) : (
                                            <View style={styles.selectionIndicatorInner} />
                                        )}
                                    </View>

                                    {/* ✅ CORRIGÉ : Description optimisée pour éviter l'allongement */}
                                    {item.description && (
                                        <View style={styles.mediaDescription}>
                                            <Text style={styles.mediaDescriptionText} numberOfLines={2} ellipsizeMode="tail">
                                                {item.description}
                                            </Text>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })
                    )}
                </ScrollView>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginLeft: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    confirmButton: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 8,
    },
    confirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    confirmTextDisabled: {
        color: '#9CA3AF',
    },
    filtersContainer: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        marginRight: 8,
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
    },
    filterText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
    },
    gridContainer: {
        padding: 12,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8, // ✅ CORRIGÉ : Espacement réduit pour un affichage plus compact
        justifyContent: 'flex-start',
        alignItems: 'flex-start', // ✅ CORRIGÉ : Alignement en haut pour éviter les barres verticales
    },
    mediaItem: {
        width: (width - 44) / 3, // ✅ CORRIGÉ : 3 colonnes avec gaps ajustés (44 = 12*2 + 8*2 + 4)
        aspectRatio: 1, // ✅ CORRIGÉ : Ratio carré strict pour éviter les barres verticales
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#F3F4F6',
        borderWidth: 2,
        borderColor: 'transparent',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },
    mediaItemSelected: {
        borderColor: modernColors.primary,
        borderWidth: 3,
    },
    mediaImage: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover', // ✅ CORRIGÉ : Cover pour remplir l'espace sans déformation
    },
    videoContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
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
    selectionIndicator: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(0, 0, 0, 0.4)',
        borderWidth: 2.5,
        borderColor: '#FFFFFF',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    selectionIndicatorActive: {
        backgroundColor: modernColors.primary,
        borderColor: '#FFFFFF',
    },
    selectionIndicatorInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'transparent',
    },
    mediaDescription: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        paddingVertical: 6,
        paddingHorizontal: 8,
        maxHeight: 32, // ✅ CORRIGÉ : Hauteur maximale pour éviter l'allongement
        justifyContent: 'center',
    },
    mediaDescriptionText: {
        fontSize: 10,
        color: '#FFFFFF',
        fontWeight: '500',
        lineHeight: 12, // ✅ CORRIGÉ : Hauteur de ligne fixe pour éviter l'allongement
        includeFontPadding: false, // ✅ CORRIGÉ : Éviter le padding supplémentaire du texte
    },
    emptyState: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: '#9CA3AF',
        marginTop: 12,
    },
});

export default ProductGalleryPickerModal;

