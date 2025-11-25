import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/NativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';

interface SpecializedService {
    id: number;
    service_id: number;
    type: 'pharmacie' | 'hopital' | 'laboratoire' | 'agence_voyage' | 'covoiturage' | 'taxi';
    nom?: string;
    nom_agence?: string;
    nom_chauffeur?: string;
    depart?: string;
    destination?: string;
    is_active?: boolean;
    is_on_duty_now?: boolean;
    is_available_now?: boolean;
    created_at: string;
}

const GestionServicesSpecialisesScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [services, setServices] = useState<SpecializedService[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'sante' | 'transport'>('tous');

    useEffect(() => {
        loadServices();
    }, []);

    const loadServices = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // Charger tous les services spécialisés de l'utilisateur
            const [pharmacies, hopitaux, laboratoires, agences, covoiturages, taxis] = await Promise.all([
                apiGet('/api/pharmacies').catch(() => ({ success: false, data: [] })),
                apiGet('/api/hopitaux').catch(() => ({ success: false, data: [] })),
                apiGet('/api/laboratoires').catch(() => ({ success: false, data: [] })),
                apiGet('/api/agences-voyage').catch(() => ({ success: false, data: [] })),
                apiGet('/api/covoiturages').catch(() => ({ success: false, data: [] })),
                apiGet('/api/taxis').catch(() => ({ success: false, data: [] })),
            ]);

            const allServices: SpecializedService[] = [];

            if (pharmacies.success && Array.isArray(pharmacies.data)) {
                allServices.push(...pharmacies.data.map((s: any) => ({ ...s, type: 'pharmacie' as const })));
            }
            if (hopitaux.success && Array.isArray(hopitaux.data)) {
                allServices.push(...hopitaux.data.map((s: any) => ({ ...s, type: 'hopital' as const })));
            }
            if (laboratoires.success && Array.isArray(laboratoires.data)) {
                allServices.push(...laboratoires.data.map((s: any) => ({ ...s, type: 'laboratoire' as const })));
            }
            if (agences.success && Array.isArray(agences.data)) {
                allServices.push(...agences.data.map((s: any) => ({ ...s, type: 'agence_voyage' as const })));
            }
            if (covoiturages.success && Array.isArray(covoiturages.data)) {
                allServices.push(...covoiturages.data.map((s: any) => ({ ...s, type: 'covoiturage' as const })));
            }
            if (taxis.success && Array.isArray(taxis.data)) {
                allServices.push(...taxis.data.map((s: any) => ({ ...s, type: 'taxi' as const })));
            }

            setServices(allServices);
        } catch (error) {
            console.error('Erreur chargement services spécialisés:', error);
            Alert.alert('Erreur', 'Impossible de charger les services spécialisés');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDelete = async (service: SpecializedService) => {
        Alert.alert(
            'Confirmer la suppression',
            `Êtes-vous sûr de vouloir supprimer ce service ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            let endpoint = '';
                            switch (service.type) {
                                case 'pharmacie':
                                    endpoint = `/api/pharmacies/${service.id}`;
                                    break;
                                case 'hopital':
                                    endpoint = `/api/hopitaux/${service.id}`;
                                    break;
                                case 'laboratoire':
                                    endpoint = `/api/laboratoires/${service.id}`;
                                    break;
                                case 'agence_voyage':
                                    endpoint = `/api/agences-voyage/${service.id}`;
                                    break;
                                case 'covoiturage':
                                    endpoint = `/api/covoiturages/${service.id}`;
                                    break;
                                case 'taxi':
                                    endpoint = `/api/taxis/${service.id}`;
                                    break;
                            }

                            const response = await apiDelete(endpoint);
                            if (response.success) {
                                Alert.alert('Succès', 'Service supprimé avec succès');
                                loadServices();
                            } else {
                                Alert.alert('Erreur', 'Impossible de supprimer le service');
                            }
                        } catch (error) {
                            console.error('Erreur suppression:', error);
                            Alert.alert('Erreur', 'Une erreur est survenue');
                        }
                    },
                },
            ]
        );
    };

    const handleToggleStatus = async (service: SpecializedService) => {
        try {
            let endpoint = '';
            switch (service.type) {
                case 'pharmacie':
                    endpoint = `/api/pharmacies/${service.id}`;
                    break;
                case 'hopital':
                    endpoint = `/api/hopitaux/${service.id}`;
                    break;
                case 'laboratoire':
                    endpoint = `/api/laboratoires/${service.id}`;
                    break;
                case 'agence_voyage':
                    endpoint = `/api/agences-voyage/${service.id}`;
                    break;
                case 'covoiturage':
                    endpoint = `/api/covoiturages/${service.id}`;
                    break;
                case 'taxi':
                    endpoint = `/api/taxis/${service.id}`;
                    break;
            }

            const response = await apiPatch(endpoint, {
                is_active: !service.is_active,
            });

            if (response.success) {
                Alert.alert('Succès', `Service ${service.is_active ? 'désactivé' : 'activé'} avec succès`);
                loadServices();
            } else {
                Alert.alert('Erreur', 'Impossible de modifier le statut');
            }
        } catch (error) {
            console.error('Erreur modification statut:', error);
            Alert.alert('Erreur', 'Une erreur est survenue');
        }
    };

    const handleEdit = (service: SpecializedService) => {
        let route = '';
        switch (service.type) {
            case 'pharmacie':
                route = 'PharmacieForm';
                break;
            case 'hopital':
                route = 'HopitalForm';
                break;
            case 'laboratoire':
                route = 'LaboratoireForm';
                break;
            case 'agence_voyage':
                route = 'AgenceVoyageForm';
                break;
            case 'covoiturage':
                route = 'CovoiturageForm';
                break;
            case 'taxi':
                route = 'TaxiForm';
                break;
        }

        (navigation as any).navigate(route, {
            serviceId: service.service_id,
            specializedServiceId: service.id,
            mode: 'edit',
        });
    };

    const getServiceName = (service: SpecializedService): string => {
        switch (service.type) {
            case 'pharmacie':
                return service.nom || 'Pharmacie';
            case 'hopital':
                return service.nom || 'Hôpital/Clinique';
            case 'laboratoire':
                return service.nom || 'Laboratoire';
            case 'agence_voyage':
                return service.nom_agence || 'Agence de Voyage';
            case 'covoiturage':
                return `${service.depart} → ${service.destination}`;
            case 'taxi':
                return service.nom_chauffeur || `Taxi ${service.id}`;
            default:
                return 'Service';
        }
    };

    const getServiceIcon = (type: SpecializedService['type']): string => {
        switch (type) {
            case 'pharmacie':
                return '💊';
            case 'hopital':
                return '🏥';
            case 'laboratoire':
                return '🔬';
            case 'agence_voyage':
                return '🚌';
            case 'covoiturage':
                return '🚗';
            case 'taxi':
                return '🚕';
            default:
                return '📋';
        }
    };

    const filteredServices = services.filter((service) => {
        if (filter === 'tous') return true;
        if (filter === 'sante') {
            return ['pharmacie', 'hopital', 'laboratoire'].includes(service.type);
        }
        if (filter === 'transport') {
            return ['agence_voyage', 'covoiturage', 'taxi'].includes(service.type);
        }
        return true;
    });

    const renderServiceCard = ({ item }: { item: SpecializedService }) => (
        <NativeCard style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                    <Text style={styles.serviceIcon}>{getServiceIcon(item.type)}</Text>
                </View>
                <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{getServiceName(item)}</Text>
                    <Text style={styles.serviceType}>
                        {item.type === 'pharmacie' && 'Pharmacie'}
                        {item.type === 'hopital' && 'Hôpital/Clinique'}
                        {item.type === 'laboratoire' && 'Laboratoire'}
                        {item.type === 'agence_voyage' && 'Agence de Voyage'}
                        {item.type === 'covoiturage' && 'Covoiturage'}
                        {item.type === 'taxi' && 'Taxi'}
                    </Text>
                </View>
                <View style={styles.statusBadge}>
                    <View
                        style={[
                            styles.statusDot,
                            { backgroundColor: item.is_active ? '#10B981' : '#EF4444' },
                        ]}
                    />
                    <Text style={styles.statusText}>
                        {item.is_active ? 'Actif' : 'Inactif'}
                    </Text>
                </View>
            </View>

            {(item.is_on_duty_now || item.is_available_now) && (
                <View style={styles.availabilityBadge}>
                    <Text style={styles.availabilityText}>
                        {item.is_on_duty_now ? '🟢 DE GARDE' : '🟢 DISPONIBLE'}
                    </Text>
                </View>
            )}

            <View style={styles.actionsRow}>
                <TouchableOpacity
                    style={[styles.actionButton, styles.editButton]}
                    onPress={() => handleEdit(item)}
                >
                    <SafeIcon name="edit" size={16} color={modernColors.primary} />
                    <Text style={styles.actionButtonText}>Modifier</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.toggleButton]}
                    onPress={() => handleToggleStatus(item)}
                >
                    <SafeIcon
                        name={item.is_active ? 'eye-off' : 'eye'}
                        size={16}
                        color={item.is_active ? '#EF4444' : '#10B981'}
                    />
                    <Text
                        style={[
                            styles.actionButtonText,
                            { color: item.is_active ? '#EF4444' : '#10B981' },
                        ]}
                    >
                        {item.is_active ? 'Désactiver' : 'Activer'}
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.actionButton, styles.deleteButton]}
                    onPress={() => handleDelete(item)}
                >
                    <SafeIcon name="trash-2" size={16} color="#EF4444" />
                    <Text style={[styles.actionButtonText, { color: '#EF4444' }]}>
                        Supprimer
                    </Text>
                </TouchableOpacity>
            </View>
        </NativeCard>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={modernColors.primary} />
                <Text style={styles.loadingText}>Chargement...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={styles.backButton}
                >
                    <SafeIcon name="arrow-left" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.title}>Gestion Services Spécialisés</Text>
            </View>

            {/* Filtres */}
            <View style={styles.filtersContainer}>
                <TouchableOpacity
                    style={[styles.filterChip, filter === 'tous' && styles.filterChipActive]}
                    onPress={() => setFilter('tous')}
                >
                    <Text
                        style={[
                            styles.filterChipText,
                            filter === 'tous' && styles.filterChipTextActive,
                        ]}
                    >
                        Tous
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, filter === 'sante' && styles.filterChipActive]}
                    onPress={() => setFilter('sante')}
                >
                    <Text
                        style={[
                            styles.filterChipText,
                            filter === 'sante' && styles.filterChipTextActive,
                        ]}
                    >
                        Santé
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.filterChip, filter === 'transport' && styles.filterChipActive]}
                    onPress={() => setFilter('transport')}
                >
                    <Text
                        style={[
                            styles.filterChipText,
                            filter === 'transport' && styles.filterChipTextActive,
                        ]}
                    >
                        Transport
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Lien vers Dashboard */}
            <View style={styles.dashboardLinkContainer}>
                <TouchableOpacity
                    style={styles.dashboardButton}
                    onPress={() => (navigation as any).navigate('Dashboard')}
                >
                    <SafeIcon name="bar-chart-2" size={20} color={modernColors.primary} />
                    <Text style={styles.dashboardButtonText}>Accéder au Dashboard</Text>
                </TouchableOpacity>
            </View>

            {/* Liste des services */}
            {filteredServices.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyTitle}>Aucun service spécialisé</Text>
                    <Text style={styles.emptyText}>
                        Créez votre premier service spécialisé pour commencer
                    </Text>
                    <NativeButton
                        variant="primary"
                        onPress={() => (navigation as any).navigate('MesServicesSpecialises')}
                        style={styles.createButton}
                    >
                        <Text style={styles.createButtonText}>Créer un service</Text>
                    </NativeButton>
                </View>
            ) : (
                <FlatList
                    data={filteredServices}
                    renderItem={renderServiceCard}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadServices(true)}
                            colors={[modernColors.primary]}
                        />
                    }
                />
            )}
        </View>
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
    filtersContainer: {
        flexDirection: 'row',
        padding: 16,
        gap: 8,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    filterChip: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    filterChipActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterChipText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    filterChipTextActive: {
        color: '#fff',
    },
    dashboardLinkContainer: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dashboardButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 12,
        backgroundColor: '#EEF2FF',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
    },
    dashboardButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.primary,
    },
    listContent: {
        padding: 16,
    },
    serviceCard: {
        marginBottom: 12,
        padding: 16,
    },
    serviceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    serviceIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    serviceIcon: {
        fontSize: 24,
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
    serviceType: {
        fontSize: 14,
        color: '#6B7280',
    },
    statusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    statusDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    statusText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#6B7280',
    },
    availabilityBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginBottom: 12,
    },
    availabilityText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#fff',
    },
    actionsRow: {
        flexDirection: 'row',
        gap: 8,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    actionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    editButton: {
        backgroundColor: '#EEF2FF',
    },
    toggleButton: {
        backgroundColor: '#F3F4F6',
    },
    deleteButton: {
        backgroundColor: '#FEE2E2',
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#374151',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: '#6B7280',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyIcon: {
        fontSize: 64,
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 24,
    },
    createButton: {
        paddingHorizontal: 24,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
});

export default GestionServicesSpecialisesScreen;

