import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    Dimensions,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import SafeIcon from '../components/SafeIcon';
import { NativeButton } from '../components/SafeNativeDesign';
import { useAuth } from '../contexts/AuthContext';
import { servicesApi } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');
const CARD_PADDING = 16; // Padding horizontal du conteneur
const CARD_MARGIN = 8; // Marge entre les cartes
// ✅ Calcul pour 2 colonnes : largeur totale - 2*padding - 1*marge entre cartes, divisé par 2
const CARD_WIDTH = (width - (CARD_PADDING * 2) - CARD_MARGIN) / 2;

interface ServiceSpecialise {
    id: string;
    title: string;
    icon: string;
    description: string;
    route: string;
    color: string;
}

const MesServicesSpecialisesScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [creatingService, setCreatingService] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterCategory, setFilterCategory] = useState<'tous' | 'sante' | 'transport'>('tous');

    // ✅ NOUVEAU : Rediriger vers le hub unifié si disponible
    // Sinon, garder l'ancien comportement pour compatibilité
    useEffect(() => {
        // Optionnel : rediriger automatiquement vers le hub
        // (navigation as any).navigate('SpecializedServicesHub');
    }, []);

    // ✅ Créer automatiquement un service avant la navigation
    const handleServicePress = async (service: ServiceSpecialise) => {
        if (creatingService) {
            console.log('[MesServicesSpecialisesScreen] ⚠️ Création déjà en cours, ignore le clic');
            return; // Éviter les clics multiples
        }

        try {
            setCreatingService(service.id);
            console.log('[MesServicesSpecialisesScreen] 🚀 Début création service:', service.id, 'Route:', service.route);

            // ✅ CORRECTION: Créer un service avec le format structuré attendu par le backend
            // Le backend attend: titre_service, category, description (obligatoires)
            // Format: peut être string simple ou objet avec { type_donnee, valeur }
            const categoryValue = service.id.includes('pharmacie') || service.id.includes('hopital') || service.id.includes('laboratoire') || service.id.includes('banque_sang')
                ? 'sante'
                : 'transport';

            // ✅ CORRECTION: Format structuré attendu par le backend
            // Le backend peut accepter soit un format simple (string) soit un format structuré
            // Pour les services spécialisés, on utilise le format simple
            const serviceData: any = {
                titre_service: service.title,
                description: service.description,
                category: categoryValue,
                // ✅ Ajouter is_tarissable par défaut (requis par le backend)
                is_tarissable: false,
            };

            // ✅ CORRECTION: S'assurer que les champs sont non vides
            if (!serviceData.titre_service || !serviceData.description || !serviceData.category) {
                Alert.alert(
                    'Erreur',
                    'Données de service incomplètes. Veuillez réessayer.',
                    [{ text: 'OK' }]
                );
                setCreatingService(null);
                return;
            }

            console.log('[MesServicesSpecialisesScreen] 📝 Données service à créer:', {
                serviceId: service.id,
                serviceData,
                route: service.route,
                category: categoryValue
            });

            const response = await servicesApi.createService(serviceData);

            console.log('[MesServicesSpecialisesScreen] Réponse création service:', {
                success: response.success,
                hasData: !!response.data,
                dataType: typeof response.data,
                error: response.error,
                message: response.message,
                fullResponse: JSON.stringify(response, null, 2)
            });

            if (response.success && response.data) {
                // ✅ CORRECTION: Vérifier différents formats de réponse
                let serviceId: number | string | undefined;

                if (typeof response.data === 'object') {
                    // Format 1: { id: ... }
                    if ('id' in response.data) {
                        serviceId = (response.data as any).id;
                    }
                    // Format 2: { service_id: ... }
                    else if ('service_id' in response.data) {
                        serviceId = (response.data as any).service_id;
                    }
                    // Format 3: { data: { id: ... } }
                    else if ('data' in response.data && typeof response.data.data === 'object' && response.data.data && 'id' in response.data.data) {
                        serviceId = (response.data.data as any).id;
                    }
                } else if (typeof response.data === 'number' || typeof response.data === 'string') {
                    serviceId = response.data;
                }

                if (serviceId) {
                    console.log('[MesServicesSpecialisesScreen] ✅ Service créé avec ID:', serviceId);
                    console.log('[MesServicesSpecialisesScreen] 🧭 Tentative navigation vers:', service.route, 'avec serviceId:', serviceId);

                    // ✅ CORRECTION: Naviguer vers le formulaire avec le serviceId en utilisant le navigateur parent
                    try {
                        // Utiliser le navigateur parent si disponible (pour navigation entre stacks)
                        const parentNavigation = (navigation as any).getParent?.() || navigation;
                        console.log('[MesServicesSpecialisesScreen] 🧭 Navigation avec parentNavigation vers:', service.route);
                        parentNavigation.navigate(service.route, {
                            serviceId: serviceId,
                            mode: 'create'
                        });
                        console.log('[MesServicesSpecialisesScreen] ✅ Navigation réussie vers:', service.route);
                    } catch (navError: any) {
                        console.error('[MesServicesSpecialisesScreen] ❌ Erreur navigation parent:', navError);
                        console.log('[MesServicesSpecialisesScreen] 🔄 Tentative navigation directe...');
                        // Fallback: essayer avec le navigateur direct
                        try {
                            (navigation as any).navigate(service.route, {
                                serviceId: serviceId,
                                mode: 'create'
                            });
                            console.log('[MesServicesSpecialisesScreen] ✅ Navigation directe réussie vers:', service.route);
                        } catch (fallbackError: any) {
                            console.error('[MesServicesSpecialisesScreen] ❌ Erreur navigation fallback:', fallbackError);
                            console.error('[MesServicesSpecialisesScreen] ❌ Détails erreur:', {
                                message: fallbackError?.message,
                                stack: fallbackError?.stack,
                                route: service.route,
                                serviceId: serviceId
                            });
                            Alert.alert(
                                'Erreur de navigation',
                                `Impossible d'ouvrir le formulaire ${service.title}.\n\nRoute: ${service.route}\nErreur: ${fallbackError?.message || 'Navigation échouée'}\n\nVeuillez réessayer.`,
                                [
                                    { text: 'OK' },
                                    {
                                        text: 'Réessayer',
                                        onPress: () => handleServicePress(service)
                                    }
                                ]
                            );
                        }
                    }
                } else {
                    console.error('[MesServicesSpecialisesScreen] ❌ Service créé mais ID introuvable dans la réponse:', response);
                    Alert.alert(
                        'Erreur',
                        `Service créé mais ID introuvable. Réponse: ${JSON.stringify(response.data)}`,
                        [{ text: 'OK' }]
                    );
                }
            } else {
                // ✅ CORRECTION: Afficher le message d'erreur réel du backend avec détails
                const errorMessage = response.error || response.message || 'Impossible de créer le service spécialisé. Veuillez réessayer.';
                console.error('[MesServicesSpecialisesScreen] ❌ Erreur création service:', {
                    error: response.error,
                    message: response.message,
                    data: response.data,
                    fullResponse: JSON.stringify(response, null, 2),
                    serviceData: JSON.stringify(serviceData, null, 2)
                });

                // ✅ NOUVEAU: Si l'erreur indique que le service existe déjà, essayer de récupérer les services existants
                if (errorMessage.toLowerCase().includes('existe') || errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('déjà')) {
                    console.log('[MesServicesSpecialisesScreen] Service existe peut-être déjà, tentative de récupération...');
                    try {
                        const userServices = await servicesApi.getUserServices();
                        if (userServices.success && Array.isArray(userServices.data)) {
                            // Chercher un service correspondant
                            const existingService = userServices.data.find((s: any) => {
                                const serviceTitle = s.titre_service || s.data?.titre_service?.valeur || s.title || '';
                                return serviceTitle.toLowerCase().includes(service.title.toLowerCase()) ||
                                    serviceTitle.toLowerCase().includes(service.id.toLowerCase());
                            });

                            if (existingService) {
                                const existingServiceId = existingService.id || existingService.service_id;
                                console.log('[MesServicesSpecialisesScreen] ✅ Service existant trouvé:', existingServiceId);
                                // ✅ CORRECTION: Utiliser le navigateur parent pour navigation entre stacks
                                try {
                                    const parentNavigation = (navigation as any).getParent?.() || navigation;
                                    parentNavigation.navigate(service.route, {
                                        serviceId: existingServiceId,
                                        mode: 'edit'
                                    });
                                } catch (navError: any) {
                                    console.error('[MesServicesSpecialisesScreen] ❌ Erreur navigation service existant:', navError);
                                    // Fallback: essayer avec le navigateur direct
                                    (navigation as any).navigate(service.route, {
                                        serviceId: existingServiceId,
                                        mode: 'edit'
                                    });
                                }
                                return;
                            }
                        }
                    } catch (err) {
                        console.error('[MesServicesSpecialisesScreen] Erreur récupération services existants:', err);
                    }
                }

                // ✅ CORRECTION: Afficher un message d'erreur plus détaillé
                const detailedMessage = errorMessage.includes('Solde insuffisant')
                    ? `${errorMessage}\n\nVeuillez recharger vos tokens pour créer un service.`
                    : errorMessage.includes('Champs obligatoires')
                        ? `${errorMessage}\n\nVeuillez vérifier que tous les champs requis sont remplis.`
                        : `${errorMessage}\n\nSi le problème persiste, veuillez contacter le support.`;

                Alert.alert(
                    'Erreur de création',
                    detailedMessage,
                    [
                        { text: 'OK' },
                        {
                            text: 'Voir les détails',
                            onPress: () => {
                                console.log('[MesServicesSpecialisesScreen] 📋 Détails erreur:', {
                                    service: service.title,
                                    serviceData,
                                    response
                                });
                            }
                        }
                    ]
                );
            }
        } catch (error: any) {
            console.error('[MesServicesSpecialisesScreen] ❌ Exception lors de la création du service:', error);
            const errorMessage = error?.message || error?.error || 'Une erreur est survenue lors de la création du service.';
            Alert.alert(
                'Erreur',
                errorMessage,
                [{ text: 'OK' }]
            );
        } finally {
            setCreatingService(null);
        }
    };

    const servicesSante: ServiceSpecialise[] = [
        {
            id: 'pharmacie',
            title: 'Pharmacie',
            icon: 'Pill', // ✅ Icône Lucide en PascalCase
            description: 'Enregistrer une pharmacie avec garde',
            route: 'PharmacieForm',
            color: '#10B981', // Vert
        },
        {
            id: 'hopital',
            title: 'Hôpital/Clinique',
            icon: 'Hospital', // ✅ Icône Lucide en PascalCase
            description: 'Enregistrer un établissement de santé',
            route: 'HopitalForm',
            color: '#EF4444', // Rouge
        },
        {
            id: 'laboratoire',
            title: 'Laboratoire/Imagerie',
            icon: 'Microscope', // ✅ Icône Lucide en PascalCase
            description: 'Enregistrer un laboratoire',
            route: 'LaboratoireForm',
            color: '#3B82F6', // Bleu
        },
        {
            id: 'banque_sang',
            title: 'Banque de Sang',
            icon: 'Droplet', // ✅ Icône Lucide en PascalCase
            description: 'Enregistrer une banque de sang',
            route: 'BanqueSangForm',
            color: '#DC2626', // Rouge foncé
        },
    ];

    const servicesTransport: ServiceSpecialise[] = [
        {
            id: 'agence_voyage',
            title: 'Agence de Voyage',
            icon: 'Bus', // ✅ Icône Lucide en PascalCase
            description: 'Enregistrer une agence de voyage',
            route: 'AgenceVoyageForm',
            color: '#F59E0B', // Orange
        },
        {
            id: 'covoiturage',
            title: 'Covoiturage',
            icon: 'Users', // ✅ Icône Lucide en PascalCase
            description: 'Proposer un trajet partagé',
            route: 'CovoiturageForm',
            color: '#8B5CF6', // Violet
        },
        {
            id: 'taxi',
            title: 'Taxi de Ville',
            icon: 'Car', // ✅ Icône Lucide en PascalCase
            description: 'Enregistrer un service de taxi',
            route: 'TaxiForm',
            color: '#F97316', // Orange foncé
        },
    ];

    // Filtrer les services selon la recherche et la catégorie
    const filteredSante = servicesSante.filter((service) => {
        const matchesSearch = searchQuery === '' ||
            service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch && (filterCategory === 'tous' || filterCategory === 'sante');
    });

    const filteredTransport = servicesTransport.filter((service) => {
        const matchesSearch = searchQuery === '' ||
            service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.description.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch && (filterCategory === 'tous' || filterCategory === 'transport');
    });

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Spécialisés</Text>
                <Text style={styles.subtitle}>
                    Gérez vos services de santé et de transport
                </Text>
            </View>

            {/* ✅ NOUVEAU: Barre de recherche globale */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher un service..."
                        placeholderTextColor={modernColors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ✅ NOUVEAU: Filtres visuels */}
            <View style={styles.filtersContainer}>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        filterCategory === 'tous' && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilterCategory('tous')}
                >
                    <Text
                        style={[
                            styles.filterButtonText,
                            filterCategory === 'tous' && styles.filterButtonTextActive,
                        ]}
                    >
                        Tous
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        filterCategory === 'sante' && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilterCategory('sante')}
                >
                    <SafeIcon
                        name="heart-pulse"
                        size={16}
                        color={filterCategory === 'sante' ? '#fff' : '#EF4444'}
                        type="lucide"
                    />
                    <Text
                        style={[
                            styles.filterButtonText,
                            filterCategory === 'sante' && styles.filterButtonTextActive,
                        ]}
                    >
                        Santé
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[
                        styles.filterButton,
                        filterCategory === 'transport' && styles.filterButtonActive,
                    ]}
                    onPress={() => setFilterCategory('transport')}
                >
                    <SafeIcon
                        name="car"
                        size={16}
                        color={filterCategory === 'transport' ? '#fff' : '#3B82F6'}
                        type="lucide"
                    />
                    <Text
                        style={[
                            styles.filterButtonText,
                            filterCategory === 'transport' && styles.filterButtonTextActive,
                        ]}
                    >
                        Transport
                    </Text>
                </TouchableOpacity>
            </View>

            {/* ✅ NOUVEAU: Bouton pour accéder au hub unifié */}
            <View style={styles.hubButtonContainer}>
                <NativeButton
                    title="📊 Voir le Hub Unifié"
                    variant="primary"
                    onPress={() => {
                        (navigation as any).navigate('SpecializedServicesHub');
                    }}
                />
            </View>

            {/* Groupe Santé */}
            {filteredSante.length > 0 && (
                <View style={styles.group}>
                    <View style={styles.groupHeader}>
                        <SafeIcon name="heart-pulse" size={20} color="#EF4444" type="lucide" />
                        <Text style={styles.groupTitle}>Santé</Text>
                        {filteredSante.length < servicesSante.length && (
                            <Text style={styles.filteredCount}>
                                ({filteredSante.length}/{servicesSante.length})
                            </Text>
                        )}
                    </View>
                    <View style={styles.servicesGrid}>
                        {filteredSante.map((service) => (
                            <TouchableOpacity
                                key={service.id}
                                style={[styles.serviceCard, { borderLeftColor: service.color }]}
                                onPress={() => handleServicePress(service)}
                                disabled={creatingService === service.id}
                            >
                                <View style={[styles.serviceIconContainer, { backgroundColor: service.color + '15' }]}>
                                    <SafeIcon
                                        name={service.icon}
                                        size={20}
                                        color={service.color}
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.serviceTitle} numberOfLines={2}>
                                    {service.title}
                                </Text>
                                <Text style={styles.serviceDescription} numberOfLines={2}>
                                    {service.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Groupe Transport */}
            {filteredTransport.length > 0 && (
                <View style={styles.group}>
                    <View style={styles.groupHeader}>
                        <SafeIcon name="car" size={20} color="#3B82F6" type="lucide" />
                        <Text style={styles.groupTitle}>Transport</Text>
                        {filteredTransport.length < servicesTransport.length && (
                            <Text style={styles.filteredCount}>
                                ({filteredTransport.length}/{servicesTransport.length})
                            </Text>
                        )}
                    </View>
                    <View style={styles.servicesGrid}>
                        {filteredTransport.map((service) => (
                            <TouchableOpacity
                                key={service.id}
                                style={[styles.serviceCard, { borderLeftColor: service.color }]}
                                onPress={() => handleServicePress(service)}
                                disabled={creatingService === service.id}
                            >
                                <View style={[styles.serviceIconContainer, { backgroundColor: service.color + '15' }]}>
                                    <SafeIcon
                                        name={service.icon}
                                        size={20}
                                        color={service.color}
                                        type="lucide"
                                    />
                                </View>
                                <Text style={styles.serviceTitle} numberOfLines={2}>
                                    {service.title}
                                </Text>
                                <Text style={styles.serviceDescription} numberOfLines={2}>
                                    {service.description}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* Message si aucun résultat */}
            {filteredSante.length === 0 && filteredTransport.length === 0 && (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="search-x" size={48} color={modernColors.textSecondary} type="lucide" />
                    <Text style={styles.emptyText}>Aucun service trouvé</Text>
                    <Text style={styles.emptySubtext}>
                        Essayez de modifier votre recherche ou vos filtres
                    </Text>
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    scrollContent: {
        paddingBottom: 20, // ✅ Espace en bas pour le scroll
    },
    header: {
        padding: 20,
        paddingTop: 40,
        backgroundColor: '#FFFFFF', // ✅ AMÉLIORÉ: Blanc pur pour meilleur contraste
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000', // ✅ AJOUT: Ombre pour séparation visuelle
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 2,
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#111827', // ✅ AMÉLIORÉ: Contraste maximal
        marginBottom: 8,
        textShadowColor: 'rgba(0,0,0,0.1)', // ✅ AJOUT: Ombre subtile pour lisibilité
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 1,
    },
    subtitle: {
        fontSize: 16,
        color: '#4B5563', // ✅ AMÉLIORÉ: Plus foncé pour meilleure lisibilité
        fontWeight: '500',
    },
    group: {
        marginTop: 24,
        paddingHorizontal: CARD_PADDING, // ✅ Utiliser la constante
    },
    groupHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8, // ✅ Réduit pour correspondre à l'image
    },
    groupTitle: {
        fontSize: 18, // ✅ Légèrement réduit
        fontWeight: '700',
        color: '#111827',
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between', // ✅ Espacement égal entre les cartes
        alignItems: 'flex-start', // ✅ Aligner en haut
        width: '100%', // ✅ Forcer la largeur complète
    },
    serviceCard: {
        width: CARD_WIDTH, // ✅ Largeur calculée pour 2 colonnes
        backgroundColor: '#fff',
        borderRadius: 12, // ✅ Légèrement réduit
        padding: 14, // ✅ Légèrement réduit
        marginBottom: CARD_MARGIN,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
        minHeight: 140, // ✅ AJOUT: Hauteur minimale pour éviter les cartes trop petites
        // ✅ Supprimer minHeight pour laisser le contenu définir la hauteur
    },
    serviceIconContainer: {
        width: 44, // ✅ AUGMENTÉ: Icônes plus visibles
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        backgroundColor: '#F9FAFB', // ✅ AJOUT: Fond plus visible
        borderWidth: 1, // ✅ AJOUT: Bordure pour meilleure visibilité
        borderColor: '#E5E7EB',
    },
    serviceTitle: {
        fontSize: 15, // ✅ Légèrement réduit
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
        lineHeight: 20,
        textAlign: 'center', // ✅ AJOUT: Centrer pour éviter débordement
    },
    serviceDescription: {
        fontSize: 12,
        color: '#6B7280',
        lineHeight: 16,
        textAlign: 'center', // ✅ AJOUT: Centrer pour éviter débordement
        flex: 1, // ✅ AJOUT: Permettre au texte de s'adapter
    },
    searchContainer: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    filtersContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
        backgroundColor: '#fff',
    },
    filterButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        gap: 6,
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    filterButtonTextActive: {
        color: '#fff',
    },
    hubButtonContainer: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filteredCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginLeft: 8,
    },
    emptyContainer: {
        padding: 40,
        alignItems: 'center',
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginTop: 16,
    },
    emptySubtext: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 8,
        textAlign: 'center',
    },
});

export default MesServicesSpecialisesScreen;

