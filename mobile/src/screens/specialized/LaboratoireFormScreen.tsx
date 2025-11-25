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

const LaboratoireFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const serviceId = (route.params as any)?.serviceId;

    const [formData, setFormData] = useState({
        nom: '',
        type_laboratoire: 'Laboratoire',
        adresse: '',
        quartier: '',
        ville: '',
        analyses_disponibles: [] as string[],
        imagerie_disponible: [] as string[],
        rdv_requis: true,
        resultats_en_ligne: false,
        telephone: '',
        whatsapp: '',
        email: '',
    });

    const [loading, setLoading] = useState(false);
    const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
    const [selectedImagerie, setSelectedImagerie] = useState<string[]>([]);

    const typesLaboratoire = ['Laboratoire', 'Centre d\'imagerie', 'Les deux'];
    const analysesOptions = ['Sang', 'Urine', 'Bactériologie', 'Parasitologie', 'Sérologie', 'Biochimie'];
    const imagerieOptions = ['Radiologie', 'Échographie', 'Scanner', 'IRM', 'Mammographie'];

    const toggleAnalyse = (analyse: string) => {
        setSelectedAnalyses((prev) =>
            prev.includes(analyse)
                ? prev.filter((a) => a !== analyse)
                : [...prev, analyse]
        );
    };

    const toggleImagerie = (imagerie: string) => {
        setSelectedImagerie((prev) =>
            prev.includes(imagerie)
                ? prev.filter((i) => i !== imagerie)
                : [...prev, imagerie]
        );
    };

    const handleSubmit = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom du laboratoire est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: serviceId,
                nom: formData.nom,
                type_laboratoire: formData.type_laboratoire,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: location
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null,
                analyses_disponibles: selectedAnalyses.length > 0 ? selectedAnalyses : null,
                imagerie_disponible: selectedImagerie.length > 0 ? selectedImagerie : null,
                rdv_requis: formData.rdv_requis,
                resultats_en_ligne: formData.resultats_en_ligne,
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
            };

            const response = await apiPost('/api/laboratoires', payload);

            if (response.success) {
                Alert.alert(
                    'Succès',
                    'Laboratoire enregistré avec succès !',
                    [{ text: 'OK', onPress: () => navigation.goBack() }]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Impossible d\'enregistrer le laboratoire');
            }
        } catch (error: any) {
            console.error('Erreur création laboratoire:', error);
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
                <Text style={styles.title}>Enregistrer un Laboratoire</Text>
            </View>

            <View style={styles.form}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Nom du laboratoire *</Text>
                    <NativeInput
                        value={formData.nom}
                        onChangeText={(text) => setFormData({ ...formData, nom: text })}
                        placeholder="Ex: Laboratoire Central"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Type</Text>
                    <View style={styles.chipsContainer}>
                        {typesLaboratoire.map((type) => (
                            <TouchableOpacity
                                key={type}
                                style={[
                                    styles.chip,
                                    formData.type_laboratoire === type && styles.chipSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, type_laboratoire: type })}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        formData.type_laboratoire === type && styles.chipTextSelected,
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
                    <Text style={styles.label}>Analyses disponibles</Text>
                    <View style={styles.chipsContainer}>
                        {analysesOptions.map((analyse) => (
                            <TouchableOpacity
                                key={analyse}
                                style={[
                                    styles.chip,
                                    selectedAnalyses.includes(analyse) && styles.chipSelected,
                                ]}
                                onPress={() => toggleAnalyse(analyse)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedAnalyses.includes(analyse) && styles.chipTextSelected,
                                    ]}
                                >
                                    {analyse}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Imagerie disponible</Text>
                    <View style={styles.chipsContainer}>
                        {imagerieOptions.map((imagerie) => (
                            <TouchableOpacity
                                key={imagerie}
                                style={[
                                    styles.chip,
                                    selectedImagerie.includes(imagerie) && styles.chipSelected,
                                ]}
                                onPress={() => toggleImagerie(imagerie)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        selectedImagerie.includes(imagerie) && styles.chipTextSelected,
                                    ]}
                                >
                                    {imagerie}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Rendez-vous requis</Text>
                    <Switch
                        value={formData.rdv_requis}
                        onValueChange={(value) => setFormData({ ...formData, rdv_requis: value })}
                        trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                    />
                </View>

                <View style={styles.switchGroup}>
                    <Text style={styles.label}>Résultats en ligne</Text>
                    <Switch
                        value={formData.resultats_en_ligne}
                        onValueChange={(value) => setFormData({ ...formData, resultats_en_ligne: value })}
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
                        placeholder="labo@example.com"
                        keyboardType="email-address"
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
                        {loading ? 'Enregistrement...' : 'Enregistrer le Laboratoire'}
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

export default LaboratoireFormScreen;

