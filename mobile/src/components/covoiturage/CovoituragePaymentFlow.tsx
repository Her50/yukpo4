// ✅ Phase 1.1: Flow de paiement intégré pour covoiturage
import { useNavigation } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletBalance } from '../../hooks/useWalletBalance';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../SafeIcon';
import { NativeButton, NativeCard } from '../SafeNativeDesign';

interface CovoituragePaymentFlowProps {
    total: number;
    devise: string;
    covoiturageId: number;
    numberOfPlaces: number;
    onPaymentSuccess: (paymentData: { paymentId: string; method: string }) => void;
    onCancel: () => void;
}

type PaymentMethod = 'wallet' | 'stripe' | 'paypal';

const CovoituragePaymentFlow: React.FC<CovoituragePaymentFlowProps> = ({
    total,
    devise,
    covoiturageId,
    numberOfPlaces,
    onPaymentSuccess,
    onCancel
}) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { walletBalance, refresh: refreshBalance } = useWalletBalance();
    const balance = walletBalance?.balance || 0;
    const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('wallet');
    const [processing, setProcessing] = useState(false);

    const handlePayment = async () => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté pour payer');
            return;
        }

        try {
            setProcessing(true);

            if (selectedMethod === 'wallet') {
                // Paiement via wallet Yukpo
                if (balance < total) {
                    Alert.alert(
                        'Solde insuffisant',
                        `Votre solde (${balance.toLocaleString('fr-FR')} ${devise}) est insuffisant. Veuillez recharger.`,
                        [
                            { text: 'Annuler', style: 'cancel' },
                            {
                                text: 'Recharger',
                                onPress: () => {
                                    navigation.navigate('RechargeTokens' as never);
                                }
                            }
                        ]
                    );
                    setProcessing(false);
                    return;
                }

                // Créer d'abord la réservation (sans paiement)
                const reservationResponse = await apiPost(`/api/covoiturages/${covoiturageId}/book`, {
                    number_of_places: numberOfPlaces,
                    passenger_names: [],
                    notes: undefined
                });

                if (!reservationResponse.success || !reservationResponse.data) {
                    Alert.alert('Erreur', reservationResponse.error || 'Impossible de créer la réservation');
                    setProcessing(false);
                    return;
                }

                const rrd: any = reservationResponse.data;
                const reservationId = rrd.reservation_id || rrd.reservation?.id;

                if (!reservationId) {
                    Alert.alert('Erreur', 'Réservation créée mais ID manquant');
                    setProcessing(false);
                    return;
                }

                // Puis traiter le paiement via l'endpoint spécialisé
                const response = await apiPost(`/api/specialized-services/reservations/${reservationId}/payment`, {
                    reservation_id: reservationId,
                    amount: total,
                    currency: devise,
                    payment_method: {
                        type: 'wallet',
                        wallet_id: user.id
                    },
                    description: `Paiement covoiturage - ${numberOfPlaces} place(s)`
                });

                const prd: any = response.data;
                if (response.success && prd) {
                    await refreshBalance();
                    onPaymentSuccess({
                        paymentId: prd.transaction_id || reservationId.toString(),
                        method: 'wallet',
                        reservationId: reservationId
                    } as any);
                } else {
                    Alert.alert('Erreur', response.error || 'Paiement échoué');
                }
            } else if (selectedMethod === 'stripe') {
                // Paiement via Stripe (à implémenter avec SDK Stripe)
                Alert.alert(
                    'Stripe',
                    'Intégration Stripe en cours de développement',
                    [{ text: 'OK' }]
                );
                // TODO: Implémenter Stripe SDK
            } else if (selectedMethod === 'paypal') {
                // Paiement via PayPal (à implémenter avec SDK PayPal)
                Alert.alert(
                    'PayPal',
                    'Intégration PayPal en cours de développement',
                    [{ text: 'OK' }]
                );
                // TODO: Implémenter PayPal SDK
            }
        } catch (error: any) {
            console.error('[CovoituragePaymentFlow] Erreur paiement:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue lors du paiement');
        } finally {
            setProcessing(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={onCancel} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Paiement</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Récapitulatif */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Récapitulatif</Text>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Total à payer:</Text>
                        <Text style={styles.summaryValue}>
                            {total.toLocaleString('fr-FR')} {devise}
                        </Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Places:</Text>
                        <Text style={styles.summaryValue}>{numberOfPlaces}</Text>
                    </View>
                </NativeCard>

                {/* Méthodes de paiement */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Méthode de paiement</Text>

                    {/* Wallet Yukpo */}
                    <TouchableOpacity
                        style={[
                            styles.paymentMethod,
                            selectedMethod === 'wallet' && styles.paymentMethodSelected
                        ]}
                        onPress={() => setSelectedMethod('wallet')}
                        disabled={processing}
                    >
                        <View style={styles.paymentMethodContent}>
                            <View style={styles.paymentMethodIcon}>
                                <SafeIcon name="wallet" size={24} color={modernColors.primary} />
                            </View>
                            <View style={styles.paymentMethodInfo}>
                                <Text style={styles.paymentMethodName}>Wallet Yukpo</Text>
                                <Text style={styles.paymentMethodBalance}>
                                    Solde: {balance.toLocaleString('fr-FR')} {devise}
                                </Text>
                            </View>
                            {selectedMethod === 'wallet' && (
                                <SafeIcon name="check-circle" size={24} color={modernColors.primary} />
                            )}
                        </View>
                        {balance < total && selectedMethod === 'wallet' && (
                            <Text style={styles.insufficientBalance}>
                                Solde insuffisant. Rechargez votre wallet.
                            </Text>
                        )}
                    </TouchableOpacity>

                    {/* Stripe */}
                    <TouchableOpacity
                        style={[
                            styles.paymentMethod,
                            selectedMethod === 'stripe' && styles.paymentMethodSelected,
                            styles.paymentMethodDisabled
                        ]}
                        onPress={() => {
                            Alert.alert('Bientôt disponible', 'Paiement par carte bancaire disponible prochainement');
                        }}
                        disabled={true}
                    >
                        <View style={styles.paymentMethodContent}>
                            <View style={styles.paymentMethodIcon}>
                                <SafeIcon name="credit-card" size={24} color="#9CA3AF" />
                            </View>
                            <View style={styles.paymentMethodInfo}>
                                <Text style={[styles.paymentMethodName, styles.disabledText]}>
                                    Carte bancaire (Stripe)
                                </Text>
                                <Text style={[styles.paymentMethodBalance, styles.disabledText]}>
                                    Bientôt disponible
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* PayPal */}
                    <TouchableOpacity
                        style={[
                            styles.paymentMethod,
                            selectedMethod === 'paypal' && styles.paymentMethodSelected,
                            styles.paymentMethodDisabled
                        ]}
                        onPress={() => {
                            Alert.alert('Bientôt disponible', 'Paiement PayPal disponible prochainement');
                        }}
                        disabled={true}
                    >
                        <View style={styles.paymentMethodContent}>
                            <View style={styles.paymentMethodIcon}>
                                <Text style={styles.paypalIcon}>P</Text>
                            </View>
                            <View style={styles.paymentMethodInfo}>
                                <Text style={[styles.paymentMethodName, styles.disabledText]}>
                                    PayPal
                                </Text>
                                <Text style={[styles.paymentMethodBalance, styles.disabledText]}>
                                    Bientôt disponible
                                </Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </NativeCard>

                {/* Sécurité */}
                <View style={styles.securityInfo}>
                    <SafeIcon name="shield" size={16} color="#10B981" />
                    <Text style={styles.securityText}>
                        Paiement sécurisé et crypté. Vos données sont protégées.
                    </Text>
                </View>

                {/* Bouton paiement */}
                <NativeButton
                    title={
                        processing
                            ? 'Traitement...'
                            : `Payer ${total.toLocaleString('fr-FR')} ${devise}`
                    }
                    onPress={handlePayment}
                    disabled={processing || (selectedMethod === 'wallet' && balance < total)}
                    variant="primary"
                    size="large"
                    icon={processing ? undefined : 'credit-card'}
                    style={styles.payButton}
                />
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 16,
    },
    card: {
        padding: 20,
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    paymentMethod: {
        borderWidth: 2,
        borderColor: '#E5E7EB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
    },
    paymentMethodSelected: {
        borderColor: modernColors.primary,
        backgroundColor: '#F0F9FF',
    },
    paymentMethodDisabled: {
        opacity: 0.5,
    },
    paymentMethodContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    paymentMethodIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    paypalIcon: {
        fontSize: 24,
        fontWeight: '700',
        color: '#003087',
    },
    paymentMethodInfo: {
        flex: 1,
    },
    paymentMethodName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    paymentMethodBalance: {
        fontSize: 14,
        color: '#6B7280',
    },
    disabledText: {
        color: '#9CA3AF',
    },
    insufficientBalance: {
        fontSize: 12,
        color: '#DC2626',
        marginTop: 8,
    },
    securityInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
        padding: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
    },
    securityText: {
        flex: 1,
        fontSize: 12,
        color: '#059669',
    },
    payButton: {
        marginTop: 8,
    },
});

export default CovoituragePaymentFlow;

