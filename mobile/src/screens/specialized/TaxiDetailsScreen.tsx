// ✅ Phase 3: Détails d'un taxi avec boutons d'action
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
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { InsuranceSelector } from '../../components/covoiturage/InsuranceSelector';
import { QRCodeDisplay } from '../../components/covoiturage/QRCodeDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import PushNotificationService from '../../services/pushNotificationService';
import { modernColors } from '../../theme/modernTheme';

interface TaxiDetails {
    id: number;
    service_id: number;
    user_id: number;
    zone: string;
    gps_actuel?: string;
    is_available_now: boolean;
    type_vehicule?: string;
    marque_modele?: string;
    telephone?: string;
    email?: string;
    tarif_base?: number;
    tarif_par_km?: number;
    climatisation?: boolean;
    wifi?: boolean;
    paiement_carte?: boolean;
    driver?: {
        nom_complet?: string;
        avatar_url?: string;
        rating?: number;
        reviews_count?: number;
        is_verified?: boolean;
    };
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
    };
}

interface TaxiDetailsScreenParams {
    taxiId: number;
}

const TaxiDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as TaxiDetailsScreenParams;

    const [taxi, setTaxi] = useState<TaxiDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [selectedInsurance, setSelectedInsurance] = useState<'basic' | 'premium' | 'full' | null>(null);
    const [showInsuranceSelector, setShowInsuranceSelector] = useState(false);
    const [reservationId, setReservationId] = useState<number | null>(null);
    const [bookingSuccess, setBookingSuccess] = useState(false);

    useEffect(() => {
        loadTaxiDetails();
    }, []);

    const loadTaxiDetails = async () => {
        try {
            setLoading(true);
            // Utiliser endpoint enrichi si disponible
            const response = await apiGet(`/api/taxis/${params.taxiId}/details-enhanced`)
                .catch(() => apiGet(`/api/taxis/${params.taxiId}`));

            if (response.success && response.data) {
                setTaxi(response.data);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du taxi');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[TaxiDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver un taxi');
            navigation.navigate('Login' as never);
            return;
        }

        try {
            setBooking(true);

            // Récupérer position actuelle pour estimation
            // TODO: Utiliser LocationContext pour obtenir GPS
            const response = await apiPost(`/api/taxis/${params.taxiId}/book`, {
                departure_gps: taxi?.gps_actuel || null,
                arrival_gps: null, // TODO: Récupérer depuis sélection utilisateur
                estimated_price: taxi?.tarif_base ? taxi.tarif_base + (5 * (taxi.tarif_par_km || 200)) : null,
                notes: 'Réservation depuis l\'application mobile',
            });

            if (response.success && response.reservation) {
                const resId = response.reservation.id;
                setReservationId(resId);
                setBookingSuccess(true);

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
                    await apiPost(`/api/reservations/${resId}/qr-code`);
                } catch (err) {
                    console.error('Erreur génération QR code:', err);
                }

                // Planifier notifications proactives
                try {
                    await PushNotificationService.registerForPushNotifications();
                    // Pour taxi: notification immédiate (pas de rappel 24h/2h)
                } catch (err) {
                    console.error('Erreur notifications:', err);
                }
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[TaxiDetailsScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        } finally {
            setBooking(false);
        }
    };

    const handleCall = () => {
        if (taxi?.telephone) {
            Alert.alert(
                'Appeler',
                `Voulez-vous appeler ${taxi.telephone}?`,
                [
                    { text: 'Annuler', style: 'cancel' },
                    {
                        text: 'Appeler',
                        onPress: () => {
                            // TODO: Implémenter Linking.openURL(`tel:${taxi.telephone}`)
                            Alert.alert('Info', 'Fonctionnalité d\'appel à venir');
                        },
                    },
                ]
            );
        }
    };

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    if (!taxi) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Taxi non trouvé</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails du taxi</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.card}>
                    <View style={styles.statusRow}>
                        <Text style={styles.zone}>{taxi.zone}</Text>
                        <View style={[styles.statusBadge, taxi.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, taxi.is_available_now && styles.statusTextAvailable]}>
                                {taxi.is_available_now ? 'Disponible' : 'Occupé'}
                            </Text>
                        </View>
                    </View>

                    {taxi.type_vehicule && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="car" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.type_vehicule}</Text>
                        </View>
                    )}

                    {taxi.marque_modele && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="info" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.marque_modele}</Text>
                        </View>
                    )}

                    {taxi.telephone && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="phone" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.telephone}</Text>
                        </View>
                    )}

                    {taxi.email && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="mail" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.email}</Text>
                        </View>
                    )}

                    {taxi.gps_actuel && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.gps_actuel}</Text>
                        </View>
                    )}

                    {/* ✅ Profil conducteur enrichi */}
                    {(taxi.driver || taxi.prestataire) && (
                        <View style={styles.prestataireSection}>
                            <Text style={styles.prestataireLabel}>Chauffeur</Text>
                            <View style={styles.driverInfo}>
                                <Text style={styles.prestataireName}>
                                    {taxi.driver?.nom_complet || taxi.prestataire?.nom_complet || 'Non renseigné'}
                                </Text>
                                {taxi.driver?.rating && (
                                    <View style={styles.ratingRow}>
                                        <SafeIcon name="star" size={16} color="#F59E0B" />
                                        <Text style={styles.ratingText}>
                                            {taxi.driver.rating.toFixed(1)} ({String(taxi.driver.reviews_count || 0)} avis)
                                        </Text>
                                    </View>
                                )}
                                {taxi.driver?.is_verified && (
                                    <View style={styles.verifiedBadge}>
                                        <SafeIcon name="check-circle" size={16} color="#10B981" />
                                        <Text style={styles.verifiedText}>Vérifié</Text>
                                    </View>
                                )}
                            </View>
                        </View>
                    )}

                    {/* ✅ Informations tarifaires */}
                    {(taxi.tarif_base || taxi.tarif_par_km) && (
                        <View style={styles.priceSection}>
                            <Text style={styles.priceLabel}>Tarifs</Text>
                            {taxi.tarif_base && (
                                <Text style={styles.priceText}>
                                    Base: {taxi.tarif_base.toLocaleString('fr-FR')} {taxi.devise || 'XAF'}
                                </Text>
                            )}
                            {taxi.tarif_par_km && (
                                <Text style={styles.priceText}>
                                    Par km: {taxi.tarif_par_km.toLocaleString('fr-FR')} {taxi.devise || 'XAF'}
                                </Text>
                            )}
                        </View>
                    )}

                    {/* ✅ Équipements */}
                    <View style={styles.equipmentSection}>
                        {taxi.climatisation && (
                            <View style={styles.equipmentItem}>
                                <SafeIcon name="snowflake" size={16} color="#6366F1" />
                                <Text style={styles.equipmentText}>Climatisation</Text>
                            </View>
                        )}
                        {taxi.wifi && (
                            <View style={styles.equipmentItem}>
                                <SafeIcon name="wifi" size={16} color="#6366F1" />
                                <Text style={styles.equipmentText}>WiFi</Text>
                            </View>
                        )}
                        {taxi.paiement_carte && (
                            <View style={styles.equipmentItem}>
                                <SafeIcon name="credit-card" size={16} color="#6366F1" />
                                <Text style={styles.equipmentText}>Paiement carte</Text>
                            </View>
                        )}
                    </View>
                </NativeCard>

                {/* ✅ Assurance passager (optionnelle) */}
                {!bookingSuccess && (
                    <NativeCard style={styles.card}>
                        <View style={styles.detailRow}>
                            <Text style={styles.cardTitle}>Assurance passager (optionnel)</Text>
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
                )}

                {/* ✅ Écran succès réservation */}
                {bookingSuccess && reservationId && (
                    <NativeCard style={styles.card}>
                        <View style={styles.successContainer}>
                            <SafeIcon name="check-circle" size={64} color="#10B981" />
                            <Text style={styles.successTitle}>Réservation confirmée !</Text>
                            <Text style={styles.successText}>
                                Votre réservation a été créée. Le chauffeur sera notifié.
                            </Text>
                            {reservationId && (
                                <>
                                    <Text style={styles.reservationId}>N° {reservationId}</Text>
                                    <QRCodeDisplay reservationId={reservationId} />
                                </>
                            )}
                        </View>
                    </NativeCard>
                )}

                {!bookingSuccess && (
                    <View style={styles.actionsContainer}>
                        {/* ✅ Phase 4: Bouton gestion pour propriétaire */}
                        {user && taxi.user_id === user.id && (
                            <NativeButton
                                title="Gérer la disponibilité"
                                onPress={() => {
                                    navigation.navigate('TaxiAvailability' as never, { taxiId: taxi.id } as never);
                                }}
                                icon="settings"
                                variant="outline"
                                style={styles.manageButton}
                            />
                        )}
                        <NativeButton
                            title="Réserver maintenant"
                            onPress={() => {
                                navigation.navigate('TaxiBooking' as never, {
                                    taxiId: taxi.id,
                                    departureGPS: taxi.gps_actuel || undefined,
                                } as never);
                            }}
                            disabled={!taxi.is_available_now || !taxi.is_on_duty}
                            icon="calendar-check"
                            variant="primary"
                            style={styles.bookButton}
                        />
                        {taxi.telephone && (
                            <NativeButton
                                title="Appeler directement"
                                onPress={handleCall}
                                icon="phone-call"
                                variant="outline"
                                style={styles.callButton}
                            />
                        )}
                    </View>
                )}

                {bookingSuccess && (
                    <View style={styles.actionsContainer}>
                        <NativeButton
                            title="Voir mes réservations"
                            onPress={() => navigation.navigate('MesReservations' as never)}
                            variant="primary"
                            style={styles.bookButton}
                        />
                    </View>
                )}
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
    statusRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    zone: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        flex: 1,
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#FEE2E2',
    },
    statusBadgeAvailable: {
        backgroundColor: '#D1FAE5',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#DC2626',
    },
    statusTextAvailable: {
        color: '#059669',
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    infoText: {
        fontSize: 16,
        color: '#374151',
    },
    prestataireSection: {
        marginTop: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    prestataireLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 4,
    },
    prestataireName: {
        fontSize: 16,
        color: '#111827',
    },
    actionsContainer: {
        gap: 12,
    },
    manageButton: {
        marginTop: 8,
    },
    bookButton: {
        marginTop: 8,
    },
    callButton: {
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
});

export default TaxiDetailsScreen;

