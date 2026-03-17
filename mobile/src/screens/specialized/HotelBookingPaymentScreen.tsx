// ✅ NOUVEAU: Écran de paiement pour réservation hôtel/meublé
// Date: 2026-01-26

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import PaymentMethodPrompt from '../../components/PaymentMethodPrompt';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { usePaymentMethodCheck } from '../../hooks/usePaymentMethodCheck';
import { userApi } from '../../services/api';
import { immobilierService } from '../../services/immobilierService';
import { modernColors, modernStyles } from '../../theme/modernTheme';

type RouteParams = {
    reservationId: number;
    montantTotal: number;
    propertyName?: string;
};

const HotelBookingPaymentScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const route = useRoute() as any;
    const { user } = useAuth();
    const reservationId = route.params?.reservationId;
    const montantTotal = route.params?.montantTotal;
    const propertyName = route.params?.propertyName || 'Bien';

    const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');
    const [paymentMethod, setPaymentMethod] = useState<string>('mobile_money');
    const [loading, setLoading] = useState(false);
    const [devise, setDevise] = useState('FCFA');
    const [userBalance, setUserBalance] = useState<number>(user?.credits || 0);
    const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);
    const paymentCheck = usePaymentMethodCheck();

    // Charger le solde utilisateur
    React.useEffect(() => {
        const loadBalance = async () => {
            try {
                const response = await (userApi as any).getTokensBalance();
                const backendData = (response?.data as any);
                const balance = backendData?.data?.remaining || backendData?.remaining || user?.credits || 0;
                setUserBalance(balance);
            } catch { setUserBalance(user?.credits || 0); }
        };
        loadBalance();
    }, []);

    const montantAvance = montantTotal * 0.3; // 30% par défaut
    const montantRestant = montantTotal - montantAvance;

    const formatPrice = (price: number) => {
        return `${(price / 1000).toFixed(0)}K ${devise}`;
    };

    const montantAPayer = paymentType === 'advance' ? montantAvance : montantTotal;

    const handlePayment = async () => {
        if (!reservationId) {
            Alert.alert(t('hotelBookingPaymentScreen.erreur'), t('hotelBookingPaymentScreen.idDeReservationManquant'));
            return;
        }

        // ✅ Vérifier les moyens de paiement si mobile_money sélectionné
        if (paymentMethod === 'mobile_money') {
            const needsPayment = await paymentCheck.checkAndPrompt();
            if (needsPayment) {
                setShowPaymentPrompt(true);
                return;
            }
        }

        if (userBalance < montantAPayer) {
            Alert.alert(
                t('hotelBookingPaymentScreen.soldeInsuffisant'),
                t('hotelBookingPaymentScreen.soldeInsuffisantMessage', {
                    balance: `${userBalance.toLocaleString()} ${devise}`,
                    amount: `${montantAPayer.toLocaleString()} ${devise}`,
                }),
                [
                    { text: t('common.cancel'), style: 'cancel' },
                    {
                        text: t('common.reload'),
                        onPress: () => (navigation as any).navigate('RechargeTokens'),
                    },
                ]
            );
            return;
        }

        try {
            setLoading(true);
            const response = await immobilierService.payHotelBooking(
                reservationId,
                paymentType,
                paymentMethod,
                paymentType === 'advance' ? montantAvance : undefined
            );

            const resData = (response?.data || response) as any;
            if (resData?.success && resData?.data) {
                const payResult = resData.data;
                const confirmMsg = t('hotelBookingPaymentScreen.votrePaiementDe', { amount: formatPrice(payResult.amount_paid) })
                    + (payResult.new_payment_status === 'fully_paid'
                        ? t('hotelBookingPaymentScreen.nnvotreReservationEstConfirmee')
                        : `\n\n${t('hotelBookingPaymentScreen.montantRestant')} ${formatPrice(payResult.remaining_amount)}`);
                Alert.alert(
                    t('hotelBookingPaymentScreen.paiementReussi'),
                    confirmMsg,
                    [
                        {
                            text: t('hotelBookingPaymentScreen.voirMonQrCode'),
                            onPress: () => {
                                (navigation as any).navigate('HotelReservationQR', {
                                    reservationId: reservationId,
                                    propertyName: propertyName,
                                });
                            },
                        },
                        {
                            text: 'OK',
                            style: 'cancel',
                            onPress: () => {
                                navigation.goBack();
                                navigation.goBack();
                            },
                        },
                    ]
                );
            } else {
                Alert.alert(t('hotelBookingPaymentScreen.erreur'), resData?.message || t('hotelBookingPaymentScreen.lePaiementAEchoue'));
            }
        } catch (err: any) {
            console.error('[HotelBookingPaymentScreen] Erreur:', err);
            Alert.alert(t('hotelBookingPaymentScreen.erreur'), err.message || t('hotelBookingPaymentScreen.erreurPaiement'));
        } finally {
            setLoading(false);
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('hotelBookingPaymentScreen.paiement')}</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Solde utilisateur */}
                <View style={[styles.section, { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }]}>
                    <View>
                        <Text style={{ fontSize: 13, color: '#6B7280' }}>{t('hotelBookingPayment.votreSolde')}</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: userBalance >= montantAPayer ? '#10B981' : '#EF4444' }}>
                            {userBalance.toLocaleString()} {devise}
                        </Text>
                    </View>
                    {userBalance < montantAPayer && (
                        <TouchableOpacity
                            style={{ backgroundColor: '#EF4444', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                            onPress={() => (navigation as any).navigate('RechargeTokens')}
                        >
                            <SafeIcon name="wallet" size={16} color="#FFFFFF" />
                            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 13 }}>{t('hotelBookingPaymentScreen.recharger')}</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Résumé réservation */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('hotelBookingPayment.reservation')}</Text>
                    <Text style={styles.propertyName}>{propertyName}</Text>
                    <Text style={styles.reservationId}>ID: #{reservationId}</Text>
                </View>

                {/* Type de paiement */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('hotelBookingPayment.typeDePaiement')}</Text>

                    <TouchableOpacity
                        style={[
                            styles.paymentTypeCard,
                            paymentType === 'advance' && styles.paymentTypeCardActive,
                        ]}
                        onPress={() => setPaymentType('advance')}
                    >
                        <View style={styles.paymentTypeHeader}>
                            <SafeIcon
                                name={paymentType === 'advance' ? 'check-circle' : 'circle'}
                                size={24}
                                color={paymentType === 'advance' ? modernColors.primary : '#9CA3AF'}
                            />
                            <Text style={[
                                styles.paymentTypeTitle,
                                paymentType === 'advance' && styles.paymentTypeTitleActive,
                            ]}>
                                {t('hotelBookingPaymentScreen.paiementAvance')}
                            </Text>
                        </View>
                        <Text style={styles.paymentTypeDescription}>
                            {t('hotelBookingPaymentScreen.payezMaintenant', { amount: formatPrice(montantAvance) })}
                        </Text>
                        <Text style={styles.paymentTypeAmount}>
                            {formatPrice(montantAvance)}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.paymentTypeCard,
                            paymentType === 'full' && styles.paymentTypeCardActive,
                            styles.paymentTypeCardMargin,
                        ]}
                        onPress={() => setPaymentType('full')}
                    >
                        <View style={styles.paymentTypeHeader}>
                            <SafeIcon
                                name={paymentType === 'full' ? 'check-circle' : 'circle'}
                                size={24}
                                color={paymentType === 'full' ? modernColors.primary : '#9CA3AF'}
                            />
                            <Text style={[
                                styles.paymentTypeTitle,
                                paymentType === 'full' && styles.paymentTypeTitleActive,
                            ]}>
                                {t('hotelBookingPaymentScreen.paiementComplet')}
                            </Text>
                        </View>
                        <Text style={styles.paymentTypeDescription}>
                            {t('hotelBookingPaymentScreen.payezMontantTotal')}
                        </Text>
                        <Text style={styles.paymentTypeAmount}>
                            {formatPrice(montantTotal)}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Méthode de paiement */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{t('hotelBookingPayment.methodeDePaiement')}</Text>

                    <View style={styles.paymentMethodsGrid}>
                        {[
                            { value: 'mobile_money', label: t('hotelBookingPaymentScreen.mobileMoney'), icon: 'smartphone' },
                            { value: 'card', label: t('hotelBookingPayment.carteBancaire'), icon: 'credit-card' },
                            { value: 'bank_transfer', label: t('hotelBookingPaymentScreen.virementBancaire'), icon: 'bank' },
                            { value: 'cash', label: t('hotelBookingPayment.especes'), icon: 'dollar-sign' },
                        ].map((method) => (
                            <TouchableOpacity
                                key={method.value}
                                style={[
                                    styles.paymentMethodCard,
                                    paymentMethod === method.value && styles.paymentMethodCardActive,
                                ]}
                                onPress={() => setPaymentMethod(method.value)}
                            >
                                <SafeIcon
                                    name={method.icon}
                                    size={24}
                                    color={paymentMethod === method.value ? modernColors.primary : '#6B7280'}
                                />
                                <Text style={[
                                    styles.paymentMethodLabel,
                                    paymentMethod === method.value && styles.paymentMethodLabelActive,
                                ]}>
                                    {method.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* Résumé */}
                <View style={styles.summarySection}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>{t('hotelBookingPayment.montantTotal')}</Text>
                        <Text style={styles.summaryValue}>{formatPrice(montantTotal)}</Text>
                    </View>
                    {paymentType === 'advance' && (
                        <>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('hotelBookingPaymentScreen.paiementMaintenant')}</Text>
                                <Text style={styles.summaryValue}>{formatPrice(montantAvance)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>{t('hotelBookingPayment.resteAPayer')}</Text>
                                <Text style={styles.summaryValue}>{formatPrice(montantRestant)}</Text>
                            </View>
                        </>
                    )}
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.summaryTotalLabel}>{t('hotelBookingPayment.aPayerMaintenant')}</Text>
                        <Text style={styles.summaryTotalValue}>
                            {formatPrice(paymentType === 'advance' ? montantAvance : montantTotal)}
                        </Text>
                    </View>
                </View>

                {/* Bouton payer */}
                <NativeButton
                    title={loading ? t('hotelBookingPaymentScreen.traitement') : t('hotelBookingPaymentScreen.payerMontant', { amount: formatPrice(paymentType === 'advance' ? montantAvance : montantTotal) })}
                    onPress={handlePayment}
                    disabled={loading}
                    variant="primary"
                    size="large"
                    style={styles.payButton}
                />

                {/* Info */}
                <View style={styles.infoBox}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <Text style={styles.infoText}>
                        {paymentType === 'advance'
                            ? t('hotelBookingPaymentScreen.vousPourrezPayerLeResteA')
                            : t('hotelBookingPaymentScreen.votreReservationSeraConfirmeeImmediatementApres')}
                    </Text>
                </View>
            </ScrollView>

            <PaymentMethodPrompt
                visible={showPaymentPrompt}
                onClose={() => setShowPaymentPrompt(false)}
                onSaved={() => {
                    paymentCheck.refresh();
                    setShowPaymentPrompt(false);
                }}
                context="payment"
            />
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 8,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...modernStyles.shadowLight,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    propertyName: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 4,
    },
    reservationId: {
        fontSize: 14,
        color: '#6B7280',
    },
    paymentTypeCard: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    paymentTypeCardActive: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    paymentTypeCardMargin: {
        marginTop: 12,
    },
    paymentTypeHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    paymentTypeTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#374151',
    },
    paymentTypeTitleActive: {
        color: modernColors.primary,
    },
    paymentTypeDescription: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 8,
    },
    paymentTypeAmount: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    paymentMethodsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    paymentMethodCard: {
        flex: 1,
        minWidth: '45%',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
        gap: 8,
    },
    paymentMethodCardActive: {
        borderColor: modernColors.primary,
        backgroundColor: '#EFF6FF',
    },
    paymentMethodLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        textAlign: 'center',
    },
    paymentMethodLabelActive: {
        color: modernColors.primary,
        fontWeight: '600',
    },
    summarySection: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        ...modernStyles.shadowLight,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '500',
        color: '#111827',
    },
    summaryTotal: {
        borderTopWidth: 2,
        borderTopColor: '#E5E7EB',
        borderBottomWidth: 0,
        marginTop: 8,
        paddingTop: 12,
    },
    summaryTotalLabel: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    summaryTotalValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    payButton: {
        marginBottom: 16,
    },
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        padding: 16,
        backgroundColor: '#EFF6FF',
        borderRadius: 12,
        gap: 12,
        marginBottom: 32,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: '#1E40AF',
        lineHeight: 20,
    },
});

export default HotelBookingPaymentScreen;

