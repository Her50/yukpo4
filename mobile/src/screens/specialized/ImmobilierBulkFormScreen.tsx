// ✅ NOUVEAU: Écran de création en lot de biens immobiliers
// Permet de créer plusieurs biens en une seule fois (ex: immeuble avec plusieurs unités)
// Date: 2026-01-26

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
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { apiPost, servicesApi } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { getCurrencyIntelligently } from '../../utils/currencyUtils';
import { useCurrencyDetection, getCurrencyFromGPS } from '../../hooks/useCurrencyDetection';

// ✅ Template pour création rapide
interface PropertyTemplate {
    type_bien: string;
    label: string;
    icon: string;
    defaultChambres: number;
    defaultSuperficie: number;
    description: string;
}

// ✅ Templates selon contexte local
const propertyTemplates: PropertyTemplate[] = [
    { 
        type_bien: 'chambre', 
        label: 'Chambre', 
        icon: 'bed',
        defaultChambres: 1,
        defaultSuperficie: 12,
        description: 'Chambre individuelle'
    },
    { 
        type_bien: 'studio', 
        label: 'Studio (1 chambre)', 
        icon: 'layout',
        defaultChambres: 1, // ✅ Studio = 1 chambre dans le langage local
        defaultSuperficie: 25,
        description: 'Studio avec une chambre'
    },
    { 
        type_bien: 'appartement', 
        label: 'Appartement (2-3 chambres)', 
        icon: 'building',
        defaultChambres: 2, // ✅ Appartement = généralement 2-3 chambres
        defaultSuperficie: 60,
        description: 'Appartement avec 2-3 chambres'
    },
    { 
        type_bien: 'meublé', 
        label: 'Meublé', 
        icon: 'sofa',
        defaultChambres: 1,
        defaultSuperficie: 30,
        description: 'Logement meublé'
    },
    { 
        type_bien: 'hôtel', 
        label: 'Hôtel', 
        icon: 'building-2',
        defaultChambres: 1,
        defaultSuperficie: 20,
        description: 'Chambre d\'hôtel'
    },
];

// ✅ Configuration pour meublés/hôtels avec standings
const standings = [
    { value: 'économique', label: 'Économique' },
    { value: 'moyen', label: 'Moyen' },
    { value: 'haut_de_gamme', label: 'Haut de gamme' },
    { value: 'luxe', label: 'Luxe' },
];

interface BulkPropertyItem {
    id: string; // ID temporaire pour la liste
    type_bien: string;
    nb_chambres: string;
    superficie_m2: string;
    standing: string;
    prix_location_mensuel: string;
    prix_location_journalier: string;
    etat_general: string;
    nb_salles_bain: string;
}

const ImmobilierBulkFormScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { user } = useAuth();
    const { location } = useLocation();
    const [serviceId, setServiceId] = useState<number | null>((route.params as any)?.serviceId || null);

    // ✅ Données communes à tous les biens
    const [commonData, setCommonData] = useState({
        statut: 'location',
        adresse: '',
        quartier: null as LocationObject | null,
        ville: null as LocationObject | null,
        gps: null as string | null,
        equipements: [] as string[],
        caution_mois: '',
        caution_montant: '',
        mensualites_exigees: '',
        distance_goudron: '',
    });

    // ✅ Liste des biens à créer
    const [properties, setProperties] = useState<BulkPropertyItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
    const [showStandings, setShowStandings] = useState(false); // Pour meublés/hôtels

    // ✅ Détection devise
    const defaultCurrency = useCurrencyDetection(commonData.ville || commonData.quartier);
    const [devise, setDevise] = useState(defaultCurrency);

    // ✅ Créer service si nécessaire
    useEffect(() => {
        const createServiceIfNeeded = async () => {
            if (!serviceId && user?.id && commonData.adresse) {
                try {
                    const serviceData = {
                        titre_service: `Immeuble - ${commonData.adresse}`,
                        description: 'Biens immobiliers multiples',
                        category: 'immobilier',
                        specialized_type: 'immobilier',
                    };
                    const response = await servicesApi.createService(serviceData);
                    if (response.success && response.data && typeof response.data === 'object' && 'id' in response.data) {
                        setServiceId((response.data as any).id);
                    }
                } catch (error: any) {
                    console.error('[ImmobilierBulkFormScreen] Erreur création service:', error);
                }
            }
        };
        if (!serviceId && commonData.adresse) {
            createServiceIfNeeded();
        }
    }, [commonData.adresse, serviceId, user?.id]);

    // ✅ Détection devise
    useEffect(() => {
        const locationSource = commonData.ville || commonData.quartier;
        if (locationSource) {
            const currency = getCurrencyIntelligently(locationSource, location?.coords ? {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            } : null);
            if (currency) {
                setDevise(currency);
            }
        } else if (location?.coords) {
            const gpsCurrency = getCurrencyFromGPS({
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            });
            setDevise(gpsCurrency);
        }
    }, [commonData.ville, commonData.quartier, location]);

    // ✅ Ajouter un bien à la liste
    const addProperty = (template?: PropertyTemplate) => {
        const newProperty: BulkPropertyItem = {
            id: Date.now().toString(),
            type_bien: template?.type_bien || 'chambre',
            nb_chambres: template?.defaultChambres.toString() || '1',
            superficie_m2: template?.defaultSuperficie.toString() || '20',
            standing: '',
            prix_location_mensuel: '',
            prix_location_journalier: '',
            etat_general: 'bon_etat',
            nb_salles_bain: '1',
        };
        setProperties([...properties, newProperty]);
    };

    // ✅ Supprimer un bien
    const removeProperty = (id: string) => {
        setProperties(properties.filter(p => p.id !== id));
    };

    // ✅ Mettre à jour un bien
    const updateProperty = (id: string, field: keyof BulkPropertyItem, value: string) => {
        setProperties(properties.map(p => 
            p.id === id ? { ...p, [field]: value } : p
        ));
    };

    // ✅ Créer plusieurs biens depuis un template
    const createFromTemplate = (template: PropertyTemplate, count: number, withStandings: boolean = false) => {
        const newProperties: BulkPropertyItem[] = [];
        
        if (withStandings && (template.type_bien === 'meublé' || template.type_bien === 'hôtel')) {
            // ✅ Créer un bien par standing pour meublés/hôtels
            standings.forEach((standing, index) => {
                newProperties.push({
                    id: `${Date.now()}-${index}`,
                    type_bien: template.type_bien,
                    nb_chambres: template.defaultChambres.toString(),
                    superficie_m2: template.defaultSuperficie.toString(),
                    standing: standing.value,
                    prix_location_mensuel: '',
                    prix_location_journalier: '',
                    etat_general: 'bon_etat',
                    nb_salles_bain: '1',
                });
            });
        } else {
            // ✅ Créer plusieurs biens identiques
            for (let i = 0; i < count; i++) {
                newProperties.push({
                    id: `${Date.now()}-${i}`,
                    type_bien: template.type_bien,
                    nb_chambres: template.defaultChambres.toString(),
                    superficie_m2: template.defaultSuperficie.toString(),
                    standing: '',
                    prix_location_mensuel: '',
                    prix_location_journalier: '',
                    etat_general: 'bon_etat',
                    nb_salles_bain: '1',
                });
            }
        }
        
        setProperties([...properties, ...newProperties]);
        setSelectedTemplate(null);
    };

    // ✅ Soumettre la création en lot
    const handleSubmit = async () => {
        if (!serviceId) {
            Alert.alert('Erreur', 'Service ID manquant');
            return;
        }

        if (properties.length === 0) {
            Alert.alert('Erreur', 'Veuillez ajouter au moins un bien');
            return;
        }

        if (!commonData.ville && !commonData.gps) {
            Alert.alert('Erreur', 'La localisation (ville ou GPS) est obligatoire');
            return;
        }

        setLoading(true);
        try {
            // ✅ Créer tous les biens
            const results = [];
            for (const property of properties) {
                const characteristics = getCharacteristicsForType(property.type_bien);
                
                const payload = {
                    service_id: serviceId,
                    titre: `${property.type_bien.charAt(0).toUpperCase() + property.type_bien.slice(1)} - ${commonData.adresse || commonData.ville?.place_name || 'Bien'}`,
                    description: `Bien de type ${property.type_bien}`,
                    type_bien: property.type_bien,
                    statut: commonData.statut,
                    adresse: commonData.adresse || undefined,
                    quartier: commonData.quartier?.place_name || undefined,
                    ville: commonData.ville?.place_name || undefined,
                    gps: commonData.gps || undefined,
                    superficie_m2: property.superficie_m2 ? parseFloat(property.superficie_m2) : undefined,
                    nb_chambres: property.nb_chambres ? parseInt(property.nb_chambres) : undefined,
                    nb_salles_bain: property.nb_salles_bain ? parseInt(property.nb_salles_bain) : undefined,
                    standing: property.standing || undefined,
                    etat_general: property.etat_general || undefined,
                    prix_vente: null,
                    prix_location_mensuel: (characteristics.useDailyPrice || characteristics.noMonthlyPrice) ? null : (property.prix_location_mensuel ? parseFloat(property.prix_location_mensuel) : null),
                    prix_location_journalier: characteristics.useDailyPrice ? (property.prix_location_journalier ? parseFloat(property.prix_location_journalier) : null) : null,
                    equipements: commonData.equipements.length > 0 ? commonData.equipements : undefined,
                    distance_goudron: commonData.distance_goudron ? parseFloat(commonData.distance_goudron) : undefined,
                    caution_mois: commonData.caution_mois ? parseInt(commonData.caution_mois) : undefined,
                    caution_montant: commonData.caution_montant ? parseFloat(commonData.caution_montant) : undefined,
                    mensualites_exigees: commonData.mensualites_exigees ? parseInt(commonData.mensualites_exigees) : undefined,
                };

                const response = await apiPost('/api/immobilier/biens', payload);
                if (response.success) {
                    results.push({ success: true, id: response.data?.id });
                } else {
                    results.push({ success: false, error: response.error });
                }
            }

            const successCount = results.filter(r => r.success).length;
            const failCount = results.filter(r => !r.success).length;

            Alert.alert(
                'Résultat',
                `${successCount} bien(s) créé(s) avec succès${failCount > 0 ? `, ${failCount} erreur(s)` : ''}`,
                [{ text: 'OK', onPress: () => navigation.goBack() }]
            );
        } catch (error: any) {
            console.error('Erreur création en lot:', error);
            Alert.alert('Erreur', error.message || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    // ✅ Fonction helper pour caractéristiques
    const getCharacteristicsForType = (type: string) => {
        switch (type) {
            case 'studio':
            case 'chambre':
            case 'meublé':
            case 'hôtel':
                return { useDailyPrice: type === 'meublé' || type === 'hôtel', noMonthlyPrice: false };
            case 'terrain':
                return { useDailyPrice: false, noMonthlyPrice: true };
            default:
                return { useDailyPrice: false, noMonthlyPrice: false };
        }
    };

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Création en lot</Text>
                <View style={styles.headerSpacer} />
            </View>

            <ScrollView 
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* ✅ Section 1: Informations communes */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <SafeIcon name="info" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={styles.sectionTitle}>Informations communes</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Statut *</Text>
                            <View style={styles.chipsRow}>
                                {['vente', 'location', 'les_deux'].map((statut) => (
                                    <TouchableOpacity
                                        key={statut}
                                        style={[
                                            styles.chipButton,
                                            commonData.statut === statut && styles.chipButtonSelected,
                                        ]}
                                        onPress={() => setCommonData({ ...commonData, statut })}
                                    >
                                        <Text style={[
                                            styles.chipButtonText,
                                            commonData.statut === statut && styles.chipButtonTextSelected,
                                        ]}>
                                            {statut === 'vente' ? 'À vendre' : statut === 'location' ? 'À louer' : 'Les deux'}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Adresse</Text>
                            <NativeInput
                                value={commonData.adresse}
                                onChangeText={(text) => setCommonData({ ...commonData, adresse: text })}
                                placeholder="Ex: Rue 1234, Immeuble XYZ"
                                style={styles.input}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Ville *</Text>
                            <LocationSelector
                                label=""
                                value={commonData.ville ? (typeof commonData.ville === 'string' ? { raw: commonData.ville, place_name: commonData.ville } : commonData.ville) : ''}
                                onSelect={(location: LocationObject) => {
                                    setCommonData({ ...commonData, ville: location });
                                }}
                                placeholder="Rechercher une ville..."
                                scope="city"
                                enrichWithBackend={true}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>Quartier</Text>
                            <LocationSelector
                                label=""
                                value={commonData.quartier ? (typeof commonData.quartier === 'string' ? { raw: commonData.quartier, place_name: commonData.quartier } : commonData.quartier) : ''}
                                onSelect={(location: LocationObject) => {
                                    setCommonData({ ...commonData, quartier: location });
                                }}
                                placeholder="Rechercher un quartier..."
                                scope="neighborhood"
                                cityContext={commonData.ville?.raw || commonData.ville?.place_name || ''}
                                enrichWithBackend={true}
                            />
                        </View>
                    </View>
                </View>

                {/* ✅ Section 2: Templates rapides */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <SafeIcon name="layers" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={styles.sectionTitle}>Création rapide</Text>
                    </View>
                    <View style={styles.sectionContent}>
                        <Text style={styles.hintText}>
                            Sélectionnez un template pour créer plusieurs biens rapidement
                        </Text>
                        
                        <View style={styles.templatesGrid}>
                            {propertyTemplates.map((template) => (
                                <TouchableOpacity
                                    key={template.type_bien}
                                    style={styles.templateCard}
                                    onPress={() => {
                                        if (template.type_bien === 'meublé' || template.type_bien === 'hôtel') {
                                            setShowStandings(true);
                                            setSelectedTemplate(template.type_bien);
                                        } else {
                                            // ✅ Créer directement 1 bien, l'utilisateur peut en ajouter d'autres
                                            createFromTemplate(template, 1, false);
                                        }
                                    }}
                                    onLongPress={() => {
                                        // ✅ Long press pour créer plusieurs biens
                                        Alert.alert(
                                            'Créer plusieurs biens',
                                            `Voulez-vous créer plusieurs ${template.label.toLowerCase()} ?`,
                                            [
                                                { text: 'Annuler', style: 'cancel' },
                                                { text: '1 bien', onPress: () => createFromTemplate(template, 1, false) },
                                                { text: '3 biens', onPress: () => createFromTemplate(template, 3, false) },
                                                { text: '5 biens', onPress: () => createFromTemplate(template, 5, false) },
                                                { text: '10 biens', onPress: () => createFromTemplate(template, 10, false) },
                                            ]
                                        );
                                    }}
                                >
                                    <SafeIcon name={template.icon} size={24} color={modernColors.primary} type="lucide" />
                                    <Text style={styles.templateLabel}>{template.label}</Text>
                                    <Text style={styles.templateDescription}>{template.description}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* ✅ Modal pour standings (meublés/hôtels) */}
                        {showStandings && selectedTemplate && (
                            <View style={styles.standingsModal}>
                                <Text style={styles.standingsTitle}>
                                    Créer un bien par standing pour {selectedTemplate === 'meublé' ? 'meublé' : 'hôtel'}
                                </Text>
                                <View style={styles.standingsGrid}>
                                    {standings.map((standing) => (
                                        <TouchableOpacity
                                            key={standing.value}
                                            style={styles.standingChip}
                                            onPress={() => {
                                                const template = propertyTemplates.find(t => t.type_bien === selectedTemplate);
                                                if (template) {
                                                    createFromTemplate(template, 1, true);
                                                }
                                                setShowStandings(false);
                                                setSelectedTemplate(null);
                                            }}
                                        >
                                            <Text style={styles.standingChipText}>{standing.label}</Text>
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => {
                                        setShowStandings(false);
                                        setSelectedTemplate(null);
                                    }}
                                >
                                    <Text style={styles.cancelButtonText}>Annuler</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                    </View>
                </View>

                {/* ✅ Section 3: Liste des biens à créer */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <SafeIcon name="list" size={20} color={modernColors.primary} type="lucide" />
                        <Text style={styles.sectionTitle}>
                            Biens à créer ({properties.length})
                        </Text>
                    </View>
                    <View style={styles.sectionContent}>
                        {properties.length === 0 ? (
                            <View style={styles.emptyState}>
                                <SafeIcon name="inbox" size={48} color="#9CA3AF" type="lucide" />
                                <Text style={styles.emptyStateText}>
                                    Aucun bien ajouté. Utilisez les templates ci-dessus pour commencer.
                                </Text>
                            </View>
                        ) : (
                            properties.map((property, index) => {
                                const characteristics = getCharacteristicsForType(property.type_bien);
                                const template = propertyTemplates.find(t => t.type_bien === property.type_bien);
                                
                                return (
                                    <View key={property.id} style={styles.propertyCard}>
                                        <View style={styles.propertyHeader}>
                                            <View style={styles.propertyHeaderLeft}>
                                                <SafeIcon name={template?.icon || 'home'} size={20} color={modernColors.primary} type="lucide" />
                                                <Text style={styles.propertyTitle}>
                                                    {template?.label || property.type_bien} #{index + 1}
                                                </Text>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => removeProperty(property.id)}
                                                style={styles.removeButton}
                                            >
                                                <SafeIcon name="x" size={20} color="#EF4444" type="lucide" />
                                            </TouchableOpacity>
                                        </View>

                                        <View style={styles.propertyFields}>
                                            <View style={styles.row}>
                                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                                    <Text style={styles.label}>Chambres</Text>
                                                    <NativeInput
                                                        value={property.nb_chambres}
                                                        onChangeText={(text) => updateProperty(property.id, 'nb_chambres', text)}
                                                        placeholder="1"
                                                        keyboardType="numeric"
                                                        style={styles.input}
                                                    />
                                                </View>
                                                <View style={[styles.inputGroup, styles.halfWidth]}>
                                                    <Text style={styles.label}>Superficie (m²)</Text>
                                                    <NativeInput
                                                        value={property.superficie_m2}
                                                        onChangeText={(text) => updateProperty(property.id, 'superficie_m2', text)}
                                                        placeholder="20"
                                                        keyboardType="numeric"
                                                        style={styles.input}
                                                    />
                                                </View>
                                            </View>

                                            {!characteristics.noMonthlyPrice && (
                                                <View style={styles.inputGroup}>
                                                    <Text style={styles.label}>
                                                        {characteristics.useDailyPrice ? 'Prix/jour' : 'Prix/mois'} ({devise})
                                                    </Text>
                                                    <NativeInput
                                                        value={characteristics.useDailyPrice ? property.prix_location_journalier : property.prix_location_mensuel}
                                                        onChangeText={(text) => updateProperty(
                                                            property.id, 
                                                            characteristics.useDailyPrice ? 'prix_location_journalier' : 'prix_location_mensuel', 
                                                            text
                                                        )}
                                                        placeholder="0"
                                                        keyboardType="numeric"
                                                        style={styles.input}
                                                    />
                                                </View>
                                            )}

                                            {(property.type_bien === 'meublé' || property.type_bien === 'hôtel') && (
                                                <View style={styles.inputGroup}>
                                                    <Text style={styles.label}>Standing</Text>
                                                    <View style={styles.chipsRow}>
                                                        {standings.map((standing) => (
                                                            <TouchableOpacity
                                                                key={standing.value}
                                                                style={[
                                                                    styles.chipSmall,
                                                                    property.standing === standing.value && styles.chipSmallSelected,
                                                                ]}
                                                                onPress={() => updateProperty(property.id, 'standing', standing.value)}
                                                            >
                                                                <Text style={[
                                                                    styles.chipSmallText,
                                                                    property.standing === standing.value && styles.chipSmallTextSelected,
                                                                ]}>
                                                                    {standing.label}
                                                                </Text>
                                                            </TouchableOpacity>
                                                        ))}
                                                    </View>
                                                </View>
                                            )}
                                        </View>
                                    </View>
                                );
                            })
                        )}

                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={() => addProperty()}
                        >
                            <SafeIcon name="plus" size={20} color="#FFFFFF" type="lucide" />
                            <Text style={styles.addButtonText}>Ajouter un bien manuellement</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ✅ Bouton de soumission */}
                <View style={styles.submitSection}>
                    <NativeButton
                        title={loading ? 'Création en cours...' : `Créer ${properties.length} bien(s)`}
                        onPress={handleSubmit}
                        disabled={loading || properties.length === 0}
                        variant="primary"
                        size="large"
                    />
                </View>
            </ScrollView>
        </SafeNativeView>
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
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    backButton: {
        padding: 8,
    },
    title: {
        flex: 1,
        fontSize: 20,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 8,
    },
    headerSpacer: {
        width: 40,
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        marginBottom: 16,
        padding: 16,
        ...modernColors.shadowLight,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#111827',
        marginLeft: 8,
    },
    sectionContent: {
        gap: 16,
    },
    inputGroup: {
        marginBottom: 16,
    },
    label: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
        marginBottom: 8,
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
    },
    chipsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    chipButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipButtonSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipButtonText: {
        fontSize: 14,
        color: '#374151',
    },
    chipButtonTextSelected: {
        color: '#FFFFFF',
    },
    hintText: {
        fontSize: 12,
        color: '#6B7280',
        marginBottom: 12,
    },
    templatesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    templateCard: {
        flex: 1,
        minWidth: '45%',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    templateLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginTop: 8,
        textAlign: 'center',
    },
    templateDescription: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
        textAlign: 'center',
    },
    standingsModal: {
        marginTop: 16,
        padding: 16,
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    standingsTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
        marginBottom: 12,
    },
    standingsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    standingChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    standingChipText: {
        fontSize: 12,
        color: modernColors.primary,
    },
    cancelButton: {
        padding: 8,
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        color: '#6B7280',
    },
    emptyState: {
        alignItems: 'center',
        padding: 32,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginTop: 16,
    },
    propertyCard: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    propertyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    propertyHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    propertyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    removeButton: {
        padding: 4,
    },
    propertyFields: {
        gap: 12,
    },
    row: {
        flexDirection: 'row',
        gap: 12,
    },
    halfWidth: {
        flex: 1,
    },
    chipSmall: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    chipSmallSelected: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    chipSmallText: {
        fontSize: 12,
        color: '#374151',
    },
    chipSmallTextSelected: {
        color: '#FFFFFF',
    },
    addButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderStyle: 'dashed',
        gap: 8,
    },
    addButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#374151',
    },
    submitSection: {
        marginTop: 8,
        marginBottom: 32,
    },
});

export default ImmobilierBulkFormScreen;

