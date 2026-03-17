// @ts-nocheck
// ✅ Écran d'enregistrement pour les libraires partenaires

import React, { useState, useCallback } from 'react';
import {
    Alert,
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import ModernGPSModal from '../components/ModernGPSModal';
import { useToaster } from '../components/ToasterProvider';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiPost } from '../services/api';
import { modernColors, modernStyles } from '../theme/modernTheme';

interface LibrairieFormData {
    nom: string;
    email: string;
    telephone: string;
    adresse: string;
    ville: string;
    pays: string;
    type_fournisseur: string;
    gps_coordinates: string | null;
}

const LibrairieRegistrationScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();
    const toaster = useToaster();

    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    const [formData, setFormData] = useState<LibrairieFormData>({
        nom: '',
        email: '',
        telephone: '',
        adresse: '',
        ville: '',
        pays: 'Cameroun',
        type_fournisseur: 'librairie',
        gps_coordinates: null,
    });

    // Types de fournisseurs disponibles
    const fournisseurTypes = [
        { value: 'librairie', label: 'Librairie' },
        { value: 'fournisseur_scolaire', label: 'Fournisseur Scolaire' },
        { value: 'editeur', label: 'Éditeur' },
        { value: 'distributeur', label: 'Distributeur' },
    ];

    // Mettre à jour les données du formulaire
    const updateFormData = useCallback((field: keyof LibrairieFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Gérer la sélection GPS
    const handleGPSLocationSelected = useCallback((location: any) => {
        if (location && location.latitude && location.longitude) {
            const gpsString = `${location.latitude},${location.longitude}`;
            updateFormData('gps_coordinates', gpsString);
            
            // Extraire la ville si disponible
            if (location.city || location.locality) {
                updateFormData('ville', location.city || location.locality);
            }
            
            toaster?.show?.('Localisation enregistrée avec succès', 'success');
        }
        setShowGPSModal(false);
    }, [updateFormData, toaster]);

    // Valider le formulaire
    const validateForm = useCallback(() => {
        if (!formData.nom.trim()) {
            Alert.alert('Erreur', 'Le nom de la librairie est requis');
            return false;
        }
        
        if (!formData.email.trim()) {
            Alert.alert('Erreur', 'L\'email est requis');
            return false;
        }
        
        if (!formData.telephone.trim()) {
            Alert.alert('Erreur', 'Le numéro de téléphone est requis');
            return false;
        }
        
        if (!formData.adresse.trim()) {
            Alert.alert('Erreur', 'L\'adresse est requise');
            return false;
        }
        
        if (!formData.ville.trim()) {
            Alert.alert('Erreur', 'La ville est requise');
            return false;
        }
        
        if (!formData.gps_coordinates) {
            Alert.alert('Erreur', 'La localisation GPS est requise pour être référencé');
            return false;
        }
        
        // Validation email simple
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            Alert.alert('Erreur', 'L\'email n\'est pas valide');
            return false;
        }
        
        return true;
    }, [formData]);

    // Soumettre le formulaire
    const handleSubmit = useCallback(async () => {
        if (!validateForm()) return;
        
        setLoading(true);
        
        try {
            const payload = {
                nom: formData.nom,
                email: formData.email,
                telephone: formData.telephone,
                adresse: formData.adresse,
                ville: formData.ville,
                pays: formData.pays,
                type_fournisseur: formData.type_fournisseur,
                gps: formData.gps_coordinates,
            };
            
            const response = await apiPost('/api/librairie-network/register', payload);
            
            if (response.success) {
                Alert.alert(
                    'Inscription réussie!',
                    'Votre demande d\'inscription a été soumise. Vous recevrez un email dès qu\'elle sera validée.',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.message || 'Une erreur est survenue lors de l\'inscription');
            }
        } catch (error: any) {
            console.error('Erreur inscription librairie:', error);
            Alert.alert(
                'Erreur',
                error.response?.data?.message || 'Une erreur est survenue lors de l\'inscription'
            );
        } finally {
            setLoading(false);
        }
    }, [formData, validateForm, navigation]);

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Devenir Libraire Partenaire</Text>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                <View style={styles.infoCard}>
                    <SafeIcon name="info" size={20} color={modernColors.primary} />
                    <Text style={styles.infoText}>
                        Rejoignez notre réseau de librairies partenaires et touchez une commission de 5% sur chaque vente de livre neuf.
                    </Text>
                </View>

                {/* Nom de la librairie */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Nom de la librairie *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.nom}
                        onChangeText={(value) => updateFormData('nom', value)}
                        placeholder="Ex: Librairie Excellence"
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Type de fournisseur */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Type de fournisseur *</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                        {fournisseurTypes.map((type) => (
                            <TouchableOpacity
                                key={type.value}
                                style={[
                                    styles.typeChip,
                                    formData.type_fournisseur === type.value && styles.typeChipActive,
                                ]}
                                onPress={() => updateFormData('type_fournisseur', type.value)}
                            >
                                <Text style={[
                                    styles.typeChipText,
                                    formData.type_fournisseur === type.value && styles.typeChipTextActive,
                                ]}>
                                    {type.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Email */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Email *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.email}
                        onChangeText={(value) => updateFormData('email', value)}
                        placeholder="contact@librairie.com"
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Téléphone */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Téléphone *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.telephone}
                        onChangeText={(value) => updateFormData('telephone', value)}
                        placeholder="+237 6 XX XX XX XX"
                        keyboardType="phone-pad"
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Adresse */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Adresse physique *</Text>
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        value={formData.adresse}
                        onChangeText={(value) => updateFormData('adresse', value)}
                        placeholder="Rue N°, Quartier, Ville..."
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Ville */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Ville *</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.ville}
                        onChangeText={(value) => updateFormData('ville', value)}
                        placeholder="Douala, Yaoundé, etc."
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Pays */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Pays</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.pays}
                        onChangeText={(value) => updateFormData('pays', value)}
                        placeholder="Cameroun"
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Localisation GPS */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>Localisation GPS * </Text>
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => setShowGPSModal(true)}
                    >
                        <SafeIcon 
                            name={formData.gps_coordinates ? "check-circle" : "map-pin"} 
                            size={20} 
                            color={formData.gps_coordinates ? modernColors.success : modernColors.primary} 
                        />
                        <Text style={styles.gpsButtonText}>
                            {formData.gps_coordinates ? 'Localisation enregistrée' : 'Sélectionner sur la carte'}
                        </Text>
                        <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                    
                    {formData.gps_coordinates && (
                        <Text style={styles.gpsCoordinates}>
                            📍 {formData.gps_coordinates}
                        </Text>
                    )}
                </View>

                {/* Bouton de soumission */}
                <View style={styles.submitContainer}>
                    <NativeButton
                        title={loading ? "Inscription en cours..." : "S'inscrire"}
                        onPress={handleSubmit}
                        disabled={loading}
                        variant="primary"
                        style={styles.submitButton}
                    />
                    
                    {loading && (
                        <ActivityIndicator 
                            size="small" 
                            color={modernColors.primary} 
                            style={styles.loader} 
                        />
                    )}
                </View>
            </ScrollView>

            {/* Modal GPS */}
            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onLocationSelected={handleGPSLocationSelected}
                title="Localisation de la librairie"
                subtitle="Sélectionnez l'emplacement exact de votre librairie"
            />
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: Platform.OS === 'ios' ? 50 : 30,
        paddingBottom: 20,
        paddingHorizontal: 20,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        padding: 8,
        marginRight: 16,
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
        flex: 1,
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        padding: 20,
    },
    infoCard: {
        flexDirection: 'row',
        backgroundColor: '#F0F9FF',
        padding: 16,
        borderRadius: modernStyles.borderRadius.lg,
        marginBottom: 24,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    infoText: {
        flex: 1,
        fontSize: 14,
        color: modernColors.text,
        marginLeft: 12,
        lineHeight: 20,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: modernColors.surface,
    },
    inputMultiline: {
        height: 80,
        textAlignVertical: 'top',
    },
    typeChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginRight: 8,
    },
    typeChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    typeChipText: {
        fontSize: 14,
        color: modernColors.text,
        fontWeight: '500',
    },
    typeChipTextActive: {
        color: '#fff',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 16,
        color: modernColors.text,
        marginLeft: 12,
    },
    gpsCoordinates: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 8,
        fontFamily: 'monospace',
    },
    submitContainer: {
        marginTop: 32,
        marginBottom: 40,
    },
    submitButton: {
        marginBottom: 16,
    },
    loader: {
        alignSelf: 'center',
    },
});

export default LibrairieRegistrationScreen;
