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
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';

interface NegotiatedPriceModalProps {
    visible: boolean;
    onClose: () => void;
    conversationId: number | string; // ✅ CORRIGÉ: Peut être un nombre ou une string (UUID pour conversations privées)
    serviceId: number;
    productIndex?: number;
    originalPrice: number; // Prix en FCFA
    merchantUserId: number;
    clientUserId: number;
    onPriceNegotiated?: () => void;
}

interface NegotiatedPriceOffer {
    id: number;
    conversation_id: string | number; // ✅ CORRIGÉ: Peut être string (UUID) ou number
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

    // ✅ CORRIGÉ : Récupérer l'utilisateur actuel depuis le contexte d'authentification
    const { user: currentUser } = useAuth();

    // ✅ CORRIGÉ : Vérifier si l'utilisateur actuel est le prestataire (merchant) ou le client
    useEffect(() => {
        const currentUserId = currentUser?.id || currentUser?.user_id || 0;
        // L'utilisateur est le prestataire si son ID correspond au merchantUserId
        // Sinon, c'est le client qui peut proposer un prix
        const userIsMerchant = currentUserId === merchantUserId && merchantUserId > 0;
        setIsMerchant(userIsMerchant);
        console.log('[NegotiatedPriceModal] User role:', {
            currentUserId,
            merchantUserId,
            clientUserId,
            isMerchant: userIsMerchant
        });
    }, [merchantUserId, clientUserId, currentUser]);

    // ✅ CORRIGÉ : Charger l'offre en attente (pour client et prestataire)
    useEffect(() => {
        if (visible) {
            loadPendingOffer();
        }
    }, [visible, conversationId, serviceId, productIndex]);

    const loadPendingOffer = async () => {
        setLoadingOffer(true);
        try {
            // ✅ CORRIGÉ : Convertir conversationId en string pour l'API
            const conversationIdStr = String(conversationId);
            // ✅ CORRIGÉ : Charger les offres en attente pour cette conversation/produit
            const response = await apiGet(
                `/api/negotiated-prices/pending?conversation_id=${encodeURIComponent(conversationIdStr)}&service_id=${serviceId}${productIndex !== undefined ? `&product_index=${productIndex}` : ''}`
            );
            if (response.success && response.data) {
                // Si plusieurs offres, prendre la plus récente
                const offers = Array.isArray(response.data) ? response.data : [response.data];
                const latestOffer = offers.length > 0 ? offers[0] : null;
                setPendingOffer(latestOffer);
            } else {
                setPendingOffer(null);
            }
        } catch (error) {
            console.error('[NegotiatedPriceModal] Erreur chargement offre:', error);
            setPendingOffer(null);
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
            // ✅ CORRIGÉ : Convertir conversationId en string pour l'API
            const conversationIdStr = String(conversationId);
            const response = await apiPost('/api/negotiated-prices', {
                conversation_id: conversationIdStr,
                service_id: serviceId,
                product_index: productIndex,
                merchant_user_id: merchantUserId,
                client_user_id: clientUserId,
                original_price_cents: Math.round(originalPrice * 100),
                negotiated_price_cents: Math.round(price * 100),
                expires_in_hours: 24,
            });

            if (response.success) {
                Alert.alert(
                    'Proposition envoyée',
                    'Votre proposition de prix a été envoyée au prestataire. Vous serez notifié de sa réponse.',
                    [{
                        text: 'OK', onPress: () => {
                            setNegotiatedPrice('');
                            loadPendingOffer(); // Recharger pour afficher la proposition en attente
                            onPriceNegotiated?.();
                        }
                    }]
                );
                // Ne pas fermer le modal pour que le client puisse voir sa proposition en attente
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de l\'envoi de la proposition');
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
                Alert.alert(
                    'Prix négocié accepté',
                    'Le prix négocié a été accepté et sera utilisé pour les prochaines commandes.',
                    [{
                        text: 'OK', onPress: () => {
                            setPendingOffer(null);
                            onPriceNegotiated?.();
                            onClose();
                        }
                    }]
                );
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
                                {isMerchant ? 'Proposition de prix négocié' : 'Proposer un prix négocié'}
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

                        {/* ✅ CORRIGÉ : Interface CLIENT - Proposer un prix négocié */}
                        {!isMerchant && (
                            <View style={styles.clientProposalSection}>
                                {pendingOffer ? (
                                    // ✅ Afficher l'offre en attente si elle existe
                                    <View style={styles.pendingOfferCard}>
                                        <View style={styles.pendingOfferHeader}>
                                            <SafeIcon name="clock" size={20} color={modernColors.warning} />
                                            <Text style={styles.pendingOfferTitle}>Proposition en attente</Text>
                                        </View>
                                        <View style={styles.pendingOfferContent}>
                                            <Text style={styles.pendingOfferLabel}>Votre prix proposé</Text>
                                            <Text style={styles.pendingOfferPrice}>
                                                {(pendingOffer.negotiated_price_cents / 100).toLocaleString('fr-FR')} FCFA
                                            </Text>
                                            <Text style={styles.pendingOfferStatus}>
                                                En attente de réponse du prestataire
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            style={[styles.button, styles.cancelOfferButton]}
                                            onPress={async () => {
                                                if (!pendingOffer) return;
                                                Alert.alert(
                                                    'Annuler la proposition',
                                                    'Voulez-vous annuler cette proposition de prix ?',
                                                    [
                                                        { text: 'Non', style: 'cancel' },
                                                        {
                                                            text: 'Oui, annuler',
                                                            style: 'destructive',
                                                            onPress: async () => {
                                                                try {
                                                                    await apiPost(`/api/negotiated-prices/${pendingOffer.id}/cancel`, {});
                                                                    setPendingOffer(null);
                                                                    Alert.alert('Succès', 'Proposition annulée');
                                                                } catch (error) {
                                                                    console.error('Erreur annulation:', error);
                                                                    Alert.alert('Erreur', 'Impossible d\'annuler la proposition');
                                                                }
                                                            }
                                                        }
                                                    ]
                                                );
                                            }}
                                        >
                                            <SafeIcon name="x" size={18} color="#FFFFFF" />
                                            <Text style={styles.buttonText}>Annuler la proposition</Text>
                                        </TouchableOpacity>
                                    </View>
                                ) : (
                                    // ✅ Formulaire pour proposer un nouveau prix
                                    <View style={styles.merchantSection}>
                                        <Text style={styles.label}>Prix négocié proposé (FCFA) *</Text>
                                        <TextInput
                                            style={styles.input}
                                            value={negotiatedPrice}
                                            onChangeText={setNegotiatedPrice}
                                            placeholder="Ex: 15000"
                                            keyboardType="numeric"
                                        />
                                        <Text style={styles.hint}>
                                            Le prix doit être inférieur au prix original ({originalPrice.toLocaleString('fr-FR')} FCFA)
                                        </Text>

                                        {/* ✅ Calcul automatique de l'économie */}
                                        {negotiatedPrice && !isNaN(parseFloat(negotiatedPrice)) && parseFloat(negotiatedPrice) < originalPrice && (
                                            <View style={styles.savingsPreview}>
                                                <SafeIcon name="trending-down" size={16} color={modernColors.success} />
                                                <Text style={styles.savingsText}>
                                                    Économie : {(originalPrice - parseFloat(negotiatedPrice)).toLocaleString('fr-FR')} FCFA
                                                </Text>
                                            </View>
                                        )}

                                        <TouchableOpacity
                                            style={[styles.button, styles.submitButton, (loading || !negotiatedPrice || parseFloat(negotiatedPrice) >= originalPrice) && styles.buttonDisabled]}
                                            onPress={handleCreateOffer}
                                            disabled={loading || !negotiatedPrice || parseFloat(negotiatedPrice) >= originalPrice}
                                        >
                                            {loading ? (
                                                <ActivityIndicator color="#FFFFFF" />
                                            ) : (
                                                <>
                                                    <SafeIcon name="send" size={18} color="#FFFFFF" />
                                                    <Text style={styles.buttonText}>Envoyer la proposition</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        )}

                        {/* ✅ CORRIGÉ : Interface PRESTATAIRE - Voir et valider les propositions du client */}
                        {isMerchant && (
                            <View style={styles.merchantSection}>
                                {loadingOffer ? (
                                    <View style={styles.loadingContainer}>
                                        <ActivityIndicator size="large" color={modernColors.primary} />
                                        <Text style={styles.loadingText}>Chargement des propositions...</Text>
                                    </View>
                                ) : pendingOffer ? (
                                    <View style={styles.offerCard}>
                                        <View style={styles.offerHeader}>
                                            <SafeIcon name="dollar-sign" size={24} color={modernColors.primary} />
                                            <Text style={styles.offerTitle}>Proposition du client</Text>
                                        </View>

                                        <View style={styles.priceComparison}>
                                            <View style={styles.priceRow}>
                                                <Text style={styles.priceLabel}>Prix original</Text>
                                                <Text style={styles.originalPriceDisplay}>
                                                    {(pendingOffer.original_price_cents / 100).toLocaleString('fr-FR')} FCFA
                                                </Text>
                                            </View>
                                            <View style={styles.priceRow}>
                                                <Text style={styles.priceLabel}>Prix proposé</Text>
                                                <Text style={styles.negotiatedPriceDisplay}>
                                                    {(pendingOffer.negotiated_price_cents / 100).toLocaleString('fr-FR')} FCFA
                                                </Text>
                                            </View>
                                            <View style={styles.priceRow}>
                                                <Text style={styles.priceLabel}>Réduction</Text>
                                                <Text style={styles.discountDisplay}>
                                                    - {((pendingOffer.original_price_cents - pendingOffer.negotiated_price_cents) / 100).toLocaleString('fr-FR')} FCFA
                                                </Text>
                                            </View>
                                        </View>

                                        {pendingOffer.expires_at && (
                                            <View style={styles.expiryInfo}>
                                                <SafeIcon name="clock" size={14} color={modernColors.warning} />
                                                <Text style={styles.expiryText}>
                                                    Expire le {new Date(pendingOffer.expires_at).toLocaleDateString('fr-FR')}
                                                </Text>
                                            </View>
                                        )}

                                        <View style={styles.offerActions}>
                                            <TouchableOpacity
                                                style={[styles.button, styles.acceptButton, loading && styles.buttonDisabled]}
                                                onPress={handleAcceptOffer}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#FFFFFF" />
                                                ) : (
                                                    <>
                                                        <SafeIcon name="check" size={20} color="#FFFFFF" />
                                                        <Text style={styles.buttonText}>Accepter</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.button, styles.rejectButton, loading && styles.buttonDisabled]}
                                                onPress={handleRejectOffer}
                                                disabled={loading}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#FFFFFF" />
                                                ) : (
                                                    <>
                                                        <SafeIcon name="x" size={20} color="#FFFFFF" />
                                                        <Text style={styles.buttonText}>Refuser</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={styles.offerHint}>
                                            En acceptant, ce prix sera utilisé pour les prochaines commandes de ce produit.
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={styles.noOfferContainer}>
                                        <SafeIcon name="dollar-sign" size={48} color="#D1D5DB" />
                                        <Text style={styles.noOfferText}>
                                            Aucune proposition de prix en attente
                                        </Text>
                                        <Text style={styles.noOfferSubtext}>
                                            Le client peut proposer un prix négocié depuis le chat
                                        </Text>
                                    </View>
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
        fontSize: 16,
        fontWeight: '600',
        marginTop: 12,
    },
    noOfferSubtext: {
        textAlign: 'center',
        color: '#9CA3AF',
        fontSize: 13,
        marginTop: 4,
    },
    noOfferContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
    },
    loadingContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 32,
        gap: 12,
    },
    loadingText: {
        fontSize: 14,
        color: '#6B7280',
    },
    pendingOfferCard: {
        padding: 16,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FCD34D',
        borderRadius: 12,
        gap: 12,
    },
    pendingOfferHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    pendingOfferTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#92400E',
    },
    pendingOfferContent: {
        gap: 4,
    },
    pendingOfferLabel: {
        fontSize: 13,
        color: '#78350F',
    },
    pendingOfferPrice: {
        fontSize: 22,
        fontWeight: '700',
        color: '#B45309',
    },
    pendingOfferStatus: {
        fontSize: 12,
        color: '#92400E',
        fontStyle: 'italic',
    },
    cancelOfferButton: {
        backgroundColor: '#DC2626',
        marginTop: 8,
    },
    savingsPreview: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        backgroundColor: '#D1FAE5',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#10B981',
    },
    savingsText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#065F46',
    },
    submitButton: {
        backgroundColor: modernColors.primary,
        marginTop: 8,
    },
    offerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    offerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text || '#111827',
    },
    priceComparison: {
        gap: 12,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 12,
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
        fontWeight: '500',
    },
    originalPriceDisplay: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B7280',
        textDecorationLine: 'line-through',
    },
    negotiatedPriceDisplay: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    discountDisplay: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.success,
    },
    expiryInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 8,
        backgroundColor: '#FEF3C7',
        borderRadius: 6,
        marginBottom: 12,
    },
    expiryText: {
        fontSize: 12,
        color: '#92400E',
    },
    offerHint: {
        fontSize: 12,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
        fontStyle: 'italic',
    },
});

export default NegotiatedPriceModal;

