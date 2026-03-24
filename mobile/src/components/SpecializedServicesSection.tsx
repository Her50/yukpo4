// 🏥 Section Services Spécialisés pour HomeScreen
// Regroupement en 5 catégories avec détection prestataire/client

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
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
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    const { t } = useLanguageSafe();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [userServices, setUserServices] = useState<UserService[]>([]);
    const [userServicesByCategory, setUserServicesByCategory] = useState<Record<string, UserService[]>>({});

    const serviceCategories = useMemo(
        () => [
            {
                id: 'sante',
                name: t('specializedServicesSection.sante'),
                icon: 'heart-pulse',
                color: '#10B981',
                services: [
                    { id: 'pharmacie', name: t('specializedServicesSection.pharmacie'), icon: 'pill', emoji: '💊', route: 'PharmacieForm', searchRoute: 'PharmacieHome' },
                    { id: 'hopital', name: t('specializedServicesSection.hopital'), icon: 'hospital', emoji: '🏥', route: 'HopitalForm', searchRoute: 'HopitalHome' },
                    { id: 'laboratoire', name: t('specializedServicesSection.laboratoire'), icon: 'microscope', emoji: '🔬', route: 'LaboratoireForm', searchRoute: 'LaboratoireHome' },
                    { id: 'banque_sang', name: t('specializedServicesSection.banqueSang'), icon: 'droplet', emoji: '🩸', route: 'BanqueSangForm', searchRoute: 'BanqueSangSearch' },
                ],
            },
            {
                id: 'transport',
                name: t('specializedServicesSection.transport'),
                icon: 'car-front',
                color: '#3B82F6',
                services: [
                    { id: 'taxi', name: t('specializedServicesSection.taxi'), icon: 'car', emoji: '🚕', route: 'TaxiForm', searchRoute: 'TaxiHome' },
                    { id: 'covoiturage', name: t('specializedServicesSection.covoiturage'), icon: 'users', emoji: '🚗', route: 'CovoiturageForm', searchRoute: 'CovoiturageHome' },
                    { id: 'agence_voyage', name: t('specializedServicesSection.agenceVoyage'), icon: 'bus', emoji: '🚌', route: 'AgenceVoyageForm', searchRoute: 'TicketVoyageHome' },
                    { id: 'automobile', name: t('specializedServicesSection.automobile'), icon: 'car', emoji: '🚘', route: 'AutomobileDashboard', searchRoute: 'AutoServicesSearch' },
                ],
            },
            {
                id: 'immobilier',
                name: t('specializedServicesSection.immobilier'),
                icon: 'home',
                color: '#F59E0B',
                services: [
                    { id: 'immobilier', name: t('specializedServicesSection.immobilierService'), icon: 'home', emoji: '🏠', route: 'ImmobilierForm', searchRoute: 'ImmobilierHome' },
                    { id: 'hotel', name: t('specializedServicesSection.hotel'), icon: 'building', emoji: '🏨', route: 'HotelDashboard', searchRoute: 'HotelSearch', searchParams: { mode: 'hotel' } },
                    { id: 'meuble', name: t('specializedServicesSection.meuble'), icon: 'key', emoji: '🛋️', route: 'HotelDashboard', searchRoute: 'MeubleSearch', searchParams: { mode: 'meuble' } },
                ],
            },
            {
                id: 'education',
                name: t('specializedServicesSection.educationEmploi'),
                icon: 'graduation-cap',
                color: '#8B5CF6',
                services: [
                    { id: 'orientation_scolaire', name: t('specializedServicesSection.orientation'), icon: 'graduation-cap', emoji: '🎓', route: 'OrientationScolaireHub', searchRoute: 'OrientationScolaireHub' },
                    { id: 'offres_emploi', name: t('specializedServicesSection.emploi'), icon: 'briefcase', emoji: '💼', route: 'OffresEmploiHub', searchRoute: 'OffresEmploiHub' },
                    { id: 'bourse_livre', name: t('specializedServicesSection.livres'), icon: 'book-open', emoji: '📚', route: 'LivreScolaireHome', searchRoute: 'LivreScolaireHome' },
                ],
            },
            {
                id: 'menus',
                name: t('specializedServicesSection.cuisineMenus'),
                icon: 'utensils-crossed',
                color: '#EC4899',
                services: [
                    { id: 'menu_planning', name: t('specializedServicesSection.menus'), icon: 'utensils-crossed', emoji: '🍽️', route: 'MenuPlanningHub', searchRoute: 'MenuPlanningHub' },
                    { id: 'bayamselam', name: t('specializedServicesSection.superMarche'), icon: 'shopping-cart', emoji: '🛒', route: 'SupermarketPartnerDashboard', searchRoute: 'SupermarketHome' },
                ],
            },
        ],
        [t]
    );

    // ✅ CORRIGÉ: Cache pour éviter les requêtes redondantes
    const servicesCacheRef = React.useRef<{ data: UserService[]; timestamp: number } | null>(null);
    const CACHE_DURATION = 60000; // 60 secondes (plus long car moins fréquent)

    // ✅ Charger les services de l'utilisateur pour détecter prestataire vs client
    useEffect(() => {
        if (user?.id) {
            // ✅ CORRIGÉ: Vérifier le cache avant de faire une requête
            if (servicesCacheRef.current) {
                const cacheAge = Date.now() - servicesCacheRef.current.timestamp;
                if (cacheAge < CACHE_DURATION) {
                    console.log('[SpecializedServicesSection] ✅ Utilisation du cache (âge:', cacheAge, 'ms)');
                    setUserServices(servicesCacheRef.current.data);
                    setLoading(false);
                    return;
                }
            }

            // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
            loadUserServices().catch(error => {
                console.error('[SpecializedServicesSection] Erreur loadUserServices:', error);
            });
        } else {
            setLoading(false);
        }
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [user?.id]);

    const loadUserServices = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/specialized-services/user?page=1&limit=100');

            if (response.success && response.data) {
                const services = (response.data as any).services || [];
                // ✅ CORRIGÉ: Mettre en cache les résultats
                servicesCacheRef.current = {
                    data: services,
                    timestamp: Date.now()
                };
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

    // ✅ Déterminer la catégorie d'un service (backend peut envoyer supermarche / bayamselam, immo, etc.)
    const getCategoryForServiceType = useCallback(
        (serviceType: string): string | null => {
            const st = serviceType.toLowerCase();
            if (st === 'supermarche' || st.includes('supermarche')) {
                return 'menus';
            }
            for (const category of serviceCategories) {
                const found = category.services.find((s) => {
                    if (s.id === 'bayamselam') {
                        return st === 'bayamselam' || st === 'supermarche' || st.includes('supermarche');
                    }
                    if (s.id === 'immobilier') {
                        return st === 'immobilier' || st === 'immo' || st.includes('immobilier');
                    }
                    if (s.id === 'hotel') {
                        return st === 'hotel' || st.includes('hotel');
                    }
                    if (s.id === 'meuble') {
                        return st === 'meuble' || st.includes('meuble');
                    }
                    return s.id === st || st.includes(s.id) || s.id.includes(st);
                });
                if (found) {
                    return category.id;
                }
            }
            return null;
        },
        [serviceCategories]
    );

    // ✅ Vérifier si l'utilisateur a des services dans une catégorie
    const hasServicesInCategory = (categoryId: string): boolean => {
        return (userServicesByCategory[categoryId]?.length || 0) > 0;
    };

    // ✅ Vérifier si l'utilisateur a un service spécifique
    const hasService = (serviceId: string): UserService | null => {
        const service = userServices.find((s) => {
            const normalizedType = s.type.toLowerCase();
            if (serviceId === 'bayamselam') {
                return (
                    normalizedType === 'bayamselam' ||
                    normalizedType === 'supermarche' ||
                    normalizedType.includes('supermarche')
                );
            }
            if (serviceId === 'immobilier') {
                return (
                    normalizedType === 'immobilier' ||
                    normalizedType === 'immo' ||
                    normalizedType.includes('immobilier')
                );
            }
            if (serviceId === 'hotel') {
                return normalizedType === 'hotel' || normalizedType.includes('hotel');
            }
            if (serviceId === 'meuble') {
                return normalizedType === 'meuble' || normalizedType.includes('meuble');
            }
            return (
                normalizedType === serviceId ||
                normalizedType.includes(serviceId) ||
                serviceId.includes(normalizedType)
            );
        });
        return service || null;
    };

    // ✅ Gérer le tap sur une catégorie
    const handleCategoryPress = (category: (typeof serviceCategories)[number]) => {
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
        category: (typeof serviceCategories)[number],
        service: (typeof serviceCategories)[number]['services'][number]
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
            const canCreateDirectly = ['pharmacie', 'hopital', 'laboratoire', 'taxi', 'covoiturage', 'automobile'].includes(service.id);

            const extra = (service as { searchParams?: Record<string, unknown> }).searchParams || {};
            const navParams = { specializedType: service.id, ...extra };

            if (canCreateDirectly && user?.id) {
                // Modal de choix: Créer ou Rechercher
                // Pour simplifier, on redirige vers la recherche
                (navigation as any).navigate(service.searchRoute || 'SpecializedSearch', navParams);
            } else {
                // Recherche directe
                (navigation as any).navigate(service.searchRoute || 'SpecializedSearch', navParams);
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
                    <Text style={styles.title}>{t('specializedServicesSection.servicesSpecialises')}</Text>
                </View>
                <TouchableOpacity
                    onPress={() => {
                        (navigation as any).navigate('SpecializedServicesHub');
                    }}
                >
                    <Text style={styles.seeAllText}>{t('specializedServicesSection.voirTous')}</Text>
                </TouchableOpacity>
            </View>

            {/* ✅ Catégories avec services */}
            {serviceCategories.map((category) => (
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
                                        {String(userServicesByCategory[category.id]?.length || 0)}
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

