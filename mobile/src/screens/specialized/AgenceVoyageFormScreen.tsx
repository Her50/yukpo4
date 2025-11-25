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
import BusModelForm, { BusModel } from '../../components/bus/BusModelForm';

const AgenceVoyageFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const serviceId = (route.params as any)?.serviceId;

    const [formData, setFormData] = useState({
        nom_agence: '',
        adresse: '',
        quartier: '',
        ville: '',
        services_voyage: [] as string[],
        compagnies_bus: [] as string[],
        destinations: [] as string[],
        heures_ouverture: '08:00',
        heures_fermeture: '18:00',
        jours_ouverture: '',
        telephone: '',
        whatsapp: '',
        email: '',
        site_web: '',
        peut_emettre_tickets_bus: false,
        compagnies_affiliees: [] as string[],
    });

    const [loading, setLoading] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [selectedCompagnies, setSelectedCompagnies] = useState<string[]>([]);
    const [selectedDestinations, setSelectedDestinations] = useState<string[]>([]);
    const [selectedAffiliees, setSelectedAffiliees] = useState<string[]>([]);
    
    // Gestion des modèles de bus
    const [busModels, setBusModels] = useState<BusModel[]>([]);
    const [showBusModelForm, setShowBusModelForm] = useState(false);
    const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);

    const servicesOptions = ['Billetterie bus', 'Billetterie avion', 'Organisation voyages', 'Visa'];
    const compagniesOptions = ['Voyages Express', 'Amour Mezam', 'Camair-Co', 'Brussels Airlines', 'Air France'];
    const destinationsOptions = ['Douala', 'Yaoundé', 'Bafoussam', 'Bamenda', 'Garoua', 'Maroua', 'Paris', 'Bruxelles'];
    const compagniesAffilieesOptions = ['Voyages Express', 'Amour Mezam', 'Camair-Co'];

    const toggleService = (service: string) => {
        setSelectedServices((prev) =>
            prev.includes(service)
                ? prev.filter((s) => s !== service)
                : [...prev, service]
        );
    };

    const toggleCompagnie = (compagnie: string) => {
        setSelectedCompagnies((prev) =>
            prev.includes(compagnie)
                ? prev.filter((c) => c !== compagnie)
                : [...prev, compagnie]
        );
    };

    const toggleDestination = (destination: string) => {
        setSelectedDestinations((prev) =>
            prev.includes(destination)
                ? prev.filter((d) => d !== destination)
                : [...prev, destination]
        );
    };

    const toggleAffiliee = (compagnie: string) => {
        setSelectedAffiliees((prev) =>
            prev.includes(compagnie)
                ? prev.filter((c) => c !== compagnie)
                : [...prev, compagnie]
        );
    };

    const handleSubmit = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom_agence.trim()) {
            Alert.alert('Erreur', 'Le nom de l\'agence est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: serviceId,
                nom_agence: formData.nom_agence,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null,
                services_voyage: selectedServices.length > 0 ? selectedServices : null,
                compagnies_bus: selectedCompagnies.length > 0 ? selectedCompagnies : null,
                destinations: selectedDestinations.length > 0 ? selectedDestinations : null,
                heures_ouverture: formData.heures_ouverture || null,
                heures_fermeture: formData.heures_fermeture || null,
                jours_ouverture: formData.jours_ouverture || null,
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                site_web: formData.site_web || null,
                peut_emettre_tickets_bus: formData.peut_emettre_tickets_bus,
                compagnies_affiliees: selectedAffiliees.length > 0 ? selectedAffiliees : null,
            };

            const response = await apiPost('/api/agences-voyage', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Agence de voyage enregistrée avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer l\'agence');
            }
        } catch (error: any) {
            console.error('Erreur création agence:', error);
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
                <Text style={styles.title}>Enregistrer une Agence de Voyage</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nom de l'agence *</Text>
                    <NativeInput
                        value={formData.nom_agence}
                        onChangeText={(text) => setFormData({ ...formData, nom_agence: text })}
                        placeholder="Ex: Agence Voyages Express"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Adresse</Text>
                    <NativeInput
                        value={formData.adresse}
                        onChangeText={(text) => setFormData({ ...formData, adresse: text })}
                        placeholder="Adresse complète"
                        multiline
                    />
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Quartier</Text>
                        <NativeInput
                            value={formData.quartier}
                            onChangeText={(text) => setFormData({ ...formData, quartier: text })}
                            placeholder="Quartier"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Ville</Text>
                        <NativeInput
                            value={formData.ville}
                            onChangeText={(text) => setFormData({ ...formData, ville: text })}
                            placeholder="Ville"
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Services offerts</Text>
                    <View style={styles.chipsContainer}>
                        {servicesOptions.map((service) => (
                            <TouchableOpacity
                                key={service}
                                style={[
                                    styles.chip,
                                    selectedServices.includes(service) && styles.chipSelected,
                                ]}
                                onPress={() => toggleService(service)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedServices.includes(service) && styles.chipTextSelected,
                                    ]}
                                >
                                    {service}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Compagnies de bus</Text>
                    <View style={styles.chipsContainer}>
                        {compagniesOptions.map((compagnie) => (
                            <TouchableOpacity
                                key={compagnie}
                                style={[
                                    styles.chip,
                                    selectedCompagnies.includes(compagnie) && styles.chipSelected,
                                ]}
                                onPress={() => toggleCompagnie(compagnie)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedCompagnies.includes(compagnie) && styles.chipTextSelected,
                                    ]}
                                >
                                    {compagnie}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Destinations</Text>
                    <View style={styles.chipsContainer}>
                        {destinationsOptions.map((destination) => (
                            <TouchableOpacity
                                key={destination}
                                style={[
                                    styles.chip,
                                    selectedDestinations.includes(destination) && styles.chipSelected,
                                ]}
                                onPress={() => toggleDestination(destination)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedDestinations.includes(destination) && styles.chipTextSelected,
                                    ]}
                                >
                                    {destination}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.row}>
                    <View style={[styles.inputGroup, { flex: 1, marginRight: 8 }]}>
                        <Text style={styles.label}>Heure d'ouverture</Text>
                        <NativeInput
                            value={formData.heures_ouverture}
                            onChangeText={(text) => setFormData({ ...formData, heures_ouverture: text })}
                            placeholder="08:00"
                        />
                    </View>
                    <View style={[styles.inputGroup, { flex: 1, marginLeft: 8 }]}>
                        <Text style={styles.label}>Heure de fermeture</Text>
                        <NativeInput
                            value={formData.heures_fermeture}
                            onChangeText={(text) => setFormData({ ...formData, heures_fermeture: text })}
                            placeholder="18:00"
                        />
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Jours d'ouverture</Text>
                    <NativeInput
                        value={formData.jours_ouverture}
                        onChangeText={(text) => setFormData({ ...formData, jours_ouverture: text })}
                        placeholder="Ex: Lundi - Samedi"
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Peut émettre tickets bus</Text>
                    <Switch
                        value={formData.peut_emettre_tickets_bus}
                        onValueChange={(value) => setFormData({ ...formData, peut_emettre_tickets_bus: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                {formData.peut_emettre_tickets_bus && (
                    <View style={styles.inputGroup}>
                        <View style={styles.busModelsHeader}>
                            <Text style={styles.label}>Modèles de bus</Text>
                            <TouchableOpacity
                                style={styles.addModelButton}
                                onPress={() => {
                                    setEditingModelIndex(null);
                                    setShowBusModelForm(true);
                                }}
                            >
                                <SafeIcon name="plus" size={20} color="#fff" />
                                <Text style={styles.addModelButtonText}>Ajouter</Text>
                            </TouchableOpacity>
                        </View>

                        {busModels.length === 0 ? (
                            <View style={styles.emptyModelsContainer}>
                                <Text style={styles.emptyModelsText}>
                                    Aucun modèle de bus configuré
                                </Text>
                                <Text style={styles.emptyModelsHint}>
                                    Ajoutez un modèle pour permettre la vente de tickets
                                </Text>
                            </View>
                        ) : (
                            <View style={styles.modelsList}>
                                {busModels.map((model, index) => (
                                    <View key={index} style={styles.modelCard}>
                                        <View style={styles.modelCardHeader}>
                                            <View>
                                                <Text style={styles.modelName}>{model.nom_modele}</Text>
                                                <Text style={styles.modelDetails}>
                                                    {model.classe} • {model.total_seats} places • {model.prix_base.toLocaleString()} FCFA
                                                </Text>
                                            </View>
                                            <View style={styles.modelActions}>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        setEditingModelIndex(index);
                                                        setShowBusModelForm(true);
                                                    }}
                                                    style={styles.editButton}
                                                >
                                                    <SafeIcon name="edit" size={18} color={modernColors.primary} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => {
                                                        Alert.alert(
                                                            'Supprimer',
                                                            `Voulez-vous supprimer le modèle "${model.nom_modele}" ?`,
                                                            [
                                                                { text: 'Annuler', style: 'cancel' },
                                                                {
                                                                    text: 'Supprimer',
                                                                    style: 'destructive',
                                                                    onPress: () => {
                                                                        setBusModels(busModels.filter((_, i) => i !== index));
                                                                    },
                                                                },
                                                            ]
                                                        );
                                                    }}
                                                    style={styles.deleteButton}
                                                >
                                                    <SafeIcon name="trash" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                        {model.equipements.length > 0 && (
                                            <View style={styles.equipementsContainer}>
                                                {model.equipements.map((eq, eqIndex) => (
                                                    <View key={eqIndex} style={styles.equipementChip}>
                                                        <Text style={styles.equipementText}>{eq}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        )}
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>
                )}

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Compagnies affiliées</Text>
                    <View style={styles.chipsContainer}>
                        {compagniesAffilieesOptions.map((compagnie) => (
                            <TouchableOpacity
                                key={compagnie}
                                style={[
                                    styles.chip,
                                    selectedAffiliees.includes(compagnie) && styles.chipSelected,
                                ]}
                                onPress={() => toggleAffiliee(compagnie)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedAffiliees.includes(compagnie) && styles.chipTextSelected,
                                    ]}
                                >
                                    {compagnie}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Téléphone</Text>
                    <NativeInput
                        value={formData.telephone}
                        onChangeText={(text) => setFormData({ ...formData, telephone: text })}
                        placeholder="+237 6XX XX XX XX"
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>WhatsApp</Text>
                    <NativeInput
                        value={formData.whatsapp}
                        onChangeText={(text) => setFormData({ ...formData, whatsapp: text })}
                        placeholder="+237 6XX XX XX XX"
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Email</Text>
                    <NativeInput
                        value={formData.email}
                        onChangeText={(text) => setFormData({ ...formData, email: text })}
                        placeholder="agence@example.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Site web</Text>
                    <NativeInput
                        value={formData.site_web}
                        onChangeText={(text) => setFormData({ ...formData, site_web: text })}
                        placeholder="https://..."
                        keyboardType="url"
                        autoCapitalize="none"
                    />
                </View>

                <NativeButton
                    onPress={handleSubmit}
                    disabled={loading || !formData.nom_agence.trim()}
                    variant="primary"
                    style={styles.submitButton}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? 'Enregistrement...' : 'Enregistrer l\'Agence'}
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
    chipsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipText: {
        fontSize: 14,
        color: '#374151',
    },
    chipTextSelected: {
        color: '#fff',
        fontWeight: '600',
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

export default AgenceVoyageFormScreen;

