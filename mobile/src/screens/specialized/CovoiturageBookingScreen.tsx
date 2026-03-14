// ✅ Phase 1.1: Écran de réservation dédié avec paiement intégré
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import CovoituragePaymentFlow from '../../components/covoiturage/CovoituragePaymentFlow';
import { InsuranceSelector } from '../../components/covoiturage/InsuranceSelector';
import { QRCodeDisplay } from '../../components/covoiturage/QRCodeDisplay';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useWalletBalance } from '../../hooks/useWalletBalance';
import { apiGet, apiPost } from '../../services/api';
import PushNotificationService from '../../services/pushNotificationService';
import { modernColors } from '../../theme/modernTheme';

interface CovoiturageBookingDetails {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    date_depart: string;
    heure_depart?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    statut: string;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
        note_moyenne?: number;
        nombre_trajets?: number;
    };
}

interface CovoiturageBookingScreenParams {
    covoiturageId: number;
    numberOfPlaces?: number;
    passengerNames?: string;
    notes?: string;
}

const CovoiturageBookingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { walletBalance, refresh: refreshBalance } = useWalletBalance();
    const balance = walletBalance?.balance || 0;
    const params = route.params as CovoiturageBookingScreenParams;

    const [covoiturage, setCovoiturage] = useState<CovoiturageBookingDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [numberOfPlaces, setNumberOfPlaces] = useState(params?.numberOfPlaces || 1);
    const [passengerNames, setPassengerNames] = useState(params?.passengerNames || '');
    const [notes, setNotes] = useState(params?.notes || '');
    const [showPayment, setShowPayment] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [reservationId, setReservationId] = useState<number | null>(null);
    const [selectedInsurance, setSelectedInsurance] = useState<'basic' | 'premium' | 'full' | null>(null);
    const [showInsuranceSelector, setShowInsuranceSelector] = useState(false);

    useEffect(() => {
        loadCovoiturageDetails();
        refreshBalance();
    }, []);

    const loadCovoiturageDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/covoiturages/${params.covoiturageId}`);

            if (response.success && response.data) {
                setCovoiturage(response.data as any);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du trajet');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[CovoiturageBookingScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const calculateTotal = () => {
        if (!covoiturage) return 0;
        return numberOfPlaces * covoiturage.prix_par_place;
    };

    const handleProceedToPayment = () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver');
            navigation.navigate('Login' as never);
            return;
        }

        if (!covoiturage) return;

        if (numberOfPlaces > covoiturage.places_disponibles) {
            Alert.alert('Erreur', `Seulement ${covoiturage.places_disponibles} place(s) disponible(s)`);
            return;
        }

        if (covoiturage.statut !== 'ouvert') {
            Alert.alert('Erreur', 'Ce trajet n\'est plus disponible');
            return;
        }

        const total = calculateTotal();
        if (balance < total) {
            Alert.alert(
                'Solde insuffisant',
                `Votre solde (${balance.toLocaleString('fr-FR')} ${covoiturage.devise}) est insuffisant. Total requis: ${total.toLocaleString('fr-FR')} ${covoiturage.devise}`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Recharger',
                        onPress: () => navigation.navigate('RechargeTokens' as never)
                    }
                ]
            );
            return;
        }

        setShowPayment(true);
    };

    const handlePaymentSuccess = async (paymentData: any) => {
        try {
            setLoading(true);
            // La réservation et le paiement sont déjà traités dans CovoituragePaymentFlow
            const reservationId = paymentData.reservationId || paymentData.paymentId;

            if (reservationId) {
                const resId = parseInt(reservationId.toString());
                setReservationId(resId);
                setBookingSuccess(true);
                await refreshBalance();

                // Créer assurance si sélectionnée
                if (selectedInsurance) {
                    try {
                        await apiPost(`/api/reservations/${resId}/insurance`, {
                            reservation_id: resId,
                            coverage_type: selectedInsurance,
                        });
                    } catch (err) {
                        console.error('Erreur création assurance:', err);
                    }
                }

                // Générer QR code
                try {
                    await apiPost(`/api/reservations/${resId}/qr-code`, {});
                } catch (err) {
                    console.error('Erreur génération QR code:', err);
                }

                // Planifier notifications proactives (push notifications locales)
                if (covoiturage) {
                    try {
                        // S'assurer que les permissions sont accordées
                        await PushNotificationService.registerForPushNotifications();

                        const departureDateTime = new Date(
                            `${covoiturage.date_depart}T${covoiturage.heure_depart || '00:00'}`
                        );

                        // Planifier les rappels locaux
                        await PushNotificationService.scheduleTripReminders({
                            reservationId: resId,
                            tripId: covoiturage.id,
                            depart: covoiturage.depart,
                            destination: covoiturage.destination,
                            departureTime: departureDateTime,
                        });
                    } catch (err) {
                        console.error('Erreur planification notifications locales:', err);
                    }
                }

                // Notifier le backend (pour backup)
                try {
                    await apiPost(`/api/reservations/${resId}/schedule-notifications`, {});
                } catch (err) {
                    console.error('Erreur planification notifications backend:', err);
                }

                Alert.alert(
                    'Réservation confirmée !',
                    `${numberOfPlaces} place(s) réservée(s) pour ${calculateTotal().toLocaleString('fr-FR')} ${covoiturage?.devise}`,
                    [
                        {
                            text: 'Voir mes réservations',
                            onPress: () => navigation.navigate('MesReservationsCovoiturage' as never)
                        },
                        {
                            text: 'Voir ma réservation',
                            onPress: () => {
                                (navigation as any).navigate('MesReservationsCovoiturage');
                            }
                        },
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack()
                        }
                    ]
                );
            } else {
                Alert.alert('Erreur', 'Réservation créée mais ID manquant');
            }
        } catch (error: any) {
            console.error('[CovoiturageBookingScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de finaliser la réservation');
        } finally {
            setLoading(false);
            setShowPayment(false);
        }
    };

    if (loading && !covoiturage) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!covoiturage) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Trajet non trouvé</Text>
            </View>
        );
    }

    if (bookingSuccess) {
        return (
            <View style={styles.container}>
                <View style={styles.successContainer}>
                    <SafeIcon name="check-circle" size={64} color="#10B981" />
                    <Text style={styles.successTitle}>Réservation confirmée !</Text>
                    <Text style={styles.successText}>
                        Votre réservation a été confirmée. Vous recevrez une notification avant le départ.
                    </Text>
                    {reservationId && (
                        <>
                            <Text style={styles.reservationId}>N° {reservationId}</Text>
                            <QRCodeDisplay reservationId={reservationId} />
                        </>
                    )}
                    <NativeButton
                        title="Voir mes réservations"
                        onPress={() => navigation.navigate('MesReservationsCovoiturage' as never)}
                        variant="primary"
                        style={styles.button}
                    />
                </View>
            </View>
        );
    }

    if (showPayment) {
        return (
            <CovoituragePaymentFlow
                total={calculateTotal()}
                devise={covoiturage.devise}
                covoiturageId={covoiturage.id}
                numberOfPlaces={numberOfPlaces}
                onPaymentSuccess={handlePaymentSuccess}
                onCancel={() => setShowPayment(false)}
            />
        );
    }

    const total = calculateTotal();

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Réservation</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Récapitulatif trajet */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Récapitulatif du trajet</Text>
                    <View style={styles.routeRow}>
                        <View style={styles.routePoint}>
                            <View style={styles.routeDot} />
                            <Text style={styles.routeText}>{covoiturage.depart}</Text>
                        </View>
                        <View style={styles.routeLine} />
                        <View style={styles.routePoint}>
                            <View style={[styles.routeDot, styles.routeDotDestination]} />
                            <Text style={styles.routeText}>{covoiturage.destination}</Text>
                        </View>
                    </View>

                    <View style={styles.infoRow}>
                        <SafeIcon name="calendar" size={16} color={modernColors.textSecondary} />
                        <Text style={styles.infoText}>
                            {new Date(covoiturage.date_depart).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long'
                            })}
                        </Text>
                    </View>

                    {covoiturage.heure_depart && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="clock" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{covoiturage.heure_depart.substring(0, 5)}</Text>
                        </View>
                    )}
                </NativeCard>

                {/* Assurance passager */}
                <NativeCard style={styles.card}>
                    <View style={styles.detailRow}>
                        <Text style={styles.cardTitle}>Assurance passager</Text>
                        <TouchableOpacity
                            onPress={() => setShowInsuranceSelector(!showInsuranceSelector)}
                            style={styles.toggleButton}
                        >
                            <Text style={styles.toggleText}>
                                {selectedInsurance ? 'Modifier' : 'Ajouter'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {selectedInsurance && (
                        <View style={styles.insuranceSelected}>
                            <SafeIcon name="shield-check" size={20} color="#10B981" />
                            <Text style={styles.insuranceText}>
                                Assurance {selectedInsurance} sélectionnée
                            </Text>
                        </View>
                    )}
                    {showInsuranceSelector && (
                        <InsuranceSelector
                            onSelect={(type) => {
                                setSelectedInsurance(type);
                                setShowInsuranceSelector(false);
                            }}
                            selected={selectedInsurance || undefined}
                        />
                    )}
                </NativeCard>

                {/* Détails réservation */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Détails de la réservation</Text>

                    <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Nombre de places:</Text>
                        <View style={styles.placesSelector}>
                            <TouchableOpacity
                                style={styles.selectorButton}
                                onPress={() => setNumberOfPlaces(Math.max(1, numberOfPlaces - 1))}
                                disabled={numberOfPlaces <= 1}
                            >
                                <SafeIcon name="minus" size={16} color={modernColors.primary} />
                            </TouchableOpacity>
                            <Text style={styles.placesValue}>{numberOfPlaces}</Text>
                            <TouchableOpacity
                                style={styles.selectorButton}
                                onPress={() => setNumberOfPlaces(Math.min(covoiturage.places_disponibles, numberOfPlaces + 1))}
                                disabled={numberOfPlaces >= covoiturage.places_disponibles}
                            >
                                <SafeIcon name="plus" size={16} color={modernColors.primary} />
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View style={styles.priceBreakdown}>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Prix par place:</Text>
                            <Text style={styles.priceValue}>
                                {covoiturage.prix_par_place.toLocaleString('fr-FR')} {covoiturage.devise}
                            </Text>
                        </View>
                        <View style={styles.priceRow}>
                            <Text style={styles.priceLabel}>Nombre de places:</Text>
                            <Text style={styles.priceValue}>{numberOfPlaces}</Text>
                        </View>
                        <View style={[styles.priceRow, styles.totalRow]}>
                            <Text style={styles.totalLabel}>Total:</Text>
                            <Text style={styles.totalValue}>
                                {total.toLocaleString('fr-FR')} {covoiturage.devise}
                            </Text>
                        </View>
                    </View>
                </NativeCard>

                {/* Assurance passager */}
                <NativeCard style={styles.card}>
                    <View style={styles.detailRow}>
                        <Text style={styles.cardTitle}>Assurance passager</Text>
                        <TouchableOpacity
                            onPress={() => setShowInsuranceSelector(!showInsuranceSelector)}
                            style={styles.toggleButton}
                        >
                            <Text style={styles.toggleText}>
                                {selectedInsurance ? 'Modifier' : 'Ajouter'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                    {selectedInsurance && (
                        <View style={styles.insuranceSelected}>
                            <SafeIcon name="shield-check" size={20} color="#10B981" />
                            <Text style={styles.insuranceText}>
                                Assurance {selectedInsurance} sélectionnée
                            </Text>
                        </View>
                    )}
                    {showInsuranceSelector && (
                        <InsuranceSelector
                            onSelect={(type) => {
                                setSelectedInsurance(type);
                                setShowInsuranceSelector(false);
                            }}
                            selected={selectedInsurance || undefined}
                        />
                    )}
                </NativeCard>

                {/* Solde wallet */}
                <NativeCard style={styles.card}>
                    <View style={styles.walletRow}>
                        <SafeIcon name="wallet" size={20} color={modernColors.primary} />
                        <View style={styles.walletInfo}>
                            <Text style={styles.walletLabel}>Solde disponible:</Text>
                            <Text style={styles.walletBalance}>
                                {balance.toLocaleString('fr-FR')} {covoiturage.devise}
                            </Text>
                        </View>
                    </View>
                    {balance < total && (
                        <Text style={styles.insufficientBalance}>
                            Solde insuffisant. Rechargez votre wallet.
                        </Text>
                    )}
                </NativeCard>

                {/* Bouton paiement */}
                <NativeButton
                    title={`Payer ${total.toLocaleString('fr-FR')} ${covoiturage.devise}`}
                    onPress={handleProceedToPayment}
                    disabled={loading || numberOfPlaces > covoiturage.places_disponibles || balance < total}
                    variant="primary"
                    size="large"
                    icon="credit-card"
                    style={styles.paymentButton}
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
    routeRow: {
        marginBottom: 16,
    },
    routePoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: modernColors.primary,
    },
    routeDotDestination: {
        backgroundColor: '#DC2626',
    },
    routeLine: {
        width: 2,
        height: 30,
        backgroundColor: '#D1D5DB',
        marginLeft: 5,
        marginVertical: 8,
    },
    routeText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginTop: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#374151',
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    detailLabel: {
        fontSize: 16,
        fontWeight: '500',
        color: '#374151',
    },
    placesSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
    },
    selectorButton: {
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
    },
    placesValue: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        minWidth: 40,
        textAlign: 'center',
    },
    priceBreakdown: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    priceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    priceLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    priceValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    totalRow: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    totalValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
    },
    walletRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    walletInfo: {
        flex: 1,
    },
    walletLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    walletBalance: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.primary,
        marginTop: 4,
    },
    insufficientBalance: {
        fontSize: 12,
        color: '#DC2626',
        marginTop: 8,
    },
    paymentButton: {
        marginTop: 8,
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    errorText: {
        fontSize: 16,
        color: '#DC2626',
    },
    successContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    successTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
    },
    successText: {
        fontSize: 16,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 8,
    },
    reservationId: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.primary,
        marginTop: 16,
    },
    button: {
        marginTop: 24,
    },
    toggleButton: {
        padding: 8,
    },
    toggleText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    insuranceSelected: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
    },
    insuranceText: {
        fontSize: 14,
        color: '#10B981',
        marginLeft: 8,
        fontWeight: '600',
    },
});

export default CovoiturageBookingScreen;

