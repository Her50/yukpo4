import DateTimePicker from '@react-native-community/datetimepicker';
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeInput } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const CovoiturageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const serviceId = (route.params as any)?.serviceId;

    const [formData, setFormData] = useState({
        depart: '',
        destination: '',
        date_depart: new Date(),
        heure_depart: '08:00',
        type_vehicule: '',
        marque_modele: '',
        nombre_places: '4',
        places_disponibles: '4',
        prix_par_place: '',
        devise: 'XAF',
        bagages_autorises: true,
        animaux_autorises: false,
        fumeur_autorise: false,
        climatisation: false,
    });

    const [loading, setLoading] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const handleSubmit = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.depart.trim() || !formData.destination.trim()) {
            Alert.alert('Erreur', 'Le point de départ et la destination sont obligatoires');
            return;
        }

        if (!formData.prix_par_place.trim()) {
            Alert.alert('Erreur', 'Le prix par place est obligatoire');
            return;
        }

        try {
            setLoading(true);

            // Formater la date au format ISO 8601
            const dateStr = formData.date_depart.toISOString();

            const payload = {
                service_id: serviceId,
                depart: formData.depart,
                destination: formData.destination,
                gps_depart: location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null,
                gps_destination: null, // À enrichir avec géocodage si nécessaire
                date_depart: dateStr,
                heure_depart: formData.heure_depart,
                type_vehicule: formData.type_vehicule || null,
                marque_modele: formData.marque_modele || null,
                nombre_places: parseInt(formData.nombre_places) || 4,
                places_disponibles: parseInt(formData.places_disponibles) || 4,
                prix_par_place: parseInt(formData.prix_par_place) || 0,
                devise: formData.devise,
                bagages_autorises: formData.bagages_autorises,
                animaux_autorises: formData.animaux_autorises,
                fumeur_autorise: formData.fumeur_autorise,
                climatisation: formData.climatisation,
            };

            const response = await apiPost('/api/covoiturages', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Trajet de covoiturage créé avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible de créer le trajet');
            }
        } catch (error: any) {
            console.error('Erreur création covoiturage:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Proposer un Covoiturage</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Point de départ *</Text>
                    <NativeInput
                        value={formData.depart}
                        onChangeText={(text) => setFormData({ ...formData, depart: text })}
                        placeholder="Ex: Douala, Carrefour Ange Raphaël"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Destination *</Text>
                    <NativeInput
                        value={formData.destination}
                        onChangeText={(text) => setFormData({ ...formData, destination: text })}
                        placeholder="Ex: Yaoundé, Gare routière"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date de départ *</Text>
                    <TouchableOpacity
                        style={styles.dateButton}
                        onPress={() => setShowDatePicker(true)}
                    >
                        <Text style={styles.dateButtonText}>
                            {formData.date_depart.toLocaleDateString('fr-FR')}
                        </Text>
                        <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                    </TouchableOpacity>
                    {showDatePicker && (
                        <DateTimePicker
                            value={formData.date_depart}
                            mode="date"
                            display="default"
                            minimumDate={new Date()}
                            onChange={(event, selectedDate) => {
                                setShowDatePicker(false);
                                if (selectedDate) {
                                    setFormData({ ...formData, date_depart: selectedDate });
                                }
                            }}
                        />
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Heure de départ *</Text>
                    <NativeInput
                        value={formData.heure_depart}
                        onChangeText={(text) => setFormData({ ...formData, heure_depart: text })}
                        placeholder="08:00"
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Type de véhicule</Text>
                        <NativeInput
                            value={formData.type_vehicule}
                            onChangeText={(text) => setFormData({ ...formData, type_vehicule: text })}
                            placeholder="Ex: Berline"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Marque/Modèle</Text>
                        <NativeInput
                            value={formData.marque_modele}
                            onChangeText={(text) => setFormData({ ...formData, marque_modele: text })}
                            placeholder="Ex: Toyota Corolla"
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Nombre de places</Text>
                        <NativeInput
                            value={formData.nombre_places}
                            onChangeText={(text) => setFormData({ ...formData, nombre_places: text })}
                            placeholder="4"
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Places disponibles</Text>
                        <NativeInput
                            value={formData.places_disponibles}
                            onChangeText={(text) => setFormData({ ...formData, places_disponibles: text })}
                            placeholder="4"
                            keyboardType="numeric"
                        />
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Prix par place *</Text>
                        <NativeInput
                            value={formData.prix_par_place}
                            onChangeText={(text) => setFormData({ ...formData, prix_par_place: text })}
                            placeholder="5000"
                            keyboardType="numeric"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Devise</Text>
                        <NativeInput
                            value={formData.devise}
                            onChangeText={(text) => setFormData({ ...formData, devise: text })}
                            placeholder="XAF"
                        />
                    </View>
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Bagages autorisés</Text>
                    <Switch
                        value={formData.bagages_autorises}
                        onValueChange={(value) => setFormData({ ...formData, bagages_autorises: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Animaux autorisés</Text>
                    <Switch
                        value={formData.animaux_autorises}
                        onValueChange={(value) => setFormData({ ...formData, animaux_autorises: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Fumeur autorisé</Text>
                    <Switch
                        value={formData.fumeur_autorise}
                        onValueChange={(value) => setFormData({ ...formData, fumeur_autorise: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Climatisation</Text>
                    <Switch
                        value={formData.climatisation}
                        onValueChange={(value) => setFormData({ ...formData, climatisation: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <NativeButton
                    onPress={handleSubmit}
                    disabled={loading || !formData.depart.trim() || !formData.destination.trim() || !formData.prix_par_place.trim()}
                    variant="primary"
                    style={styles.submitButton}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? 'Création...' : 'Créer le Trajet'}
                    </Text>
                </NativeButton>
            </View>
        </ScrollView>
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
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    form: {
        padding: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingVertical: 8,
    },
    dateButton: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#fff',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    dateButtonText: {
        fontSize: 16,
        color: '#111827',
    },
    submitButton: {
        marginTop: 24,
    },
    submitButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default CovoiturageFormScreen;

