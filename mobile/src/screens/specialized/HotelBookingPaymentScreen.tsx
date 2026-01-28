// ✅ NOUVEAU: Écran de paiement pour réservation hôtel/meublé
// Date: 2026-01-26

import { RouteProp, useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { immobilierService } from '../../services/immobilierService';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';

type RouteParams = {
    reservationId: number;
    montantTotal: number;
    propertyName?: string;
};

const HotelBookingPaymentScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute<RouteProp<{ params: RouteParams }, 'params'>>();
    const reservationId = route.params?.reservationId;
    const montantTotal = route.params?.montantTotal;
    const propertyName = route.params?.propertyName || 'Bien';

    const [paymentType, setPaymentType] = useState<'advance' | 'full'>('advance');
    const [paymentMethod, setPaymentMethod] = useState<string>('mobile_money');
    const [loading, setLoading] = useState(false);
    const [devise, setDevise] = useState('FCFA');

    const montantAvance = montantTotal * 0.3; // 30% par défaut
    const montantRestant = montantTotal - montantAvance;

    const formatPrice = (price: number) => {
        return `${(price / 1000).toFixed(0)}K ${devise}`;
    };

    const handlePayment = async () => {
        if (!reservationId) {
            Alert.alert('Erreur', 'ID de réservation manquant');
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

            if (response.success && response.data) {
                Alert.alert(
                    'Paiement réussi',
                    `Votre paiement de ${formatPrice(response.data.amount_paid)} a été confirmé.${response.data.new_payment_status === 'fully_paid' ? '\n\nVotre réservation est confirmée !' : '\n\nMontant restant: ' + formatPrice(response.data.remaining_amount)}`,
                    [
                        {
                            text: 'Voir mon QR code',
                            onPress: () => {
                                // Naviguer vers l'écran QR
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
                                navigation.goBack(); // Retourner à l'écran précédent
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', 'Le paiement a échoué');
            }
        } catch (err: any) {
            console.error('[HotelBookingPaymentScreen] Erreur:', err);
            Alert.alert('Erreur', err.message || 'Erreur lors du paiement');
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
                <Text style={styles.title}>Paiement</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Résumé réservation */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>📋 Réservation</Text>
                    <Text style={styles.propertyName}>{propertyName}</Text>
                    <Text style={styles.reservationId}>ID: #{reservationId}</Text>
                </View>

                {/* Type de paiement */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💳 Type de paiement</Text>
                    
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
                                Paiement d'avance (30%)
                            </Text>
                        </View>
                        <Text style={styles.paymentTypeDescription}>
                            Payez {formatPrice(montantAvance)} maintenant, le reste à l'arrivée
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
                                Paiement complet
                            </Text>
                        </View>
                        <Text style={styles.paymentTypeDescription}>
                            Payez le montant total maintenant
                        </Text>
                        <Text style={styles.paymentTypeAmount}>
                            {formatPrice(montantTotal)}
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* Méthode de paiement */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>💳 Méthode de paiement</Text>
                    
                    <View style={styles.paymentMethodsGrid}>
                        {[
                            { value: 'mobile_money', label: 'Mobile Money', icon: 'smartphone' },
                            { value: 'card', label: 'Carte bancaire', icon: 'credit-card' },
                            { value: 'bank_transfer', label: 'Virement bancaire', icon: 'bank' },
                            { value: 'cash', label: 'Espèces', icon: 'dollar-sign' },
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
                        <Text style={styles.summaryLabel}>Montant total</Text>
                        <Text style={styles.summaryValue}>{formatPrice(montantTotal)}</Text>
                    </View>
                    {paymentType === 'advance' && (
                        <>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Paiement maintenant</Text>
                                <Text style={styles.summaryValue}>{formatPrice(montantAvance)}</Text>
                            </View>
                            <View style={styles.summaryRow}>
                                <Text style={styles.summaryLabel}>Reste à payer</Text>
                                <Text style={styles.summaryValue}>{formatPrice(montantRestant)}</Text>
                            </View>
                        </>
                    )}
                    <View style={[styles.summaryRow, styles.summaryTotal]}>
                        <Text style={styles.summaryTotalLabel}>À payer maintenant</Text>
                        <Text style={styles.summaryTotalValue}>
                            {formatPrice(paymentType === 'advance' ? montantAvance : montantTotal)}
                        </Text>
                    </View>
                </View>

                {/* Bouton payer */}
                <NativeButton
                    title={loading ? 'Traitement...' : `Payer ${formatPrice(paymentType === 'advance' ? montantAvance : montantTotal)}`}
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
                            ? 'Vous pourrez payer le reste à votre arrivée. La réservation sera confirmée après le paiement.'
                            : 'Votre réservation sera confirmée immédiatement après le paiement.'}
                    </Text>
                </View>
            </ScrollView>
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
        ...modernColors.shadowLight,
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
        ...modernColors.shadowLight,
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

