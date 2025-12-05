// ✅ NOUVEAU Phase 5.1: Page de gestion des services spécialisés (Web)
// Utilise l'endpoint unifié au lieu de 6 appels séparés

import {
    BarChart3,
    CheckSquare,
    Compass,
    Edit,
    Eye,
    EyeOff,
    Filter,
    Grid3x3,
    List,
    Plus,
    Trash2,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ServiceFilters, { ServiceFilters as ServiceFiltersType } from '../../components/specialized/ServiceFilters';
import ServiceSortSearchBar, { SortConfig } from '../../components/specialized/ServiceSortSearchBar';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/buttons/Button';
import { Card, CardContent } from '../../components/ui/card';
import { Skeleton } from '../../components/ui/skeleton';
import { useAuth } from '../../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch } from '../../services/apiService';

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

interface ServicesStatistics {
    total: number;
    active: number;
    inactive: number;
    by_type: Record<string, number>;
}

const GestionServicesSpecialisesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const { user } = useAuth();
    const [services, setServices] = useState<UnifiedService[]>([]);
    const [statistics, setStatistics] = useState<ServicesStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'sante' | 'transport'>('tous');
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFiltersModal, setShowFiltersModal] = useState(false); // ✅ Phase 5.2: Modal filtres
    const [advancedFilters, setAdvancedFilters] = useState<ServiceFiltersType>({ // ✅ Phase 5.2: Filtres avancés
        type: searchParams.get('type') || 'all',
        status: (searchParams.get('status') as any) || 'all',
        dateRange: (searchParams.get('dateRange') as any) || 'all',
    });
    const [sortConfig, setSortConfig] = useState<SortConfig>({ // ✅ Phase 5.3: Configuration tri
        field: 'updated_at',
        direction: 'desc',
    });
    const [selectionMode, setSelectionMode] = useState(false); // ✅ Phase 5.5: Mode sélection multiple
    const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set()); // ✅ Phase 5.5: Services sélectionnés (service_id)

    useEffect(() => {
        // ✅ Phase 5.2: Charger filtres depuis URL
        const type = searchParams.get('type') || 'all';
        const status = searchParams.get('status') || 'all';
        const dateRange = searchParams.get('dateRange') || 'all';
        setAdvancedFilters({ type, status: status as any, dateRange: dateRange as any });
        loadServices();
    }, []);

    const loadServices = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // ✅ Utiliser endpoint unifié
            // ✅ Phase 5.2: Ajouter filtres dans query params
            // ✅ Phase 5.3: Ajouter tri dans query params
            let url = '/api/specialized-services/user?page=1&limit=100';
            const params: string[] = [];

            if (advancedFilters.type && advancedFilters.type !== 'all') {
                params.push(`type_filter=${advancedFilters.type}`);
            }
            if (advancedFilters.status && advancedFilters.status !== 'all') {
                params.push(`status=${advancedFilters.status}`);
            }
            // ✅ Phase 5.3: Ajouter paramètres de tri
            if (sortConfig.field) {
                params.push(`sort_by=${sortConfig.field}`);
            }
            if (sortConfig.direction) {
                params.push(`sort_direction=${sortConfig.direction}`);
            }

            if (params.length > 0) {
                url += '&' + params.join('&');
            }
            const response = await apiGet(url);
            const data = await response.json();

            if (data.success && data.data) {
                setServices(data.data.services || []);
                setStatistics(data.data.statistics || {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    by_type: {},
                });
            }
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur chargement:', error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDelete = async (service: UnifiedService) => {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ce service ?`)) {
            return;
        }

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
            const data = await response.json();

            if (data.success || response.ok) {
                alert('Service supprimé avec succès');
                loadServices();
            } else {
                alert('Impossible de supprimer le service');
            }
        } catch (error) {
            console.error('Erreur suppression:', error);
            alert('Une erreur est survenue');
        }
    };

    const handleToggleStatus = async (service: UnifiedService) => {
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
            const data = await response.json();

            if (data.success || response.ok) {
                alert(`Service ${service.is_active ? 'désactivé' : 'activé'} avec succès`);
                loadServices();
            } else {
                alert('Impossible de modifier le statut');
            }
        } catch (error) {
            console.error('Erreur modification statut:', error);
            alert('Une erreur est survenue');
        }
    };

    const handleEdit = (service: UnifiedService) => {
        if (selectionMode) {
            toggleServiceSelection(service.service_id);
            return;
        }

        let route = '';
        switch (service.type) {
            case 'pharmacie':
                route = '/specialized/pharmacie/create';
                break;
            case 'hopital':
                route = '/specialized/hopital/create';
                break;
            case 'laboratoire':
                route = '/specialized/laboratoire/create';
                break;
            case 'agence_voyage':
                route = '/specialized/agence-voyage/create';
                break;
            case 'covoiturage':
                route = '/specialized/covoiturage/create';
                break;
            case 'taxi':
                route = '/specialized/taxi/create';
                break;
        }

        navigate(route, {
            state: {
                serviceId: service.service_id,
                specializedServiceId: service.id,
                mode: 'edit',
            },
        });
    };

    // ✅ Phase 5.5: Toggle sélection d'un service
    const toggleServiceSelection = (serviceId: number) => {
        const newSelection = new Set(selectedServices);
        if (newSelection.has(serviceId)) {
            newSelection.delete(serviceId);
        } else {
            newSelection.add(serviceId);
        }
        setSelectedServices(newSelection);
    };

    // ✅ Phase 5.5: Actions batch
    const handleBatchAction = async (action: 'activate' | 'deactivate' | 'delete') => {
        if (selectedServices.size === 0) {
            window.alert('Veuillez sélectionner au moins un service');
            return;
        }

        // ✅ Phase 5.5: Confirmation pour actions destructives
        if (action === 'delete') {
            if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${selectedServices.size} service(s) ? Cette action est irréversible.`)) {
                return;
            }
        }

        try {
            const response = await apiPatch('/api/specialized-services/batch', {
                service_ids: Array.from(selectedServices),
                action,
            });
            const data = await response.json();

            if (data.success) {
                window.alert(
                    `${data.data.processed} service(s) ${action === 'activate' ? 'activé(s)' : action === 'deactivate' ? 'désactivé(s)' : 'supprimé(s)'}`
                );
                setSelectedServices(new Set());
                setSelectionMode(false);
                loadServices();
            } else {
                window.alert('Une erreur est survenue');
            }
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur action batch:', error);
            window.alert('Impossible d\'effectuer l\'action');
        }
    };

    const getServiceName = (service: UnifiedService): string => {
        switch (service.type) {
            case 'pharmacie':
                return service.nom || 'Pharmacie';
            case 'hopital':
                return service.nom || 'Hôpital/Clinique';
            case 'laboratoire':
                return service.nom || 'Laboratoire';
            case 'agence_voyage':
                return service.metadata?.nom_agence || 'Agence de Voyage';
            case 'covoiturage':
                return `${service.metadata?.depart || ''} → ${service.metadata?.destination || ''}`;
            case 'taxi':
                return service.metadata?.nom_chauffeur || `Taxi ${service.id}`;
            default:
                return 'Service';
        }
    };

    const getServiceIcon = (type: string): string => {
        const icons: Record<string, string> = {
            pharmacie: '💊',
            hopital: '🏥',
            laboratoire: '🔬',
            banque_sang: '🩸',
            agence_voyage: '🚌',
            covoiturage: '🚗',
            taxi: '🚕',
        };
        return icons[type] || '📋';
    };

    const getTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            pharmacie: 'Pharmacie',
            hopital: 'Hôpital',
            laboratoire: 'Laboratoire',
            banque_sang: 'Banque de Sang',
            agence_voyage: 'Agence',
            covoiturage: 'Covoiturage',
            taxi: 'Taxi',
        };
        return labels[type] || type;
    };

    const getTypeColor = (type: string): string => {
        const colors: Record<string, string> = {
            pharmacie: '#10B981',
            hopital: '#EF4444',
            laboratoire: '#3B82F6',
            banque_sang: '#DC2626',
            agence_voyage: '#F59E0B',
            covoiturage: '#8B5CF6',
            taxi: '#F97316',
        };
        return colors[type] || '#6366F1';
    };

    // Filtrer selon recherche, catégorie et filtres avancés
    const filteredServices = services.filter((service) => {
        // Filtre par catégorie (ancien filtre)
        let matchesCategory = true;
        if (filter === 'sante') {
            matchesCategory = ['pharmacie', 'hopital', 'laboratoire', 'banque_sang'].includes(service.type);
        } else if (filter === 'transport') {
            matchesCategory = ['agence_voyage', 'covoiturage', 'taxi'].includes(service.type);
        }

        // ✅ Phase 5.2: Filtre par type (filtres avancés)
        let matchesType = true;
        if (advancedFilters.type && advancedFilters.type !== 'all') {
            matchesType = service.type === advancedFilters.type;
        }

        // ✅ Phase 5.2: Filtre par statut (filtres avancés)
        let matchesStatus = true;
        if (advancedFilters.status && advancedFilters.status !== 'all') {
            if (advancedFilters.status === 'active') {
                matchesStatus = service.is_active === true;
            } else if (advancedFilters.status === 'inactive') {
                matchesStatus = service.is_active === false;
            }
        }

        // ✅ Phase 5.2: Filtre par date de création
        let matchesDate = true;
        if (advancedFilters.dateRange && advancedFilters.dateRange !== 'all') {
            const now = new Date();
            const serviceDate = new Date(service.created_at);
            const diffTime = now.getTime() - serviceDate.getTime();
            const diffDays = diffTime / (1000 * 60 * 60 * 24);

            switch (advancedFilters.dateRange) {
                case 'today':
                    matchesDate = diffDays < 1;
                    break;
                case 'week':
                    matchesDate = diffDays < 7;
                    break;
                case 'month':
                    matchesDate = diffDays < 30;
                    break;
                case 'year':
                    matchesDate = diffDays < 365;
                    break;
            }
        }

        // Filtre par recherche
        const matchesSearch =
            searchQuery === '' ||
            getServiceName(service).toLowerCase().includes(searchQuery.toLowerCase()) ||
            service.type.toLowerCase().includes(searchQuery.toLowerCase());

        return matchesCategory && matchesType && matchesStatus && matchesDate && matchesSearch;
    });

    // ✅ Phase 5.3: Trier les services selon la configuration
    const sortedServices = [...filteredServices].sort((a, b) => {
        let comparison = 0;

        switch (sortConfig.field) {
            case 'name':
                const nameA = getServiceName(a).toLowerCase();
                const nameB = getServiceName(b).toLowerCase();
                comparison = nameA.localeCompare(nameB);
                break;
            case 'created_at':
                comparison =
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                break;
            case 'updated_at':
                // Utiliser created_at comme proxy pour updated_at si non disponible
                comparison =
                    new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                break;
            case 'status':
                // Actifs en premier si asc, inactifs si desc
                if (a.is_active === b.is_active) {
                    comparison = 0;
                } else {
                    comparison = a.is_active ? 1 : -1;
                }
                break;
            default:
                comparison = 0;
        }

        return sortConfig.direction === 'asc' ? comparison : -comparison;
    });

    // ✅ Phase 5.2: Persister filtres dans URL
    const updateFilters = (newFilters: ServiceFiltersType) => {
        setAdvancedFilters(newFilters);
        const params = new URLSearchParams();
        if (newFilters.type && newFilters.type !== 'all') {
            params.set('type', newFilters.type);
        }
        if (newFilters.status && newFilters.status !== 'all') {
            params.set('status', newFilters.status);
        }
        if (newFilters.dateRange && newFilters.dateRange !== 'all') {
            params.set('dateRange', newFilters.dateRange);
        }
        setSearchParams(params);
        loadServices();
    };

    // Skeleton loader
    const ServiceSkeleton = () => (
        <Card className="mb-4">
            <CardContent className="p-4">
                <div className="flex gap-4">
                    <Skeleton className="w-16 h-16 rounded-lg" />
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-3 w-full" />
                        <div className="flex gap-2">
                            <Skeleton className="h-6 w-16 rounded-full" />
                            <Skeleton className="h-6 w-20 rounded-full" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <div className="mb-6">
                        <Skeleton className="h-8 w-64 mb-4" />
                        <Skeleton className="h-10 w-full mb-4" />
                        <div className="flex gap-2">
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-8 w-20" />
                            <Skeleton className="h-8 w-24" />
                        </div>
                    </div>
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5, 6].map((i) => (
                            <ServiceSkeleton key={i} />
                        ))}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <h1 className="text-3xl font-bold text-gray-900">
                            Gestion Services Spécialisés
                        </h1>
                        <div className="flex items-center gap-2">
                            {!selectionMode ? (
                                <>
                                    <Button
                                        onClick={() => navigate('/specialized/dashboard')}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        Dashboard
                                    </Button>
                                    <Button
                                        onClick={() => navigate('/specialized/hub')}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <Compass className="w-4 h-4" />
                                        Explorer
                                    </Button>
                                    <Button
                                        onClick={() => setSelectionMode(true)}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <CheckSquare className="w-4 h-4" />
                                        Sélectionner
                                    </Button>
                                </>
                            ) : (
                                <>
                                    <Button
                                        onClick={() => {
                                            setSelectionMode(false);
                                            setSelectedServices(new Set());
                                        }}
                                        variant="outline"
                                    >
                                        Annuler
                                    </Button>
                                    <span className="text-sm font-medium text-indigo-600">
                                        {selectedServices.size} sélectionné{selectedServices.size > 1 ? 's' : ''}
                                    </span>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Statistiques rapides */}
                    {statistics && (
                        <div className="grid grid-cols-4 gap-4 mb-6">
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-sm text-gray-600 mb-1">Total</div>
                                    <div className="text-2xl font-bold text-gray-900">
                                        {statistics.total}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-sm text-gray-600 mb-1">Actifs</div>
                                    <div className="text-2xl font-bold text-green-600">
                                        {statistics.active}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <div className="text-sm text-gray-600 mb-1">Inactifs</div>
                                    <div className="text-2xl font-bold text-orange-600">
                                        {statistics.inactive}
                                    </div>
                                </CardContent>
                            </Card>
                            <Card>
                                <CardContent className="p-4">
                                    <Button
                                        onClick={() => navigate('/specialized/hub')}
                                        variant="ghost"
                                        className="w-full flex items-center justify-center gap-2"
                                    >
                                        <BarChart3 className="w-4 h-4" />
                                        Dashboard
                                    </Button>
                                </CardContent>
                            </Card>
                        </div>
                    )}

                    {/* ✅ Phase 5.3: Barre de recherche avec tri */}
                    <ServiceSortSearchBar
                        searchQuery={searchQuery}
                        onSearchChange={setSearchQuery}
                        sortConfig={sortConfig}
                        onSortChange={setSortConfig}
                        placeholder="Rechercher dans la liste..."
                    />

                    {/* Filtres et Toggle */}
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex gap-2">
                            <button
                                onClick={() => setFilter('tous')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'tous'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => setFilter('sante')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'sante'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                Santé
                            </button>
                            <button
                                onClick={() => setFilter('transport')}
                                className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${filter === 'transport'
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                Transport
                            </button>
                            {/* ✅ Phase 5.2: Bouton filtres avancés */}
                            <button
                                onClick={() => setShowFiltersModal(true)}
                                className={`relative px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${(advancedFilters.type !== 'all' || advancedFilters.status !== 'all' || advancedFilters.dateRange !== 'all')
                                    ? 'bg-indigo-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                            >
                                <Filter className="w-4 h-4" />
                                Filtres
                                {(advancedFilters.type !== 'all' || advancedFilters.status !== 'all' || advancedFilters.dateRange !== 'all') && (
                                    <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-xs text-white flex items-center justify-center">
                                        !
                                    </span>
                                )}
                            </button>
                        </div>

                        {/* Toggle vue */}
                        <div className="flex gap-2 bg-gray-200 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('card')}
                                className={`p-2 rounded transition-colors ${viewMode === 'card'
                                    ? 'bg-white shadow-sm'
                                    : 'hover:bg-gray-100'
                                    }`}
                            >
                                <Grid3x3 className={`w-5 h-5 ${viewMode === 'card' ? 'text-indigo-600' : 'text-gray-600'}`} />
                            </button>
                            <button
                                onClick={() => setViewMode('list')}
                                className={`p-2 rounded transition-colors ${viewMode === 'list'
                                    ? 'bg-white shadow-sm'
                                    : 'hover:bg-gray-100'
                                    }`}
                            >
                                <List className={`w-5 h-5 ${viewMode === 'list' ? 'text-indigo-600' : 'text-gray-600'}`} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Liste des services */}
                {sortedServices.length === 0 ? (
                    <Card className="p-12">
                        <CardContent className="text-center">
                            <div className="text-6xl mb-4">📋</div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-2">
                                Aucun service spécialisé
                            </h3>
                            <p className="text-gray-600 mb-6">
                                {searchQuery || filter !== 'tous'
                                    ? 'Aucun service ne correspond à vos critères de recherche'
                                    : 'Créez votre premier service spécialisé pour commencer à proposer vos services'}
                            </p>
                            <div className="flex gap-4 justify-center">
                                <Button
                                    onClick={() => navigate('/specialized/hub')}
                                    className="flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Créer un service
                                </Button>
                                {searchQuery || filter !== 'tous' ? (
                                    <Button
                                        onClick={() => {
                                            setSearchQuery('');
                                            setFilter('tous');
                                        }}
                                        variant="outline"
                                    >
                                        Réinitialiser les filtres
                                    </Button>
                                ) : (
                                    <Button
                                        onClick={() => navigate('/specialized/hub')}
                                        variant="outline"
                                        className="flex items-center gap-2"
                                    >
                                        <Compass className="w-4 h-4" />
                                        Explorer les services
                                    </Button>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ) : (
                    <div
                        className={
                            viewMode === 'card'
                                ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                                : 'space-y-4'
                        }
                    >
                        {sortedServices.map((service) => {
                            const typeColor = getTypeColor(service.type);
                            const serviceName = getServiceName(service);
                            const isSelected = selectedServices.has(service.service_id);

                            if (viewMode === 'list') {
                                return (
                                    <Card
                                        key={`${service.type}-${service.id}`}
                                        className={`hover:shadow-md transition-shadow ${isSelected && selectionMode ? 'ring-2 ring-indigo-600' : ''}`}
                                    >
                                        <CardContent className="p-4">
                                            <div className="flex items-center gap-4">
                                                {selectionMode && (
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={() => toggleServiceSelection(service.service_id)}
                                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                                    />
                                                )}
                                                <div
                                                    className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                                                    style={{ backgroundColor: typeColor + '15' }}
                                                >
                                                    {getServiceIcon(service.type)}
                                                </div>
                                                <div className="flex-1">
                                                    <h3 className="font-bold text-gray-900 mb-1">
                                                        {serviceName}
                                                    </h3>
                                                    <div className="flex items-center gap-2">
                                                        <Badge
                                                            style={{
                                                                backgroundColor: typeColor + '20',
                                                                color: typeColor,
                                                            }}
                                                        >
                                                            {getTypeLabel(service.type)}
                                                        </Badge>
                                                        <Badge
                                                            variant={service.is_active ? 'default' : 'secondary'}
                                                        >
                                                            {service.is_active ? 'Actif' : 'Inactif'}
                                                        </Badge>
                                                        {service.is_available_now && (
                                                            <Badge className="bg-green-100 text-green-800">
                                                                Disponible
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex gap-2">
                                                    <Button
                                                        onClick={() => handleEdit(service)}
                                                        variant="ghost"
                                                        size="sm"
                                                    >
                                                        <Edit className="w-4 h-4" />
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleToggleStatus(service)}
                                                        variant="ghost"
                                                        size="sm"
                                                    >
                                                        {service.is_active ? (
                                                            <EyeOff className="w-4 h-4 text-orange-600" />
                                                        ) : (
                                                            <Eye className="w-4 h-4 text-green-600" />
                                                        )}
                                                    </Button>
                                                    <Button
                                                        onClick={() => handleDelete(service)}
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            }

                            return (
                                <Card
                                    key={`${service.type}-${service.id}`}
                                    className="hover:shadow-lg transition-shadow"
                                    style={{ borderLeft: `4px solid ${typeColor}` }}
                                >
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div
                                                className="w-12 h-12 rounded-lg flex items-center justify-center text-2xl"
                                                style={{ backgroundColor: typeColor + '15' }}
                                            >
                                                {getServiceIcon(service.type)}
                                            </div>
                                            <Button
                                                onClick={() => handleEdit(service)}
                                                variant="ghost"
                                                size="sm"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                        </div>
                                        <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">
                                            {serviceName}
                                        </h3>
                                        <div className="flex items-center gap-2 mb-3">
                                            <Badge
                                                style={{
                                                    backgroundColor: typeColor + '20',
                                                    color: typeColor,
                                                }}
                                            >
                                                {getTypeLabel(service.type)}
                                            </Badge>
                                            <Badge
                                                variant={service.is_active ? 'default' : 'secondary'}
                                            >
                                                {service.is_active ? 'Actif' : 'Inactif'}
                                            </Badge>
                                        </div>
                                        {service.is_available_now && (
                                            <div className="mb-3 text-sm text-green-600 font-medium">
                                                🟢 Disponible maintenant
                                            </div>
                                        )}
                                        <div className="flex gap-2">
                                            <Button
                                                onClick={() => handleEdit(service)}
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                            >
                                                <Edit className="w-4 h-4 mr-1" />
                                                Modifier
                                            </Button>
                                            <Button
                                                onClick={() => handleToggleStatus(service)}
                                                variant="outline"
                                                size="sm"
                                                className="flex-1"
                                            >
                                                {service.is_active ? (
                                                    <>
                                                        <EyeOff className="w-4 h-4 mr-1" />
                                                        Désactiver
                                                    </>
                                                ) : (
                                                    <>
                                                        <Eye className="w-4 h-4 mr-1" />
                                                        Activer
                                                    </>
                                                )}
                                            </Button>
                                            <Button
                                                onClick={() => handleDelete(service)}
                                                variant="outline"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:border-red-600"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ✅ Phase 5.5: Barre d'actions batch */}
            {selectionMode && selectedServices.size > 0 && (
                <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-lg z-50">
                    <div className="max-w-7xl mx-auto flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">
                            {selectedServices.size} service{selectedServices.size > 1 ? 's' : ''} sélectionné{selectedServices.size > 1 ? 's' : ''}
                        </span>
                        <div className="flex gap-3">
                            <Button
                                onClick={() => handleBatchAction('activate')}
                                variant="outline"
                                className="flex items-center gap-2 border-green-600 text-green-600 hover:bg-green-50"
                            >
                                <Eye className="w-4 h-4" />
                                Activer
                            </Button>
                            <Button
                                onClick={() => handleBatchAction('deactivate')}
                                variant="outline"
                                className="flex items-center gap-2 border-orange-600 text-orange-600 hover:bg-orange-50"
                            >
                                <EyeOff className="w-4 h-4" />
                                Désactiver
                            </Button>
                            <Button
                                onClick={() => handleBatchAction('delete')}
                                variant="outline"
                                className="flex items-center gap-2 border-red-600 text-red-600 hover:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4" />
                                Supprimer
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✅ Phase 5.2: Modal filtres avancés */}
            <ServiceFilters
                visible={showFiltersModal}
                onClose={() => setShowFiltersModal(false)}
                onApply={updateFilters}
                initialFilters={advancedFilters}
            />
        </div>
    );
};

export default GestionServicesSpecialisesPage;

