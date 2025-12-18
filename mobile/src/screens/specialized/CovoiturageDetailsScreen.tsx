// ✅ Phase 1.4: Détails d'un covoiturage avec chat intégré et profil conducteur enrichi
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import ChatModalMobile from '../../components/ChatModalMobile';
import CovoiturageDriverProfile from '../../components/covoiturage/CovoiturageDriverProfile';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface CovoiturageDetails {
    id: number;
    service_id: number;
    user_id: number;
    depart: string;
    destination: string;
    gps_depart?: string;
    gps_destination?: string;
    date_depart: string;
    heure_depart?: string;
    nombre_places: number;
    places_disponibles: number;
    prix_par_place: number;
    devise: string;
    statut: string;
    type_vehicule?: string;
    marque_modele?: string;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
    };
}

interface CovoiturageDetailsScreenParams {
    covoiturageId: number;
}

const CovoiturageDetailsScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const params = route.params as CovoiturageDetailsScreenParams;

    const [covoiturage, setCovoiturage] = useState<CovoiturageDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);
    const [numberOfPlaces, setNumberOfPlaces] = useState(1);
    const [passengerNames, setPassengerNames] = useState('');
    const [notes, setNotes] = useState('');
    const [showChat, setShowChat] = useState(false);
    const [driverReviews, setDriverReviews] = useState<any[]>([]);
    const [loadingReviews, setLoadingReviews] = useState(false);

    useEffect(() => {
        loadCovoiturageDetails();
    }, []);

    useEffect(() => {
        if (covoiturage?.prestataire?.user_id) {
            loadDriverReviews();
        }
    }, [covoiturage?.prestataire?.user_id]);

    const loadCovoiturageDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/covoiturages/${params.covoiturageId}`);

            if (response.success && response.data) {
                setCovoiturage(response.data);
            } else {
                Alert.alert('Erreur', 'Impossible de charger les détails du trajet');
                navigation.goBack();
            }
        } catch (error: any) {
            console.error('[CovoiturageDetailsScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les détails');
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    const loadDriverReviews = async () => {
        if (!covoiturage?.prestataire?.user_id) return;
        try {
            setLoadingReviews(true);
            const response = await apiGet(`/api/covoiturages/${params.covoiturageId}/reviews`);
            if (response.success && response.data) {
                setDriverReviews(response.data.reviews || []);
            }
        } catch (error: any) {
            console.error('[CovoiturageDetailsScreen] Erreur chargement avis:', error);
        } finally {
            setLoadingReviews(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            Alert.alert('Connexion requise', 'Veuillez vous connecter pour réserver une place');
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

        try {
            setBooking(true);
            const response = await apiPost(`/api/covoiturages/${params.covoiturageId}/book`, {
                number_of_places: numberOfPlaces,
                passenger_names: passengerNames ? passengerNames.split(',').map(n => n.trim()) : undefined,
                notes: notes || undefined,
            });

            if (response.success) {
                const totalPrice = numberOfPlaces * covoiturage.prix_par_place;
                Alert.alert(
                    'Réservation créée',
                    `${numberOfPlaces} place(s) réservée(s) pour ${totalPrice.toLocaleString('fr-FR')} ${covoiturage.devise}`,
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[CovoiturageDetailsScreen] Erreur réservation:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la réservation');
        } finally {
            setBooking(false);
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

    if (!covoiturage) {
        return (
            <View style={styles.centerContainer}>
                <Text style={styles.errorText}>Trajet non trouvé</Text>
            </View>
        );
    }

    const totalPrice = numberOfPlaces * covoiturage.prix_par_place;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Détails du trajet</Text>
            </View>

            <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer}>
                <NativeCard style={styles.card}>
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

                    <View style={styles.infoSection}>
                        <View style={styles.infoRow}>
                            <SafeIcon name="calendar" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>
                                {new Date(covoiturage.date_depart).toLocaleDateString('fr-FR', {
                                    weekday: 'long',
                                    day: 'numeric',
                                    month: 'long',
                                    year: 'numeric',
                                })}
                            </Text>
                        </View>

                        {covoiturage.heure_depart && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="clock" size={20} color={modernColors.textSecondary} />
                                <Text style={styles.infoText}>{covoiturage.heure_depart.substring(0, 5)}</Text>
                            </View>
                        )}

                        <View style={styles.infoRow}>
                            <SafeIcon name="users" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>
                                {covoiturage.places_disponibles} / {covoiturage.nombre_places} places disponibles
                            </Text>
                        </View>

                        <View style={styles.infoRow}>
                            <SafeIcon name="dollar-sign" size={20} color={modernColors.textSecondary} />
                            <Text style={styles.infoText}>
                                {covoiturage.prix_par_place.toLocaleString('fr-FR')} {covoiturage.devise} / place
                            </Text>
                        </View>

                        {covoiturage.type_vehicule && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="car" size={20} color={modernColors.textSecondary} />
                                <Text style={styles.infoText}>{covoiturage.type_vehicule}</Text>
                            </View>
                        )}

                        {covoiturage.marque_modele && (
                            <View style={styles.infoRow}>
                                <SafeIcon name="info" size={20} color={modernColors.textSecondary} />
                                <Text style={styles.infoText}>{covoiturage.marque_modele}</Text>
                            </View>
                        )}
                    </View>

                </NativeCard>

                {/* Profil conducteur enrichi */}
                {covoiturage.prestataire && (
                    <CovoiturageDriverProfile
                        driver={{
                            user_id: covoiturage.prestataire.user_id,
                            nom_complet: covoiturage.prestataire.nom_complet,
                            avatar_url: covoiturage.prestataire.avatar_url,
                            note_moyenne: (covoiturage.prestataire as any).note_moyenne,
                            nombre_trajets: (covoiturage.prestataire as any).nombre_trajets,
                            nombre_avis: (covoiturage.prestataire as any).nombre_avis,
                            date_inscription: (covoiturage.prestataire as any).date_inscription,
                            is_verified: (covoiturage.prestataire as any).is_verified,
                            badges: (covoiturage.prestataire as any).badges
                        }}
                        reviews={driverReviews}
                        onContactPress={() => setShowChat(true)}
                        onViewAllReviews={() => {
                            // TODO: Naviguer vers écran tous les avis
                            Alert.alert('Avis', 'Page tous les avis à venir');
                        }}
                    />
                )}

                {covoiturage.statut === 'ouvert' && covoiturage.places_disponibles > 0 && (
                    <NativeCard style={styles.bookingCard}>
                        <Text style={styles.bookingTitle}>Réserver une place</Text>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Nombre de places</Text>
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

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Noms des passagers (optionnel, séparés par virgule)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={passengerNames}
                                onChangeText={setPassengerNames}
                                placeholder="Ex: Jean Dupont, Marie Martin"
                                multiline
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Notes (optionnel)</Text>
                            <TextInput
                                style={styles.textInput}
                                value={notes}
                                onChangeText={setNotes}
                                placeholder="Informations complémentaires..."
                                multiline
                            />
                        </View>

                        <View style={styles.totalRow}>
                            <Text style={styles.totalLabel}>Total:</Text>
                            <Text style={styles.totalPrice}>
                                {totalPrice.toLocaleString('fr-FR')} {covoiturage.devise}
                            </Text>
                        </View>

                        {/* ✅ Bouton différent selon si propriétaire ou client */}
                        {covoiturage.user_id === user?.id ? (
                            <NativeButton
                                title="Gérer mon trajet"
                                onPress={() => {
                                    navigation.navigate('MyTrips' as never);
                                }}
                                icon="settings"
                                variant="secondary"
                                style={styles.bookButton}
                            />
                        ) : (
                            <NativeButton
                                title={`Réserver ${numberOfPlaces} place${numberOfPlaces > 1 ? 's' : ''}`}
                                onPress={() => {
                                    // Naviguer vers écran réservation dédié
                                    navigation.navigate('CovoiturageBooking' as never, {
                                        covoiturageId: params.covoiturageId,
                                        numberOfPlaces,
                                        passengerNames,
                                        notes
                                    } as never);
                                }}
                                disabled={booking || numberOfPlaces > covoiturage.places_disponibles}
                                icon="check"
                                variant="primary"
                                style={styles.bookButton}
                            />
                        )}
                    </NativeCard>
                )}
            </ScrollView>

            {/* Chat modal */}
            {covoiturage && covoiturage.prestataire && user && (
                <ChatModalMobile
                    visible={showChat}
                    onClose={() => setShowChat(false)}
                    service={{
                        id: covoiturage.service_id,
                        titre_service: `Covoiturage ${covoiturage.depart} → ${covoiturage.destination}`,
                        user_id: covoiturage.user_id
                    }}
                    prestataireInfo={covoiturage.prestataire}
                    user={user}
                />
            )}
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
    routeRow: {
        marginBottom: 20,
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
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    infoSection: {
        gap: 12,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
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
    bookingCard: {
        padding: 20,
    },
    bookingTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
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
        flex: 1,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: '#111827',
        minHeight: 80,
        textAlignVertical: 'top',
    },
    totalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    totalLabel: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
    },
    totalPrice: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
    },
    bookButton: {
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

export default CovoiturageDetailsScreen;

