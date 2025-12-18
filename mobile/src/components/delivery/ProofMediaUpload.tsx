// ✅ Phase 9 - Amélioration : Composant pour uploader des médias de preuve (pickup/delivery) - Mobile
// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { ResizeMode, Video } from 'expo-av';
import * as ImagePicker from 'expo-image-picker';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { ENVIRONMENT } from '../../config/environment';
import { deliveryApi } from '../../services/api';
import { mediaService } from '../../services/mediaService';
import { modernColors } from '../../theme/modernTheme';
import { DeliveryProofMedia } from '../../types/delivery';
import SafeStorage from '../../utils/safeStorage';
import { NativeCard } from '../SafeNativeDesign';
import SafeIcon from '../SafeIcon';
import DeliveryProofVideoRecorder from './DeliveryProofVideoRecorder';

interface ProofMediaUploadProps {
    deliveryId: string;
    proofType: 'pickup' | 'delivery';
    isCourier: boolean;
    onMediaUpdated?: () => void;
}

const ProofMediaUpload: React.FC<ProofMediaUploadProps> = ({
    deliveryId,
    proofType,
    isCourier,
    onMediaUpdated,
}) => {
    const [media, setMedia] = useState<DeliveryProofMedia[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [showVideoRecorder, setShowVideoRecorder] = useState(false);

    // ✅ NOUVEAU 2025-12-03: Initialiser mediaService pour CDN avec fallback
    useEffect(() => {
        mediaService.initialize(ENVIRONMENT.API_URL).catch(() => {
            // Ignorer erreurs d'initialisation
        });
    }, []);

    useEffect(() => {
        loadMedia();
    }, [deliveryId, proofType]);

    const loadMedia = async () => {
        setLoading(true);
        try {
            const response = await deliveryApi.listProofMedia(deliveryId);
            if (response.success && response.data) {
                const mediaList = (response.data as any).media || [];
                const filtered = mediaList.filter((m: DeliveryProofMedia) => m.proof_type === proofType);
                setMedia(filtered);
            }
        } catch (error: any) {
            console.error('Erreur chargement médias:', error);
        } finally {
            setLoading(false);
        }
    };

    const handlePickImage = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la galerie');
            return;
        }

        // ✅ CORRIGÉ: Utiliser 'all' as any pour compatibilité avec toutes les versions d'expo-image-picker
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: 'all' as any,
            allowsEditing: true,
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            await uploadMedia(result.assets[0].uri, result.assets[0].type || 'image');
        }
    };

    const handleTakePhoto = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la caméra');
            return;
        }

        // Demander à l'utilisateur s'il veut prendre une photo ou une vidéo
        Alert.alert(
            'Type de média',
            'Que souhaitez-vous capturer ?',
            [
                {
                    text: 'Photo',
                    onPress: async () => {
                        // ✅ CORRIGÉ: Utiliser 'images' as any pour compatibilité avec toutes les versions d'expo-image-picker
                        const result = await ImagePicker.launchCameraAsync({
                            mediaTypes: 'images' as any,
                            allowsEditing: true,
                            quality: 0.8,
                        });
                        if (!result.canceled && result.assets[0]) {
                            await uploadMedia(result.assets[0].uri, result.assets[0].type || 'image');
                        }
                    },
                },
                {
                    text: 'Vidéo',
                    onPress: () => {
                        // ✅ NOUVEAU: Utiliser le système évolué DeliveryProofVideoRecorder
                        setShowVideoRecorder(true);
                    },
                },
                { text: 'Annuler', style: 'cancel' },
            ]
        );
    };

    const handleVideoRecorded = async (videoUri: string) => {
        setShowVideoRecorder(false);
        await uploadMedia(videoUri, 'video');
    };

    const uploadMedia = async (uri: string, type: string) => {
        setUploading(true);
        try {
            const isImage = type.startsWith('image');

            // ✅ Phase 9 - Amélioration : Uploader le fichier via multipart/form-data
            const formData = new FormData();

            // Créer un objet File à partir de l'URI
            const filename = uri.split('/').pop() || `proof_${Date.now()}.${isImage ? 'jpg' : 'mp4'}`;
            const fileType = isImage ? 'image/jpeg' : 'video/mp4';

            // @ts-ignore - FormData accepte les objets avec uri, type, name
            formData.append('file', {
                uri,
                type: fileType,
                name: filename,
            } as any);

            formData.append('delivery_id', deliveryId);
            formData.append('proof_type', proofType);

            // Récupérer le token depuis AsyncStorage
            const token = await SafeStorage.getItem('token');
            const baseUrl = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

            const response = await fetch(`${baseUrl}/api/media/upload-proof`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    // Ne pas définir Content-Type pour FormData, le navigateur le fait automatiquement
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.message || 'Impossible d\'uploader le média');
            }

            const result = await response.json();

            Alert.alert(
                'Succès',
                `${isImage ? 'Image' : 'Vidéo'} de ${proofType === 'pickup' ? 'récupération' : 'livraison'} ajoutée avec succès`
            );

            loadMedia();
            onMediaUpdated?.();
        } catch (error: any) {
            console.error('Erreur upload média:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'ajouter le média');
        } finally {
            setUploading(false);
        }
    };

    const handleDelete = async (mediaId: number) => {
        Alert.alert(
            'Confirmation',
            'Êtes-vous sûr de vouloir supprimer ce média ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deliveryApi.deleteProofMedia(deliveryId, mediaId);
                            Alert.alert('Succès', 'Le média a été supprimé avec succès');
                            loadMedia();
                            onMediaUpdated?.();
                        } catch (error: any) {
                            Alert.alert('Erreur', error.message || 'Impossible de supprimer le média');
                        }
                    },
                },
            ]
        );
    };

    const pickupMedia = media.filter(m => m.proof_type === 'pickup');
    const deliveryMedia = media.filter(m => m.proof_type === 'delivery');
    const currentMedia = proofType === 'pickup' ? pickupMedia : deliveryMedia;

    return (
        <NativeCard style={styles.card}>
            <View style={styles.header}>
                <Text style={styles.title}>
                    {proofType === 'pickup' ? '📸 Preuve de récupération' : '📦 Preuve de livraison'}
                </Text>
                {isCourier && (
                    <View style={styles.actions}>
                        <TouchableOpacity
                            onPress={() => {
                                Alert.alert(
                                    'Ajouter un média',
                                    'Choisissez une option',
                                    [
                                        { text: '📸 Prendre une photo/vidéo', onPress: handleTakePhoto },
                                        { text: '🖼️ Choisir depuis la galerie', onPress: handlePickImage },
                                        { text: 'Annuler', style: 'cancel' },
                                    ]
                                );
                            }}
                            disabled={uploading}
                            style={styles.addButton}
                        >
                            <SafeIcon name="plus" size={20} color={modernColors.primary} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {loading ? (
                <Text style={styles.emptyText}>Chargement...</Text>
            ) : currentMedia.length === 0 ? (
                <Text style={styles.emptyText}>
                    {isCourier
                        ? `Aucune ${proofType === 'pickup' ? 'preuve de récupération' : 'preuve de livraison'} pour le moment`
                        : `Aucune ${proofType === 'pickup' ? 'preuve de récupération' : 'preuve de livraison'} disponible`}
                </Text>
            ) : (
                <FlatList
                    data={currentMedia}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={({ item }) => (
                        <View style={styles.mediaItem}>
                            {item.media_type === 'image' ? (
                                <Image
                                    source={{
                                        uri: item.media_url.startsWith('http')
                                            ? item.media_url
                                            : mediaService.getImageUrl(item.media_url)
                                    }}
                                    style={styles.mediaImage}
                                />
                            ) : (
                                <Video
                                    source={{
                                        uri: item.media_url.startsWith('http')
                                            ? item.media_url
                                            : mediaService.getVideoUrl(item.media_url)
                                    }}
                                    style={styles.mediaVideo}
                                    useNativeControls
                                    resizeMode={ResizeMode.COVER}
                                />
                            )}
                            {isCourier && (
                                <TouchableOpacity
                                    onPress={() => handleDelete(item.id)}
                                    style={styles.deleteButton}
                                >
                                    <SafeIcon name="trash-2" size={16} color={modernColors.error} />
                                </TouchableOpacity>
                            )}
                            <View style={styles.mediaInfo}>
                                <Text style={styles.mediaDate}>
                                    {new Date(item.uploaded_at).toLocaleDateString('fr-FR')}
                                </Text>
                            </View>
                        </View>
                    )}
                />
            )}

            {/* Comparaison pickup vs delivery si les deux existent */}
            {pickupMedia.length > 0 && deliveryMedia.length > 0 && proofType === 'delivery' && (
                <View style={styles.comparisonSection}>
                    <Text style={styles.comparisonTitle}>🔍 Comparaison état initial vs final</Text>
                    <View style={styles.comparisonGrid}>
                        <View style={styles.comparisonItem}>
                            <Text style={styles.comparisonLabel}>État initial (récupération)</Text>
                            {pickupMedia[0].media_type === 'image' ? (
                                <Image
                                    source={{
                                        uri: pickupMedia[0].media_url.startsWith('http')
                                            ? pickupMedia[0].media_url
                                            : mediaService.getImageUrl(pickupMedia[0].media_url)
                                    }}
                                    style={styles.comparisonImage}
                                />
                            ) : (
                                <Video
                                    source={{
                                        uri: pickupMedia[0].media_url.startsWith('http')
                                            ? pickupMedia[0].media_url
                                            : mediaService.getVideoUrl(pickupMedia[0].media_url)
                                    }}
                                    style={styles.comparisonVideo}
                                    useNativeControls
                                    resizeMode={ResizeMode.COVER}
                                />
                            )}
                        </View>
                        <View style={styles.comparisonItem}>
                            <Text style={styles.comparisonLabel}>État final (livraison)</Text>
                            {deliveryMedia[0].media_type === 'image' ? (
                                <Image
                                    source={{
                                        uri: deliveryMedia[0].media_url.startsWith('http')
                                            ? deliveryMedia[0].media_url
                                            : mediaService.getImageUrl(deliveryMedia[0].media_url)
                                    }}
                                    style={styles.comparisonImage}
                                />
                            ) : (
                                <Video
                                    source={{
                                        uri: deliveryMedia[0].media_url.startsWith('http')
                                            ? deliveryMedia[0].media_url
                                            : mediaService.getVideoUrl(deliveryMedia[0].media_url)
                                    }}
                                    style={styles.comparisonVideo}
                                    useNativeControls
                                    resizeMode={ResizeMode.COVER}
                                />
                            )}
                        </View>
                    </View>
                </View>
            )}

            {/* ✅ NOUVEAU: Modal pour enregistrement vidéo avec système évolué */}
            <Modal
                visible={showVideoRecorder}
                animationType="slide"
                presentationStyle="fullScreen"
                onRequestClose={() => setShowVideoRecorder(false)}
            >
                <DeliveryProofVideoRecorder
                    proofType={proofType}
                    onRecordingComplete={handleVideoRecorded}
                    onCancel={() => setShowVideoRecorder(false)}
                    maxDuration={30}
                />
            </Modal>
        </NativeCard>
    );
};

const styles = StyleSheet.create({
    card: {
        marginBottom: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    actions: {
        flexDirection: 'row',
        gap: 8,
    },
    addButton: {
        padding: 8,
        backgroundColor: modernColors.primary + '20',
        borderRadius: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        paddingVertical: 16,
    },
    mediaItem: {
        marginRight: 12,
        position: 'relative',
    },
    mediaImage: {
        width: 120,
        height: 120,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    mediaVideo: {
        width: 120,
        height: 120,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    deleteButton: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: modernColors.error + '80',
        borderRadius: 12,
        padding: 4,
    },
    mediaInfo: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderBottomLeftRadius: 8,
        borderBottomRightRadius: 8,
        padding: 4,
    },
    mediaDate: {
        fontSize: 10,
        color: 'white',
    },
    comparisonSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    comparisonTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    comparisonGrid: {
        flexDirection: 'row',
        gap: 12,
    },
    comparisonItem: {
        flex: 1,
    },
    comparisonLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    comparisonImage: {
        width: '100%',
        height: 100,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
    comparisonVideo: {
        width: '100%',
        height: 100,
        borderRadius: 8,
        backgroundColor: modernColors.surfaceVariant,
    },
});

export default ProofMediaUpload;

