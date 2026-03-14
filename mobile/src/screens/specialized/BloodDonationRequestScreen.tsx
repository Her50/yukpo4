import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
const URGENCE_LEVELS = [
    { value: 'normal', label: 'Normal', color: '#10B981' },
    { value: 'urgent', label: 'Urgent', color: '#F59E0B' },
    { value: 'critique', label: 'Critique', color: '#EF4444' },
];

interface BloodBank {
    id: number;
    nom: string;
    adresse?: string;
}

const BloodDonationRequestScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const banqueId = (route.params as any)?.banqueId as number | undefined;

    const [loading, setLoading] = useState(false);
    const [loadingBanks, setLoadingBanks] = useState(false);
    const [bloodBanks, setBloodBanks] = useState<BloodBank[]>([]);
    const [matchingInfo, setMatchingInfo] = useState<{
        matchesCount: number;
        compatibleGroups: string[];
    } | null>(null);

    const [formData, setFormData] = useState({
        banque_sang_id: banqueId || 0,
        service_id: (route.params as any)?.serviceId || 0,
        groupe_sanguin_requis: '',
        quantite_requise: '1',
        unite: 'poches',
        is_urgent: false,
        urgence_level: 'normal',
        deadline_date: '',
        patient_name: '',
        hospital_name: '',
        notes: '',
        max_distance_km: '50',
    });

    // Charger les banques de sang de l'utilisateur
    useEffect(() => {
        loadBloodBanks();
    }, []);

    // Charger info compatibilité quand groupe sélectionné
    useEffect(() => {
        if (formData.groupe_sanguin_requis) {
            loadCompatibilityInfo(formData.groupe_sanguin_requis);
        }
    }, [formData.groupe_sanguin_requis]);

    const loadBloodBanks = async () => {
        try {
            setLoadingBanks(true);
            const response = await apiGet('/api/banques-sang/my-banks');
            if (response.success && response.data) {
                setBloodBanks(response.data as BloodBank[]);
                // Si une seule banque et banqueId non fourni, la sélectionner
                if ((response.data as any[]).length === 1 && !banqueId) {
                    setFormData({ ...formData, banque_sang_id: (response.data as any[])[0].id });
                }
            }
        } catch (error: any) {
            console.error('[BloodDonationRequestScreen] Erreur chargement banques:', error);
            Alert.alert('Erreur', 'Impossible de charger vos banques de sang');
        } finally {
            setLoadingBanks(false);
        }
    };

    const loadCompatibilityInfo = async (group: string) => {
        try {
            const response = await apiGet(`/api/blood-donation/compatibility-info/${group}`);
            if (response.success && response.data) {
                const compatibleGroups = (response.data as any).can_receive_from as string[];
                setMatchingInfo({
                    matchesCount: 0, // Sera calculé lors de la création
                    compatibleGroups: compatibleGroups || [],
                });
            }
        } catch (error: any) {
            console.error('[BloodDonationRequestScreen] Erreur chargement compatibilité:', error);
        }
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.banque_sang_id) {
            Alert.alert('Erreur', 'Veuillez sélectionner une banque de sang');
            return;
        }

        if (!formData.groupe_sanguin_requis) {
            Alert.alert('Erreur', 'Veuillez sélectionner un groupe sanguin requis');
            return;
        }

        if (!formData.quantite_requise || parseInt(formData.quantite_requise) <= 0) {
            Alert.alert('Erreur', 'Veuillez entrer une quantité valide');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                banque_sang_id: formData.banque_sang_id,
                service_id: formData.service_id || 0,
                groupe_sanguin_requis: formData.groupe_sanguin_requis,
                quantite_requise: parseInt(formData.quantite_requise),
                unite: formData.unite,
                is_urgent: formData.is_urgent,
                urgence_level: formData.urgence_level,
                deadline_date: formData.deadline_date || null,
                request_latitude: location?.coords.latitude || null,
                request_longitude: location?.coords.longitude || null,
                request_location_address: null,
                notes: formData.notes || null,
                patient_name: formData.patient_name || null,
                hospital_name: formData.hospital_name || null,
                max_distance_km: parseFloat(formData.max_distance_km) || 50.0,
            };

            const response = await apiPost('/api/blood-donation/requests', payload);

            if (response.success) {
                const requestId = (response.data as any)?.request_id;
                const matchesFound = (response.data as any)?.matches_found || 0;

                Alert.alert(
                    'Demande créée',
                    `Votre demande a été créée avec succès. ${matchesFound} donneur(s) compatible(s) trouvé(s).`,
                    [
                        {
                            text: 'Voir les matches',
                            onPress: () => {
                                navigation.navigate('BloodDonationMatches' as never, {
                                    requestId,
                                } as never);
                            },
                        },
                        {
                            text: 'OK',
                            style: 'cancel',
                        },
                    ]
                );

                // Réinitialiser le formulaire
                setFormData({
                    ...formData,
                    groupe_sanguin_requis: '',
                    quantite_requise: '1',
                    patient_name: '',
                    hospital_name: '',
                    notes: '',
                });
            } else {
                Alert.alert('Erreur', (response as any).error || 'Impossible de créer la demande');
            }
        } catch (error: any) {
            console.error('[BloodDonationRequestScreen] Erreur création demande:', error);
            Alert.alert('Erreur', error.message || 'Impossible de créer la demande');
        } finally {
            setLoading(false);
        }
    };

    const selectedUrgence = URGENCE_LEVELS.find((u) => u.value === formData.urgence_level);

    return (
        <>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Créer une demande de don</Text>
            </View>

            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Sélection banque de sang */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Banque de sang</Text>
                    {loadingBanks ? (
                        <ActivityIndicator size="small" color={modernColors.primary} />
                    ) : (
                        <>
                            {bloodBanks.length === 0 ? (
                                <Text style={styles.hintText}>
                                    Aucune banque de sang trouvée. Veuillez d'abord créer une banque de sang.
                                </Text>
                            ) : (
                                <View style={styles.bankSelector}>
                                    {bloodBanks.map((bank) => (
                                        <TouchableOpacity
                                            key={bank.id}
                                            style={[
                                                styles.bankOption,
                                                formData.banque_sang_id === bank.id && styles.bankOptionSelected,
                                            ]}
                                            onPress={() => setFormData({ ...formData, banque_sang_id: bank.id })}
                                        >
                                            <View style={styles.bankOptionContent}>
                                                <SafeIcon
                                                    name="droplet"
                                                    size={20}
                                                    color={
                                                        formData.banque_sang_id === bank.id
                                                            ? modernColors.primary
                                                            : '#6B7280'
                                                    }
                                                />
                                                <View style={styles.bankInfo}>
                                                    <Text
                                                        style={[
                                                            styles.bankName,
                                                            formData.banque_sang_id === bank.id && styles.bankNameSelected,
                                                        ]}
                                                    >
                                                        {bank.nom}
                                                    </Text>
                                                    {bank.adresse && (
                                                        <Text style={styles.bankAddress}>{bank.adresse}</Text>
                                                    )}
                                                </View>
                                            </View>
                                            {formData.banque_sang_id === bank.id && (
                                                <SafeIcon name="check-circle" size={20} color={modernColors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>
                            )}
                        </>
                    )}
                </View>

                {/* Groupe sanguin requis */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Groupe sanguin requis *</Text>
                    <View style={styles.bloodGroupGrid}>
                        {GROUPES_SANGUINS.map((group) => (
                            <TouchableOpacity
                                key={group}
                                style={[
                                    styles.bloodGroupButton,
                                    formData.groupe_sanguin_requis === group && styles.bloodGroupButtonSelected,
                                ]}
                                onPress={() => setFormData({ ...formData, groupe_sanguin_requis: group })}
                            >
                                <Text
                                    style={[
                                        styles.bloodGroupText,
                                        formData.groupe_sanguin_requis === group && styles.bloodGroupTextSelected,
                                    ]}
                                >
                                    {group}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Info compatibilité */}
                    {matchingInfo && matchingInfo.compatibleGroups.length > 0 && (
                        <View style={styles.compatibilityInfo}>
                            <Text style={styles.compatibilityTitle}>Groupes compatibles:</Text>
                            <View style={styles.compatibleGroupsList}>
                                {matchingInfo.compatibleGroups.map((group) => (
                                    <View key={group} style={styles.compatibleGroupTag}>
                                        <Text style={styles.compatibleGroupText}>{group}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Quantité */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quantité requise *</Text>
                    <View style={styles.quantityRow}>
                        <TextInput
                            style={styles.quantityInput}
                            value={formData.quantite_requise}
                            onChangeText={(text) => setFormData({ ...formData, quantite_requise: text })}
                            placeholder="1"
                            keyboardType="numeric"
                        />
                        <TextInput
                            style={styles.uniteInput}
                            value={formData.unite}
                            onChangeText={(text) => setFormData({ ...formData, unite: text })}
                            placeholder="poches"
                        />
                    </View>
                </View>

                {/* Urgence */}
                <View style={styles.section}>
                    <View style={styles.switchGroup}>
                        <View>
                            <Text style={styles.sectionTitle}>Demande urgente</Text>
                            <Text style={styles.hintText}>Les donneurs seront notifiés en priorité</Text>
                        </View>
                        <Switch
                            value={formData.is_urgent}
                            onValueChange={(value) =>
                                setFormData({
                                    ...formData,
                                    is_urgent: value,
                                    urgence_level: value ? 'urgent' : 'normal',
                                })
                            }
                            trackColor={{ false: '#D1D5DB', true: modernColors.primary }}
                        />
                    </View>

                    {formData.is_urgent && (
                        <View style={styles.urgenceLevelContainer}>
                            <Text style={styles.label}>Niveau d'urgence</Text>
                            <View style={styles.urgenceLevelButtons}>
                                {URGENCE_LEVELS.map((level) => (
                                    <TouchableOpacity
                                        key={level.value}
                                        style={[
                                            styles.urgenceLevelButton,
                                            formData.urgence_level === level.value &&
                                            styles.urgenceLevelButtonSelected(level.color),
                                        ]}
                                        onPress={() => setFormData({ ...formData, urgence_level: level.value })}
                                    >
                                        <Text
                                            style={[
                                                styles.urgenceLevelText,
                                                formData.urgence_level === level.value &&
                                                styles.urgenceLevelTextSelected,
                                            ]}
                                        >
                                            {level.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}
                </View>

                {/* Informations additionnelles */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Informations additionnelles</Text>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Nom du patient (optionnel)</Text>
                        <NativeInput
                            value={formData.patient_name}
                            onChangeText={(text) => setFormData({ ...formData, patient_name: text })}
                            placeholder="Nom du patient"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Hôpital (optionnel)</Text>
                        <NativeInput
                            value={formData.hospital_name}
                            onChangeText={(text) => setFormData({ ...formData, hospital_name: text })}
                            placeholder="Nom de l'hôpital"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Date limite (optionnel)</Text>
                        <NativeInput
                            value={formData.deadline_date}
                            onChangeText={(text) => setFormData({ ...formData, deadline_date: text })}
                            placeholder="YYYY-MM-DD"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Distance maximale (km)</Text>
                        <NativeInput
                            value={formData.max_distance_km}
                            onChangeText={(text) => setFormData({ ...formData, max_distance_km: text })}
                            placeholder="50"
                            keyboardType="numeric"
                        />
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Notes (optionnel)</Text>
                        <TextInput
                            style={styles.notesInput}
                            value={formData.notes}
                            onChangeText={(text) => setFormData({ ...formData, notes: text })}
                            placeholder="Informations supplémentaires..."
                            multiline
                            numberOfLines={4}
                            textAlignVertical="top"
                        />
                    </View>
                </View>

                {/* Bouton soumettre */}
                <NativeButton
                    title={loading ? 'Création en cours...' : 'Créer la demande'}
                    onPress={handleSubmit}
                    disabled={loading || !formData.banque_sang_id || !formData.groupe_sanguin_requis}
                    variant="primary"
                    size="large"
                    style={styles.submitButton}
                />
            </ScrollView>
        </>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    content: {
        padding: 16,
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
    section: {
        marginBottom: 24,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    bankSelector: {
        gap: 8,
    },
    bankOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 12,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
    },
    bankOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: `${modernColors.primary}10`,
    },
    bankOptionContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    bankInfo: {
        flex: 1,
    },
    bankName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    bankNameSelected: {
        color: modernColors.primary,
    },
    bankAddress: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    bloodGroupGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    bloodGroupButton: {
        width: '22%',
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#DC2626',
        backgroundColor: '#FEE2E2',
    },
    bloodGroupButtonSelected: {
        backgroundColor: '#DC2626',
    },
    bloodGroupText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#DC2626',
    },
    bloodGroupTextSelected: {
        color: '#fff',
    },
    compatibilityInfo: {
        marginTop: 16,
        padding: 12,
        backgroundColor: '#F0FDF4',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    compatibilityTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: '#166534',
        marginBottom: 8,
    },
    compatibleGroupsList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    compatibleGroupTag: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#86EFAC',
    },
    compatibleGroupText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#166534',
    },
    quantityRow: {
        flexDirection: 'row',
        gap: 12,
    },
    quantityInput: {
        flex: 1,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 16,
        color: '#111827',
    },
    uniteInput: {
        width: 100,
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
        color: '#111827',
    },
    switchGroup: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    urgenceLevelContainer: {
        marginTop: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
        marginBottom: 8,
    },
    urgenceLevelButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    urgenceLevelButton: {
        flex: 1,
        padding: 10,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#F9FAFB',
        alignItems: 'center',
    },
    urgenceLevelButtonSelected: (color: string) => ({
        borderColor: color,
        backgroundColor: `${color}20`,
    }),
    urgenceLevelText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    urgenceLevelTextSelected: {
        color: '#111827',
    },
    inputGroup: {
        marginBottom: 16,
    },
    notesInput: {
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        fontSize: 14,
        color: '#111827',
        minHeight: 100,
    },
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        fontStyle: 'italic',
    },
    submitButton: {
        marginTop: 8,
        marginBottom: 32,
    },
});

export default BloodDonationRequestScreen;

