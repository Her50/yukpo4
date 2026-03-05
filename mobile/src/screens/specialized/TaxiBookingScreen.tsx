// ✅ Écran de réservation/appel taxi avec sélection GPS
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import ModernGPSModal from '../../components/ModernGPSModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { InsuranceSelector } from '../../components/covoiturage/InsuranceSelector';
import { QRCodeDisplay } from '../../components/covoiturage/QRCodeDisplay';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost } from '../../services/api';
import PushNotificationService from '../../services/pushNotificationService';
import { taxiService } from '../../services/taxiService';
import { modernColors } from '../../theme/modernTheme';

interface TaxiDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom_chauffeur?: string;
    telephone?: string;
    whatsapp?: string;
    zone_intervention?: string[];
    gps_actuel?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    type_vehicule?: string;
    marque_modele?: string;
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
}

interface TaxiBookingScreenParams {
    taxiId: number;
    departureGPS?: string;
    arrivalGPS?: string;
}

const TaxiBookingScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const params = route.params as TaxiBookingScreenParams;

    const [taxi, setTaxi] = useState<TaxiDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [bookingSuccess, setBookingSuccess] = useState(false);
    const [reservationId, setReservationId] = useState<number | null>(null);

    // GPS
    const [departureGPS, setDepartureGPS] = useState<string>(params?.departureGPS || '');
    const [arrivalGPS, setArrivalGPS] = useState<string>(params?.arrivalGPS || '');
    const [showDepartureGPSModal, setShowDepartureGPSModal] = useState(false);
    const [showArrivalGPSModal, setShowArrivalGPSModal] = useState(false);

    // Assurance
    const [selectedInsurance, setSelectedInsurance] = useState<'basic' | 'premium' | 'full' | null>(null);
    const [showInsuranceSelector, setShowInsuranceSelector] = useState(false);

    // Notes
    const [notes, setNotes] = useState('');

    // Estimation prix
    const [estimatedPrice, setEstimatedPrice] = useState<number | null>(null);
    const [estimatedDistance, setEstimatedDistance] = useState<number | null>(null);

    // ✅ NOUVEAU: Prix dynamique IA
    const [dynamicPrice, setDynamicPrice] = useState<{
        final_price: number;
        dynamic_multiplier: number;
        surge_factor: number;
        demand_factor: number;
        supply_factor: number;
        confidence: number;
        reasoning: string;
    } | null>(null);
    const [loadingDynamicPrice, setLoadingDynamicPrice] = useState(false);
    const [dynamicPriceError, setDynamicPriceError] = useState<string | null>(null);

    useEffect(() => {
        loadTaxiDetails();

        // Initialiser GPS départ avec position actuelle
        if (location?.coords && !departureGPS) {
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setDepartureGPS(`${lat},${lng}`);
        }
    }, []);

    useEffect(() => {
        // Calculer estimation prix si départ et arrivée sont définis
        if (departureGPS && arrivalGPS && taxi?.tarif_base && taxi?.tarif_par_km) {
            calculatePriceEstimate();
        }
    }, [departureGPS, arrivalGPS, taxi]);

    const loadTaxiDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/taxis/${params.taxiId}/details-enhanced`)
                .catch(() => apiGet(`/api/taxis/${params.taxiId}`));

            const r = response.data as any;
            if (response.success && r) {
                setTaxi(r);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du taxi');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[TaxiBookingScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const calculatePriceEstimate = () => {
        if (!taxi?.tarif_base || !taxi?.tarif_par_km) return;

        try {
            const [depLat, depLng] = departureGPS.split(',').map(Number);
            const [arrLat, arrLng] = arrivalGPS.split(',').map(Number);

            // Calcul distance approximative (Haversine simplifié)
            const R = 6371; // Rayon de la Terre en km
            const dLat = (arrLat - depLat) * Math.PI / 180;
            const dLng = (arrLng - depLng) * Math.PI / 180;
            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(depLat * Math.PI / 180) * Math.cos(arrLat * Math.PI / 180) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
            const distance = R * c;

            setEstimatedDistance(distance);

            // Prix = tarif_base + (distance * tarif_par_km)
            const basePrice = taxi.tarif_base + (distance * taxi.tarif_par_km);
            setEstimatedPrice(Math.round(basePrice));

            // ✅ NOUVEAU: Appeler le prix dynamique IA en parallèle
            fetchDynamicPrice(basePrice, distance, depLat, depLng);
        } catch (error) {
            console.error('Erreur calcul prix:', error);
        }
    };

    // ✅ NOUVEAU: Récupérer le prix dynamique IA
    const fetchDynamicPrice = async (basePrice: number, distanceKm: number, lat: number, lng: number) => {
        try {
            setLoadingDynamicPrice(true);
            setDynamicPriceError(null);

            const response = await taxiService.calculateDynamicPrice({
                base_price: basePrice,
                distance_km: distanceKm,
                zone_id: `zone_${lat.toFixed(2)}_${lng.toFixed(2)}`,
                latitude: lat,
                longitude: lng,
                radius_km: 10,
                vehicle_type: taxi?.type_vehicule || 'taxi',
            });

            const r = response.data as any;
            if (response.success && r) {
                const priceData = r?.data || r;
                if (priceData?.final_price) {
                    setDynamicPrice(priceData);
                    setEstimatedPrice(Math.round(priceData.final_price));
                }
            }
        } catch (error: any) {
            console.warn('[TaxiBookingScreen] Prix dynamique IA non disponible:', error.message);
            setDynamicPriceError('Prix IA non disponible');
        } finally {
            setLoadingDynamicPrice(false);
        }
    };

    const handleGPSSelect = (coordinates: string, type: 'departure' | 'arrival') => {
        if (type === 'departure') {
            setDepartureGPS(coordinates);
            setShowDepartureGPSModal(false);
        } else {
            setArrivalGPS(coordinates);
            setShowArrivalGPSModal(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver un taxi');
            navigation.navigate('Login' as never);
            return;
        }

        if (!departureGPS) {
            Alert.alert('Erreur', 'Veuillez sélectionner votre point de départ');
            return;
        }

        if (!arrivalGPS) {
            Alert.alert('Erreur', 'Veuillez sélectionner votre destination');
            return;
        }

        if (!taxi) return;

        if (!taxi.is_available_now || !taxi.is_on_duty) {
            Alert.alert('Taxi indisponible', 'Ce taxi n\'est pas disponible pour le moment');
            return;
        }

        try {
            setBooking(true);

            const response = await apiPost(`/api/taxis/${params.taxiId}/book`, {
                departure_gps: departureGPS,
                arrival_gps: arrivalGPS,
                estimated_price: estimatedPrice,
                notes: notes || 'Réservation depuis l\'application mobile',
            });

            const r = response.data as any;
            if (response.success && r?.reservation) {
                const resId = r.reservation.id;
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
                } catch (err) {
                    console.error('Erreur notifications:', err);
                }

                Alert.alert(
                    'Réservation confirmée !',
                    `Votre réservation a été créée. Le chauffeur vous contactera bientôt.${estimatedPrice ? `\nPrix estimé: ${estimatedPrice.toLocaleString('fr-FR')} FCFA` : ''}`,
                    [
                        {
                            text: 'Voir mes réservations',
                            onPress: () => navigation.navigate('MesReservations' as never)
                        },
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack()
                        }
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[TaxiBookingScreen] Erreur réservation:', error);
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
                            Linking.openURL(`tel:${taxi.telephone}`);
                        },
                    },
                ]
            );
        }
    };

    const handleWhatsApp = () => {
        if (taxi?.whatsapp) {
            const phone = taxi.whatsapp.replace(/[^0-9]/g, '');
            Linking.openURL(`whatsapp://send?phone=${phone}`);
        }
    };

    if (loading && !taxi) {
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

    if (bookingSuccess) {
        return (
            <View style={styles.container}>
                <View style={styles.successContainer}>
                    <SafeIcon name="check-circle" size={64} color="#10B981" />
                    <Text style={styles.successTitle}>Réservation confirmée !</Text>
                    <Text style={styles.successText}>
                        Votre réservation a été créée. Le chauffeur vous contactera bientôt.
                    </Text>
                    {reservationId && (
                        <>
                            <Text style={styles.reservationId}>N° {reservationId}</Text>
                            <QRCodeDisplay reservationId={reservationId} />
                        </>
                    )}
                    <NativeButton
                        title="Voir mes réservations"
                        onPress={() => navigation.navigate('MesReservations' as never)}
                        variant="primary"
                        style={styles.button}
                    />
                </View>
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
                <Text style={styles.title}>Réservation taxi</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                {/* Récapitulatif taxi */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Informations du taxi</Text>
                    {taxi.nom_chauffeur && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="user" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.nom_chauffeur}</Text>
                        </View>
                    )}
                    {taxi.type_vehicule && (
                        <View style={styles.infoRow}>
                            <SafeIcon name="car" size={16} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>{taxi.type_vehicule}</Text>
                            {taxi.marque_modele && <Text style={styles.infoText}> - {taxi.marque_modele}</Text>}
                        </View>
                    )}
                    <View style={styles.statusRow}>
                        <View style={[styles.statusBadge, taxi.is_available_now && styles.statusBadgeAvailable]}>
                            <Text style={[styles.statusText, taxi.is_available_now && styles.statusTextAvailable]}>
                                {taxi.is_available_now ? 'Disponible' : 'Occupé'}
                            </Text>
                        </View>
                    </View>
                </NativeCard>

                {/* Sélection GPS */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Votre trajet</Text>

                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => setShowDepartureGPSModal(true)}
                    >
                        <View style={styles.gpsButtonContent}>
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <View style={styles.gpsButtonTextContainer}>
                                <Text style={styles.gpsButtonLabel}>Point de départ</Text>
                                <Text style={styles.gpsButtonValue} numberOfLines={1}>
                                    {departureGPS || 'Sélectionner votre position'}
                                </Text>
                            </View>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.gpsButton, styles.gpsButtonArrival]}
                        onPress={() => setShowArrivalGPSModal(true)}
                    >
                        <View style={styles.gpsButtonContent}>
                            <SafeIcon name="map-pin" size={20} color="#DC2626" />
                            <View style={styles.gpsButtonTextContainer}>
                                <Text style={styles.gpsButtonLabel}>Destination</Text>
                                <Text style={styles.gpsButtonValue} numberOfLines={1}>
                                    {arrivalGPS || 'Sélectionner votre destination'}
                                </Text>
                            </View>
                        </View>
                        <SafeIcon name="chevron-right" size={20} color={modernColors.textSecondary} />
                    </TouchableOpacity>

                    {estimatedPrice && (
                        <View style={styles.priceEstimate}>
                            <Text style={styles.priceEstimateLabel}>
                                {dynamicPrice ? 'Prix IA:' : 'Estimation:'}
                            </Text>
                            <Text style={styles.priceEstimateValue}>
                                {estimatedPrice.toLocaleString('fr-FR')} FCFA
                            </Text>
                            {estimatedDistance && (
                                <Text style={styles.priceEstimateDistance}>
                                    (~{estimatedDistance.toFixed(1)} km)
                                </Text>
                            )}
                        </View>
                    )}

                    {/* ✅ NOUVEAU: Détails prix dynamique IA */}
                    {loadingDynamicPrice && (
                        <View style={styles.dynamicPriceLoading}>
                            <ActivityIndicator size="small" color={modernColors.primary} />
                            <Text style={styles.dynamicPriceLoadingText}>Calcul du prix intelligent IA...</Text>
                        </View>
                    )}

                    {dynamicPrice && !loadingDynamicPrice && (
                        <View style={styles.dynamicPriceContainer}>
                            <View style={styles.dynamicPriceHeader}>
                                <SafeIcon name="sparkles" size={16} color="#8B5CF6" />
                                <Text style={styles.dynamicPriceTitle}>Prix intelligent IA</Text>
                                <View style={styles.confidenceBadge}>
                                    <Text style={styles.confidenceText}>
                                        {Math.round(dynamicPrice.confidence * 100)}% confiance
                                    </Text>
                                </View>
                            </View>

                            {dynamicPrice.dynamic_multiplier !== 1.0 && (
                                <View style={styles.surgeInfo}>
                                    <SafeIcon
                                        name={dynamicPrice.dynamic_multiplier > 1.0 ? 'trending-up' : 'trending-down'}
                                        size={14}
                                        color={dynamicPrice.dynamic_multiplier > 1.0 ? '#F59E0B' : '#10B981'}
                                    />
                                    <Text style={[
                                        styles.surgeText,
                                        { color: dynamicPrice.dynamic_multiplier > 1.0 ? '#F59E0B' : '#10B981' }
                                    ]}>
                                        {dynamicPrice.dynamic_multiplier > 1.0
                                            ? `+${Math.round((dynamicPrice.dynamic_multiplier - 1) * 100)}% (forte demande)`
                                            : `-${Math.round((1 - dynamicPrice.dynamic_multiplier) * 100)}% (faible demande)`
                                        }
                                    </Text>
                                </View>
                            )}

                            {dynamicPrice.reasoning && (
                                <Text style={styles.dynamicPriceReasoning}>
                                    {dynamicPrice.reasoning}
                                </Text>
                            )}
                        </View>
                    )}
                </NativeCard>

                {/* Notes */}
                <NativeCard style={styles.card}>
                    <Text style={styles.cardTitle}>Notes (optionnel)</Text>
                    <NativeInput
                        placeholder="Informations supplémentaires pour le chauffeur..."
                        value={notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                        style={styles.notesInput}
                    />
                </NativeCard>

                {/* Assurance */}
                <NativeCard style={styles.card}>
                    <View style={styles.detailRow}>
                        <Text style={styles.cardTitle}>Assurance</Text>
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

                {/* Contact rapide */}
                {(taxi.telephone || taxi.whatsapp) && (
                    <NativeCard style={styles.card}>
                        <Text style={styles.cardTitle}>Contact rapide</Text>
                        <View style={styles.contactButtons}>
                            {taxi.telephone && (
                                <TouchableOpacity
                                    style={[styles.contactButton, styles.callButton]}
                                    onPress={handleCall}
                                >
                                    <SafeIcon name="phone" size={20} color="#fff" />
                                    <Text style={styles.contactButtonText}>Appeler</Text>
                                </TouchableOpacity>
                            )}
                            {taxi.whatsapp && (
                                <TouchableOpacity
                                    style={[styles.contactButton, styles.whatsappButton]}
                                    onPress={handleWhatsApp}
                                >
                                    <SafeIcon name="message-circle" size={20} color="#fff" />
                                    <Text style={styles.contactButtonText}>WhatsApp</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </NativeCard>
                )}

                {/* Bouton réservation */}
                <NativeButton
                    title={booking ? 'Réservation en cours...' : estimatedPrice ? `Réserver - ${estimatedPrice.toLocaleString('fr-FR')} FCFA` : 'Réserver'}
                    onPress={handleBook}
                    disabled={booking || !departureGPS || !arrivalGPS || !taxi.is_available_now}
                    variant="primary"
                    size="large"
                    icon="calendar-check"
                    style={styles.bookButton}
                />
            </ScrollView>

            {/* Modals GPS */}
            <ModernGPSModal
                visible={showDepartureGPSModal}
                onClose={() => setShowDepartureGPSModal(false)}
                onSelect={(coordinates) => handleGPSSelect(coordinates, 'departure')}
                title="Point de départ"
                initialCoordinates={departureGPS}
            />

            <ModernGPSModal
                visible={showArrivalGPSModal}
                onClose={() => setShowArrivalGPSModal(false)}
                onSelect={(coordinates) => handleGPSSelect(coordinates, 'arrival')}
                title="Destination"
                initialCoordinates={arrivalGPS}
            />
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
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
    },
    infoText: {
        fontSize: 14,
        color: '#374151',
    },
    statusRow: {
        marginTop: 8,
    },
    statusBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: '#EF4444' + '20',
    },
    statusBadgeAvailable: {
        backgroundColor: '#10B981' + '20',
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#EF4444',
    },
    statusTextAvailable: {
        color: '#10B981',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    gpsButtonArrival: {
        borderColor: '#FEE2E2',
        backgroundColor: '#FEF2F2',
    },
    gpsButtonContent: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        gap: 12,
    },
    gpsButtonTextContainer: {
        flex: 1,
    },
    gpsButtonLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 4,
    },
    gpsButtonValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    priceEstimate: {
        marginTop: 12,
        padding: 16,
        backgroundColor: modernColors.primary + '10',
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    priceEstimateLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    priceEstimateValue: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.primary,
    },
    priceEstimateDistance: {
        fontSize: 12,
        color: '#6B7280',
        marginLeft: 'auto',
    },
    notesInput: {
        marginTop: 8,
        minHeight: 80,
    },
    detailRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
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
    contactButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    contactButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 14,
        borderRadius: 12,
    },
    callButton: {
        backgroundColor: modernColors.primary,
    },
    whatsappButton: {
        backgroundColor: '#25D366',
    },
    contactButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },
    bookButton: {
        marginTop: 8,
    },
    dynamicPriceLoading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 12,
        padding: 12,
        backgroundColor: '#F5F3FF',
        borderRadius: 8,
    },
    dynamicPriceLoadingText: {
        fontSize: 13,
        color: '#8B5CF6',
    },
    dynamicPriceContainer: {
        marginTop: 12,
        padding: 14,
        backgroundColor: '#F5F3FF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#DDD6FE',
    },
    dynamicPriceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dynamicPriceTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#8B5CF6',
        flex: 1,
    },
    confidenceBadge: {
        backgroundColor: '#8B5CF620',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    confidenceText: {
        fontSize: 11,
        fontWeight: '600',
        color: '#8B5CF6',
    },
    surgeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
    },
    surgeText: {
        fontSize: 13,
        fontWeight: '600',
    },
    dynamicPriceReasoning: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 8,
        lineHeight: 18,
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
});

export default TaxiBookingScreen;

