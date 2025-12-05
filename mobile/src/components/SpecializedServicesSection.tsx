// 🏥 Section Services Spécialisés pour HomeScreen
// Regroupement en 5 catégories avec détection prestataire/client

import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// ✅ Configuration des catégories et services
const SERVICE_CATEGORIES = [
    {
        id: 'sante',
        name: 'SANTÉ',
        icon: 'heart-pulse',
        color: '#10B981',
        services: [
            { id: 'pharmacie', name: 'Pharmacie', icon: 'pill', emoji: '💊', route: 'PharmacieForm', searchRoute: 'PharmacieSearch' },
            { id: 'hopital', name: 'Hôpital', icon: 'hospital', emoji: '🏥', route: 'HopitalForm', searchRoute: 'HopitalSearch' },
            { id: 'laboratoire', name: 'Laboratoire', icon: 'microscope', emoji: '🔬', route: 'LaboratoireForm', searchRoute: 'LaboratoireSearch' },
            { id: 'banque_sang', name: 'Banque Sang', icon: 'droplet', emoji: '🩸', route: 'BanqueSangForm', searchRoute: 'BanqueSangSearch' },
        ],
    },
    {
        id: 'transport',
        name: 'TRANSPORT',
        icon: 'car-front',
        color: '#3B82F6',
        services: [
            { id: 'taxi', name: 'Taxi', icon: 'car', emoji: '🚕', route: 'TaxiForm', searchRoute: 'TaxiSearch' },
            { id: 'covoiturage', name: 'Covoiturage', icon: 'users', emoji: '🚗', route: 'CovoiturageForm', searchRoute: 'CovoiturageSearch' },
            { id: 'agence_voyage', name: 'Agence', icon: 'bus', emoji: '🚌', route: 'AgenceVoyageForm', searchRoute: 'AgenceVoyageSearch' },
        ],
    },
    {
        id: 'immobilier',
        name: 'IMMOBILIER',
        icon: 'home',
        color: '#F59E0B',
        services: [
            { id: 'immobilier', name: 'Immobilier', icon: 'home', emoji: '🏠', route: 'ImmobilierSearch', searchRoute: 'ImmobilierSearch' },
        ],
    },
    {
        id: 'education',
        name: 'ÉDUCATION & EMPLOI',
        icon: 'graduation-cap',
        color: '#8B5CF6',
        services: [
            { id: 'orientation_scolaire', name: 'Orientation', icon: 'graduation-cap', emoji: '🎓', route: 'OrientationScolaireHub', searchRoute: 'OrientationScolaireHub' },
            { id: 'offres_emploi', name: 'Emploi', icon: 'briefcase', emoji: '💼', route: 'OffresEmploiHub', searchRoute: 'OffresEmploiHub' },
            { id: 'bourse_livre', name: 'Livres', icon: 'book-open', emoji: '📚', route: 'LivreScolaireSearch', searchRoute: 'LivreScolaireSearch' },
        ],
    },
    {
        id: 'menus',
        name: 'CUISINE & MENUS',
        icon: 'utensils-crossed',
        color: '#EC4899',
        services: [
            { id: 'menu_planning', name: 'Menus', icon: 'utensils-crossed', emoji: '🍽️', route: 'MenuPlanningHub', searchRoute: 'MenuPlanningHub' },
        ],
    },
];

interface UserService {
    id: number;
    service_id: number;
    type: string;
    nom?: string;
    is_active?: boolean;
}

interface SpecializedServicesSectionProps {
    compact?: boolean;
}

const SpecializedServicesSection: React.FC<SpecializedServicesSectionProps> = ({
    compact = false,
}) => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userServices, setUserServices] = useState<UserService[]>([]);
    const [userServicesByCategory, setUserServicesByCategory] = useState<Record<string, UserService[]>>({});

    // ✅ Charger les services de l'utilisateur pour détecter prestataire vs client
    useEffect(() => {
        if (user?.id) {
            loadUserServices();
        } else {
            setLoading(false);
        }
    }, [user?.id]);

    const loadUserServices = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/specialized-services/user?page=1&limit=100');

            if (response.success && response.data) {
                const services = (response.data as any).services || [];
                setUserServices(services);

                // ✅ Grouper par catégorie
                const grouped: Record<string, UserService[]> = {};
                services.forEach((service: UserService) => {
                    const category = getCategoryForServiceType(service.type);
                    if (category) {
                        if (!grouped[category]) {
                            grouped[category] = [];
                        }
                        grouped[category].push(service);
                    }
                });
                setUserServicesByCategory(grouped);
            }
        } catch (error) {
            console.error('[SpecializedServicesSection] Erreur chargement services:', error);
        } finally {
            setLoading(false);
        }
    };

    // ✅ Déterminer la catégorie d'un service
    const getCategoryForServiceType = (serviceType: string): string | null => {
        for (const category of SERVICE_CATEGORIES) {
            const found = category.services.find(s =>
                s.id === serviceType ||
                serviceType.includes(s.id) ||
                s.id.includes(serviceType)
            );
            if (found) {
                return category.id;
            }
        }
        return null;
    };

    // ✅ Vérifier si l'utilisateur a des services dans une catégorie
    const hasServicesInCategory = (categoryId: string): boolean => {
        return (userServicesByCategory[categoryId]?.length || 0) > 0;
    };

    // ✅ Vérifier si l'utilisateur a un service spécifique
    const hasService = (serviceId: string): UserService | null => {
        const service = userServices.find(s => {
            const normalizedType = s.type.toLowerCase();
            return normalizedType === serviceId ||
                normalizedType.includes(serviceId) ||
                serviceId.includes(normalizedType);
        });
        return service || null;
    };

    // ✅ Gérer le tap sur une catégorie
    const handleCategoryPress = (category: typeof SERVICE_CATEGORIES[0]) => {
        if (hasServicesInCategory(category.id)) {
            // ✅ PRESTATAIRE avec services → GestionServicesSpecialisesScreen (filtré)
            (navigation as any).navigate('GestionServicesSpecialises', {
                category: category.id,
            });
        } else {
            // ✅ CLIENT ou PRESTATAIRE sans services → SpecializedSearchScreen
            (navigation as any).navigate('SpecializedSearch', {
                specializedType: category.id,
                categoryName: category.name,
            });
        }
    };

    // ✅ Gérer le tap sur un service spécifique
    const handleServicePress = (
        category: typeof SERVICE_CATEGORIES[0],
        service: typeof SERVICE_CATEGORIES[0]['services'][0]
    ) => {
        const userService = hasService(service.id);

        if (userService) {
            // ✅ PRESTATAIRE avec service → FormScreen (mode édition)
            (navigation as any).navigate(service.route, {
                serviceId: userService.service_id,
                mode: 'edit',
            });
        } else {
            // ✅ CLIENT ou PRESTATAIRE sans service → SearchScreen ou FormScreen (création)
            // Pour certains services, on peut créer directement
            const canCreateDirectly = ['pharmacie', 'hopital', 'laboratoire', 'taxi', 'covoiturage'].includes(service.id);

            if (canCreateDirectly && user?.id) {
                // Modal de choix: Créer ou Rechercher
                // Pour simplifier, on redirige vers la recherche
                (navigation as any).navigate(service.searchRoute || 'SpecializedSearch', {
                    specializedType: service.id,
                });
            } else {
                // Recherche directe
                (navigation as any).navigate(service.searchRoute || 'SpecializedSearch', {
                    specializedType: service.id,
                });
            }
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={modernColors.primary} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={styles.headerLeft}>
                    <SafeIcon name="sparkles" size={20} color={modernColors.primary} type="lucide" />
                    <Text style={styles.title}>Services Spécialisés</Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        (navigation as any).navigate('SpecializedServicesHub');
                    }}
                >
                    <Text style={styles.seeAllText}>Voir tous →</Text>
                </TouchableOpacity>
            </View>

            {/* ✅ Catégories avec services */}
            {SERVICE_CATEGORIES.map((category) => (
                <View key={category.id} style={styles.categoryContainer}>
                    {/* Header de catégorie */}
                    <TouchableOpacity
                        style={styles.categoryHeader}
                        onPress={() => handleCategoryPress(category)}
                        activeOpacity={0.7}
                    >
                        <View style={styles.categoryHeaderLeft}>
                            <View style={[styles.categoryIconContainer, { backgroundColor: category.color + '20' }]}>
                                <SafeIcon
                                    name={category.icon}
                                    size={18}
                                    color={category.color}
                                    type="lucide"
                                />
                            </View>
                            <Text style={styles.categoryName}>{category.name}</Text>
                            {hasServicesInCategory(category.id) && (
                                <View style={styles.badge}>
                                    <Text style={styles.badgeText}>
                                        {userServicesByCategory[category.id]?.length || 0}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <SafeIcon name="chevron-right" size={16} color={modernColors.textSecondary} type="lucide" />
                    </TouchableOpacity>

                    {/* Services de la catégorie */}
                    <View style={styles.servicesGrid}>
                        {category.services.map((service) => {
                            const userService = hasService(service.id);
                            return (
                                <TouchableOpacity
                                    key={service.id}
                                    style={styles.serviceCard}
                                    onPress={() => handleServicePress(category, service)}
                                    activeOpacity={0.7}
                                >
                                    <View style={[styles.serviceIconContainer, { backgroundColor: category.color + '15' }]}>
                                        <Text style={styles.serviceEmoji}>{service.emoji}</Text>
                                    </View>
                                    <Text style={styles.serviceName} numberOfLines={1}>
                                        {service.name}
                                    </Text>
                                    {userService && (
                                        <View style={styles.serviceBadge}>
                                            <View style={[styles.serviceBadgeDot, { backgroundColor: userService.is_active ? '#10B981' : '#9CA3AF' }]} />
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>
            ))}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginVertical: 16,
        paddingHorizontal: 16,
    },
    loadingContainer: {
        padding: 20,
        alignItems: 'center',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    headerLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    seeAllText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    categoryContainer: {
        marginBottom: 20,
    },
    categoryHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 4,
    },
    categoryHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    categoryIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    categoryName: {
        fontSize: 16,
        fontWeight: '700',
        color: modernColors.text,
    },
    badge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
        minWidth: 24,
        alignItems: 'center',
    },
    badgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    servicesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        paddingLeft: 4,
    },
    serviceCard: {
        width: '30%', // 3 colonnes
        minWidth: 90,
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    serviceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 8,
    },
    serviceEmoji: {
        fontSize: 24,
    },
    serviceName: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    serviceBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
    },
    serviceBadgeDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
});

export default SpecializedServicesSection;

