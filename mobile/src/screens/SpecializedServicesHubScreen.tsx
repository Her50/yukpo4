// ✅ NOUVEAU: Hub unifié pour services spécialisés
// Point d'entrée principal avec accès rapide, statistiques et suggestions

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Dimensions,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../components/SafeNativeDesign';
import SafeIcon from '../components/SafeIcon';
import ServicesStatistics from '../components/ServicesStatistics';
import { useAuth } from '../contexts/AuthContext';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 colonnes avec padding

interface ServiceType {
    id: string;
    name: string;
    icon: string;
    color: string;
    count: number;
    route: string;
    category: 'sante' | 'transport' | 'education' | 'emploi';
}

interface ServicesStatistics {
    total: number;
    active: number;
    inactive: number;
    by_type: Record<string, number>;
}

interface UnifiedService {
    id: number;
    service_id: number;
    type: string;
    nom: string;
    is_active: boolean;
    is_available_now?: boolean;
    created_at: string;
    metadata?: any;
}

const SpecializedServicesHubScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [statistics, setStatistics] = useState<ServicesStatistics | null>(null);
    const [services, setServices] = useState<UnifiedService[]>([]);
    const [searchQuery, setSearchQuery] = useState('');

    // Rafraîchir à chaque focus
    useFocusEffect(
        useCallback(() => {
            loadData();
        }, [])
    );

    const loadData = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            const response = await apiGet('/api/specialized-services/user?page=1&limit=20');

            if (response.success && response.data) {
                const data = response.data as any;
                setServices(data.services || []);
                setStatistics(data.statistics || {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    by_type: {},
                });
            }
        } catch (error) {
            console.error('[SpecializedServicesHub] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const serviceTypes: ServiceType[] = [
        {
            id: 'pharmacie',
            name: 'Pharmacie',
            icon: 'Pill',
            color: '#10B981',
            count: statistics?.by_type?.pharmacie || 0,
            route: 'PharmacieForm',
            category: 'sante',
        },
        {
            id: 'hopital',
            name: 'Hôpital',
            icon: 'Hospital',
            color: '#EF4444',
            count: statistics?.by_type?.hopital || 0,
            route: 'HopitalForm',
            category: 'sante',
        },
        {
            id: 'laboratoire',
            name: 'Laboratoire',
            icon: 'Microscope',
            color: '#3B82F6',
            count: statistics?.by_type?.laboratoire || 0,
            route: 'LaboratoireForm',
            category: 'sante',
        },
        {
            id: 'banque_sang',
            name: 'Banque de Sang',
            icon: 'Droplet',
            color: '#DC2626',
            count: statistics?.by_type?.banque_sang || 0,
            route: 'BanqueSangForm',
            category: 'sante',
        },
        {
            id: 'agence_voyage',
            name: 'Agence de Voyage',
            icon: 'Bus',
            color: '#F59E0B',
            count: statistics?.by_type?.agence_voyage || 0,
            route: 'AgenceVoyageForm',
            category: 'transport',
        },
        {
            id: 'covoiturage',
            name: 'Covoiturage',
            icon: 'Users',
            color: '#8B5CF6',
            count: statistics?.by_type?.covoiturage || 0,
            route: 'CovoiturageForm',
            category: 'transport',
        },
        {
            id: 'taxi',
            name: 'Taxi',
            icon: 'Car',
            color: '#F97316',
            count: statistics?.by_type?.taxi || 0,
            route: 'TaxiForm',
            category: 'transport',
        },
        {
            id: 'bourse_livre',
            name: 'Bourse du Livre',
            icon: 'BookOpen',
            color: '#8B5CF6',
            count: 0, // À implémenter : statistiques pour livres scolaires
            route: 'LivreScolaireForm',
            category: 'education',
        },
        {
            id: 'orientation_scolaire',
            name: 'Orientation Scolaire',
            icon: 'GraduationCap',
            color: '#10B981',
            count: 0, // À implémenter : statistiques pour établissements
            route: 'OrientationScolaireHub',
            category: 'education',
        },
        {
            id: 'offres_emploi',
            name: 'Offres d\'Emploi',
            icon: 'Briefcase',
            color: '#6366F1',
            count: 0, // À implémenter : statistiques pour offres d'emploi
            route: 'OffresEmploiHub',
            category: 'emploi',
        },
        {
            id: 'menu_planning',
            name: 'Planification Menus',
            icon: 'UtensilsCrossed',
            color: '#F59E0B',
            count: 0, // menus actifs
            route: 'MenuPlanningHub',
            category: 'vie_quotidienne',
        },
    ];

    const santeTypes = serviceTypes.filter((t) => t.category === 'sante');
    const transportTypes = serviceTypes.filter((t) => t.category === 'transport');
    const educationTypes = serviceTypes.filter((t) => t.category === 'education');
    const emploiTypes = serviceTypes.filter((t) => t.category === 'emploi');
    const vieQuotidienneTypes = serviceTypes.filter((t) => t.category === 'vie_quotidienne');

    if (loading) {
        return (
            <View style={styles.centerContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={() => loadData(true)} />
            }
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={styles.header}>
                <Text style={styles.title}>Services Spécialisés</Text>
            </View>

            {/* ✅ NOUVEAU: Composant statistiques */}
            {statistics && (
                <ServicesStatistics
                    total={statistics.total}
                    active={statistics.active}
                    inactive={statistics.inactive}
                    by_type={statistics.by_type}
                />
            )}

            {/* Accès rapide par type - Santé */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                        <SafeIcon name="heart-pulse" size={20} color="#EF4444" type="lucide" />
                        <Text style={styles.sectionTitle}>Santé</Text>
                    </View>
                </View>
                <View style={styles.quickAccessGrid}>
                    {santeTypes.map((type) => {
                        return (
                            <View key={type.id} style={[styles.quickAccessCard, { borderLeftColor: type.color }]}>
                                <TouchableOpacity
                                    style={styles.quickAccessCardContent}
                                    onPress={() => {
                                        (navigation as any).navigate(type.route, { mode: 'create' });
                                    }}
                                >
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: type.color + '15' },
                                        ]}
                                    >
                                        <SafeIcon
                                            name={type.icon}
                                            size={24}
                                            color={type.color}
                                            type="lucide"
                                        />
                                    </View>
                                    <Text style={styles.quickAccessName}>{type.name}</Text>
                                    {type.count > 0 && (
                                        <Text style={styles.quickAccessCount}>
                                            {String(type.count)} service{type.count > 1 ? 's' : ''}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Accès rapide par type - Transport */}
            <View style={styles.section}>
                <View style={styles.sectionHeader}>
                    <View style={styles.sectionHeaderLeft}>
                        <SafeIcon name="car" size={20} color="#3B82F6" type="lucide" />
                        <Text style={styles.sectionTitle}>Transport</Text>
                    </View>
                    {/* ✅ Phase 4: Liens vers Mes trajets et Mes taxis */}
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        <TouchableOpacity
                            onPress={() => {
                                (navigation as any).navigate('MyTrips');
                            }}
                        >
                            <Text style={styles.seeAllText}>Mes trajets</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                (navigation as any).navigate('MesTaxis');
                            }}
                        >
                            <Text style={styles.seeAllText}>Mes taxis</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <View style={styles.quickAccessGrid}>
                    {transportTypes.map((type) => {
                        return (
                            <View key={type.id} style={[styles.quickAccessCard, { borderLeftColor: type.color }]}>
                                <TouchableOpacity
                                    style={styles.quickAccessCardContent}
                                    onPress={() => {
                                        (navigation as any).navigate(type.route, { mode: 'create' });
                                    }}
                                >
                                    <View
                                        style={[
                                            styles.iconContainer,
                                            { backgroundColor: type.color + '15' },
                                        ]}
                                    >
                                        <SafeIcon
                                            name={type.icon}
                                            size={24}
                                            color={type.color}
                                            type="lucide"
                                        />
                                    </View>
                                    <Text style={styles.quickAccessName}>{type.name}</Text>
                                    {type.count > 0 && (
                                        <Text style={styles.quickAccessCount}>
                                            {String(type.count)} service{type.count > 1 ? 's' : ''}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        );
                    })}
                </View>
            </View>

            {/* Accès rapide par type - Éducation */}
            {educationTypes.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                            <SafeIcon name="BookOpen" size={20} color="#8B5CF6" type="lucide" />
                            <Text style={styles.sectionTitle}>Éducation</Text>
                        </View>
                    </View>
                    <View style={styles.quickAccessGrid}>
                        {educationTypes.map((type) => {
                            return (
                                <View key={type.id} style={[styles.quickAccessCard, { borderLeftColor: type.color }]}>
                                    <TouchableOpacity
                                        style={styles.quickAccessCardContent}
                                        onPress={() => {
                                            // Navigation vers la configuration
                                            (navigation as any).navigate(type.route, { mode: 'create' });
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { backgroundColor: type.color + '15' },
                                            ]}
                                        >
                                            <SafeIcon
                                                name={type.icon}
                                                size={24}
                                                color={type.color}
                                                type="lucide"
                                            />
                                        </View>
                                        <Text style={styles.quickAccessName}>{type.name}</Text>
                                    </TouchableOpacity>
                                    <View style={styles.actionButtonsRow}>
                                        <TouchableOpacity
                                            style={styles.searchButton}
                                            onPress={() => {
                                                (navigation as any).navigate('MesLivres');
                                            }}
                                        >
                                            <SafeIcon name="book" size={16} color={type.color} />
                                            <Text style={[styles.searchButtonText, { color: type.color }]}>
                                                Mes Livres
                                            </Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={[styles.searchButton, { marginLeft: 8 }]}
                                            onPress={() => {
                                                (navigation as any).navigate('MesTrocs');
                                            }}
                                        >
                                            <SafeIcon name="repeat" size={16} color={type.color} />
                                            <Text style={[styles.searchButtonText, { color: type.color }]}>
                                                Mes Trocs
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Accès rapide par type - Emploi */}
            {emploiTypes.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                            <SafeIcon name="Briefcase" size={20} color="#6366F1" type="lucide" />
                            <Text style={styles.sectionTitle}>Emploi</Text>
                        </View>
                    </View>
                    <View style={styles.quickAccessGrid}>
                        {emploiTypes.map((type) => {
                            return (
                                <View key={type.id} style={[styles.quickAccessCard, { borderLeftColor: type.color }]}>
                                    <TouchableOpacity
                                        style={styles.quickAccessCardContent}
                                        onPress={() => {
                                            (navigation as any).navigate('OffresEmploiHub');
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { backgroundColor: type.color + '15' },
                                            ]}
                                        >
                                            <SafeIcon
                                                name={type.icon}
                                                size={24}
                                                color={type.color}
                                                type="lucide"
                                            />
                                        </View>
                                        <Text style={styles.quickAccessName}>{type.name}</Text>
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Accès rapide par type - Vie Quotidienne */}
            {vieQuotidienneTypes.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <View style={styles.sectionHeaderLeft}>
                            <SafeIcon name="Home" size={20} color="#F59E0B" type="lucide" />
                            <Text style={styles.sectionTitle}>Vie Quotidienne</Text>
                        </View>
                    </View>
                    <View style={styles.quickAccessGrid}>
                        {vieQuotidienneTypes.map((type) => {
                            return (
                                <View key={type.id} style={[styles.quickAccessCard, { borderLeftColor: type.color }]}>
                                    <TouchableOpacity
                                        style={styles.quickAccessCardContent}
                                        onPress={() => {
                                            (navigation as any).navigate(type.route);
                                        }}
                                    >
                                        <View
                                            style={[
                                                styles.iconContainer,
                                                { backgroundColor: type.color + '15' },
                                            ]}
                                        >
                                            <SafeIcon
                                                name={type.icon}
                                                size={24}
                                                color={type.color}
                                                type="lucide"
                                            />
                                        </View>
                                        <Text style={styles.quickAccessName}>{type.name}</Text>
                                        {type.count > 0 && (
                                            <Text style={styles.quickAccessCount}>
                                                {String(type.count)} menu{type.count > 1 ? 's' : ''}
                                            </Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            );
                        })}
                    </View>
                </View>
            )}

            {/* Liste des services récents */}
            {services.length > 0 && (
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>Mes Services</Text>
                        <TouchableOpacity
                            onPress={() => {
                                (navigation as any).navigate('GestionServicesSpecialises');
                            }}
                        >
                            <Text style={styles.seeAllText}>Voir tous</Text>
                        </TouchableOpacity>
                    </View>

                    {services.slice(0, 5).map((service) => (
                        <NativeCard key={service.id} style={styles.serviceCard}>
                            <View style={styles.serviceCardContent}>
                                <View style={styles.serviceInfo}>
                                    <Text style={styles.serviceName}>{service.nom}</Text>
                                    <View style={styles.serviceMeta}>
                                        <Text style={styles.serviceType}>
                                            {service.type.charAt(0).toUpperCase() + service.type.slice(1)}
                                        </Text>
                                        <View
                                            style={[
                                                styles.statusBadge,
                                                {
                                                    backgroundColor: service.is_active
                                                        ? modernColors.success + '20'
                                                        : modernColors.warning + '20',
                                                },
                                            ]}
                                        >
                                            <Text
                                                style={[
                                                    styles.statusText,
                                                    {
                                                        color: service.is_active
                                                            ? modernColors.success
                                                            : modernColors.warning,
                                                    },
                                                ]}
                                            >
                                                {service.is_active ? 'Actif' : 'Inactif'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        const routeMap: Record<string, string> = {
                                            pharmacie: 'PharmacieForm',
                                            hopital: 'HopitalForm',
                                            laboratoire: 'LaboratoireForm',
                                            agence_voyage: 'AgenceVoyageForm',
                                            covoiturage: 'CovoiturageForm',
                                            taxi: 'TaxiForm',
                                        };
                                        (navigation as any).navigate(
                                            routeMap[service.type] || 'GestionServicesSpecialises',
                                            {
                                                serviceId: service.service_id,
                                                mode: 'edit',
                                            }
                                        );
                                    }}
                                >
                                    <SafeIcon name="edit" size={20} color={modernColors.primary} />
                                </TouchableOpacity>
                            </View>
                        </NativeCard>
                    ))}
                </View>
            )}

            {/* Suggestions intelligentes */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>💡 Suggestions</Text>
                <NativeCard style={styles.suggestionCard}>
                    <Text style={styles.suggestionText}>
                        📍 Pharmacie de garde près de vous
                    </Text>
                </NativeCard>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    scrollContent: {
        paddingBottom: 20,
    },
    header: {
        padding: 20,
        paddingTop: 40,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#111827',
        marginBottom: 16,
    },
    statsContainer: {
        flexDirection: 'row',
        gap: 24,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        fontSize: 24,
        fontWeight: '700',
        color: modernColors.primary,
    },
    statLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginTop: 4,
    },
    searchContainer: {
        padding: 16,
        backgroundColor: '#fff',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchPlaceholder: {
        flex: 1,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    section: {
        padding: 16,
        marginTop: 8,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    seeAllText: {
        fontSize: 14,
        color: modernColors.primary,
        fontWeight: '600',
    },
    quickAccessGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
    },
    quickAccessCard: {
        width: CARD_WIDTH,
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 16,
        borderLeftWidth: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    quickAccessName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    quickAccessCount: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    quickAccessCardContent: {
        flex: 1,
    },
    actionButtonsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginTop: 8,
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 8,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    searchButtonText: {
        fontSize: 12,
        fontWeight: '600',
    },
    serviceCard: {
        marginBottom: 12,
    },
    serviceCardContent: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    serviceInfo: {
        flex: 1,
    },
    serviceName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    serviceMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    serviceType: {
        fontSize: 12,
        color: modernColors.textSecondary,
        textTransform: 'capitalize',
    },
    statusBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    statusText: {
        fontSize: 11,
        fontWeight: '600',
    },
    suggestionCard: {
        padding: 16,
    },
    suggestionText: {
        fontSize: 16,
        color: '#111827',
        marginBottom: 12,
    },
});

export default SpecializedServicesHubScreen;
