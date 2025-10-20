// Composant pour sélectionner et valider les modes de paiement
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { modernColors } from '../theme/modernTheme';
import { formatCardNumber, validateCardExpiry, validateCardNumber, validatePhoneNumber } from '../utils/paymentValidation';
import { NativeInput } from './NativeDesign';
import SafeIcon from './SafeIcon';

interface PaymentMethod {
    type: 'mobile_money' | 'orange_money' | 'carte_bancaire';
    phoneNumber?: string;
    cardNumber?: string;
    cardExpiry?: string;
    cardCVV?: string;
    cardHolder?: string;
}

interface PaymentMethodSelectorProps {
    onPaymentChange: (payment: PaymentMethod | null) => void;
    readonly?: boolean;
}

// Les validations sont maintenant dans utils/paymentValidation.ts

const PaymentMethodSelector: React.FC<PaymentMethodSelectorProps> = ({ onPaymentChange, readonly = false }) => {
    const [selectedType, setSelectedType] = useState<'mobile_money' | 'orange_money' | 'carte_bancaire' | null>(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [cardNumber, setCardNumber] = useState('');
    const [cardExpiry, setCardExpiry] = useState('');
    const [cardCVV, setCardCVV] = useState('');
    const [cardHolder, setCardHolder] = useState('');

    // Validation en temps réel
    const [phoneError, setPhoneError] = useState<string | null>(null);
    const [cardError, setCardError] = useState<string | null>(null);
    const [expiryError, setExpiryError] = useState<string | null>(null);

    // Mettre à jour le parent quand les données changent
    useEffect(() => {
        if (!selectedType) {
            onPaymentChange(null);
            return;
        }

        if (selectedType === 'mobile_money' || selectedType === 'orange_money') {
            const validation = validatePhoneNumber(phoneNumber);
            if (validation.valid) {
                onPaymentChange({
                    type: selectedType,
                    phoneNumber: validation.formattedNumber || phoneNumber
                });
                setPhoneError(null);
            } else {
                onPaymentChange(null);
                if (phoneNumber.length > 6) {
                    setPhoneError(validation.error || null);
                }
            }
        } else if (selectedType === 'carte_bancaire') {
            const cardValidation = validateCardNumber(cardNumber);
            const expiryValidation = validateCardExpiry(cardExpiry);

            if (cardValidation.valid && expiryValidation.valid && cardCVV.length >= 3 && cardHolder.trim().length > 0) {
                onPaymentChange({
                    type: selectedType,
                    cardNumber,
                    cardExpiry,
                    cardCVV,
                    cardHolder
                });
                setCardError(null);
                setExpiryError(null);
            } else {
                onPaymentChange(null);
                if (cardNumber.length >= 13) setCardError(cardValidation.error || null);
                if (cardExpiry.length >= 4) setExpiryError(expiryValidation.error || null);
            }
        }
    }, [selectedType, phoneNumber, cardNumber, cardExpiry, cardCVV, cardHolder]);

    // Auto-formatage numéro de carte (espaces tous les 4 chiffres)
    const handleCardNumberChange = (text: string) => {
        setCardNumber(formatCardNumber(text));
    };

    // Auto-formatage date d'expiration (MM/YY)
    const handleExpiryChange = (text: string) => {
        const cleaned = text.replace(/\D/g, '');
        if (cleaned.length >= 2) {
            setCardExpiry(cleaned.substring(0, 2) + '/' + cleaned.substring(2, 4));
        } else {
            setCardExpiry(cleaned);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.title}>💳 Mode de paiement</Text>
            <Text style={styles.subtitle}>
                Sélectionnez votre moyen de paiement préféré pour faciliter les transactions
            </Text>

            {/* Sélection du type de paiement */}
            <View style={styles.paymentTypes}>
                <TouchableOpacity
                    style={[
                        styles.paymentTypeCard,
                        selectedType === 'mobile_money' && styles.paymentTypeCardActive
                    ]}
                    onPress={() => setSelectedType('mobile_money')}
                    disabled={readonly}
                >
                    <Text style={styles.paymentTypeIcon}>📱</Text>
                    <Text style={[
                        styles.paymentTypeText,
                        selectedType === 'mobile_money' && styles.paymentTypeTextActive
                    ]}>
                        Mobile Money
                    </Text>
                    {selectedType === 'mobile_money' && (
                        <View style={styles.checkmark}>
                            <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.paymentTypeCard,
                        selectedType === 'orange_money' && styles.paymentTypeCardActive
                    ]}
                    onPress={() => setSelectedType('orange_money')}
                    disabled={readonly}
                >
                    <Text style={styles.paymentTypeIcon}>🍊</Text>
                    <Text style={[
                        styles.paymentTypeText,
                        selectedType === 'orange_money' && styles.paymentTypeTextActive
                    ]}>
                        Orange Money
                    </Text>
                    {selectedType === 'orange_money' && (
                        <View style={styles.checkmark}>
                            <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                        </View>
                    )}
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.paymentTypeCard,
                        selectedType === 'carte_bancaire' && styles.paymentTypeCardActive
                    ]}
                    onPress={() => setSelectedType('carte_bancaire')}
                    disabled={readonly}
                >
                    <Text style={styles.paymentTypeIcon}>💳</Text>
                    <Text style={[
                        styles.paymentTypeText,
                        selectedType === 'carte_bancaire' && styles.paymentTypeTextActive
                    ]}>
                        Carte Bancaire
                    </Text>
                    {selectedType === 'carte_bancaire' && (
                        <View style={styles.checkmark}>
                            <SafeIcon name="check-circle" size={20} color={modernColors.success} />
                        </View>
                    )}
                </TouchableOpacity>
            </View>

            {/* Formulaire Mobile Money / Orange Money */}
            {(selectedType === 'mobile_money' || selectedType === 'orange_money') && (
                <View style={styles.formContainer}>
                    <Text style={styles.formLabel}>
                        Numéro de téléphone {selectedType === 'mobile_money' ? 'Mobile Money' : 'Orange Money'}
                    </Text>
                    <Text style={styles.formHint}>
                        Entrez votre numéro sans l'indicatif pays (détecté automatiquement)
                    </Text>
                    <NativeInput
                        placeholder="Ex: 6XX XX XX XX"
                        value={phoneNumber}
                        onChangeText={(text) => {
                            // Permettre uniquement les chiffres et espaces
                            const cleaned = text.replace(/[^\d\s]/g, '');
                            setPhoneNumber(cleaned);
                        }}
                        keyboardType="phone-pad"
                        maxLength={15}
                        style={[
                            styles.input,
                            phoneError && styles.inputError
                        ]}
                        editable={!readonly}
                    />
                    {phoneError && (
                        <View style={styles.errorContainer}>
                            <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                            <Text style={styles.errorText}>{phoneError}</Text>
                        </View>
                    )}
                    {phoneNumber.length > 0 && !phoneError && (
                        <View style={styles.successContainer}>
                            <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                            <Text style={styles.successText}>✓ Numéro valide</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Formulaire Carte Bancaire */}
            {selectedType === 'carte_bancaire' && (
                <View style={styles.formContainer}>
                    <View style={styles.cardPreview}>
                        <Text style={styles.cardType}>
                            {validateCardNumber(cardNumber.replace(/\s/g, '')).type || 'Carte Bancaire'}
                        </Text>
                    </View>

                    {/* Numéro de carte */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.formLabel}>Numéro de carte</Text>
                        <NativeInput
                            placeholder="XXXX XXXX XXXX XXXX"
                            value={cardNumber}
                            onChangeText={handleCardNumberChange}
                            keyboardType="number-pad"
                            maxLength={19}
                            style={[
                                styles.input,
                                cardError && styles.inputError
                            ]}
                            editable={!readonly}
                        />
                        {cardError && (
                            <View style={styles.errorContainer}>
                                <SafeIcon name="alert-circle" size={16} color={modernColors.error} />
                                <Text style={styles.errorText}>{cardError}</Text>
                            </View>
                        )}
                    </View>

                    {/* Nom du titulaire */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.formLabel}>Nom du titulaire</Text>
                        <NativeInput
                            placeholder="JEAN DUPONT"
                            value={cardHolder}
                            onChangeText={(text) => setCardHolder(text.toUpperCase())}
                            autoCapitalize="characters"
                            style={styles.input}
                            editable={!readonly}
                        />
                    </View>

                    {/* Date expiration + CVV */}
                    <View style={styles.rowFields}>
                        <View style={[styles.fieldGroup, styles.flex1]}>
                            <Text style={styles.formLabel}>Expiration</Text>
                            <NativeInput
                                placeholder="MM/AA"
                                value={cardExpiry}
                                onChangeText={handleExpiryChange}
                                keyboardType="number-pad"
                                maxLength={5}
                                style={[
                                    styles.input,
                                    expiryError && styles.inputError
                                ]}
                                editable={!readonly}
                            />
                            {expiryError && (
                                <Text style={styles.errorTextSmall}>{expiryError}</Text>
                            )}
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
                            <Text style={styles.successText}>✓ Informations de carte valides</Text>
                        </View>
                    )}
                </View>
            )}

            {/* Message informatif */}
            {!selectedType && (
                <View style={styles.hintBox}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <Text style={styles.hintText}>
                        Sélectionnez un mode de paiement pour faciliter les transactions avec vos clients
                    </Text>
                </View>
            )}

            {/* Sécurité */}
            {selectedType && (
                <View style={styles.securityBanner}>
                    <SafeIcon name="shield" size={18} color={modernColors.success} />
                    <Text style={styles.securityText}>
                        🔒 Vos informations de paiement sont sécurisées et cryptées
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
    paymentTypes: {
        flexDirection: 'row',
        gap: 12,
    },
    paymentTypeCard: {
        flex: 1,
        backgroundColor: modernColors.surface,
        borderWidth: 2,
        borderColor: modernColors.border,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        gap: 8,
        position: 'relative',
    },
    paymentTypeCardActive: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    paymentTypeIcon: {
        fontSize: 32,
    },
    paymentTypeText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
    },
    paymentTypeTextActive: {
        color: modernColors.primary,
    },
    checkmark: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    formContainer: {
        gap: 12,
        marginTop: 8,
    },
    formLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    formHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 4,
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
        marginBottom: 12,
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
});

export default PaymentMethodSelector;

