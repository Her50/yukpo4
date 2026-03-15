/**
 * Écran de paiement pour tickets de bus
 * Utilise le système de paiement existant (RechargeTokens)
 */

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { useLanguageSafe } from '../../contexts/LanguageContext';

interface BusTicketPaymentParams {
    productId: string;
    reservationIds: string[];
    ticketPrice: number;
    isRoundTrip?: boolean;
    returnDate?: string;
    returnTime?: string;
}

const BusTicketPaymentScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute();
    const { user, refreshUser } = useAuth();
    const [loading, setLoading] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<'tokens' | 'mobile_money' | null>(null);

    const params = (route.params || {}) as BusTicketPaymentParams;
    const {
        productId,
        reservationIds = [],
        ticketPrice = 0,
        isRoundTrip = false,
    } = params;

    const returnDate = (params as any).returnDate;
    const returnTime = (params as any).returnTime;
    const numberOfTickets = reservationIds.length || 1;
    const bookingFee = 500;
    const subtotal = ticketPrice * numberOfTickets;
    const totalPrice = subtotal + bookingFee;

    useEffect(() => {
        // Vérifier si l'utilisateur a assez de tokens
        if (user?.credits && user.credits >= totalPrice) {
            setPaymentMethod('tokens');
        }
    }, [user?.credits, totalPrice]);

    const handlePaymentWithTokens = async () => {
        if (!user?.credits || user.credits < totalPrice) {
            Alert.alert(
                'Solde insuffisant',
                `Vous avez ${user?.credits || 0} tokens. Vous avez besoin de ${totalPrice} tokens.`,
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: 'Recharger',
                        onPress: () => (navigation as any).navigate('RechargeTokens'),
                    },
                ]
            );
            return;
        }

        setLoading(true);
        try {
            const response = await apiPost('/api/bus-tickets/payment', {
                product_id: productId,
                reservation_ids: reservationIds,
                ticket_price: ticketPrice,
                number_of_tickets: numberOfTickets,
                booking_fee: bookingFee,
                currency: 'XAF',
                is_round_trip: isRoundTrip,
                return_date: returnDate || null,
                return_time: returnTime || null,
            });

            const resData: any = response.data || response;
            if (resData.success || resData.payment_id) {
                await refreshUser?.();
                Alert.alert(
                    'Paiement réussi',
                    `Votre ticket a été payé avec succès !\nMontant: ${(resData.total_amount || totalPrice).toLocaleString()} FCFA`,
                    [
                        {
                            text: 'Voir mon ticket',
                            onPress: () => {
                                (navigation as any).navigate('MyBusTickets');
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', resData.error || 'Le paiement a échoué');
            }
        } catch (error: any) {
            console.error('[BusTicketPayment] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    const handlePaymentWithMobileMoney = () => {
        Alert.alert(
            'Paiement Mobile Money',
            'Cette fonctionnalité sera bientôt disponible. Utilisez vos tokens pour l\'instant.',
            [{ text: 'OK' }]
        );
    };

    return (
        <SafeNativeView style={styles.container} edges={['top', 'bottom']}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-back" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Paiement</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.summaryCard}>
                    <Text style={styles.summaryTitle}>Résumé de la réservation</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Places réservées:</Text>
                        <Text style={styles.summaryValue}>{numberOfTickets}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Prix unitaire:</Text>
                        <Text style={styles.summaryValue}>
                            {ticketPrice.toLocaleString()} FCFA
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Sous-total:</Text>
                        <Text style={styles.summaryValue}>
                            {subtotal.toLocaleString()} FCFA
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Frais de réservation:</Text>
                        <Text style={styles.summaryValue}>
                            {bookingFee.toLocaleString()} FCFA
                        </Text>
                    </View>
                    {isRoundTrip && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Aller-retour:</Text>
                            <Text style={styles.summaryValue}>Oui</Text>
                        </View>
                    )}
                    <View style={[styles.summaryRow, styles.totalRow]}>
                        <Text style={styles.totalLabel}>Total:</Text>
                        <Text style={styles.totalValue}>
                            {totalPrice.toLocaleString()} FCFA
                        </Text>
                    </View>
                </View>

                <View style={styles.paymentMethodsCard}>
                    <Text style={styles.sectionTitle}>Méthode de paiement</Text>

                    {/* Paiement avec tokens */}
                    <TouchableOpacity
                        style={[
                            styles.paymentMethod,
                            paymentMethod === 'tokens' && styles.paymentMethodSelected,
                        ]}
                        onPress={() => setPaymentMethod('tokens')}
                        disabled={loading}
                    >
                        <View style={styles.paymentMethodContent}>
                            <SafeIcon
                                name="wallet"
                                size={24}
                                color={
                                    paymentMethod === 'tokens'
                                        ? modernColors.primary
                                        : modernColors.textSecondary
                                }
                            />
                            <View style={styles.paymentMethodInfo}>
                                <Text style={styles.paymentMethodName}>Tokens</Text>
                                <Text style={styles.paymentMethodBalance}>
                                    Solde: {user?.credits || 0} tokens
                                </Text>
                            </View>
                        </View>
                        {paymentMethod === 'tokens' && (
                            <SafeIcon name="checkmark-circle" size={24} color={modernColors.primary} />
                        )}
                    </TouchableOpacity>

                    {/* Paiement Mobile Money */}
                    <TouchableOpacity
                        style={[
                            styles.paymentMethod,
                            paymentMethod === 'mobile_money' && styles.paymentMethodSelected,
                        ]}
                        onPress={() => setPaymentMethod('mobile_money')}
                        disabled={loading}
                    >
                        <View style={styles.paymentMethodContent}>
                            <SafeIcon
                                name="phone-portrait"
                                size={24}
                                color={
                                    paymentMethod === 'mobile_money'
                                        ? modernColors.primary
                                        : modernColors.textSecondary
                                }
                            />
                            <View style={styles.paymentMethodInfo}>
                                <Text style={styles.paymentMethodName}>
                                    Mobile Money (MTN/Orange)
                                </Text>
                                <Text style={styles.paymentMethodBalance}>Bientôt disponible</Text>
                            </View>
                        </View>
                        {paymentMethod === 'mobile_money' && (
                            <SafeIcon name="checkmark-circle" size={24} color={modernColors.primary} />
                        )}
                    </TouchableOpacity>
                </View>

                {user?.credits && user.credits < totalPrice && paymentMethod === 'tokens' && (
                    <View style={styles.warningCard}>
                        <SafeIcon name="warning" size={20} color={modernColors.warning} />
                        <Text style={styles.warningText}>
                            Solde insuffisant. Rechargez vos tokens pour continuer.
                        </Text>
                    </View>
                )}
            </ScrollView>

            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.payButton,
                        (!paymentMethod || loading) && styles.payButtonDisabled,
                    ]}
                    onPress={
                        paymentMethod === 'tokens'
                            ? handlePaymentWithTokens
                            : handlePaymentWithMobileMoney
                    }
                    disabled={!paymentMethod || loading}
                >
                    {loading ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.payButtonText}>
                            Payer {totalPrice.toLocaleString()} FCFA
                        </Text>
                    )}
                </TouchableOpacity>
            </View>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    placeholder: {
        width: 40,
    },
    content: {
        flex: 1,
        padding: 16,
    },
    summaryCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    summaryTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
    },
    paymentMethodsCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 12,
    },
    paymentMethod: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: modernColors.border,
        marginBottom: 12,
    },
    paymentMethodSelected: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}10`,
    },
    paymentMethodContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    paymentMethodInfo: {
        marginLeft: 12,
        flex: 1,
    },
    paymentMethodName: {
        fontSize: 16,
        fontWeight: '500',
        color: modernColors.text,
        marginBottom: 4,
    },
    paymentMethodBalance: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    warningCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: `${modernColors.warning}20`,
        padding: 12,
        borderRadius: 8,
        marginBottom: 16,
    },
    warningText: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: modernColors.warning,
    },
    footer: {
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        backgroundColor: modernColors.surface,
    },
    payButton: {
        backgroundColor: modernColors.primary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payButtonDisabled: {
        backgroundColor: modernColors.textSecondary,
        opacity: 0.5,
    },
    payButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default BusTicketPaymentScreen;

