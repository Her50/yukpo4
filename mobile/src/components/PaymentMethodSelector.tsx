// Composant pour sélectionner et valider les modes de paiement
// ✅ CORRIGÉ 2026-03-11: Numéros MTN Money et Orange Money séparés (plus de partage d'état)
// Format de sortie compatible avec backend PaymentMatchingService:
// { mtn_money: { phone, verified }, orange_money: { phone, verified }, taxId?, carte_bancaire?: {...} }
import React, { useEffect, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { formatCardNumber, validateCardExpiry, validateCardNumber, validatePhoneNumber } from '../utils/paymentValidation';
import SafeIcon from './SafeIcon';
import { NativeInput } from './SafeNativeDesign';
import { useLanguageSafe } from '../contexts/LanguageContext';

// ✅ CORRIGÉ: Interface compatible avec le backend PaymentMatchingService
export interface PaymentMethodsData {
    mtn_money?: { phone: string; verified: boolean };
    orange_money?: { phone: string; verified: boolean };
    carte_bancaire?: {
        cardNumber: string;
        cardExpiry: string;
        cardCVV: string;
        cardHolder: string;
    };
    taxId?: string;
}

interface PaymentMethodSelectorProps {
    onPaymentChange: (payment: PaymentMethodsData | null) => void;
    readonly?: boolean;
}

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ onPaymentChange, readonly = false }) => {
    // ✅ CORRIGÉ: États séparés pour chaque mode de paiement mobile money
        const { t } = useLanguageSafe();
const [mtnEnabled, setMtnEnabled] = useState(false);
    const [mtnPhoneNumber, setMtnPhoneNumber] = useState('');
    const [mtnPhoneError, setMtnPhoneError] = useState<string | null>(null);

    const [orangeEnabled, setOrangeEnabled] = useState(false);
    const [orangePhoneNumber, setOrangePhoneNumber] = useState('');
    const [orangePhoneError, setOrangePhoneError] = useState<string | null>(null);

    const [showBankCard, setShowBankCard] = useState(false);
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVV, setCardCVV] = useState('');
    const [cardHolder, setCardHolder] = useState('');
    const [cardError, setCardError] = useState<string | null>(null);
    const [expiryError, setExpiryError] = useState<string | null>(null);

    const [taxId, setTaxId] = useState('');

    // ✅ Mettre à jour le parent quand les données changent
    useEffect(() => {
        const result: PaymentMethodsData = {};
        let hasAnyMethod = false;

        // MTN Money
        if (mtnEnabled && mtnPhoneNumber.trim()) {
            const validation = validatePhoneNumber(mtnPhoneNumber);
            if (validation.valid) {
                result.mtn_money = { phone: validation.formattedNumber || mtnPhoneNumber, verified: false };
                setMtnPhoneError(null);
                hasAnyMethod = true;
            } else if (mtnPhoneNumber.length > 6) {
                setMtnPhoneError(validation.error || null);
            }
        } else {
            setMtnPhoneError(null);
        }

        // Orange Money
        if (orangeEnabled && orangePhoneNumber.trim()) {
            const validation = validatePhoneNumber(orangePhoneNumber);
            if (validation.valid) {
                result.orange_money = { phone: validation.formattedNumber || orangePhoneNumber, verified: false };
                setOrangePhoneError(null);
                hasAnyMethod = true;
            } else if (orangePhoneNumber.length > 6) {
                setOrangePhoneError(validation.error || null);
            }
        } else {
            setOrangePhoneError(null);
        }

        // Carte bancaire
        if (showBankCard && cardNumber && cardExpiry && cardCVV && cardHolder) {
            const cardValidation = validateCardNumber(cardNumber);
            const expiryValidation = validateCardExpiry(cardExpiry);
            if (cardValidation.valid && expiryValidation.valid && cardCVV.length >= 3 && cardHolder.trim().length > 0) {
                result.carte_bancaire = { cardNumber, cardExpiry, cardCVV, cardHolder };
                setCardError(null);
                setExpiryError(null);
                hasAnyMethod = true;
            } else {
                if (cardNumber.length >= 13) setCardError(cardValidation.error || null);
                if (cardExpiry.length >= 4) setExpiryError(expiryValidation.error || null);
            }
        }

        if (taxId.trim()) {
            result.taxId = taxId.trim();
        }

        onPaymentChange(hasAnyMethod ? result : null);
    }, [mtnEnabled, mtnPhoneNumber, orangeEnabled, orangePhoneNumber, showBankCard, cardNumber, cardExpiry, cardCVV, cardHolder, taxId]);

    const handleCardNumberChange = (text: string) => {
        setCardNumber(formatCardNumber(text));
    };

    const handleExpiryChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            setCardExpiry(cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4));
        } else {
            setCardExpiry(cleaned);
        }
    };

    const cleanPhone = (text: string) => text.replace(/[^\d\s]/g, '');

    return (
        <View style={styles.container}>
            <Text style={styles.title}>💳 Modes de paiement</Text>
            <Text style={styles.subtitle}>
                Renseignez vos numéros pour recevoir les paiements de vos clients. Vous pouvez activer plusieurs modes.
            </Text>

            {/* Numéro de contribuable */}
            <View style={styles.taxIdSection}>
                <View style={styles.taxIdHeader}>
                    <SafeIcon name="file-text" size={18} color={modernColors.textSecondary} />
                    <Text style={styles.taxIdTitle}>{t('paymentMethodSelector.numeroDeContribuableOptionnel')}</Text>
                </View>
                <NativeInput
                    placeholder="Ex: M012345678901C"
                    value={taxId}
                    onChangeText={setTaxId}
                    autoCapitalize="characters"
                    style={styles.input}
                    editable={!readonly}
                />
                <Text style={styles.taxIdHint}>
                    Pour les entreprises: ajoutez votre numéro de contribuable pour vos factures
                </Text>
            </View>

            {/* ✅ MTN Money - Section dédiée */}
            <View style={[styles.providerSection, mtnEnabled && styles.providerSectionActive]}>
                <View style={styles.providerHeader}>
                    <View style={styles.providerTitleRow}>
                        <Text style={styles.providerEmoji}>📱</Text>
                        <Text style={[styles.providerTitle, mtnEnabled && styles.providerTitleActive]}>MTN Mobile Money</Text>
                    </View>
                    <Switch
                        value={mtnEnabled}
                        onValueChange={setMtnEnabled}
                        trackColor={{ false: '#E5E7EB', true: '#FBBF24' }}
                        thumbColor={mtnEnabled ? '#F59E0B' : '#9CA3AF'}
                        disabled={readonly}
                    />
                </View>
                {mtnEnabled && (
                    <View style={styles.providerForm}>
                        <Text style={styles.formLabel}>{t('paymentMethodSelector.numeroMtnMoney')}</Text>
                        <Text style={styles.formHint}>
                            Votre numéro MTN pour recevoir les paiements (ex: 670 XX XX XX)
                        </Text>
                        <NativeInput
                            placeholder="6XX XX XX XX"
                            value={mtnPhoneNumber}
                            onChangeText={(text) => setMtnPhoneNumber(cleanPhone(text))}
                            keyboardType="phone-pad"
                            maxLength={15}
                            style={[styles.input, mtnPhoneError && styles.inputError]}
                            editable={!readonly}
                        />
                        {mtnPhoneError && (
                            <View style={styles.errorContainer}>
                                <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                                <Text style={styles.errorText}>{mtnPhoneError}</Text>
                            </View>
                        )}
                        {mtnPhoneNumber.length > 0 && !mtnPhoneError && (
                            <View style={styles.successContainer}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                                <Text style={styles.successText}>{t('paymentMethodSelector.numeroMtnValide')}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* ✅ Orange Money - Section dédiée */}
            <View style={[styles.providerSection, orangeEnabled && styles.providerSectionActiveOrange]}>
                <View style={styles.providerHeader}>
                    <View style={styles.providerTitleRow}>
                        <Text style={styles.providerEmoji}>📱</Text>
                        <Text style={[styles.providerTitle, orangeEnabled && styles.providerTitleActiveOrange]}>Orange Money</Text>
                    </View>
                    <Switch
                        value={orangeEnabled}
                        onValueChange={setOrangeEnabled}
                        trackColor={{ false: '#E5E7EB', true: '#FDBA74' }}
                        thumbColor={orangeEnabled ? '#F97316' : '#9CA3AF'}
                        disabled={readonly}
                    />
                </View>
                {orangeEnabled && (
                    <View style={styles.providerForm}>
                        <Text style={styles.formLabel}>{t('paymentMethodSelector.numeroOrangeMoney')}</Text>
                        <Text style={styles.formHint}>
                            Votre numéro Orange pour recevoir les paiements (ex: 690 XX XX XX)
                        </Text>
                        <NativeInput
                            placeholder="6XX XX XX XX"
                            value={orangePhoneNumber}
                            onChangeText={(text) => setOrangePhoneNumber(cleanPhone(text))}
                            keyboardType="phone-pad"
                            maxLength={15}
                            style={[styles.input, orangePhoneError && styles.inputError]}
                            editable={!readonly}
                        />
                        {orangePhoneError && (
                            <View style={styles.errorContainer}>
                                <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                                <Text style={styles.errorText}>{orangePhoneError}</Text>
                            </View>
                        )}
                        {orangePhoneNumber.length > 0 && !orangePhoneError && (
                            <View style={styles.successContainer}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                                <Text style={styles.successText}>{t('paymentMethodSelector.numeroOrangeValide')}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Carte Bancaire - Section dédiée */}
            <View style={[styles.providerSection, showBankCard && styles.providerSectionActiveCard]}>
                <View style={styles.providerHeader}>
                    <View style={styles.providerTitleRow}>
                        <Text style={styles.providerEmoji}>💳</Text>
                        <Text style={[styles.providerTitle, showBankCard && styles.providerTitleActiveCard]}>{t('paymentMethodSelector.carteBancaire')}</Text>
                    </View>
                    <Switch
                        value={showBankCard}
                        onValueChange={setShowBankCard}
                        trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                        thumbColor={showBankCard ? '#3B82F6' : '#9CA3AF'}
                        disabled={readonly}
                    />
                </View>
                {showBankCard && (
                    <View style={styles.providerForm}>
                        <View style={styles.cardPreview}>
                            <Text style={styles.cardType}>
                                {validateCardNumber(cardNumber.replace(/\s/g, '')).type || t('paymentMethodSelector.carteBancaire')}
                            </Text>
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.formLabel}>{t('paymentMethodSelector.numeroDeCarte')}</Text>
                            <NativeInput
                                placeholder="XXXX XXXX XXXX XXXX"
                                value={cardNumber}
                                onChangeText={handleCardNumberChange}
                                keyboardType="number-pad"
                                maxLength={19}
                                style={[styles.input, cardError && styles.inputError]}
                                editable={!readonly}
                            />
                            {cardError && (
                                <View style={styles.errorContainer}>
                                    <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                                    <Text style={styles.errorText}>{cardError}</Text>
                                </View>
                            )}
                        </View>
                        <View style={styles.fieldGroup}>
                            <Text style={styles.formLabel}>{t('paymentMethodSelector.nomDuTitulaire')}</Text>
                            <NativeInput
                                placeholder="JEAN DUPONT"
                                value={cardHolder}
                                onChangeText={(text) => setCardHolder(text.toUpperCase())}
                                autoCapitalize="characters"
                                style={styles.input}
                                editable={!readonly}
                            />
                        </View>
                        <View style={styles.rowFields}>
                            <View style={[styles.fieldGroup, styles.flex1]}>
                                <Text style={styles.formLabel}>Expiration</Text>
                                <NativeInput
                                    placeholder="MM/AA"
                                    value={cardExpiry}
                                    onChangeText={handleExpiryChange}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                    style={[styles.input, expiryError && styles.inputError]}
                                    editable={!readonly}
                                />
                                {expiryError && <Text style={styles.errorTextSmall}>{expiryError}</Text>}
                            </View>
                            <View style={[styles.fieldGroup, styles.flex1]}>
                                <Text style={styles.formLabel}>CVV</Text>
                                <NativeInput
                                    placeholder="XXX"
                                    value={cardCVV}
                                    onChangeText={(text) => setCardCVV(text.replace(/\D/g, ''))}
                                    keyboardType="number-pad"
                                    maxLength={4}
                                    secureTextEntry
                                    style={styles.input}
                                    editable={!readonly}
                                />
                            </View>
                        </View>
                        {cardNumber.length >= 13 && !cardError && cardExpiry.length >= 5 && !expiryError && cardCVV.length >= 3 && cardHolder.length > 0 && (
                            <View style={styles.successContainer}>
                                <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                                <Text style={styles.successText}>{t('paymentMethodSelector.informationsDeCarteValides')}</Text>
                            </View>
                        )}
                    </View>
                )}
            </View>

            {/* Message informatif */}
            {!mtnEnabled && !orangeEnabled && !showBankCard && (
                <View style={styles.hintBox}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <Text style={styles.hintText}>
                        Activez au moins un mode de paiement pour recevoir les paiements de vos clients
                    </Text>
                </View>
            )}

            {/* Sécurité */}
            {(mtnEnabled || orangeEnabled || showBankCard) && (
                <View style={styles.securityBanner}>
                    <SafeIcon name="shield" size={18} color={modernColors.success} />
                    <Text style={styles.securityText}>
                        Vos informations de paiement sont sécurisées et cryptées
                    </Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        gap: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    subtitle: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: -8,
    },
    // ✅ Sections par fournisseur
    providerSection: {
        backgroundColor: modernColors.surface,
        borderWidth: 1.5,
        borderColor: modernColors.border,
        borderRadius: 14,
        padding: 16,
        gap: 12,
    },
    providerSectionActive: {
        borderColor: '#FBBF24',
        backgroundColor: '#FFFBEB',
    },
    providerSectionActiveOrange: {
        borderColor: '#F97316',
        backgroundColor: '#FFF7ED',
    },
    providerSectionActiveCard: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    providerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    providerTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    providerEmoji: {
        fontSize: 28,
    },
    providerTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: modernColors.textSecondary,
    },
    providerTitleActive: {
        color: '#B45309',
    },
    providerTitleActiveOrange: {
        color: '#C2410C',
    },
    providerTitleActiveCard: {
        color: '#1D4ED8',
    },
    providerForm: {
        gap: 10,
        paddingTop: 4,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    formHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 2,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
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
        marginTop: 4,
    },
    errorText: {
        fontSize: 12,
        color: modernColors.error,
        flex: 1,
    },
    errorTextSmall: {
        fontSize: 11,
        color: modernColors.error,
        marginTop: 2,
    },
    successContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    successText: {
        fontSize: 13,
        color: modernColors.success,
        fontWeight: '600',
    },
    hintBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: modernColors.background,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    hintText: {
        flex: 1,
        fontSize: 13,
        color: modernColors.textSecondary,
    },
    securityBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: modernColors.success + '15',
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.success + '30',
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: modernColors.success,
        fontWeight: '500',
    },
    cardPreview: {
        backgroundColor: modernColors.primary,
        padding: 16,
        borderRadius: 12,
        marginBottom: 8,
    },
    cardType: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    fieldGroup: {
        gap: 6,
    },
    rowFields: {
        flexDirection: 'row',
        gap: 12,
    },
    flex1: {
        flex: 1,
    },
    taxIdSection: {
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: modernColors.border,
        gap: 10,
    },
    taxIdHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    taxIdTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    taxIdHint: {
        fontSize: 11,
        color: modernColors.textSecondary,
        fontStyle: 'italic',
        marginTop: 4,
    },
});

export default PaymentMethodSelector;

