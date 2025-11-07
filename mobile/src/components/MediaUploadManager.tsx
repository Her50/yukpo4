import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image as RNImage,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

interface MediaUploadManagerProps {
  images: string[];
  videos: string[];
  onImagesChange: (images: string[]) => void;
  onVideosChange: (videos: string[]) => void;
  readonly?: boolean;
  maxImages?: number;
  maxVideos?: number;
}

const MediaUploadManager: React.FC<MediaUploadManagerProps> = ({
  images: imagesProp,
  videos: videosProp,
  onImagesChange,
  onVideosChange,
  readonly = false,
  maxImages = 10,
  maxVideos = 2
}) => {
  // ✅ Protection contre undefined - toujours utiliser des tableaux
  const images = imagesProp || [];
  const videos = videosProp || [];

  const [uploading, setUploading] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState<string | null>(null);

  const pickImages = async () => {
    if (images.length >= maxImages) {
      Alert.alert('Limite atteinte', `Vous ne pouvez ajouter que ${maxImages} images maximum`);
      return;
    }

    try {
      setUploading(true);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission refusée',
          'Vous devez autoriser l\'accès à la galerie pour ajouter des images'
        );
        setUploading(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newImages: string[] = [];

        for (const asset of result.assets) {
          if (asset.base64) {
            const imageBase64 = `data:image/jpeg;base64,${asset.base64}`;
            newImages.push(imageBase64);
          }
        }

        if (newImages.length > 0) {
          const remainingSlots = maxImages - images.length;
          const imagesToAdd = newImages.slice(0, remainingSlots);

          onImagesChange([...images, ...imagesToAdd]);

          if (newImages.length > remainingSlots) {
            Alert.alert(
              'Limite atteinte',
              `Seulement ${remainingSlots} image(s) ajoutée(s). Limite: ${maxImages} images.`
            );
          }
        }
      }
    } catch (error) {
      console.error('Erreur sélection images:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner les images');
    } finally {
      setUploading(false);
    }
  };

  const pickVideos = async () => {
    if (videos.length >= maxVideos) {
      Alert.alert('Limite atteinte', `Vous ne pouvez ajouter que ${maxVideos} vidéos maximum`);
      return;
    }

    try {
      setUploading(true);

      const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permissionResult.granted) {
        Alert.alert(
          'Permission refusée',
          'Vous devez autoriser l\'accès à la galerie pour ajouter des vidéos'
        );
        setUploading(false);
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 0.8,
        base64: false, // Vidéos : pas de base64 (trop lourd)
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const videoUri = result.assets[0].uri;

        if (videoUri) {
          onVideosChange([...videos, videoUri]);
        }
      }
    } catch (error) {
      console.error('Erreur sélection vidéo:', error);
      Alert.alert('Erreur', 'Impossible de sélectionner la vidéo');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    Alert.alert(
      'Supprimer l\'image',
      'Êtes-vous sûr de vouloir supprimer cette image ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const newImages = images.filter((_, i) => i !== index);
            onImagesChange(newImages);
          }
        }
      ]
    );
  };

  const removeVideo = (index: number) => {
    Alert.alert(
      'Supprimer la vidéo',
      'Êtes-vous sûr de vouloir supprimer cette vidéo ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            const newVideos = videos.filter((_, i) => i !== index);
            onVideosChange(newVideos);
          }
        }
      ]
    );
  };

  if (readonly) {
    return (
      <View style={styles.readonlyContainer}>
        <Text style={styles.readonlyText}>Médias (lecture seule)</Text>
        <View style={styles.readonlyGrid}>
          {images.length > 0 && (
            <View style={styles.readonlyItem}>
              <SafeIcon name="image" size={20} color={modernColors.primary} />
              <Text style={styles.readonlyLabel}>{images.length} image(s)</Text>
            </View>
          )}
          {videos.length > 0 && (
            <View style={styles.readonlyItem}>
              <SafeIcon name="video" size={20} color={modernColors.accent} />
              <Text style={styles.readonlyLabel}>{videos.length} vidéo(s)</Text>
            </View>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Section Images */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <SafeIcon name="image" size={24} color={modernColors.primary} />
          <Text style={styles.sectionTitle}>Photos ({images.length}/{maxImages})</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Ajoutez des photos de votre produit ou service
        </Text>

        {/* Grille d'images */}
        {images.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.mediaScroll}>
            {images.map((image, index) => (
              <View key={index} style={styles.imageContainer}>
                <TouchableOpacity
                  style={styles.imagePreview}
                  onPress={() => setShowImagePreview(image)}
                >
                  <RNImage source={{ uri: image }} style={styles.imageThumb} />
                  {index === 0 && (
                    <View style={styles.mainBadge}>
                      <Text style={styles.mainBadgeText}>Principale</Text>
                    </View>
                  )}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <SafeIcon name="x" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Bouton Ajouter Images */}
        {images.length < maxImages && (
          <TouchableOpacity
            style={[styles.uploadButton, uploading && styles.uploadButtonDisabled]}
            onPress={pickImages}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={modernColors.primary} />
            ) : (
              <>
                <SafeIcon name="camera" size={32} color={modernColors.primary} />
                <Text style={styles.uploadText}>Ajouter des photos</Text>
                <Text style={styles.uploadHint}>
                  {images.length === 0 ? 'La première sera l\'image principale' : `Encore ${maxImages - images.length} photo(s)`}
                </Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Section Vidéos */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <SafeIcon name="video" size={24} color={modernColors.accent} />
          <Text style={styles.sectionTitle}>Vidéos ({videos.length}/{maxVideos})</Text>
        </View>
        <Text style={styles.sectionSubtitle}>
          Ajoutez des vidéos de démonstration (optionnel)
        </Text>

        {/* Liste vidéos */}
        {videos.length > 0 && (
          <View style={styles.videoList}>
            {videos.map((video, index) => (
              <View key={index} style={styles.videoItem}>
                <View style={styles.videoInfo}>
                  <SafeIcon name="film" size={20} color={modernColors.accent} />
                  <Text style={styles.videoName} numberOfLines={1}>
                    Vidéo {index + 1}
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.videoRemoveButton}
                  onPress={() => removeVideo(index)}
                >
                  <SafeIcon name="trash-2" size={16} color="#EF4444" />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* Bouton Ajouter Vidéos */}
        {videos.length < maxVideos && (
          <TouchableOpacity
            style={[styles.uploadButton, styles.uploadButtonVideo, uploading && styles.uploadButtonDisabled]}
            onPress={pickVideos}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color={modernColors.accent} />
            ) : (
              <>
                <SafeIcon name="video" size={32} color={modernColors.accent} />
                <Text style={[styles.uploadText, { color: modernColors.accent }]}>Ajouter une vidéo</Text>
                <Text style={styles.uploadHint}>Durée max: 30 secondes</Text>
              </>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Preview Modal (simplifié) */}
      {showImagePreview && (
        <TouchableOpacity
          style={styles.previewModal}
          activeOpacity={1}
          onPress={() => setShowImagePreview(null)}
        >
          <View style={styles.previewModalContent}>
            <RNImage
              source={{ uri: showImagePreview }}
              style={styles.previewImage}
              resizeMode="contain"
            />
            <TouchableOpacity
              style={styles.closePreviewButton}
              onPress={() => setShowImagePreview(null)}
            >
              <SafeIcon name="x" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 20,
  },
  section: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: -8,
  },
  mediaScroll: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  imageContainer: {
    position: 'relative',
    marginRight: 12,
  },
  imagePreview: {
    position: 'relative',
  },
  imageThumb: {
    width: 120,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  mainBadge: {
    position: 'absolute',
    bottom: 4,
    left: 4,
    backgroundColor: modernColors.primary,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  mainBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  removeButton: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#EF4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
  },
  uploadButton: {
    borderWidth: 2,
    borderColor: modernColors.primary,
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 24,
    alignItems: 'center',
    gap: 8,
  },
  uploadButtonVideo: {
    borderColor: modernColors.accent,
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadText: {
    fontSize: 16,
    fontWeight: '600',
    color: modernColors.primary,
  },
  uploadHint: {
    fontSize: 12,
    color: '#6B7280',
  },
  videoList: {
    gap: 8,
  },
  videoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  videoInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  videoName: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  videoRemoveButton: {
    padding: 8,
  },
  readonlyContainer: {
    backgroundColor: '#F3F4F6',
    padding: 16,
    borderRadius: 12,
  },
  readonlyText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  readonlyGrid: {
    flexDirection: 'row',
    gap: 16,
  },
  readonlyItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  readonlyLabel: {
    fontSize: 14,
    color: '#4B5563',
  },
  previewModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    zIndex: 1000,
  },
  previewModalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  previewImage: {
    width: '90%',
    height: '80%',
  },
  closePreviewButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default MediaUploadManager;



