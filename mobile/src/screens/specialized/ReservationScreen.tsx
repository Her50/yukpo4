// ✅ NOUVEAU: Écran de création de réservation pour services spécialisés

import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface ReservationScreenProps {
    route: {
        params: {
            serviceId: number;
            serviceType: string;
            serviceName: string;
            prestataireId: number;
            reservationType?: 'rdv' | 'place' | 'course' | 'ticket';
        };
    };
    navigation: any;
}

const ReservationScreen: React.FC<ReservationScreenProps> = ({ route, navigation }) => {
    const { user } = useAuth();
    const { serviceId, serviceType, serviceName, prestataireId, reservationType } = route.params;

    const [loading, setLoading] = useState(false);
    const [requestedDate, setRequestedDate] = useState<string>('');
    const [notes, setNotes] = useState('');
    const [details, setDetails] = useState<any>({});

    // Détails spécifiques selon le type
    const [nombrePlaces, setNombrePlaces] = useState(1); // Covoiturage
    const [pickupAddress, setPickupAddress] = useState(''); // Taxi
    const [dropoffAddress, setDropoffAddress] = useState(''); // Taxi
    const [destination, setDestination] = useState(''); // Agence
    const [numberOfTickets, setNumberOfTickets] = useState(1); // Agence
    const [patientName, setPatientName] = useState(''); // Hôpital/Laboratoire
    const [reason, setReason] = useState(''); // Hôpital/Laboratoire

    useEffect(() => {
        // Initialiser les détails selon le type
        if (reservationType === 'place' && serviceType === 'covoiturage') {
            setDetails({ nombre_places: 1 });
        } else if (reservationType === 'course' && serviceType === 'taxi') {
            setDetails({ pickup_address: '', dropoff_address: '' });
        } else if (reservationType === 'ticket' && serviceType === 'agence_voyage') {
            setDetails({ destination: '', number_of_tickets: 1 });
        } else if (reservationType === 'rdv') {
            setDetails({ patient_name: '', reason: '' });
        }
    }, [reservationType, serviceType]);

    const handleCreateReservation = async () => {
        if (!user) {
            Alert.alert('Erreur', 'Vous devez être connecté pour réserver');
            return;
        }

        // Validation selon le type
        if (reservationType === 'rdv' && !requestedDate) {
            Alert.alert('Erreur', 'Veuillez sélectionner une date');
            return;
        }

        if (reservationType === 'place' && nombrePlaces < 1) {
            Alert.alert('Erreur', 'Veuillez sélectionner au moins une place');
            return;
        }

        if (reservationType === 'course' && !pickupAddress) {
            Alert.alert('Erreur', 'Veuillez saisir l\'adresse de prise en charge');
            return;
        }

        setLoading(true);

        try {
            // Construire les détails selon le type
            let reservationDetails: any = { ...details };

            if (reservationType === 'place') {
                reservationDetails = {
                    nombre_places: nombrePlaces,
                };
            } else if (reservationType === 'course') {
                reservationDetails = {
                    pickup_address: pickupAddress,
                    dropoff_address: dropoffAddress || null,
                };
            } else if (reservationType === 'ticket') {
                reservationDetails = {
                    destination,
                    number_of_tickets: numberOfTickets,
                };
            } else if (reservationType === 'rdv') {
                reservationDetails = {
                    patient_name: patientName || null,
                    reason: reason || null,
                };
            }

            const response = await apiPost('/api/specialized-services/reservations', {
                service_id: serviceId,
                service_type: serviceType,
                reservation_type: reservationType || 'rdv',
                requested_date: requestedDate || null,
                details: reservationDetails,
                amount: null, // Sera calculé côté backend si nécessaire
                currency: null,
            });

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Votre réservation a été créée avec succès. Le prestataire vous confirmera bientôt.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.navigate('MesReservations'),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[ReservationScreen] Erreur création réservation:', error);
            Alert.alert('Erreur', 'Une erreur est survenue lors de la création de la réservation');
        } finally {
            setLoading(false);
        }
    };

    const renderSpecificFields = () => {
        if (reservationType === 'place' && serviceType === 'covoiturage') {
            return (
                <View style={styles.section}>
                    <Text style={styles.label}>Nombre de places</Text>
                    <NativeInput
                        value={nombrePlaces.toString()}
                        onChangeText={(text) => setNombrePlaces(parseInt(text) || 1)}
                        keyboardType="numeric"
                        placeholder="1"
                    />
                </View>
            );
        }

        if (reservationType === 'course' && serviceType === 'taxi') {
            return (
                <View style={styles.section}>
                    <Text style={styles.label}>Adresse de prise en charge *</Text>
                    <NativeInput
                        value={pickupAddress}
                        onChangeText={setPickupAddress}
                        placeholder="Adresse de départ"
                    />
                    <Text style={styles.label}>Adresse de destination (optionnel)</Text>
                    <NativeInput
                        value={dropoffAddress}
                        onChangeText={setDropoffAddress}
                        placeholder="Adresse d'arrivée"
                    />
                </View>
            );
        }

        if (reservationType === 'ticket' && serviceType === 'agence_voyage') {
            return (
                <View style={styles.section}>
                    <Text style={styles.label}>Destination *</Text>
                    <NativeInput
                        value={destination}
                        onChangeText={setDestination}
                        placeholder="Ville de destination"
                    />
                    <Text style={styles.label}>Nombre de tickets</Text>
                    <NativeInput
                        value={numberOfTickets.toString()}
                        onChangeText={(text) => setNumberOfTickets(parseInt(text) || 1)}
                        keyboardType="numeric"
                        placeholder="1"
                    />
                </View>
            );
        }

        if (reservationType === 'rdv') {
            return (
                <View style={styles.section}>
                    <Text style={styles.label}>Nom du patient (optionnel)</Text>
                    <NativeInput
                        value={patientName}
                        onChangeText={setPatientName}
                        placeholder="Nom complet"
                    />
                    <Text style={styles.label}>Raison du rendez-vous (optionnel)</Text>
                    <NativeInput
                        value={reason}
                        onChangeText={setReason}
                        placeholder="Décrivez brièvement"
                        multiline
                        numberOfLines={3}
                    />
                </View>
            );
        }

        return null;
    };

    return (
        <ScrollView style={styles.container}>
            <NativeCard style={styles.card}>
                <Text style={styles.title}>Réservation</Text>
                <Text style={styles.serviceName}>{serviceName}</Text>

                {reservationType === 'rdv' && (
                    <View style={styles.section}>
                        <Text style={styles.label}>Date et heure souhaitées *</Text>
                        <NativeInput
                            value={requestedDate}
                            onChangeText={setRequestedDate}
                            placeholder="YYYY-MM-DD HH:MM"
                        />
                        <Text style={styles.hint}>Format: 2025-01-30 14:30</Text>
                    </View>
                )}

                {renderSpecificFields()}

                <View style={styles.section}>
                    <Text style={styles.label}>Notes (optionnel)</Text>
                    <NativeInput
                        value={notes}
                        onChangeText={setNotes}
                        placeholder="Informations complémentaires"
                        multiline
                        numberOfLines={4}
                    />
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={modernColors.primary} />
                ) : (
                    <NativeButton
                        title="Créer la réservation"
                        variant="primary"
                        onPress={handleCreateReservation}
                        style={styles.button}
                    />
                )}
            </NativeCard>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    card: {
        margin: 16,
        padding: 16,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: modernColors.text,
        marginBottom: 8,
    },
    serviceName: {
        fontSize: 18,
        color: modernColors.textSecondary,
        marginBottom: 24,
    },
    section: {
        marginBottom: 20,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    hint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    button: {
        marginTop: 24,
    },
});

export default ReservationScreen;

