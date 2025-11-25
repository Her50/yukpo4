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

const HopitalFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const serviceId = (route.params as any)?.serviceId;

    const [formData, setFormData] = useState({
        nom: '',
        type_etablissement: 'Hôpital',
        adresse: '',
        quartier: '',
        ville: '',
        prestations_medicales: [] as string[],
        banque_sang: false,
        urgences_disponible: false,
        rdv_en_ligne: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
        site_web: '',
    });

    const [loading, setLoading] = useState(false);
    const [selectedPrestations, setSelectedPrestations] = useState<string[]>([]);

    const typesEtablissement = ['Hôpital', 'Clinique', 'Centre de santé', 'Dispensaire'];
    const prestationsOptions = [
        'Urgences',
        'Consultation générale',
        'Chirurgie',
        'Maternité',
        'Pédiatrie',
        'Cardiologie',
        'Radiologie',
    ];

    const togglePrestation = (prestation: string) => {
        setSelectedPrestations((prev) =>
            prev.includes(prestation)
                ? prev.filter((p) => p !== prestation)
                : [...prev, prestation]
        );
    };

    const handleSubmit = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom de l\'établissement est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: serviceId,
                nom: formData.nom,
                type_etablissement: formData.type_etablissement,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null,
                prestations_medicales: selectedPrestations.length > 0 ? selectedPrestations : null,
                banque_sang: formData.banque_sang,
                urgences_disponible: formData.urgences_disponible,
                rdv_en_ligne: formData.rdv_en_ligne,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                site_web: formData.site_web || null,
            };

            const response = await apiPost('/api/hopitaux', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Établissement de santé enregistré avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer l\'établissement');
            }
        } catch (error: any) {
            console.error('Erreur création hôpital:', error);
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
                <Text style={styles.title}>Enregistrer un Hôpital/Clinique</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nom de l'établissement *</Text>
                    <NativeInput
                        value={formData.nom}
                        onChangeText={(text) => setFormData({ ...formData, nom: text })}
                        placeholder="Ex: Hôpital Central"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Type d'établissement</Text>
                    <View style={styles.chipsContainer}>
                        {typesEtablissement.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.chip,
                                    formData.type_etablissement === type && styles.chipSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, type_etablissement: type })}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        formData.type_etablissement === type && styles.chipTextSelected,
                                    ]}
                                >
                                    {type}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
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
                    <Text style={styles.label}>Prestations médicales</Text>
                    <View style={styles.chipsContainer}>
                        {prestationsOptions.map((prestation) => (
                            <TouchableOpacity
                                key={prestation}
                                style={[
                                    styles.chip,
                                    selectedPrestations.includes(prestation) && styles.chipSelected,
                                ]}
                                onPress={() => togglePrestation(prestation)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedPrestations.includes(prestation) && styles.chipTextSelected,
                                    ]}
                                >
                                    {prestation}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Banque de sang</Text>
                    <Switch
                        value={formData.banque_sang}
                        onValueChange={(value) => setFormData({ ...formData, banque_sang: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Urgences disponibles</Text>
                    <Switch
                        value={formData.urgences_disponible}
                        onValueChange={(value) => setFormData({ ...formData, urgences_disponible: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Rendez-vous en ligne</Text>
                    <Switch
                        value={formData.rdv_en_ligne}
                        onValueChange={(value) => setFormData({ ...formData, rdv_en_ligne: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
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
                    <Text style={styles.label}>Téléphone urgence</Text>
                    <NativeInput
                        value={formData.telephone_urgence}
                        onChangeText={(text) => setFormData({ ...formData, telephone_urgence: text })}
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
                        placeholder="hopital@example.com"
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
                    disabled={loading || !formData.nom.trim()}
                    variant="primary"
                    style={styles.submitButton}
                >
                    <Text style={styles.submitButtonText}>
                        {loading ? 'Enregistrement...' : 'Enregistrer l\'Établissement'}
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

export default HopitalFormScreen;

