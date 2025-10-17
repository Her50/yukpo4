import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
// @ts-ignore
import ReactNative from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// @ts-ignore
const { Alert, Dimensions, ScrollView, StyleSheet, Text, TouchableOpacity, View, Image: RNImage, Modal: RNModal } = ReactNative;

const { width } = Dimensions.get('window');
const itemWidth = (width - 80) / 3; // 3 colonnes avec espacement

interface MediaFiles {
    images: string[];
    audios: string[];
    videos: string[];
    documents: string[];
    excel: string[];
    logo: string[];
    banner: string[];
}

interface MediaManagerMobileProps {
    mediaFiles: MediaFiles;
    onMediaChange: (mediaFiles: MediaFiles) => void;
    readonly?: boolean;
}

const MediaManagerMobile: React.FC<MediaManagerMobileProps> = ({
    mediaFiles,
    onMediaChange,
    readonly = false
}) => {
    const [showImagePreview, setShowImagePreview] = useState<string | null>(null);

    const pickImage = async (type: 'logo' | 'banner' | 'images') => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (!permissionResult.granted) {
                Alert.alert(
                    'Permission refusée',
                    'Vous devez autoriser l\'accès à la galerie pour ajouter des images'
                );
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: type === 'images',
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const newImages = result.assets.map(asset =>
                    asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : ''
                ).filter(img => img);

                if (type === 'images') {
                    onMediaChange({
                        ...mediaFiles,
                        images: [...mediaFiles.images, ...newImages]
                    });
                } else {
                    onMediaChange({
                        ...mediaFiles,
                        [type]: newImages.slice(0, 1) // Une seule image pour logo et banner
                    });
                }
            }
        } catch (error) {
            console.error('Erreur sélection image:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'image');
        }
    };

    const pickDocument = async (type: 'documents' | 'excel') => {
        try {
            const result = await DocumentPicker.getDocumentAsync({
                type: type === 'excel' ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' : '*/*',
                copyToCacheDirectory: true,
                multiple: false,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const file = result.assets[0];
                const base64 = await convertFileToBase64(file.uri);

                onMediaChange({
                    ...mediaFiles,
                    [type]: [...mediaFiles[type], base64]
                });
            }
        } catch (error) {
            console.error('Erreur sélection document:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner le document');
        }
    };

    const pickAudio = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: false,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const audio = result.assets[0];
                if (audio.base64) {
                    onMediaChange({
                        ...mediaFiles,
                        audios: [...mediaFiles.audios, `data:audio/mp4;base64,${audio.base64}`]
                    });
                }
            }
        } catch (error) {
            console.error('Erreur sélection audio:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner l\'audio');
        }
    };

    const pickVideo = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos,
                allowsMultipleSelection: false,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets) {
                const video = result.assets[0];
                if (video.base64) {
                    onMediaChange({
                        ...mediaFiles,
                        videos: [...mediaFiles.videos, `data:video/mp4;base64,${video.base64}`]
                    });
                }
            }
        } catch (error) {
            console.error('Erreur sélection vidéo:', error);
            Alert.alert('Erreur', 'Impossible de sélectionner la vidéo');
        }
    };

    const convertFileToBase64 = async (uri: string): Promise<string> => {
        try {
            const response = await fetch(uri);
            const blob = await response.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => {
                    const result = reader.result as string;
                    resolve(result.split(',')[1]); // Retourner seulement la partie base64
                };
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (error) {
            console.error('Erreur conversion base64:', error);
            throw error;
        }
    };

    const removeMedia = (type: keyof MediaFiles, index: number) => {
        const newMedia = [...mediaFiles[type]];
        newMedia.splice(index, 1);
        onMediaChange({
            ...mediaFiles,
            [type]: newMedia
        });
    };

    const getMediaIcon = (type: string) => {
        switch (type) {
            case 'logo': return 'image';
            case 'banner': return 'image';
            case 'images': return 'image';
            case 'videos': return 'video';
            case 'audios': return 'mic';
            case 'documents': return 'file';
            case 'excel': return 'file-spreadsheet';
            default: return 'file';
        }
    };

    const getMediaTitle = (type: string) => {
        switch (type) {
            case 'logo': return 'Logo';
            case 'banner': return 'Bannière';
            case 'images': return 'Images';
            case 'videos': return 'Vidéos';
            case 'audios': return 'Audio';
            case 'documents': return 'Documents';
            case 'excel': return 'Excel';
            default: return 'Fichier';
        }
    };

    const getMediaColor = (type: string) => {
        switch (type) {
            case 'logo': return '#3B82F6'; // Bleu
            case 'banner': return '#8B5CF6'; // Violet
            case 'images': return '#10B981'; // Vert
            case 'videos': return '#F59E0B'; // Orange
            case 'audios': return '#EF4444'; // Rouge
            case 'documents': return '#6B7280'; // Gris
            case 'excel': return '#059669'; // Vert foncé
            default: return '#6B7280';
        }
    };

    const mediaTypes: (keyof MediaFiles)[] = ['logo', 'banner', 'images', 'videos', 'audios', 'documents', 'excel'];

    if (readonly) {
        return (
            <View style={styles.readonlyContainer}>
                <Text style={styles.readonlyText}>Aperçu des médias (lecture seule)</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {mediaTypes.map(type => (
                        mediaFiles[type].length > 0 && (
                            <View key={type} style={styles.readonlyMediaItem}>
                                <SafeIcon name={getMediaIcon(type)} size={20} color={getMediaColor(type)} />
                                <Text style={styles.readonlyMediaText}>
                                    {getMediaTitle(type)} ({mediaFiles[type].length})
                                </Text>
                            </View>
                        )
                    ))}
                </ScrollView>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.title}>Médias</Text>
            <Text style={styles.subtitle}>Ajoutez vos fichiers et images</Text>

            {/* Grille compacte 2x3 */}
            <View style={styles.gridContainer}>
                {mediaTypes.map((type, index) => (
                    <View key={type} style={styles.mediaItem}>
                        <TouchableOpacity
                            style={[styles.mediaButton, { backgroundColor: getMediaColor(type) + '15' }]}
                            onPress={() => {
                                if (type === 'logo' || type === 'banner' || type === 'images') {
                                    pickImage(type);
                                } else if (type === 'documents' || type === 'excel') {
                                    pickDocument(type);
                                } else if (type === 'audios') {
                                    pickAudio();
                                } else if (type === 'videos') {
                                    pickVideo();
                                }
                            }}
                        >
                            <SafeIcon
                                name={getMediaIcon(type)}
                                size={22}
                                color={getMediaColor(type)}
                            />
                        </TouchableOpacity>

                        <Text style={styles.mediaTitle}>{getMediaTitle(type)}</Text>

                        {mediaFiles[type].length > 0 && (
                            <View style={styles.countBadge}>
                                <Text style={styles.countText}>{mediaFiles[type].length}</Text>
                            </View>
                        )}
                    </View>
                ))}
            </View>

            {/* Aperçu des médias sélectionnés */}
            {(mediaFiles.images.length > 0 || mediaFiles.logo.length > 0 || mediaFiles.banner.length > 0) && (
                <View style={styles.previewContainer}>
                    <Text style={styles.previewTitle}>Aperçu</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {[...mediaFiles.logo, ...mediaFiles.banner, ...mediaFiles.images].map((image, index) => (
                            <TouchableOpacity
                                key={index}
                                style={styles.previewItem}
                                onPress={() => setShowImagePreview(image)}
                            >
                                <RNImage source={{ uri: image }} style={styles.previewImage} />
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            )}

            {/* Modal de prévisualisation */}
            <RNModal
                visible={showImagePreview !== null}
                transparent={true}
                onRequestClose={() => setShowImagePreview(null)}
            >
                <View style={styles.previewModal}>
                    <TouchableOpacity
                        style={styles.previewCloseButton}
                        onPress={() => setShowImagePreview(null)}
                    >
                        <SafeIcon name="x" size={24} color="#FFFFFF" />
                    </TouchableOpacity>

                    {showImagePreview && (
                        <RNImage
                            source={{ uri: showImagePreview }}
                            style={styles.previewModalImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </RNModal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginVertical: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 16,
    },
    gridContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'flex-start',
        gap: 8,
    },
    mediaItem: {
        width: itemWidth,
        alignItems: 'center',
        position: 'relative',
        marginBottom: 12,
    },
    mediaButton: {
        width: '100%',
        aspectRatio: 1,
        maxWidth: 70,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    mediaTitle: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
        lineHeight: 13,
    },
    countBadge: {
        position: 'absolute',
        top: -2,
        right: 4,
        backgroundColor: modernColors.primary,
        borderRadius: 9,
        minWidth: 18,
        height: 18,
        paddingHorizontal: 4,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFFFFF',
    },
    countText: {
        fontSize: 9,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    previewContainer: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    previewTitle: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 8,
    },
    previewItem: {
        marginRight: 8,
    },
    previewImage: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    previewModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewCloseButton: {
        position: 'absolute',
        top: 50,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1,
    },
    previewModalImage: {
        width: width - 40,
        height: width - 40,
    },
    readonlyContainer: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginVertical: 8,
    },
    readonlyText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 12,
    },
    readonlyMediaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginRight: 8,
    },
    readonlyMediaText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginLeft: 6,
    },
});

export default MediaManagerMobile;