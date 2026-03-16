// Modal pour effectuer un paiement en ligne vers un prestataire
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import { hapticError, hapticPaymentSuccess } from '../utils/hapticFeedback';
import { formatCardNumber, validateCardExpiry, validateCardNumber, validatePhoneNumber } from '../utils/paymentValidation';
import AlerteSecurite from './AlerteSecurite';
import SafeIcon from './SafeIcon';
import { NativeInput } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

interface PaiementEnLigneModalProps {
    visible: boolean;
    onClose: () => void;
    service: any;
    product?: any;
    prestataire: any;
    montant?: number;
    devise?: string;
}

const PaiementEnLigneModal: React.FC<PaiementEnLigneModalProps> = ({
    visible,
    onClose,
    service,
    product,
    prestataire,
    montant,
    devise = 'XAF'
}) => {
        const { t } = useLanguageSafe();
const [step, setStep] = useState<'alerte' | 'montant' | 'methode' | 'confirmation'>('alerte');
    const [paymentAmount, setPaymentAmount] = useState(montant?.toString() || '');
    const [prestatairePaymentMethod, setPrestatairePaymentMethod] = useState<any>(null);
    const [loading, setLoading] = useState(false);

    // États selon le mode de paiement du prestataire
    const [phoneNumber, setPhoneNumber] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVV, setCardCVV] = useState('');
    const [cardHolder, setCardHolder] = useState('');

    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [showAlerteAcceptee, setShowAlerteAcceptee] = useState(false);

    // Charger le mode de paiement du prestataire
    useEffect(() => {
        if (visible && service?.data?.mode_paiement) {
            const modePaiement = service.data.mode_paiement.valeur || service.data.mode_paiement;
            setPrestatairePaymentMethod(modePaiement);
        }
    }, [visible, service]);

    const handlePay = async () => {
        // Validation finale
        if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
            hapticError(); // ✅ Haptic feedback pour erreur critique
            Alert.alert('Erreur', 'Montant invalide');
            return;
        }

        if (!prestatairePaymentMethod) {
            hapticError(); // ✅ Haptic feedback pour erreur critique
            Alert.alert('Erreur', 'Le prestataire n\'a pas configuré de mode de paiement');
            return;
        }

        // Validation selon le type de paiement
        if (prestatairePaymentMethod.type === 'mobile_money' || prestatairePaymentMethod.type === 'orange_money') {
            const validation = validatePhoneNumber(phoneNumber);
            if (!validation.valid) {
                hapticError(); // ✅ Haptic feedback pour erreur critique
                Alert.alert('Erreur', validation.error || 'Numéro invalide');
                return;
            }
        } else if (prestatairePaymentMethod.type === 'carte_bancaire') {
            const cardValidation = validateCardNumber(cardNumber);
            const expiryValidation = validateCardExpiry(cardExpiry);

            if (!cardValidation.valid) {
                hapticError(); // ✅ Haptic feedback pour erreur critique
                Alert.alert('Erreur', cardValidation.error || 'Carte invalide');
                return;
            }
            if (!expiryValidation.valid) {
                hapticError(); // ✅ Haptic feedback pour erreur critique
                Alert.alert('Erreur', expiryValidation.error || 'Date expirée');
                return;
            }
            if (cardCVV.length < 3 || !cardHolder.trim()) {
                hapticError(); // ✅ Haptic feedback pour erreur critique
                Alert.alert('Erreur', 'Informations de carte incomplètes');
                return;
            }
        }

        setLoading(true);
        try {
            const response = await apiPost('/api/payments/transfer', {
                service_id: service.id,
                product_id: product?.id,
                amount: parseFloat(paymentAmount),
                currency: devise,
                recipient_user_id: prestataire.userId || service.user_id,
                recipient_payment_method: prestatairePaymentMethod,
                sender_payment: {
                    type: prestatairePaymentMethod.type,
                    phoneNumber,
                    cardNumber, cardExpiry, cardCVV, cardHolder
                }
            });

            if (response.success) {
                hapticPaymentSuccess(); // ✅ Haptic feedback pour paiement réussi
                Alert.alert(
                    t('paiementEnLigneModal.paiementInitie'),
                    `Transaction ID: ${(response.data as any).transaction_id}\n\nLe paiement est en cours de traitement. Vous recevrez une notification de confirmation.`,
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                resetForm();
                                onClose();
                            }
                        }
                    ]
                );
            } else {
                throw new Error(response.error || 'Erreur paiement');
            }
        } catch (error: any) {
            console.error('[PaiementEnLigneModal] Erreur:', error);
            hapticError(); // ✅ Haptic feedback pour erreur de paiement
            Alert.alert('Erreur', error.message || 'Le paiement a échoué');
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setStep('alerte');
        setPaymentAmount('');
        setPhoneNumber('');
        setCardNumber('');
        setCardExpiry('');
        setCardCVV('');
        setCardHolder('');
        setShowAlerteAcceptee(false);
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.headerIcon}>
                            <SafeIcon name="credit-card" size={24} color={modernColors.primary} />
                        </View>
                        <View style={styles.headerTextContainer}>
                            <Text style={styles.headerTitle}>Paiement en ligne</Text>
                            <Text style={styles.headerSubtitle}>
                                {product ? product.nom : service.data?.titre_service?.valeur || 'Service'}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={() => { resetForm(); onClose(); }} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                        {/* Étape 1: Alerte sécurité */}
                        {step === 'alerte' && (
                            <View style={styles.stepContainer}>
                                <AlerteSecurite variant="warning" showDetails={true} />

                                <View style={styles.actionButtons}>
                                    <TouchableOpacity
                                        style={styles.acceptButton}
                                        onPress={() => {
                                            setShowAlerteAcceptee(true);
                                            setStep('montant');
                                        }}
                                    >
                                        <SafeIcon name="check" size={20} color="#FFFFFF" />
                                        <Text style={styles.acceptButtonText}>J'ai compris, continuer</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Étape 2: Montant */}
                        {step === 'montant' && (
                            <View style={styles.stepContainer}>
                                <Text style={styles.stepTitle}>{t('paiementEnLigne.montantAPayer')}</Text>
                                <View style={styles.montantContainer}>
                                    <NativeInput
                                        placeholder="Ex: 5000"
                                        value={paymentAmount}
                                        onChangeText={setPaymentAmount}
                                        keyboardType="numeric"
                                        style={styles.montantInput}
                                    />
                                    <View style={styles.deviseTag}>
                                        <Text style={styles.deviseText}>{devise}</Text>
                                    </View>
                                </View>

                                <View style={styles.infoBox}>
                                    <SafeIcon name="info" size={16} color={modernColors.primary} />
                                    <Text style={styles.infoText}>
                                        Recommandation : Ne payez qu'un acompte (30-50%) et le solde à la livraison
                                    </Text>
                                </View>

                                <TouchableOpacity
                                    style={[styles.nextButton, (!paymentAmount || parseFloat(paymentAmount) <= 0) && styles.nextButtonDisabled]}
                                    onPress={() => setStep('methode')}
                                    disabled={!paymentAmount || parseFloat(paymentAmount) <= 0}
                                >
                                    <Text style={styles.nextButtonText}>Continuer</Text>
                                    <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* Étape 3: Méthode de paiement (selon le prestataire) */}
                        {step === 'methode' && prestatairePaymentMethod && (
                            <View style={styles.stepContainer}>
                                <Text style={styles.stepTitle}>{t('paiementEnLigne.modeDePaiementDuPrestataire')}</Text>

                                <View style={styles.prestataireMethodInfo}>
                                    <Text style={styles.prestataireMethodLabel}>
                                        {prestatairePaymentMethod.type === 'mobile_money' ? '📱 Mobile Money' :
                                            prestatairePaymentMethod.type === 'orange_money' ? '🍊 Orange Money' :
                                                '💳 Carte Bancaire'}
                                    </Text>
                                    {prestatairePaymentMethod.phoneNumber && (
                                        <Text style={styles.prestataireMethodValue}>
                                            Numéro: {prestatairePaymentMethod.phoneNumber}
                                        </Text>
                                    )}
                                </View>

                                <Text style={styles.yourPaymentTitle}>{t('paiementEnLigne.vosInformationsDePaiement')}</Text>

                                {/* Formulaire Mobile Money / Orange Money */}
                                {(prestatairePaymentMethod.type === 'mobile_money' || prestatairePaymentMethod.type === 'orange_money') && (
                                    <View>
                                        <Text style={styles.fieldLabel}>{t('paiementEnLigne.votreNumeroDeTelephone')}</Text>
                                        <NativeInput
                                            placeholder="Ex: 6XX XX XX XX"
                                            value={phoneNumber}
                                            onChangeText={setPhoneNumber}
                                            keyboardType="phone-pad"
                                            maxLength={15}
                                            style={[styles.input, phoneError && styles.inputError]}
                                        />
                                        {phoneError && (
                                            <View style={styles.errorContainer}>
                                                <SafeIcon name="alert-circle" size={14} color={modernColors.error} />
                                                <Text style={styles.errorText}>{phoneError}</Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Formulaire Carte Bancaire */}
                                {prestatairePaymentMethod.type === 'carte_bancaire' && (
                                    <View style={styles.cardForm}>
                                        <View style={styles.fieldGroup}>
                                            <Text style={styles.fieldLabel}>{t('paiementEnLigne.numeroDeCarte')}</Text>
                                            <NativeInput
                                                placeholder="XXXX XXXX XXXX XXXX"
                                                value={cardNumber}
                                                onChangeText={(text) => setCardNumber(formatCardNumber(text))}
                                                keyboardType="number-pad"
                                                maxLength={19}
                                                style={styles.input}
                                            />
                                        </View>

                                        <View style={styles.fieldGroup}>
                                            <Text style={styles.fieldLabel}>{t('paiementEnLigne.nomDuTitulaire')}</Text>
                                            <NativeInput
                                                placeholder="JEAN DUPONT"
                                                value={cardHolder}
                                                onChangeText={(text) => setCardHolder(text.toUpperCase())}
                                                autoCapitalize="characters"
                                                style={styles.input}
                                            />
                                        </View>

                                        <View style={styles.rowFields}>
                                            <View style={styles.fieldGroupHalf}>
                                                <Text style={styles.fieldLabel}>Expiration</Text>
                                                <NativeInput
                                                    placeholder="MM/AA"
                                                    value={cardExpiry}
                                                    onChangeText={(text) => {
                                                        const cleaned = text.replace(/\D/g, '');
                                                        if (cleaned.length >= 2) {
                                                            setCardExpiry(cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4));
                                                        } else {
                                                            setCardExpiry(cleaned);
                                                        }
                                                    }}
                                                    keyboardType="number-pad"
                                                    maxLength={5}
                                                    style={styles.input}
                                                />
                                            </View>

                                            <View style={styles.fieldGroupHalf}>
                                                <Text style={styles.fieldLabel}>CVV</Text>
                                                <NativeInput
                                                    placeholder="XXX"
                                                    value={cardCVV}
                                                    onChangeText={(text) => setCardCVV(text.replace(/\D/g, ''))}
                                                    keyboardType="number-pad"
                                                    maxLength={4}
                                                    secureTextEntry
                                                    style={styles.input}
                                                />
                                            </View>
                                        </View>
                                    </View>
                                )}

                                <View style={styles.navigationButtons}>
                                    <TouchableOpacity
                                        style={styles.backButton}
                                        onPress={() => setStep('montant')}
                                    >
                                        <SafeIcon name="chevron-left" size={20} color={modernColors.text} />
                                        <Text style={styles.backButtonText}>{t('paiementEnLigne.retour')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={styles.nextButton}
                                        onPress={() => setStep('confirmation')}
                                    >
                                        <Text style={styles.nextButtonText}>Continuer</Text>
                                        <SafeIcon name="chevron-right" size={20} color="#FFFFFF" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Étape 4: Confirmation */}
                        {step === 'confirmation' && (
                            <View style={styles.stepContainer}>
                                <Text style={styles.stepTitle}>✅ Confirmation du paiement</Text>

                                <View style={styles.confirmCard}>
                                    <View style={styles.confirmRow}>
                                        <Text style={styles.confirmLabel}>{t('paiementEnLigne.montant')}</Text>
                                        <Text style={styles.confirmValue}>{paymentAmount} {devise}</Text>
                                    </View>
                                    <View style={styles.confirmRow}>
                                        <Text style={styles.confirmLabel}>{t('paiementEnLigne.beneficiaire')}</Text>
                                        <Text style={styles.confirmValue}>{prestataire?.nom_complet || 'Prestataire'}</Text>
                                    </View>
                                    <View style={styles.confirmRow}>
                                        <Text style={styles.confirmLabel}>{t('paiementEnLigne.service')}</Text>
                                        <Text style={styles.confirmValue} numberOfLines={2}>
                                            {product ? product.nom : service.data?.titre_service?.valeur || 'Service'}
                                        </Text>
                                    </View>
                                    <View style={styles.confirmRow}>
                                        <Text style={styles.confirmLabel}>{t('paiementEnLigne.methode')}</Text>
                                        <Text style={styles.confirmValue}>
                                            {prestatairePaymentMethod.type === 'mobile_money' ? 'Mobile Money' :
                                                prestatairePaymentMethod.type === 'orange_money' ? 'Orange Money' :
                                                    'Carte Bancaire'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.warningFinal}>
                                    <SafeIcon name="alert-triangle" size={18} color="#F59E0B" />
                                    <Text style={styles.warningFinalText}>
                                        ⚠️ Cette action est irréversible. Assurez-vous d'avoir vérifié le prestataire.
                                    </Text>
                                </View>

                                <View style={styles.navigationButtons}>
                                    <TouchableOpacity
                                        style={styles.backButton}
                                        onPress={() => setStep('methode')}
                                        disabled={loading}
                                    >
                                        <SafeIcon name="chevron-left" size={20} color={modernColors.text} />
                                        <Text style={styles.backButtonText}>{t('paiementEnLigne.retour')}</Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[styles.payButton, loading && styles.payButtonDisabled]}
                                        onPress={handlePay}
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <ActivityIndicator size="small" color="#FFFFFF" />
                                        ) : (
                                            <>
                                                <SafeIcon name="check-circle" size={20} color="#FFFFFF" />
                                                <Text style={styles.payButtonText}>{t('paiementEnLigneModal.confirmerLePaiement')}</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '95%',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary + '20',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTextContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    headerSubtitle: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginTop: 2,
    },
    closeButton: {
        padding: 4,
    },
    content: {
        flex: 1,
    },
    stepContainer: {
        padding: 20,
    },
    stepTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 16,
    },
    actionButtons: {
        gap: 12,
        marginTop: 20,
    },
    acceptButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.success,
        paddingVertical: 16,
        borderRadius: 12,
    },
    acceptButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    montantContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    montantInput: {
        flex: 1,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 12,
        padding: 16,
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.text,
        backgroundColor: modernColors.surface,
        textAlign: 'center',
    },
    deviseTag: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
    },
    deviseText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: modernColors.background,
        padding: 12,
        borderRadius: 8,
        marginTop: 16,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.text,
        lineHeight: 18,
    },
    prestataireMethodInfo: {
        backgroundColor: modernColors.background,
        padding: 16,
        borderRadius: 12,
        marginBottom: 16,
    },
    prestataireMethodLabel: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        marginBottom: 4,
    },
    prestataireMethodValue: {
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    yourPaymentTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 6,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 15,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    inputError: {
        borderColor: modernColors.error,
        backgroundColor: modernColors.error + '10',
    },
    errorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6,
    },
    errorText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.error,
    },
    cardForm: {
        gap: 16,
    },
    fieldGroup: {
        gap: 6,
    },
    rowFields: {
        flexDirection: 'row',
        gap: 12,
    },
    fieldGroupHalf: {
        flex: 1,
        gap: 6,
    },
    confirmCard: {
        backgroundColor: modernColors.background,
        padding: 16,
        borderRadius: 12,
        gap: 12,
    },
    confirmRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    confirmLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    confirmValue: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.text,
        textAlign: 'right',
        flex: 1,
        marginLeft: 12,
    },
    warningFinal: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#FFFBEB',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#FCD34D',
        marginTop: 16,
    },
    warningFinalText: {
        flex: 1,
        fontSize: 13,
        color: '#92400E',
        fontWeight: '600',
        lineHeight: 18,
    },
    navigationButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 20,
    },
    backButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.background,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    backButtonText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
    },
    nextButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        borderRadius: 12,
    },
    nextButtonDisabled: {
        opacity: 0.5,
    },
    nextButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    payButton: {
        flex: 2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: modernColors.success,
        paddingVertical: 14,
        borderRadius: 12,
    },
    payButtonDisabled: {
        opacity: 0.5,
    },
    payButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default PaiementEnLigneModal;

