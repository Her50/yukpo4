// ✅ Écran de modification du profil famille pour planification menus
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeCard, NativeInput } from '../../components/SafeNativeDesign';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { FamilyProfile, menuPlanningService } from '../../services/menuPlanningService';
import { modernColors } from '../../theme/modernTheme';

const FamilyProfileScreen: React.FC = () => {
    const navigation = useNavigation();
    const { t } = useLanguageSafe();

    const PREFERENCE_OPTIONS = useMemo(
        () => [
            t('familyProfileScreen.vegetarien'),
            t('familyProfileScreen.vegan'),
            'Halal',
            'Cacher',
            'Sans gluten',
            t('familyProfileScreen.pescetarien'),
            'Flexitarien',
        ],
        [t]
    );

    const CUISINE_STYLES = useMemo(
        () => [
            'Africaine',
            t('familyProfileScreen.francaise'),
            'Italienne',
            'Asiatique',
            t('familyProfileScreen.mediterraneenne'),
            t('familyProfileScreen.americaine'),
            'Mexicaine',
            'Indienne',
            'Locale traditionnelle',
        ],
        [t]
    );

    const COOKING_LEVELS = useMemo(
        () => [
            t('familyProfileScreen.debutant'),
            t('familyProfileScreen.intermediaire'),
            t('familyProfileScreen.avance'),
        ],
        [t]
    );

    const ALLERGY_OPTIONS = useMemo(
        () => [
            'Arachides',
            'Lactose',
            'Gluten',
            'Fruits de mer',
            t('familyProfileScreen.ufs'),
            'Soja',
            'Noix',
            'Poisson',
        ],
        [t]
    );

    const DIETARY_RESTRICTIONS = useMemo(
        () => [
            t('familyProfileScreen.diabete'),
            'Hypertension',
            t('familyProfileScreen.cholesterol'),
            'Perte de poids',
            'Gain de poids',
            'Sportif',
        ],
        [t]
    );
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [profile, setProfile] = useState<FamilyProfile>({
        total_members: 1,
        children_count: 0,
        adults_count: 1,
        preferences: [],
        allergies: [],
        dietary_restrictions: [],
        cuisine_styles: [],
        cooking_level: t('familyProfileScreen.debutant'),
    });

    useEffect(() => {
        loadProfile();
    }, []);

    const loadProfile = async () => {
        try {
            setLoading(true);
            const response = await menuPlanningService.getFamilyProfile();
            if (response.success && response.data?.profile) {
                setProfile(response.data.profile);
            }
        } catch (error: any) {
            console.error('[FamilyProfile] Erreur chargement:', error);
            Alert.alert(t('message.error'), t('familyProfile.cannotLoadProfile'));
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        // ✅ NOUVEAU: Validation avant sauvegarde
        if (profile.total_members < 1) {
            Alert.alert(t('familyProfile.validation'), t('familyProfile.atLeastOneMember'));
            return;
        }
        if (profile.adults_count < 1) {
            Alert.alert(t('familyProfile.validation'), t('familyProfile.atLeastOneAdult'));
            return;
        }
        if (profile.cuisine_styles.length === 0) {
            Alert.alert(t('familyProfile.validation'), t('familyProfile.selectCuisineStyle'));
            return;
        }

        try {
            setSaving(true);
            const response = await menuPlanningService.updateFamilyProfile(profile);

            if (response.success) {
                Alert.alert(t('message.success'), t('familyProfile.profileUpdated'), [
                    {
                        text: t('familyProfileScreen.ok'),
                        onPress: () => navigation.goBack(),
                    },
                ]);
            } else {
                Alert.alert(t('message.error'), response.error || t('familyProfile.cannotUpdateProfile'));
            }
        } catch (error: any) {
            console.error('[FamilyProfile] Erreur sauvegarde:', error);
            Alert.alert(t('message.error'), error.message || t('familyProfile.errorOccurred'));
        } finally {
            setSaving(false);
        }
    };

    const togglePreference = (pref: string) => {
        setProfile((prev) => ({
            ...prev,
            preferences: prev.preferences.includes(pref)
                ? prev.preferences.filter((p) => p !== pref)
                : [...prev.preferences, pref],
        }));
    };

    const toggleAllergy = (allergy: string) => {
        setProfile((prev) => ({
            ...prev,
            allergies: prev.allergies.includes(allergy)
                ? prev.allergies.filter((a) => a !== allergy)
                : [...prev.allergies, allergy],
        }));
    };

    const toggleRestriction = (restriction: string) => {
        setProfile((prev) => ({
            ...prev,
            dietary_restrictions: prev.dietary_restrictions.includes(restriction)
                ? prev.dietary_restrictions.filter((r) => r !== restriction)
                : [...prev.dietary_restrictions, restriction],
        }));
    };

    const toggleCuisineStyle = (style: string) => {
        setProfile((prev) => ({
            ...prev,
            cuisine_styles: prev.cuisine_styles.includes(style)
                ? prev.cuisine_styles.filter((s) => s !== style)
                : [...prev.cuisine_styles, style],
        }));
    };

    return (
        <KeyboardAwareScreen style={styles.container} contentContainerStyle={styles.scrollContent}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>{t('menuPlanning.familyProfile')}</Text>
            </View>

            <View style={styles.form}>
                {/* Nombre de personnes */}
                <NativeCard style={styles.card}>
                    <Text style={styles.label}>{t('familyProfile.compositionDeLaFamille')}</Text>
                    <View style={styles.row}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t('familyProfileScreen.total')}</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={profile.total_members > 0 ? profile.total_members.toString() : ''}
                                onChangeText={(text) => {
                                    // ✅ CORRIGÉ: Permettre de vider le champ
                                    if (text === '' || text === null || text === undefined) {
                                        setProfile((prev) => ({
                                            ...prev,
                                            total_members: 0,
                                        }));
                                        return;
                                    }
                                    const num = parseInt(text);
                                    if (!isNaN(num) && num >= 0) {
                                        setProfile((prev) => ({
                                            ...prev,
                                            total_members: num,
                                            adults_count: Math.max(1, prev.adults_count),
                                            children_count: Math.max(0, num - prev.adults_count),
                                        }));
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>{t('familyProfileScreen.adults')}</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={profile.adults_count > 0 ? profile.adults_count.toString() : ''}
                                onChangeText={(text) => {
                                    // ✅ CORRIGÉ: Permettre de vider le champ
                                    if (text === '' || text === null || text === undefined) {
                                        setProfile((prev) => ({
                                            ...prev,
                                            adults_count: 0,
                                            total_members: prev.children_count,
                                        }));
                                        return;
                                    }
                                    const num = parseInt(text);
                                    if (!isNaN(num) && num >= 0) {
                                        setProfile((prev) => ({
                                            ...prev,
                                            adults_count: num,
                                            children_count: Math.max(0, prev.total_members - num),
                                            total_members: num + prev.children_count,
                                        }));
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>
                        <View style={styles.inputGroup}>
                            <Text style={styles.inputLabel}>Enfants</Text>
                            <TextInput
                                style={styles.numberInput}
                                value={profile.children_count > 0 ? profile.children_count.toString() : ''}
                                onChangeText={(text) => {
                                    // ✅ CORRIGÉ: Permettre de vider le champ
                                    if (text === '' || text === null || text === undefined) {
                                        setProfile((prev) => ({
                                            ...prev,
                                            children_count: 0,
                                            total_members: prev.adults_count,
                                        }));
                                        return;
                                    }
                                    const num = parseInt(text);
                                    if (!isNaN(num) && num >= 0) {
                                        setProfile((prev) => ({
                                            ...prev,
                                            children_count: num,
                                            total_members: prev.adults_count + num,
                                        }));
                                    }
                                }}
                                keyboardType="numeric"
                                placeholder="0"
                            />
                        </View>
                    </View>
                </NativeCard>

                {/* Préférences alimentaires */}
                <NativeCard style={styles.card}>
                    <Text style={styles.label}>{t('familyProfile.preferencesAlimentaires')}</Text>
                    <View style={styles.chipsContainer}>
                        {PREFERENCE_OPTIONS.map((pref) => (
                            <TouchableOpacity
                                key={pref}
                                style={[
                                    styles.chip,
                                    profile.preferences.includes(pref) && styles.chipSelected,
                                ]}
                                onPress={() => togglePreference(pref)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        profile.preferences.includes(pref) && styles.chipTextSelected,
                                    ]}
                                >
                                    {pref}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                {/* Allergies */}
                <NativeCard style={styles.card}>
                    <Text style={styles.label}>⚠️ Allergies</Text>
                    <View style={styles.chipsContainer}>
                        {ALLERGY_OPTIONS.map((allergy) => (
                            <TouchableOpacity
                                key={allergy}
                                style={[
                                    styles.chip,
                                    profile.allergies.includes(allergy) && styles.chipSelected,
                                ]}
                                onPress={() => toggleAllergy(allergy)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        profile.allergies.includes(allergy) && styles.chipTextSelected,
                                    ]}
                                >
                                    {allergy}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                {/* Restrictions diététiques */}
                <NativeCard style={styles.card}>
                    <Text style={styles.label}>{t('familyProfile.restrictionsDietetiques')}</Text>
                    <View style={styles.chipsContainer}>
                        {DIETARY_RESTRICTIONS.map((restriction) => (
                            <TouchableOpacity
                                key={restriction}
                                style={[
                                    styles.chip,
                                    profile.dietary_restrictions.includes(restriction) && styles.chipSelected,
                                ]}
                                onPress={() => toggleRestriction(restriction)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        profile.dietary_restrictions.includes(restriction) && styles.chipTextSelected,
                                    ]}
                                >
                                    {restriction}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                {/* Styles de cuisine */}
                <NativeCard style={styles.card}>
                    <Text style={styles.label}>{t('familyProfile.stylesDeCuisinePreferes')}</Text>
                    <View style={styles.chipsContainer}>
                        {CUISINE_STYLES.map((style) => (
                            <TouchableOpacity
                                key={style}
                                style={[
                                    styles.chip,
                                    profile.cuisine_styles.includes(style) && styles.chipSelected,
                                ]}
                                onPress={() => toggleCuisineStyle(style)}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        profile.cuisine_styles.includes(style) && styles.chipTextSelected,
                                    ]}
                                >
                                    {style}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                {/* Budget et temps */}
                <NativeCard style={styles.card}>
                    <Text style={styles.label}>\uD83D\uDCB0 Budget mensuel (FCFA)</Text>
                    {/* ✅ NOUVEAU: Presets de budget rapide */}
                    <View style={styles.chipsContainer}>
                        {[25000, 50000, 75000, 100000, 150000].map((amount) => (
                            <TouchableOpacity
                                key={amount}
                                style={[
                                    styles.chip,
                                    profile.budget_monthly === amount && styles.chipSelected,
                                ]}
                                onPress={() => setProfile((prev) => ({ ...prev, budget_monthly: amount }))}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        profile.budget_monthly === amount && styles.chipTextSelected,
                                    ]}
                                >
                                    {amount.toLocaleString()}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                    <NativeInput
                        value={profile.budget_monthly?.toString() || ''}
                        onChangeText={(text) => {
                            const num = parseFloat(text) || undefined;
                            setProfile((prev) => ({ ...prev, budget_monthly: num }));
                        }}
                        placeholder={t('familyProfile.ouSaisissezUnMontantPersonnalise')}
                        keyboardType="numeric"
                    />

                    <Text style={[styles.label, { marginTop: 16 }]}>⏱️ Temps disponible (heures/jour)</Text>
                    <NativeInput
                        value={profile.time_available_hours?.toString() || ''}
                        onChangeText={(text) => {
                            const num = parseFloat(text) || undefined;
                            setProfile((prev) => ({ ...prev, time_available_hours: num }));
                        }}
                        placeholder="Ex: 2"
                        keyboardType="numeric"
                    />

                    <Text style={[styles.label, { marginTop: 16 }]}>\uD83D\uDC68‍\uD83C\uDF73 Niveau de cuisine</Text>
                    <View style={styles.chipsContainer}>
                        {COOKING_LEVELS.map((level) => (
                            <TouchableOpacity
                                key={level}
                                style={[
                                    styles.chip,
                                    profile.cooking_level === level && styles.chipSelected,
                                ]}
                                onPress={() => setProfile((prev) => ({ ...prev, cooking_level: level }))}
                            >
                                <Text
                                    style={[
                                        styles.chipText,
                                        profile.cooking_level === level && styles.chipTextSelected,
                                    ]}
                                >
                                    {level.charAt(0).toUpperCase() + level.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </NativeCard>

                <NativeButton
                    title={saving ? t('familyProfileScreen.saving') : t('familyProfileScreen.enregistrerLeProfil')}
                    onPress={handleSave}
                    loading={saving}
                    variant="primary"
                    size="large"
                    style={styles.saveButton}
                />
            </View>
        </KeyboardAwareScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        paddingBottom: 20,
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
    card: {
        marginBottom: 16,
        padding: 16,
    },
    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    inputGroup: {
        flex: 1,
    },
    inputLabel: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
        marginBottom: 8,
    },
    numberInput: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        fontSize: 16,
        textAlign: 'center',
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
    saveButton: {
        marginTop: 8,
    },
});

export default FamilyProfileScreen;

