// ✅ Formulaire de création/édition d'un livre scolaire (Mobile)

import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import ModernGPSModal from '../../components/ModernGPSModal';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiGet, apiPost, apiPut } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

const niveaux = ['Primaire', 'Collège', 'Lycée'];
const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];

const LivreScolaireFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const params = route.params as any;
    const mode = params?.mode || 'create';
    const livreId = params?.livreId as number | undefined;

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        titre: '',
        auteur: '',
        editeur: '',
        isbn: '',
        classe_actuelle: '',
        classe_souhaitee: '',
        matiere: '',
        niveau: '',
        etat_livre: '',
        description_etat: '',
        ville: '',
        quartier: null as LocationObject | null,
    });

    const [selectedGPS, setSelectedGPS] = useState<string | null>(null);
    const [showGPSModal, setShowGPSModal] = useState(false);

    useEffect(() => {
        if (mode === 'edit' && livreId) {
            loadLivreData();
        } else if (location?.coords) {
            // Pré-remplir GPS avec position actuelle
            const lat = location.coords.latitude;
            const lng = location.coords.longitude;
            setSelectedGPS(`${lat},${lng}`);
        }
    }, [mode, livreId]);

    const loadLivreData = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/livres-scolaires/${livreId}`);

            if (response.success && response.data?.livre) {
                const livre = response.data.livre;
                setFormData({
                    titre: livre.titre || '',
                    auteur: livre.auteur || '',
                    editeur: livre.editeur || '',
                    isbn: livre.isbn || '',
                    classe_actuelle: livre.classe_actuelle || '',
                    classe_souhaitee: livre.classe_souhaitee || '',
                    matiere: livre.matiere || '',
                    niveau: livre.niveau || '',
                    etat_livre: livre.etat_livre || '',
                    description_etat: livre.description_etat || '',
                    ville: livre.ville || '',
                    quartier: livre.quartier ? { raw: livre.quartier, place_name: livre.quartier } : null,
                });
                if (livre.gps) {
                    setSelectedGPS(livre.gps);
                }
            }
        } catch (error: any) {
            console.error('[LivreScolaireFormScreen] Erreur chargement:', error);
            Alert.alert('Erreur', 'Impossible de charger les données du livre');
        } finally {
            setLoading(false);
        }
    };

    const handleGPSSelect = (coordinates: string) => {
        setSelectedGPS(coordinates);
        setShowGPSModal(false);
    };

    const handleSubmit = async () => {
        // Validation
        if (!formData.titre.trim()) {
            Alert.alert('Erreur', 'Le titre est obligatoire');
            return;
        }
        if (!formData.classe_actuelle.trim()) {
            Alert.alert('Erreur', 'La classe actuelle est obligatoire');
            return;
        }
        if (!formData.classe_souhaitee.trim()) {
            Alert.alert('Erreur', 'La classe souhaitée est obligatoire');
            return;
        }
        if (!formData.matiere.trim()) {
            Alert.alert('Erreur', 'La matière est obligatoire');
            return;
        }
        if (!formData.etat_livre.trim()) {
            Alert.alert('Erreur', 'L\'état du livre est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload: any = {
                titre: formData.titre.trim(),
                auteur: formData.auteur.trim() || null,
                editeur: formData.editeur.trim() || null,
                isbn: formData.isbn.trim() || null,
                classe_actuelle: formData.classe_actuelle.trim(),
                classe_souhaitee: formData.classe_souhaitee.trim(),
                matiere: formData.matiere.trim(),
                niveau: formData.niveau.trim() || null,
                etat_livre: formData.etat_livre.trim(),
                description_etat: formData.description_etat.trim() || null,
                ville: formData.quartier?.raw || formData.ville.trim() || null,
                quartier: formData.quartier?.raw || null,
                gps: selectedGPS || (location?.coords
                    ? `${location.coords.latitude},${location.coords.longitude}`
                    : null),
            };

            let response;
            if (mode === 'edit' && livreId) {
                response = await apiPut(`/api/livres-scolaires/${livreId}`, payload);
            } else {
                response = await apiPost('/api/livres-scolaires', payload);
            }

            if (response.success) {
                Alert.alert(
                    'Succès',
                    mode === 'edit' ? 'Livre modifié avec succès !' : 'Livre créé avec succès !',
                    [
                        {
                            text: 'OK',
                            onPress: () => navigation.goBack(),
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', response.error || 'Une erreur est survenue');
            }
        } catch (error: any) {
            console.error('[LivreScolaireFormScreen] Erreur:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <ScrollView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                        <SafeIcon name="arrow-left" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.title}>
                        {mode === 'edit' ? 'Modifier le livre' : 'Créer un livre'}
                    </Text>
                </View>

                <View style={styles.form}>
                    {/* Titre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Titre du livre *</Text>
                        <NativeInput
                            value={formData.titre}
                            onChangeText={(text) => setFormData({ ...formData, titre: text })}
                            placeholder="Ex: Mathématiques 6ème"
                        />
                    </View>

                    {/* Auteur */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Auteur</Text>
                        <NativeInput
                            value={formData.auteur}
                            onChangeText={(text) => setFormData({ ...formData, auteur: text })}
                            placeholder="Nom de l'auteur"
                        />
                    </View>

                    {/* Éditeur */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Éditeur</Text>
                        <NativeInput
                            value={formData.editeur}
                            onChangeText={(text) => setFormData({ ...formData, editeur: text })}
                            placeholder="Ex: Hachette, Nathan"
                        />
                    </View>

                    {/* ISBN */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>ISBN</Text>
                        <NativeInput
                            value={formData.isbn}
                            onChangeText={(text) => setFormData({ ...formData, isbn: text })}
                            placeholder="Numéro ISBN (optionnel)"
                            keyboardType="numeric"
                        />
                    </View>

                    {/* Classe actuelle */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Classe actuelle *</Text>
                        <NativeInput
                            value={formData.classe_actuelle}
                            onChangeText={(text) => setFormData({ ...formData, classe_actuelle: text })}
                            placeholder="Ex: 6ème, 5ème, Terminale"
                        />
                    </View>

                    {/* Classe souhaitée */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Classe souhaitée *</Text>
                        <NativeInput
                            value={formData.classe_souhaitee}
                            onChangeText={(text) => setFormData({ ...formData, classe_souhaitee: text })}
                            placeholder="Ex: 5ème, 4ème, 1ère"
                        />
                    </View>

                    {/* Matière */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Matière *</Text>
                        <NativeInput
                            value={formData.matiere}
                            onChangeText={(text) => setFormData({ ...formData, matiere: text })}
                            placeholder="Ex: Mathématiques, Français"
                        />
                    </View>

                    {/* Niveau */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Niveau</Text>
                        <View style={styles.chipContainer}>
                            {niveaux.map((n) => (
                                <TouchableOpacity
                                    key={n}
                                    style={[
                                        styles.chip,
                                        formData.niveau === n && styles.chipSelected
                                    ]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        niveau: formData.niveau === n ? '' : n
                                    })}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        formData.niveau === n && styles.chipTextSelected
                                    ]}>
                                        {n}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* État du livre */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>État du livre *</Text>
                        <View style={styles.chipContainer}>
                            {etats.map((etat) => (
                                <TouchableOpacity
                                    key={etat}
                                    style={[
                                        styles.chip,
                                        formData.etat_livre === etat && styles.chipSelected
                                    ]}
                                    onPress={() => setFormData({
                                        ...formData,
                                        etat_livre: formData.etat_livre === etat ? '' : etat
                                    })}
                                >
                                    <Text style={[
                                        styles.chipText,
                                        formData.etat_livre === etat && styles.chipTextSelected
                                    ]}>
                                        {etat}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {/* Description de l'état */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Description de l'état</Text>
                        <NativeInput
                            value={formData.description_etat}
                            onChangeText={(text) => setFormData({ ...formData, description_etat: text })}
                            placeholder="Décrivez l'état du livre en détail..."
                            multiline
                            numberOfLines={4}
                        />
                    </View>

                    {/* Localisation */}
                    <View style={styles.inputGroup}>
                        <LocationSelector
                            label="Quartier"
                            value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                            onSelect={(location: LocationObject) => {
                                // ✅ CORRECTION: Extraire la valeur à stocker (string ou LocationObject selon besoin)
                                const quartierValue = location.raw || location.place_name || '';
                                setFormData({ 
                                    ...formData, 
                                    quartier: quartierValue,
                                    // ✅ NOUVEAU: Extraire automatiquement ville et pays si disponibles
                                    ville: location.components?.ville || formData.ville,
                                    pays: location.components?.pays || formData.pays,
                                });
                            }}
                            placeholder="Rechercher un quartier..."
                            scope="neighborhood"
                        />
                    </View>

                    {/* ✅ NOUVEAU: Section Statistiques (si livre existe) */}
                    {livreId && (
                        <View style={styles.statsSection}>
                            <View style={styles.sectionHeader}>
                                <SafeIcon name="bar-chart" size={20} color={modernColors.primary} type="lucide" />
                                <Text style={styles.sectionTitle}>Informations</Text>
                            </View>
                            <View style={styles.statsContainer}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{formData.niveau || 'N/A'}</Text>
                                    <Text style={styles.statLabel}>Niveau</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{formData.etat_livre || 'N/A'}</Text>
                                    <Text style={styles.statLabel}>État</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>
                                        {formData.classe_actuelle ? 'Oui' : 'Non'}
                                    </Text>
                                    <Text style={styles.statLabel}>Échange</Text>
                                </View>
                            </View>
                            {formData.classe_actuelle && formData.classe_souhaitee && (
                                <View style={styles.exchangeInfo}>
                                    <SafeIcon name="repeat" size={16} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.exchangeInfoText}>
                                        {formData.classe_actuelle} → {formData.classe_souhaitee}
                                    </Text>
                                </View>
                            )}
                        </View>
                    )}

                    {/* GPS */}
                    <View style={styles.inputGroup}>
                        <Text style={styles.label}>Position GPS</Text>
                        <TouchableOpacity
                            style={styles.gpsButton}
                            onPress={() => setShowGPSModal(true)}
                        >
                            <SafeIcon name="map-pin" size={20} color={modernColors.primary} />
                            <Text style={styles.gpsButtonText}>
                                {selectedGPS ? 'Localisation sélectionnée' : 'Sélectionner sur la carte'}
                            </Text>
                            <SafeIcon name="chevron-right" size={20} color="#9CA3AF" />
                        </TouchableOpacity>
                        {selectedGPS && (
                            <Text style={styles.gpsText}>{selectedGPS}</Text>
                        )}
                    </View>

                    {/* Bouton de soumission */}
                    <NativeButton
                        title={mode === 'edit' ? '💾 Enregistrer les modifications' : '✅ Créer le livre'}
                        variant="primary"
                        onPress={handleSubmit}
                        style={styles.submitButton}
                        disabled={loading}
                    />
                </View>
            </ScrollView>

            <ModernGPSModal
                visible={showGPSModal}
                onClose={() => setShowGPSModal(false)}
                onSelect={handleGPSSelect}
                currentLocation={selectedGPS}
            />
        </>
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
        backgroundColor: '#FFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        marginRight: 12,
        padding: 4,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#111827',
    },
    form: {
        padding: 16,
        gap: 16,
    },
    inputGroup: {
        gap: 8,
    },
    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    chipContainer: {
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
        color: '#FFF',
        fontWeight: '600',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        backgroundColor: '#FFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    gpsButtonText: {
        flex: 1,
        fontSize: 14,
        color: '#374151',
    },
    gpsText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    submitButton: {
        marginTop: 8,
    },
    // ✅ NOUVEAU: Styles pour section statistiques
    statsSection: {
        marginTop: 24,
        marginBottom: 16,
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    statsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 12,
    },
    statItem: {
        flex: 1,
        alignItems: 'center',
    },
    statValue: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.primary,
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 11,
        color: '#6B7280',
        textAlign: 'center',
    },
    statDivider: {
        width: 1,
        height: 35,
        backgroundColor: '#E5E7EB',
        marginHorizontal: 8,
    },
    exchangeInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    exchangeInfoText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '500',
    },
});

export default LivreScolaireFormScreen;

