/**
 * Écran de gestion des médias de preuve de livraison
 * Permet au coursier d'ajouter et gérer les photos/vidéos de preuve
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Dimensions,
    FlatList,
    Image,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import DeliveryProofVideoRecorder from '../../components/delivery/DeliveryProofVideoRecorder';
import { SafeIcon } from '../../components/SafeIcon';
import { useDeliveryContext } from '../../contexts/DeliveryContext';
import { apiDelete, apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const { width, height } = Dimensions.get('window');

interface ProofMedia {
    id: number;
    media_type: 'image' | 'video';
    media_url: string;
    proof_type: 'pickup' | 'delivery';
    uploaded_at: string;
    metadata?: any;
}

const DeliveryProofScreen: React.FC<{ route: any }> = ({ route }) => {
    const { deliveryId } = route.params;
    const { delivery, refreshDelivery } = useDeliveryContext();
    const [proofMedias, setProofMedias] = useState<ProofMedia[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [showVideoRecorder, setShowVideoRecorder] = useState<boolean>(false);
    const [currentProofType, setCurrentProofType] = useState<'pickup' | 'delivery'>('pickup');
    const [selectedMedia, setSelectedMedia] = useState<ProofMedia | null>(null);
    const [showMediaModal, setShowMediaModal] = useState<boolean>(false);

    useEffect(() => {
        loadProofMedias();
    }, [deliveryId]);

    const loadProofMedias = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/delivery/${deliveryId}/proof-media`);
            if (response.success) {
                setProofMedias(response.data || []);
            }
        } catch (error) {
            console.error('Erreur chargement médias:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleAddPhoto = async () => {
        // TODO: Implémenter la sélection de photo depuis la galerie ou la caméra
        Alert.alert('Photo', 'Fonctionnalité photo à implémenter');
    };

    const handleAddVideo = () => {
        setCurrentProofType(delivery?.status === 'EnRoutePickup' || delivery?.status === 'ShoppingCompleted' ? 'pickup' : 'delivery');
        setShowVideoRecorder(true);
    };

    const handleVideoRecorded = async (videoUri: string) => {
        setShowVideoRecorder(false);

        try {
            const response = await apiPost(`/api/delivery/${deliveryId}/proof-media`, {
                media_type: 'video',
                media_url: videoUri,
                proof_type: currentProofType,
                metadata: {
                    recorded_at: new Date().toISOString(),
                    device_info: 'mobile_app',
                },
            });

            if (response.success) {
                Alert.alert('✅ Succès', 'Vidéo de preuve ajoutée avec succès');
                loadProofMedias();
                refreshDelivery(deliveryId);
            } else {
                Alert.alert('Erreur', response.message || 'Impossible d\'ajouter la vidéo');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.response?.data?.message || 'Impossible d\'ajouter la vidéo');
        }
    };

    const handleDeleteMedia = (media: ProofMedia) => {
        Alert.alert(
            'Supprimer le média',
            'Êtes-vous sûr de vouloir supprimer cette preuve ? Cette action est irréversible.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: () => deleteMedia(media),
                },
            ]
        );
    };

    const deleteMedia = async (media: ProofMedia) => {
        try {
            const response = await apiDelete(`/api/delivery/${deliveryId}/proof-media/${media.id}`);
            if (response.success) {
                Alert.alert('✅ Succès', 'Média supprimé avec succès');
                loadProofMedias();
                refreshDelivery(deliveryId);
            } else {
                Alert.alert('Erreur', response.message || 'Impossible de supprimer le média');
            }
        } catch (error: any) {
            Alert.alert('Erreur', error.response?.data?.message || 'Impossible de supprimer le média');
        }
    };

    const handleMediaPress = (media: ProofMedia) => {
        setSelectedMedia(media);
        setShowMediaModal(true);
    };

    const canAddPickupProof = delivery?.status === 'EnRoutePickup' || delivery?.status === 'ShoppingCompleted';
    const canAddDeliveryProof = delivery?.status === 'EnRouteDelivery' || delivery?.status === 'Delivered';

    const pickupMedias = proofMedias.filter(m => m.proof_type === 'pickup');
    const deliveryMedias = proofMedias.filter(m => m.proof_type === 'delivery');

    const renderMediaItem = ({ item }: { item: ProofMedia }) => (
        <TouchableOpacity
            style={styles.mediaItem}
            onPress={() => handleMediaPress(item)}
        >
            {item.media_type === 'image' ? (
                <Image source={{ uri: item.media_url }} style={styles.mediaImage} />
            ) : (
                <View style={styles.videoThumbnail}>
                    <SafeIcon name="play-circle" size={40} color="white" />
                    <Text style={styles.videoText}>Vidéo</Text>
                </View>
            )}
            <View style={styles.mediaOverlay}>
                <TouchableOpacity
                    style={styles.deleteButton}
                    onPress={() => handleDeleteMedia(item)}
                >
                    <SafeIcon name="trash-2" size={16} color="white" />
                </TouchableOpacity>
            </View>
            <Text style={styles.mediaType}>
                {item.proof_type === 'pickup' ? '📦 Récupération' : '✅ Livraison'}
            </Text>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement des preuves...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={[modernColors.primary, modernColors.primaryDark]}
                style={styles.header}
            >
                <View style={styles.headerContent}>
                    <Text style={styles.headerTitle}>Preuves de livraison</Text>
                    <Text style={styles.headerSubtitle}>
                        Livraison #{deliveryId?.toString()?.slice(0, 8)?.toUpperCase()}
                    </Text>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* Instructions */}
                <View style={styles.instructionsSection}>
                    <Text style={styles.sectionTitle}>Instructions</Text>
                    <View style={styles.instructionCard}>
                        <View style={styles.instructionItem}>
                            <SafeIcon name="camera" size={20} color={modernColors.primary} />
                            <Text style={styles.instructionText}>
                                Prenez des photos ou vidéos claires de l'état du colis
                            </Text>
                        </View>
                        <View style={styles.instructionItem}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.instructionText}>
                                Montrez l'adresse de destination et l'emplacement final
                            </Text>
                        </View>
                        <View style={styles.instructionItem}>
                            <SafeIcon name="clock" size={20} color={modernColors.primary} />
                            <Text style={styles.instructionText}>
                                Ajoutez les preuves au moment approprié (récupération/livraison)
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Preuves de récupération */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>📦 Preuves de récupération</Text>
                        {pickupMedias.length > 0 && (
                            <Text style={styles.mediaCount}>{pickupMedias.length} média{pickupMedias.length > 1 ? 's' : ''}</Text>
                        )}
                    </View>

                    {canAddPickupProof && (
                        <View style={styles.addMediaButtons}>
                            <TouchableOpacity
                                style={[styles.addButton, styles.addPhotoButton]}
                                onPress={handleAddPhoto}
                            >
                                <SafeIcon name="camera" size={24} color="white" />
                                <Text style={styles.addButtonText}>Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.addButton, styles.addVideoButton]}
                                onPress={handleAddVideo}
                            >
                                <SafeIcon name="video" size={24} color="white" />
                                <Text style={styles.addButtonText}>Vidéo</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {pickupMedias.length > 0 ? (
                        <FlatList
                            data={pickupMedias}
                            renderItem={renderMediaItem}
                            keyExtractor={(item) => item.id.toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.mediaList}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <SafeIcon name="image" size={40} color={modernColors.border} />
                            <Text style={styles.emptyStateText}>
                                Aucune preuve de récupération pour le moment
                            </Text>
                        </View>
                    )}
                </View>

                {/* Preuves de livraison */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>✅ Preuves de livraison</Text>
                        {deliveryMedias.length > 0 && (
                            <Text style={styles.mediaCount}>{deliveryMedias.length} média{deliveryMedias.length > 1 ? 's' : ''}</Text>
                        )}
                    </View>

                    {canAddDeliveryProof && (
                        <View style={styles.addMediaButtons}>
                            <TouchableOpacity
                                style={[styles.addButton, styles.addPhotoButton]}
                                onPress={handleAddPhoto}
                            >
                                <SafeIcon name="camera" size={24} color="white" />
                                <Text style={styles.addButtonText}>Photo</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.addButton, styles.addVideoButton]}
                                onPress={handleAddVideo}
                            >
                                <SafeIcon name="video" size={24} color="white" />
                                <Text style={styles.addButtonText}>Vidéo</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {deliveryMedias.length > 0 ? (
                        <FlatList
                            data={deliveryMedias}
                            renderItem={renderMediaItem}
                            keyExtractor={(item) => item.id.toString()}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            style={styles.mediaList}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <SafeIcon name="image" size={40} color={modernColors.border} />
                            <Text style={styles.emptyStateText}>
                                Aucune preuve de livraison pour le moment
                            </Text>
                        </View>
                    )}
                </View>

                {/* Statut actuel */}
                <View style={styles.statusSection}>
                    <Text style={styles.sectionTitle}>Statut actuel</Text>
                    <View style={styles.statusCard}>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Statut de la livraison:</Text>
                            <Text style={styles.statusValue}>{delivery?.status}</Text>
                        </View>
                        <View style={styles.statusItem}>
                            <Text style={styles.statusLabel}>Total des preuves:</Text>
                            <Text style={styles.statusValue}>{proofMedias.length} média{proofMedias.length > 1 ? 's' : ''}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            {/* Modal vidéo */}
            {showVideoRecorder && (
                <Modal
                    visible={showVideoRecorder}
                    animationType="slide"
                    presentationStyle="fullScreen"
                >
                    <DeliveryProofVideoRecorder
                        proofType={currentProofType}
                        onRecordingComplete={handleVideoRecorded}
                        onCancel={() => setShowVideoRecorder(false)}
                        maxDuration={30}
                    />
                </Modal>
            )}

            {/* Modal visualisation média */}
            {showMediaModal && selectedMedia && (
                <Modal
                    visible={showMediaModal}
                    animationType="fade"
                    transparent={true}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowMediaModal(false)}
                    >
                        <View style={styles.mediaModalContent}>
                            {selectedMedia.media_type === 'image' ? (
                                <Image
                                    source={{ uri: selectedMedia.media_url }}
                                    style={styles.modalImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.videoPlaceholder}>
                                    <SafeIcon name="play-circle" size={60} color="white" />
                                    <Text style={styles.videoPlaceholderText}>Lecture vidéo</Text>
                                </View>
                            )}
                            <TouchableOpacity
                                style={styles.closeModalButton}
                                onPress={() => setShowMediaModal(false)}
                            >
                                <SafeIcon name="x" size={24} color="white" />
                            </TouchableOpacity>
                        </View>
                    </TouchableOpacity>
                </Modal>
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        paddingTop: 20,
        paddingBottom: 30,
        paddingHorizontal: 20,
    },
    headerContent: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
        color: 'white',
        marginBottom: 5,
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.9)',
    },
    content: {
        flex: 1,
        padding: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 15,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    instructionsSection: {
        marginBottom: 25,
    },
    section: {
        marginBottom: 30,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 15,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
    },
    mediaCount: {
        fontSize: 14,
        color: modernColors.textSecondary,
        backgroundColor: modernColors.card,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    instructionCard: {
        backgroundColor: modernColors.card,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    instructionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    instructionText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.textSecondary,
        lineHeight: 20,
    },
    addMediaButtons: {
        flexDirection: 'row',
        gap: 15,
        marginBottom: 20,
    },
    addButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 15,
        borderRadius: 12,
        gap: 8,
    },
    addPhotoButton: {
        backgroundColor: modernColors.primary,
    },
    addVideoButton: {
        backgroundColor: modernColors.accent,
    },
    addButtonText: {
        color: 'white',
        fontSize: 16,
        fontWeight: '600',
    },
    mediaList: {
        marginBottom: 10,
    },
    mediaItem: {
        width: 120,
        height: 120,
        marginRight: 15,
        borderRadius: 12,
        overflow: 'hidden',
        position: 'relative',
    },
    mediaImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    videoThumbnail: {
        width: '100%',
        height: '100%',
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    videoText: {
        color: 'white',
        fontSize: 12,
        marginTop: 5,
    },
    mediaOverlay: {
        position: 'absolute',
        top: 5,
        right: 5,
    },
    deleteButton: {
        backgroundColor: 'rgba(255, 59, 48, 0.9)',
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaType: {
        position: 'absolute',
        bottom: 5,
        left: 5,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        color: 'white',
        fontSize: 10,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 8,
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: 30,
    },
    emptyStateText: {
        marginTop: 10,
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    statusSection: {
        marginBottom: 30,
    },
    statusCard: {
        backgroundColor: modernColors.card,
        borderRadius: 12,
        padding: 20,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    statusItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    statusLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    statusValue: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    mediaModalContent: {
        width: width * 0.9,
        height: height * 0.7,
        position: 'relative',
    },
    modalImage: {
        width: '100%',
        height: '100%',
        borderRadius: 12,
    },
    videoPlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: modernColors.border,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 12,
    },
    videoPlaceholderText: {
        color: 'white',
        fontSize: 16,
        marginTop: 10,
    },
    closeModalButton: {
        position: 'absolute',
        top: 20,
        right: 20,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default DeliveryProofScreen;
