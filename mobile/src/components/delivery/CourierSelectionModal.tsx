import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { deliveryApi } from '../../services/api';
import { mediaService } from '../../services/mediaService';
import { modernColors } from '../../theme/modernTheme';
import { SafeIcon } from '../SafeIcon';
import { NativeButton } from '../SafeNativeDesign';

interface CourierSelectionModalProps {
    visible: boolean;
    onClose: () => void;
    deliveryId: string;
    onSuccess?: () => void;
}

interface AvailableCourier {
    id: string;
    user_id: number;
    name: string | null;
    email: string;
    avatar_url: string | null;
    rating_average: number | null;
    rating_count: number;
    bio: string | null;
    stats: {
        completed_deliveries: number;
        cancelled_deliveries: number;
        avg_delivery_time_minutes: number | null;
        success_rate: number;
    };
}

const CourierSelectionModal: React.FC<CourierSelectionModalProps> = ({
    visible,
    onClose,
    deliveryId,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const [couriers, setCouriers] = useState<AvailableCourier[]>([]);
    const [selectedCourierId, setSelectedCourierId] = useState<string | null>(null);
    const [loadingCouriers, setLoadingCouriers] = useState(false);

    useEffect(() => {
        if (visible) {
            loadCouriers();
        }
    }, [visible]);

    const loadCouriers = async () => {
        setLoadingCouriers(true);
        try {
            const response = await deliveryApi.listAvailableCouriers({} as any);
            if (response.couriers) {
                setCouriers(response.couriers);
            }
        } catch (error: any) {
            console.error('[CourierSelectionModal] Erreur chargement coursiers:', error);
            Alert.alert('Erreur', 'Impossible de charger la liste des coursiers');
        } finally {
            setLoadingCouriers(false);
        }
    };

    const handleAssign = async () => {
        if (!selectedCourierId) {
            Alert.alert('Erreur', 'Veuillez sélectionner un coursier');
            return;
        }

        setLoading(true);
        try {
            await deliveryApi.assignCourier(deliveryId, selectedCourierId);
            Alert.alert('✅ Coursier assigné', 'Le coursier a été assigné avec succès à cette livraison');
            onSuccess?.();
            onClose();
        } catch (error: any) {
            console.error('[CourierSelectionModal] Erreur assignation:', error);
            Alert.alert('Erreur', error.message || 'Impossible d\'assigner le coursier');
        } finally {
            setLoading(false);
        }
    };

    const renderCourier = ({ item }: { item: AvailableCourier }) => (
        <TouchableOpacity
            style={[
                styles.courierCard,
                selectedCourierId === item.id && styles.courierCardSelected,
            ]}
            onPress={() => setSelectedCourierId(item.id)}
        >
            <View style={styles.courierHeader}>
                {/* Avatar */}
                {item.avatar_url ? (
                    <Image source={{ uri: mediaService.getImageUrl(item.avatar_url) }} style={styles.avatar} />
                ) : (
                    <View style={styles.avatarPlaceholder}>
                        <Text style={styles.avatarText}>
                            {(item.name || item.email)[0].toUpperCase()}
                        </Text>
                    </View>
                )}

                {/* Info */}
                <View style={styles.courierInfo}>
                    <View style={styles.courierNameRow}>
                        <Text style={styles.courierName} numberOfLines={1}>
                            {item.name || item.email}
                        </Text>
                        {selectedCourierId === item.id && (
                            <SafeIcon name="check-circle" size={20} color={modernColors.primary} />
                        )}
                    </View>

                    {item.bio && (
                        <Text style={styles.courierBio} numberOfLines={2}>
                            {item.bio}
                        </Text>
                    )}

                    {/* Stats */}
                    <View style={styles.statsRow}>
                        {item.rating_average !== null && (
                            <View style={styles.statItem}>
                                <SafeIcon name="star" size={14} color="#FBBF24" />
                                <Text style={styles.statText}>
                                    {item.rating_average.toFixed(1)} ({item.rating_count})
                                </Text>
                            </View>
                        )}

                        <View style={styles.statItem}>
                            <SafeIcon name="check-circle" size={14} color={modernColors.success} />
                            <Text style={styles.statText}>
                                {item.stats.completed_deliveries} livraisons
                            </Text>
                        </View>

                        {item.stats.avg_delivery_time_minutes && (
                            <View style={styles.statItem}>
                                <SafeIcon name="clock" size={14} color={modernColors.primary} />
                                <Text style={styles.statText}>
                                    {Math.round(item.stats.avg_delivery_time_minutes)} min
                                </Text>
                            </View>
                        )}

                        <Text style={styles.successRate}>
                            {item.stats.success_rate}% réussite
                        </Text>
                    </View>
                </View>
            </View>
        </TouchableOpacity>
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>Choisir un livreur</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Content */}
                    {loadingCouriers ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={modernColors.primary} />
                            <Text style={styles.loadingText}>Chargement des coursiers...</Text>
                        </View>
                    ) : couriers.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>
                                Aucun coursier disponible pour le moment
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={couriers}
                            renderItem={renderCourier}
                            keyExtractor={(item) => item.id}
                            contentContainerStyle={styles.listContent}
                        />
                    )}

                    {/* Footer */}
                    <View style={styles.footer}>
                        <NativeButton
                            title="Annuler"
                            variant="outline"
                            onPress={onClose}
                            disabled={loading}
                        />
                        <NativeButton
                            title={loading ? 'Assignation...' : 'Assigner ce coursier'}
                            variant="primary"
                            onPress={handleAssign}
                            disabled={!selectedCourierId || loading}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: 'white',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '90%',
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    listContent: {
        padding: 16,
    },
    courierCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        marginBottom: 12,
        backgroundColor: 'white',
    },
    courierCardSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    courierHeader: {
        flexDirection: 'row',
        gap: 12,
    },
    avatar: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary + '20',
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: modernColors.primary,
    },
    courierInfo: {
        flex: 1,
    },
    courierNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    courierName: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        flex: 1,
    },
    courierBio: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    statsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 12,
    },
    statItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statText: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    successRate: {
        marginLeft: 'auto',
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.success,
    },
    footer: {
        flexDirection: 'row',
        gap: 12,
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.background,
    },
});

export default CourierSelectionModal;

