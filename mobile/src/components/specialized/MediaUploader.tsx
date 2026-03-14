/**
 * ✅ Composant professionnel pour upload d'images et vidéos vers S3/Wasabi
 * Utilisé dans ImmobilierFormScreen et autres écrans nécessitant des médias
 */

import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { mediaService } from '../../services/mediaService';
import { UploadedFile, uploadFiles } from '../../services/uploadApi';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

export interface MediaItem {
    uri: string;
    type: 'image' | 'video';
    uploaded?: boolean;
    uploadUrl?: string;
    uploading?: boolean;
}

interface MediaUploaderProps {
    media: MediaItem[];
    onMediaChange: (media: MediaItem[]) => void;
    maxImages?: number;
    maxVideos?: number;
    allowVideos?: boolean;
    label?: string;
}

const MediaUploader: React.FC<MediaUploaderProps> = ({
    media,
    onMediaChange,
    maxImages = 10,
    maxVideos = 3,
    allowVideos = true,
    label = 'Photos et vidéos',
}) => {
    const [uploading, setUploading] = useState(false);
    const [previewIndex, setPreviewIndex] = useState<number | null>(null);

    const requestPermissions = async () => {
        const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
        const { status: libraryStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (cameraStatus !== 'granted' || libraryStatus !== 'granted') {
            Alert.alert(
                'Permissions requises',
                'Veuillez autoriser l\'accès à la caméra et à la galerie pour ajouter des photos/vidéos.'
            );
            return false;
        }
        return true;
    };

    const pickFromLibrary = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: allowVideos
                ? ImagePicker.MediaTypeOptions.All
                : ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.8,
            videoQuality: (ImagePicker as any).VideoQuality?.Medium,
        });

        if (!result.canceled && result.assets) {
            const newMedia: MediaItem[] = result.assets.map(asset => ({
                uri: asset.uri,
                type: asset.type === 'video' ? 'video' : 'image',
                uploaded: false,
            }));

            // Vérifier les limites
            const currentImages = media.filter(m => m.type === 'image').length;
            const currentVideos = media.filter(m => m.type === 'video').length;
            const newImages = newMedia.filter(m => m.type === 'image').length;
            const newVideos = newMedia.filter(m => m.type === 'video').length;

            if (currentImages + newImages > maxImages) {
                Alert.alert('Limite atteinte', `Maximum ${maxImages} photos autorisées`);
                return;
            }

            if (currentVideos + newVideos > maxVideos) {
                Alert.alert('Limite atteinte', `Maximum ${maxVideos} vidéos autorisées`);
                return;
            }

            onMediaChange([...media, ...newMedia]);

            // Upload automatique
            uploadMedia(newMedia);
        }
    };

    const takePhoto = async () => {
        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.8,
            allowsEditing: true,
        });

        if (!result.canceled && result.assets[0]) {
            const newMedia: MediaItem = {
                uri: result.assets[0].uri,
                type: 'image',
                uploaded: false,
            };

            const currentImages = media.filter(m => m.type === 'image').length;
            if (currentImages >= maxImages) {
                Alert.alert('Limite atteinte', `Maximum ${maxImages} photos autorisées`);
                return;
            }

            onMediaChange([...media, newMedia]);
            uploadMedia([newMedia]);
        }
    };

    const recordVideo = async () => {
        if (!allowVideos) return;

        const hasPermission = await requestPermissions();
        if (!hasPermission) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            quality: (ImagePicker as any).VideoQuality?.Medium,
            allowsEditing: true,
        });

        if (!result.canceled && result.assets[0]) {
            const newMedia: MediaItem = {
                uri: result.assets[0].uri,
                type: 'video',
                uploaded: false,
            };

            const currentVideos = media.filter(m => m.type === 'video').length;
            if (currentVideos >= maxVideos) {
                Alert.alert('Limite atteinte', `Maximum ${maxVideos} vidéos autorisées`);
                return;
            }

            onMediaChange([...media, newMedia]);
            uploadMedia([newMedia]);
        }
    };

    const uploadMedia = async (itemsToUpload: MediaItem[]) => {
        try {
            setUploading(true);

            const files = itemsToUpload.map(item => ({
                uri: item.uri,
                type: item.type === 'video' ? 'video/mp4' : 'image/jpeg',
            }));

            const uploadedFiles: UploadedFile[] = await uploadFiles(files);

            // Mettre à jour les items avec les URLs uploadées
            const updatedMedia = media.map(item => {
                const uploadedFile = uploadedFiles.find(
                    (f, index) => itemsToUpload[index]?.uri === item.uri
                );
                if (uploadedFile) {
                    return {
                        ...item,
                        uploaded: true,
                        uploadUrl: uploadedFile.url,
                    };
                }
                return item;
            });

            // Ajouter les nouveaux items uploadés
            const newUploadedItems: MediaItem[] = itemsToUpload.map((item, index) => ({
                ...item,
                uploaded: true,
                uploadUrl: uploadedFiles[index]?.url,
            }));

            onMediaChange([...updatedMedia.filter(m => !itemsToUpload.some(i => i.uri === m.uri)), ...newUploadedItems]);
        } catch (error: any) {
            console.error('[MediaUploader] Erreur upload:', error);
            Alert.alert('Erreur', 'Impossible d\'uploader les médias. Veuillez réessayer.');
        } finally {
            setUploading(false);
        }
    };

    const removeMedia = (index: number) => {
        const newMedia = media.filter((_, i) => i !== index);
        onMediaChange(newMedia);
    };

    const getImageUrl = (item: MediaItem) => {
        if (item.uploadUrl) {
            return mediaService.getImageUrl(item.uploadUrl, { width: 400, quality: 80 });
        }
        return item.uri;
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.label}>{label}</Text>
                <Text style={styles.count}>
                    {media.length} / {maxImages + maxVideos} médias
                </Text>
            </View>

            {/* Actions */}
            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.primaryButton]}
                    onPress={pickFromLibrary}
                    disabled={uploading}
                >
                    <SafeIcon name="image" size={20} color="#fff" type="lucide" />
                    <Text style={styles.actionButtonText}>Galerie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.actionButton, styles.secondaryButton]}
                    onPress={takePhoto}
                    disabled={uploading}
                >
                    <SafeIcon name="camera" size={20} color={modernColors.primary} type="lucide" />
                    <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Photo</Text>
                </TouchableOpacity>
                {allowVideos && (
                    <TouchableOpacity
                        style={[styles.actionButton, styles.secondaryButton]}
                        onPress={recordVideo}
                        disabled={uploading}
                    >
                        <SafeIcon name="video" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={[styles.actionButtonText, styles.secondaryButtonText]}>Vidéo</Text>
                    </TouchableOpacity>
                )}
            </View>

            {uploading && (
                <View style={styles.uploadingIndicator}>
                    <ActivityIndicator size="small" color={modernColors.primary} />
                    <Text style={styles.uploadingText}>Upload en cours...</Text>
                </View>
            )}

            {/* Galerie de médias */}
            {media.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.gallery}>
                    {media.map((item, index) => (
                        <View key={index} style={styles.mediaItem}>
                            {item.type === 'image' ? (
                                <Image
                                    source={{ uri: getImageUrl(item) }}
                                    style={styles.mediaImage}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.videoPlaceholder}>
                                    <SafeIcon name="video" size={32} color="#fff" type="lucide" />
                                </View>
                            )}
                            {item.uploaded && (
                                <View style={styles.uploadedBadge}>
                                    <SafeIcon name="check-circle" size={16} color="#10B981" type="lucide" />
                                </View>
                            )}
                            {item.uploading && (
                                <View style={styles.uploadingBadge}>
                                    <ActivityIndicator size="small" color="#fff" />
                                </View>
                            )}
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => removeMedia(index)}
                            >
                                <SafeIcon name="x" size={16} color="#fff" type="lucide" />
                            </TouchableOpacity>
                            {item.type === 'video' && (
                                <View style={styles.videoBadge}>
                                    <SafeIcon name="play" size={12} color="#fff" type="lucide" />
                                </View>
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}

            {/* Modal de prévisualisation */}
            <Modal
                visible={previewIndex !== null}
                transparent
                animationType="fade"
                onRequestClose={() => setPreviewIndex(null)}
            >
                <View style={styles.previewModal}>
                    <TouchableOpacity
                        style={styles.previewClose}
                        onPress={() => setPreviewIndex(null)}
                    >
                        <SafeIcon name="x" size={24} color="#fff" type="lucide" />
                    </TouchableOpacity>
                    {previewIndex !== null && media[previewIndex] && (
                        <Image
                            source={{ uri: getImageUrl(media[previewIndex]) }}
                            style={styles.previewImage}
                            resizeMode="contain"
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    count: {
        fontSize: 12,
        color: '#6B7280',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        gap: 8,
    },
    primaryButton: {
        backgroundColor: modernColors.primary,
    },
    secondaryButton: {
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    actionButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    secondaryButtonText: {
        color: modernColors.primary,
    },
    uploadingIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    uploadingText: {
        fontSize: 12,
        color: '#6B7280',
    },
    gallery: {
        marginTop: 8,
    },
    mediaItem: {
        width: 120,
        height: 120,
        marginRight: 12,
        borderRadius: 8,
        overflow: 'hidden',
        position: 'relative',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#1F2937',
        justifyContent: 'center',
        alignItems: 'center',
    },
    uploadedBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 4,
    },
    uploadingBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    removeButton: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: '#EF4444',
        borderRadius: 12,
        width: 24,
        height: 24,
        justifyContent: 'center',
        alignItems: 'center',
    },
    videoBadge: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 12,
        padding: 4,
    },
    previewModal: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    previewClose: {
        position: 'absolute',
        top: 40,
        right: 20,
        zIndex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        borderRadius: 20,
        padding: 8,
    },
    previewImage: {
        width: '100%',
        height: '100%',
    },
});

export default MediaUploader;

