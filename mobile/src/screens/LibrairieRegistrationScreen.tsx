// @ts-nocheck
// ✅ Écran d'enregistrement pour les libraires partenaires

import React, { useState, useCallback, useMemo, useEffect } from 'react';
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

/** Succursale / point de représentation supplémentaire (même réseau — notifications géo Yukpo). */
interface SuccursaleDraft {
    id: string;
    libelle: string;
    adresse: string;
    ville: string;
    gps_coordinates: string | null;
}

const LibrairieRegistrationScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t, language } = useLanguageSafe();
    const toaster = useToaster();

    const [loading, setLoading] = useState(false);
    const [showGPSModal, setShowGPSModal] = useState(false);
    /** Quel emplacement est en cours de pointage GPS : siège | id succursale */
    const [gpsTarget, setGpsTarget] = useState<'main' | string>('main');
    const [succursales, setSuccursales] = useState<SuccursaleDraft[]>([]);
    const [formData, setFormData] = useState<LibrairieFormData>({
        nom: '',
        email: '',
        telephone: '',
        adresse: '',
        ville: '',
        pays: '',
        type_fournisseur: 'librairie',
        gps_coordinates: null,
    });

    useEffect(() => {
        setFormData((prev) => {
            if (prev.pays.trim() !== '') return prev;
            return { ...prev, pays: t('librairieRegistration.defaultCountry') };
        });
    }, [language, t]);

    const fournisseurTypes = useMemo(
        () => [
            { value: 'librairie', label: t('librairieRegistration.typeLibrairie') },
            { value: 'fournisseur_scolaire', label: t('librairieRegistration.typeFournisseurScolaire') },
            { value: 'editeur', label: t('librairieRegistration.typeEditeur') },
            { value: 'distributeur', label: t('librairieRegistration.typeDistributeur') },
        ],
        [t],
    );

    // Mettre à jour les données du formulaire
    const updateFormData = useCallback((field: keyof LibrairieFormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Gérer la sélection GPS (siège ou succursale)
    const handleGPSLocationSelected = useCallback((location: any) => {
        if (location && location.latitude && location.longitude) {
            const gpsString = `${location.latitude},${location.longitude}`;
            if (gpsTarget === 'main') {
                updateFormData('gps_coordinates', gpsString);
                if (location.city || location.locality) {
                    updateFormData('ville', location.city || location.locality);
                }
            } else {
                setSuccursales((prev) =>
                    prev.map((s) =>
                        s.id === gpsTarget
                            ? {
                                  ...s,
                                  gps_coordinates: gpsString,
                                  ville:
                                      location.city || location.locality
                                          ? (location.city || location.locality || s.ville)
                                          : s.ville,
                              }
                            : s,
                    ),
                );
            }
            toaster?.show?.(t('librairieRegistration.toasterLocationSaved'), 'success');
        }
        setShowGPSModal(false);
        setGpsTarget('main');
    }, [updateFormData, toaster, gpsTarget, t]);

    const addSuccursale = useCallback(() => {
        setSuccursales((prev) => [
            ...prev,
            {
                id: `s-${Date.now()}`,
                libelle: '',
                adresse: '',
                ville: '',
                gps_coordinates: null,
            },
        ]);
    }, []);

    const removeSuccursale = useCallback((id: string) => {
        setSuccursales((prev) => prev.filter((s) => s.id !== id));
    }, []);

    const updateSuccursale = useCallback((id: string, field: keyof SuccursaleDraft, value: string) => {
        setSuccursales((prev) =>
            prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)),
        );
    }, []);

    // Valider le formulaire
    const validateForm = useCallback(() => {
        if (!formData.nom.trim()) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errNomRequired'));
            return false;
        }

        if (!formData.email.trim()) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errEmailRequired'));
            return false;
        }

        if (!formData.telephone.trim()) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errPhoneRequired'));
            return false;
        }

        if (!formData.adresse.trim()) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errAddressRequired'));
            return false;
        }

        if (!formData.ville.trim()) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errCityRequired'));
            return false;
        }

        if (!formData.gps_coordinates) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errHeadquartersGpsRequired'));
            return false;
        }

        for (const s of succursales) {
            if (!s.gps_coordinates?.trim()) {
                Alert.alert(
                    t('librairieRegistration.error'),
                    t('librairieRegistration.errBranchGpsRequired', {
                        name: s.libelle.trim() || t('librairieRegistration.branchDefaultName'),
                    }),
                );
                return false;
            }
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            Alert.alert(t('librairieRegistration.error'), t('librairieRegistration.errEmailInvalid'));
            return false;
        }

        return true;
    }, [formData, succursales, t]);

    // Soumettre le formulaire
    const handleSubmit = useCallback(async () => {
        if (!validateForm()) return;
        
        setLoading(true);
        
        try {
            const lieux = [
                {
                    libelle: t('librairieRegistration.headquartersLabel'),
                    gps: formData.gps_coordinates,
                    ville: formData.ville,
                    pays: formData.pays,
                    adresse: formData.adresse,
                },
                ...succursales.map((s) => ({
                    libelle: s.libelle.trim() || t('librairieRegistration.branchDefaultName'),
                    gps: s.gps_coordinates,
                    ville: s.ville.trim() || undefined,
                    pays: formData.pays,
                    adresse: s.adresse.trim() || undefined,
                })),
            ];

            const payload = {
                nom: formData.nom,
                email: formData.email,
                telephone: formData.telephone,
                adresse: formData.adresse,
                ville: formData.ville,
                pays: formData.pays,
                type_fournisseur: formData.type_fournisseur,
                gps: formData.gps_coordinates,
                lieux,
            };
            
            const response = await apiPost('/api/librairie-network/register', payload);
            
            if (response.success) {
                Alert.alert(t('librairieRegistration.successTitle'), t('librairieRegistration.successMessage'), [
                    {
                        text: t('librairieRegistration.ok'),
                        onPress: () => navigation.goBack(),
                    },
                ]);
            } else {
                Alert.alert(
                    t('librairieRegistration.error'),
                    response.message || t('librairieRegistration.errSubmitGeneric'),
                );
            }
        } catch (error: any) {
            console.error('Erreur inscription librairie:', error);
            Alert.alert(
                t('librairieRegistration.error'),
                error.response?.data?.message || t('librairieRegistration.errSubmitGeneric'),
            );
        } finally {
            setLoading(false);
        }
    }, [formData, validateForm, navigation, succursales, t]);

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
                <Text style={styles.headerTitle}>{t('librairieRegistration.headerTitle')}</Text>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                {/* Nom de la librairie */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelBookstoreName')}</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.nom}
                        onChangeText={(value) => updateFormData('nom', value)}
                        placeholder={t('librairieRegistration.placeholderBookstoreName')}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Type de fournisseur */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelSupplierType')}</Text>
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
                    <Text style={styles.label}>{t('librairieRegistration.labelEmail')}</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.email}
                        onChangeText={(value) => updateFormData('email', value)}
                        placeholder={t('librairieRegistration.placeholderEmail')}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Téléphone */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelPhone')}</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.telephone}
                        onChangeText={(value) => updateFormData('telephone', value)}
                        placeholder={t('librairieRegistration.placeholderPhone')}
                        keyboardType="phone-pad"
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Adresse */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelAddress')}</Text>
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        value={formData.adresse}
                        onChangeText={(value) => updateFormData('adresse', value)}
                        placeholder={t('librairieRegistration.placeholderAddress')}
                        multiline
                        numberOfLines={3}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Ville */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelCity')}</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.ville}
                        onChangeText={(value) => updateFormData('ville', value)}
                        placeholder={t('librairieRegistration.placeholderCity')}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Pays */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelCountry')}</Text>
                    <TextInput
                        style={styles.input}
                        value={formData.pays}
                        onChangeText={(value) => updateFormData('pays', value)}
                        placeholder={t('librairieRegistration.placeholderCountry')}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                </View>

                {/* Localisation GPS — siège */}
                <View style={styles.formGroup}>
                    <Text style={styles.label}>{t('librairieRegistration.labelHeadquartersGps')}</Text>
                    <Text style={styles.hint}>{t('librairieRegistration.hintHeadquartersGps')}</Text>
                    <TouchableOpacity
                        style={styles.gpsButton}
                        onPress={() => {
                            setGpsTarget('main');
                            setShowGPSModal(true);
                        }}
                    >
                        <SafeIcon 
                            name={formData.gps_coordinates ? "check-circle" : "map-pin"} 
                            size={20} 
                            color={formData.gps_coordinates ? modernColors.success : modernColors.primary} 
                        />
                        <Text style={styles.gpsButtonText}>
                            {formData.gps_coordinates ? t('librairieRegistration.gpsSaved') : t('librairieRegistration.gpsPickOnMap')}
                        </Text>
                        <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                    </TouchableOpacity>
                    
                    {formData.gps_coordinates && (
                        <Text style={styles.gpsCoordinates}>
                            📍 {formData.gps_coordinates}
                        </Text>
                    )}
                </View>

                {/* Succursales / points de représentation */}
                <View style={styles.formGroup}>
                    <View style={styles.rowBetween}>
                        <Text style={styles.label}>{t('librairieRegistration.labelBranchesOptional')}</Text>
                        <TouchableOpacity style={styles.addBranchBtn} onPress={addSuccursale}>
                            <SafeIcon name="plus" size={18} color={modernColors.primary} />
                            <Text style={[styles.addBranchText, { marginLeft: 6 }]}>{t('librairieRegistration.addBranch')}</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>{t('librairieRegistration.hintBranches')}</Text>
                    {succursales.map((s) => (
                        <View key={s.id} style={styles.branchCard}>
                            <View style={styles.rowBetween}>
                                <Text style={styles.branchTitle}>{t('librairieRegistration.branchCardTitle')}</Text>
                                <TouchableOpacity onPress={() => removeSuccursale(s.id)}>
                                    <SafeIcon name="trash-2" size={18} color="#DC2626" />
                                </TouchableOpacity>
                            </View>
                            <TextInput
                                style={styles.input}
                                value={s.libelle}
                                onChangeText={(v) => updateSuccursale(s.id, 'libelle', v)}
                                placeholder={t('librairieRegistration.placeholderBranchName')}
                                placeholderTextColor={modernColors.textSecondary}
                            />
                            <TextInput
                                style={[styles.input, { marginTop: 8 }]}
                                value={s.adresse}
                                onChangeText={(v) => updateSuccursale(s.id, 'adresse', v)}
                                placeholder={t('librairieRegistration.placeholderBranchAddressOptional')}
                                placeholderTextColor={modernColors.textSecondary}
                            />
                            <TextInput
                                style={[styles.input, { marginTop: 8 }]}
                                value={s.ville}
                                onChangeText={(v) => updateSuccursale(s.id, 'ville', v)}
                                placeholder={t('librairieRegistration.placeholderBranchCity')}
                                placeholderTextColor={modernColors.textSecondary}
                            />
                            <TouchableOpacity
                                style={[styles.gpsButton, { marginTop: 8 }]}
                                onPress={() => {
                                    setGpsTarget(s.id);
                                    setShowGPSModal(true);
                                }}
                            >
                                <SafeIcon
                                    name={s.gps_coordinates ? 'check-circle' : 'map-pin'}
                                    size={20}
                                    color={s.gps_coordinates ? modernColors.success : modernColors.primary}
                                />
                                <Text style={styles.gpsButtonText}>
                                    {s.gps_coordinates ? t('librairieRegistration.gpsRecorded') : t('librairieRegistration.placeOnMap')}
                                </Text>
                                <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} />
                            </TouchableOpacity>
                            {s.gps_coordinates ? (
                                <Text style={styles.gpsCoordinates}>📍 {s.gps_coordinates}</Text>
                            ) : null}
                        </View>
                    ))}
                </View>

                {/* Bouton de soumission */}
                <View style={styles.submitContainer}>
                    <NativeButton
                        title={loading ? t('librairieRegistration.submitting') : t('librairieRegistration.submitRegister')}
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
                onClose={() => {
                    setShowGPSModal(false);
                    setGpsTarget('main');
                }}
                onLocationSelected={handleGPSLocationSelected}
                title={gpsTarget === 'main' ? t('librairieRegistration.gpsModalTitleMain') : t('librairieRegistration.gpsModalTitleBranch')}
                subtitle={t('librairieRegistration.gpsModalSubtitle')}
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
    hint: {
        fontSize: 13,
        color: modernColors.textSecondary,
        marginBottom: 10,
        lineHeight: 18,
    },
    rowBetween: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    addBranchBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
    },
    addBranchText: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.primary,
    },
    branchCard: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: modernStyles.borderRadius.md,
        padding: 12,
        marginBottom: 12,
        backgroundColor: modernColors.surface,
    },
    branchTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
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
