import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface NegotiatedPriceModalProps {
    visible: boolean;
    onClose: () => void;
    conversationId: number;
    serviceId: number;
    productIndex?: number;
    originalPrice: number; // Prix en FCFA
    merchantUserId: number;
    clientUserId: number;
    onPriceNegotiated?: () => void;
}

interface NegotiatedPriceOffer {
    id: number;
    conversation_id: number;
    service_id: number;
    product_index?: number;
    merchant_user_id: number;
    client_user_id: number;
    original_price_cents: number;
    negotiated_price_cents: number;
    status: string;
    expires_at?: string;
    created_at: string;
}

const NegotiatedPriceModal: React.FC<NegotiatedPriceModalProps> = ({
    visible,
    onClose,
    conversationId,
    serviceId,
    productIndex,
    originalPrice,
    merchantUserId,
    clientUserId,
    onPriceNegotiated,
}) => {
    const [negotiatedPrice, setNegotiatedPrice] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [pendingOffer, setPendingOffer] = useState<NegotiatedPriceOffer | null>(null);
    const [loadingOffer, setLoadingOffer] = useState(false);
    const [isMerchant, setIsMerchant] = useState(false);

    // Vérifier si l'utilisateur est le prestataire
    useEffect(() => {
        // TODO: Récupérer l'ID de l'utilisateur connecté depuis le contexte/auth
        setIsMerchant(true); // À adapter selon votre système d'auth
    }, []);

    // Charger l'offre en attente
    useEffect(() => {
        if (visible && !isMerchant) {
            loadPendingOffer();
        }
    }, [visible, isMerchant]);

    const loadPendingOffer = async () => {
        setLoadingOffer(true);
        try {
            const response = await apiGet(
                `/api/negotiated-prices/pending?conversation_id=${conversationId}&service_id=${serviceId}${productIndex !== undefined ? `&product_index=${productIndex}` : ''}`
            );
            if (response.success && response.data) {
                setPendingOffer(response.data || null);
            }
        } catch (error) {
            console.error('Erreur chargement offre:', error);
        } finally {
            setLoadingOffer(false);
        }
    };

    const handleCreateOffer = async () => {
        const price = parseFloat(negotiatedPrice);
        if (isNaN(price) || price <= 0) {
            Alert.alert('Erreur', 'Veuillez entrer un prix valide');
            return;
        }

        if (price >= originalPrice) {
            Alert.alert('Erreur', 'Le prix négocié doit être inférieur au prix original');
            return;
        }

        setLoading(true);
        try {
            const response = await apiPost('/api/negotiated-prices', {
                conversation_id: conversationId,
                service_id: serviceId,
                product_index: productIndex,
                original_price_cents: Math.round(originalPrice * 100),
                negotiated_price_cents: Math.round(price * 100),
                expires_in_hours: 24,
            });

            if (response.success) {
                Alert.alert('Succès', 'Offre de prix négocié créée avec succès');
                setNegotiatedPrice('');
                onPriceNegotiated?.();
                onClose();
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de la création de l\'offre');
            }
        } catch (error) {
            console.error('Erreur création offre:', error);
            Alert.alert('Erreur', 'Erreur lors de la création de l\'offre');
        } finally {
            setLoading(false);
        }
    };

    const handleAcceptOffer = async () => {
        if (!pendingOffer) return;

        setLoading(true);
        try {
            const response = await apiPost(`/api/negotiated-prices/${pendingOffer.id}/accept`, {});

            if (response.success) {
                Alert.alert('Succès', 'Offre acceptée avec succès');
                setPendingOffer(null);
                onPriceNegotiated?.();
                onClose();
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de l\'acceptation de l\'offre');
            }
        } catch (error) {
            console.error('Erreur acceptation offre:', error);
            Alert.alert('Erreur', 'Erreur lors de l\'acceptation de l\'offre');
        } finally {
            setLoading(false);
        }
    };

    const handleRejectOffer = async () => {
        if (!pendingOffer) return;

        setLoading(true);
        try {
            const response = await apiPost(`/api/negotiated-prices/${pendingOffer.id}/reject`, {});

            if (response.success) {
                Alert.alert('Offre rejetée', 'L\'offre a été rejetée');
                setPendingOffer(null);
                onClose();
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors du rejet de l\'offre');
            }
        } catch (error) {
            console.error('Erreur rejet offre:', error);
            Alert.alert('Erreur', 'Erreur lors du rejet de l\'offre');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.modal}>
                    <LinearGradient
                        colors={[modernColors.primary || '#6366F1', modernColors.secondary || '#8B5CF6']}
                        style={styles.header}
                    >
                        <View style={styles.headerContent}>
                            <SafeIcon name="dollar-sign" size={24} color="#FFFFFF" />
                            <Text style={styles.headerTitle}>
                                {isMerchant ? 'Proposer un prix négocié' : 'Offre de prix négocié'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                    </LinearGradient>

                    <View style={styles.content}>
                        {/* Prix original */}
                        <View style={styles.originalPriceCard}>
                            <Text style={styles.originalPriceLabel}>Prix original</Text>
                            <Text style={styles.originalPriceValue}>
                                {originalPrice.toLocaleString('fr-FR')} FCFA
                            </Text>
                        </View>

                        {/* Interface prestataire */}
                        {isMerchant && (
                            <View style={styles.merchantSection}>
                                <Text style={styles.label}>Prix négocié (FCFA)</Text>
                                <TextInput
                                    style={styles.input}
                                    value={negotiatedPrice}
                                    onChangeText={setNegotiatedPrice}
                                    placeholder="Ex: 15000"
                                    keyboardType="numeric"
                                />
                                <Text style={styles.hint}>
                                    Le prix doit être inférieur au prix original
                                </Text>
                                <TouchableOpacity
                                    style={[styles.button, loading || !negotiatedPrice && styles.buttonDisabled]}
                                    onPress={handleCreateOffer}
                                    disabled={loading || !negotiatedPrice}
                                >
                                    {loading ? (
                                        <ActivityIndicator color="#FFFFFF" />
                                    ) : (
                                        <Text style={styles.buttonText}>Créer l'offre</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Interface client */}
                        {!isMerchant && (
                            <View style={styles.clientSection}>
                                {loadingOffer ? (
                                    <ActivityIndicator size="large" color={modernColors.primary} />
                                ) : pendingOffer ? (
                                    <View style={styles.offerCard}>
                                        <Text style={styles.offerLabel}>Prix négocié proposé</Text>
                                        <Text style={styles.offerPrice}>
                                            {(pendingOffer.negotiated_price_cents / 100).toLocaleString('fr-FR')} FCFA
                                        </Text>
                                        <Text style={styles.offerSavings}>
                                            Économie : {((pendingOffer.original_price_cents - pendingOffer.negotiated_price_cents) / 100).toLocaleString('fr-FR')} FCFA
                                        </Text>
                                        <View style={styles.offerActions}>
                                            <TouchableOpacity
                                                style={[styles.button, styles.acceptButton]}
                                                onPress={handleAcceptOffer}
                                                disabled={loading}
                                            >
                                                <SafeIcon name="check" size={20} color="#FFFFFF" />
                                                <Text style={styles.buttonText}>Accepter</Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.button, styles.rejectButton]}
                                                onPress={handleRejectOffer}
                                                disabled={loading}
                                            >
                                                <SafeIcon name="x" size={20} color="#FFFFFF" />
                                                <Text style={styles.buttonText}>Rejeter</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={styles.noOfferText}>
                                        Aucune offre de prix négocié en attente
                                    </Text>
                                )}
                            </View>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modal: {
        width: '90%',
        maxWidth: 400,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    headerContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    closeButton: {
        padding: 4,
    },
    content: {
        padding: 16,
        gap: 16,
    },
    originalPriceCard: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
    },
    originalPriceLabel: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    originalPriceValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text || '#111827',
    },
    merchantSection: {
        gap: 12,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text || '#111827',
    },
    input: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 16,
    },
    hint: {
        fontSize: 12,
        color: '#6B7280',
    },
    clientSection: {
        gap: 12,
    },
    offerCard: {
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderWidth: 1,
        borderColor: '#BFDBFE',
        borderRadius: 8,
        gap: 8,
    },
    offerLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    offerPrice: {
        fontSize: 24,
        fontWeight: '700',
        color: '#2563EB',
    },
    offerSavings: {
        fontSize: 12,
        color: '#6B7280',
    },
    offerActions: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
    },
    button: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        gap: 8,
    },
    acceptButton: {
        backgroundColor: '#16A34A',
    },
    rejectButton: {
        backgroundColor: '#DC2626',
    },
    buttonDisabled: {
        opacity: 0.5,
    },
    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
    noOfferText: {
        textAlign: 'center',
        color: '#6B7280',
        fontSize: 14,
    },
});

export default NegotiatedPriceModal;

