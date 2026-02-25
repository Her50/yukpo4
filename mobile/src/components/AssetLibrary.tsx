import * as ImagePicker from 'expo-image-picker';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Dimensions, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { NativeCard, NativeInput } from './SafeNativeDesign';

const { width } = Dimensions.get('window');
const ASSET_CARD_WIDTH = (width - 48) / 3;

interface Asset {
    id: string;
    type: 'image' | 'video';
    url: string;
    thumbnail?: string;
    name: string;
    size: number;
    created_at: string;
    tags?: string[];
}

interface AssetLibraryProps {
    type?: 'image' | 'video' | 'all';
    onSelectAsset?: (asset: Asset) => void;
    onUploadAsset?: (asset: Asset) => void;
    userId?: number;
    multiSelect?: boolean;
    selectedAssets?: string[];
}

export const AssetLibrary: React.FC<AssetLibraryProps> = ({
    type = 'all',
    onSelectAsset,
    onUploadAsset,
    userId,
    multiSelect = false,
    selectedAssets = [],
}) => {
    const [assets, setAssets] = useState<Asset[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [showUpload, setShowUpload] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'image' | 'video'>(type === 'all' ? 'all' : type);

    const loadAssets = useCallback(async () => {
        if (!userId) return;

        try {
            setLoading(true);
            const response = await apiGet(`/api/publicites/assets?user_id=${userId}&type=${filterType}`);

            if (response.success && response.data) {
                setAssets(response.data.assets || []);
            }
        } catch (error) {
            console.error('[AssetLibrary] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    }, [userId, filterType]);

    useEffect(() => {
        if (expanded && userId) {
            loadAssets();
        }
    }, [expanded, userId, loadAssets]);

    const handleUploadImage = useCallback(async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                // TODO: Upload vers le backend
                Alert.alert('Info', 'Upload d\'image à implémenter');
            }
        } catch (error) {
            console.error('[AssetLibrary] Erreur upload image:', error);
            Alert.alert('Erreur', 'Impossible d\'uploader l\'image');
        }
    }, []);

    const handleUploadVideo = useCallback(async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsEditing: false,
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const asset = result.assets[0];
                // TODO: Upload vers le backend
                Alert.alert('Info', 'Upload de vidéo à implémenter');
            }
        } catch (error) {
            console.error('[AssetLibrary] Erreur upload vidéo:', error);
            Alert.alert('Erreur', 'Impossible d\'uploader la vidéo');
        }
    }, []);

    const filteredAssets = assets.filter(asset => {
        if (filterType !== 'all' && asset.type !== filterType) return false;
        if (searchQuery.trim() && !asset.name.toLowerCase().includes(searchQuery.toLowerCase())) {
            return false;
        }
        return true;
    });

    if (!expanded) {
        return (
            <TouchableOpacity
                style={styles.expandButton}
                onPress={() => setExpanded(true)}
            >
                <SafeIcon name="image" size={20} color={modernColors.primary} />
                <Text style={styles.expandText}>
                    Bibliothèque de médias ({assets.length})
                </Text>
                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    }

    return (
        <NativeCard style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.title}>📚 Bibliothèque de Médias</Text>
                    <Text style={styles.subtitle}>
                        Réutilisez vos images et vidéos dans vos publicités
                    </Text>
                </View>
                <TouchableOpacity onPress={() => setExpanded(false)}>
                    <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Barre de recherche et filtres */}
            <View style={styles.controls}>
                <NativeInput
                    placeholder="Rechercher..."
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                    style={styles.searchInput}
                />
                <View style={styles.filterRow}>
                    {(['all', 'image', 'video'] as const).map((t) => (
                        <TouchableOpacity
                            key={t}
                            style={[
                                styles.filterButton,
                                filterType === t && styles.filterButtonActive,
                            ]}
                            onPress={() => setFilterType(t)}
                        >
                            <Text style={[
                                styles.filterText,
                                filterType === t && styles.filterTextActive,
                            ]}>
                                {t === 'all' ? 'Tous' : t === 'image' ? '📷 Images' : '🎬 Vidéos'}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Boutons upload */}
            <View style={styles.uploadRow}>
                <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handleUploadImage}
                >
                    <SafeIcon name="image" size={18} color="#fff" />
                    <Text style={styles.uploadButtonText}>Ajouter image</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.uploadButton}
                    onPress={handleUploadVideo}
                >
                    <SafeIcon name="video" size={18} color="#fff" />
                    <Text style={styles.uploadButtonText}>Ajouter vidéo</Text>
                </TouchableOpacity>
            </View>

            {/* Grille d'assets */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                </View>
            ) : filteredAssets.length === 0 ? (
                <View style={styles.emptyState}>
                    <SafeIcon name="image" size={48} color={modernColors.border} />
                    <Text style={styles.emptyText}>Aucun média</Text>
                    <Text style={styles.emptySubtext}>
                        Ajoutez vos premières images ou vidéos pour les réutiliser
                    </Text>
                </View>
            ) : (
                <View style={styles.assetsGrid}>
                    <View style={styles.gridContainer}>
                        {filteredAssets.map((asset) => {
                            const isSelected = selectedAssets.includes(asset.id);
                            return (
                                <TouchableOpacity
                                    key={asset.id}
                                    style={[
                                        styles.assetCard,
                                        isSelected && styles.assetCardSelected,
                                    ]}
                                    onPress={() => onSelectAsset?.(asset)}
                                >
                                    {asset.type === 'image' ? (
                                        <Image
                                            source={{ uri: asset.thumbnail || asset.url }}
                                            style={styles.assetImage}
                                            resizeMode="cover"
                                        />
                                    ) : (
                                        <View style={styles.videoPlaceholder}>
                                            <SafeIcon name="play" size={24} color="#fff" />
                                        </View>
                                    )}
                                    {isSelected && (
                                        <View style={styles.selectedOverlay}>
                                            <SafeIcon name="check" size={20} color="#fff" />
                                        </View>
                                    )}
                                    <View style={styles.assetBadge}>
                                        <SafeIcon
                                            name={asset.type === 'image' ? 'image' : 'video'}
                                            size={12}
                                            color="#fff"
                                        />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            )}

            <Text style={styles.countText}>
                {filteredAssets.length} média{filteredAssets.length > 1 ? 'x' : ''} trouvé{filteredAssets.length > 1 ? 's' : ''}
            </Text>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    expandButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.surfaceVariant,
        marginBottom: 16,
    },
    expandText: {
        flex: 1,
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 20,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    controls: {
        marginBottom: 16,
    },
    searchInput: {
        width: '100%',
        marginBottom: 12,
    },
    filterRow: {
        flexDirection: 'row',
        gap: 8,
    },
    filterButton: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
        backgroundColor: modernColors.surface,
        alignItems: 'center',
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    filterTextActive: {
        color: '#fff',
    },
    uploadRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
    },
    uploadButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 12,
        backgroundColor: modernColors.primary,
    },
    uploadButtonText: {
        fontSize: 13,
        fontWeight: '700',
        color: '#fff',
    },
    loadingContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyState: {
        alignItems: 'center',
        padding: 40,
    },
    emptyText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 12,
    },
    emptySubtext: {
        fontSize: 13,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 4,
    },
    assetsGrid: {
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    assetCard: {
        width: ASSET_CARD_WIDTH,
        height: ASSET_CARD_WIDTH,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
        borderWidth: 2,
        borderColor: 'transparent',
    },
    assetCardSelected: {
        borderColor: modernColors.primary,
    },
    assetImage: {
        width: '100%',
        height: '100%',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(99, 102, 241, 0.7)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    assetBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    countText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 12,
    },
});

