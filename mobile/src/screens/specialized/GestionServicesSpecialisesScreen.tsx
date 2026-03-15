// ✅ CORRIGÉ: Utiliser SafeStorage pour éviter les erreurs "Driver not found"
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import ConflictResolutionModal, { ConflictInfo } from '../../components/ConflictResolutionModal';
import NotificationPreferencesModal from '../../components/NotificationPreferencesModal';
import SafeIcon from '../../components/SafeIcon';
import { NativeCard } from '../../components/SafeNativeDesign';
import ServiceCard from '../../components/ServiceCard';
import ServiceFilters, { ServiceFilters as ServiceFiltersType } from '../../components/ServiceFilters';
import ServiceListItem from '../../components/ServiceListItem';
import ServiceSkeleton from '../../components/ServiceSkeleton';
import ServiceSortSearchBar, { SortConfig } from '../../components/ServiceSortSearchBar';
import SyncStatusIndicator, { SyncStatus } from '../../components/SyncStatusIndicator';
import { useAuth } from '../../contexts/AuthContext';
import { useOfflineMode } from '../../hooks/useOfflineMode';
import { apiDelete, apiGet, apiPatch } from '../../services/api';
import { offlineStorage } from '../../services/offline_storage';
import { pushNotificationService } from '../../services/push_notifications';
import { syncService } from '../../services/sync_service';
import { modernColors } from '../../theme/modernTheme';
import SafeStorage from '../../utils/safeStorage';

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
    const { t } = useLanguageSafe();
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<'tous' | 'sante' | 'transport'>('tous');
    const [viewMode, setViewMode] = useState<'card' | 'list'>('card'); // ✅ NOUVEAU: Mode carte/liste
    const [searchQuery, setSearchQuery] = useState(''); // ✅ NOUVEAU: Recherche dans liste
    const [showFiltersModal, setShowFiltersModal] = useState(false); // ✅ NOUVEAU Phase 5.2: Modal filtres
    const [advancedFilters, setAdvancedFilters] = useState<ServiceFiltersType>({ // ✅ NOUVEAU Phase 5.2: Filtres avancés
        type: 'all',
        status: 'all',
        dateRange: 'all',
    });
    const [sortConfig, setSortConfig] = useState<SortConfig>({ // ✅ Phase 5.3: Configuration tri
        field: 'updated_at',
        direction: 'desc',
    });
    const [selectionMode, setSelectionMode] = useState(false); // ✅ Phase 5.5: Mode sélection multiple
    const [selectedServices, setSelectedServices] = useState<Set<number>>(new Set()); // ✅ Phase 5.5: Services sélectionnés (service_id)
    const { isOffline, isOnline } = useOfflineMode(); // ✅ Phase 6.2: Détection mode hors ligne
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('synced'); // ✅ Phase 6.5: Statut synchronisation
    const [pendingSyncCount, setPendingSyncCount] = useState(0); // ✅ Phase 6.5: Nombre d'éléments en attente
    const [conflictModalVisible, setConflictModalVisible] = useState(false); // ✅ Phase 6.4: Modal conflit
    const [currentConflict, setCurrentConflict] = useState<ConflictInfo | null>(null); // ✅ Phase 6.4: Conflit actuel
    const [notificationPrefsVisible, setNotificationPrefsVisible] = useState(false); // ✅ Phase 6.1: Modal préférences notifications

    useEffect(() => {
        loadServices();
        loadViewModePreference();
        checkSyncQueue();
    }, []);

    // ✅ Phase 6.2: Charger depuis le cache si hors ligne
    useEffect(() => {
        if (isOffline) {
            loadFromCache();
            setSyncStatus('offline');
        } else {
            setSyncStatus('synced');
            // Vérifier la queue de sync au retour en ligne
            checkSyncQueue();
        }
    }, [isOffline]);

    // ✅ Phase 6.1: Initialiser les notifications push
    useEffect(() => {
        const initNotifications = async () => {
            try {
                // ✅ Phase 6.1: Passer userId pour enregistrement automatique au backend
                const token = await pushNotificationService.registerForPushNotifications(user?.id as any);
                if (token) {
                    console.log('[GestionServicesSpecialises] Token push enregistré:', token);
                }

                // Configurer les handlers
                pushNotificationService.setupNotificationHandlers(
                    (notification) => {
                        // Notification reçue
                        pushNotificationService.handleSpecializedNotification(notification);
                    },
                    (response) => {
                        // Notification tapée
                        const data = response.notification.request.content.data;
                        if (data?.type === 'pharmacy_on_duty' && data?.pharmacy_id) {
                            // Naviguer vers la pharmacie
                            // navigation.navigate('PharmacyDetail', { id: data.pharmacy_id });
                        } else if (data?.type === 'carpool_match' && data?.carpool_id) {
                            // Naviguer vers le covoiturage
                            // navigation.navigate('CarpoolDetail', { id: data.carpool_id });
                        } else if (data?.type === 'taxi_nearby' && data?.taxi_id) {
                            // Naviguer vers les taxis
                            // navigation.navigate('TaxiList');
                        } else if (data?.type === 'weekly_summary') {
                            // Naviguer vers le dashboard
                            navigation.navigate('ServicesDashboard' as never);
                        }
                    }
                );
            } catch (error) {
                console.error('[GestionServicesSpecialises] Erreur init notifications:', error);
            }
        };

        initNotifications();
    }, []);

    // ✅ Phase 6.2: Charger les services depuis le cache
    const loadFromCache = async () => {
        try {
            const cachedServices = await offlineStorage.getServices();
            if (cachedServices && cachedServices.length > 0) {
                setServices(cachedServices as any);
                console.log('[GestionServicesSpecialises] ✅ Services chargés depuis le cache:', cachedServices.length);
            }
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur chargement cache:', error);
        }
    };

    // ✅ Phase 6.3: Vérifier la queue de synchronisation
    const checkSyncQueue = async () => {
        try {
            const queue = await offlineStorage.getSyncQueue();
            setPendingSyncCount(queue.length);
            if (queue.length > 0 && isOnline) {
                setSyncStatus('pending');
                // ✅ Phase 6.3: Synchroniser automatiquement au retour en ligne
                if (isOnline && !syncService.getIsSyncing()) {
                    performSync();
                }
            } else if (queue.length === 0) {
                setSyncStatus('synced');
            }
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur vérification queue:', error);
        }
    };

    // ✅ Phase 6.3: Effectuer la synchronisation
    // ✅ Phase 6.4: Gérer les conflits détectés
    const performSync = async () => {
        if (syncService.getIsSyncing()) return;

        setSyncStatus('syncing');
        const unsubscribe = syncService.onSyncProgress((progress) => {
            setPendingSyncCount(progress.total - progress.processed);
            console.log('[GestionServicesSpecialises] Progression sync:', progress);
        });

        try {
            const result = await syncService.syncQueue();
            if (result.success) {
                setSyncStatus('synced');
                setPendingSyncCount(0);
                // Recharger les services après sync
                await loadServices();
            } else {
                // ✅ Phase 6.4: Vérifier s'il y a des conflits
                const hasConflicts = result.errors.some((e) => e.includes('CONFLIT') || e.includes('conflict'));
                if (hasConflicts) {
                    setSyncStatus('error');
                    // Extraire les infos de conflit depuis les erreurs
                    // TODO: Parser les erreurs pour extraire ConflictInfo
                    Alert.alert(
                        t('gestionServices.conflictsDetected'),
                        t('gestionServices.conflictsDetectedMsg'),
                        [
                            {
                                text: 'OK', onPress: () => {
                                    // TODO: Ouvrir modal de résolution de conflits
                                }
                            },
                        ]
                    );
                } else {
                    setSyncStatus('error');
                    Alert.alert(
                        t('gestionServices.syncError'),
                        t('gestionServices.syncErrorMsg', { count: result.failed })
                    );
                }
            }
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur synchronisation:', error);
            setSyncStatus('error');
        } finally {
            unsubscribe();
        }
    };

    // ✅ Phase 6.4: Résoudre un conflit
    const handleResolveConflict = async (resolution: 'use_local' | 'use_server' | 'merge' | 'cancel') => {
        if (!currentConflict) return;

        try {
            await syncService.resolveConflict(
                currentConflict.service_id,
                resolution,
                currentConflict.local_data
            );
            setConflictModalVisible(false);
            setCurrentConflict(null);
            // Recharger les services
            await loadServices();
            // Vérifier la queue
            await checkSyncQueue();
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur résolution conflit:', error);
            Alert.alert(t('message.error'), t('gestionServices.cannotResolveConflict'));
        }
    };

    // ✅ NOUVEAU: Charger la préférence de mode d'affichage
    const loadViewModePreference = async () => {
        try {
            const savedMode = await SafeStorage.getItem('specialized_services_view_mode');
            if (savedMode === 'card' || savedMode === 'list') {
                setViewMode(savedMode);
            }
        } catch (error) {
            console.error('Erreur chargement préférence mode:', error);
        }
    };

    // ✅ NOUVEAU: Sauvegarder la préférence de mode d'affichage
    const saveViewModePreference = async (mode: 'card' | 'list') => {
        try {
            await SafeStorage.setItem('specialized_services_view_mode', mode);
        } catch (error) {
            console.error('Erreur sauvegarde préférence mode:', error);
        }
    };

    const loadServices = async (isRefresh = false) => {
        try {
            if (isRefresh) {
                setRefreshing(true);
            } else {
                setLoading(true);
            }

            // ✅ NOUVEAU : Utiliser endpoint unifié au lieu de 6 appels séparés
            // ✅ Phase 5.2: Ajouter filtres dans query params
            // ✅ Phase 5.3: Ajouter tri dans query params
            let url = '/api/specialized-services/user?';
            const params: string[] = [];

            // ✅ Filtrer automatiquement par partner_type si l'utilisateur est partenaire
            if (user?.role === 'partenaire' && user.partner_type) {
                params.push(`type_filter=${user.partner_type}`);
            } else if (advancedFilters.type && advancedFilters.type !== 'all') {
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

            url += params.join('&');
            const response = await apiGet(url);

            if (response.success && response.data) {
                const data = response.data as any;
                const unifiedServices = data.services || [];

                // Convertir format unifié vers format local
                const allServices: SpecializedService[] = unifiedServices.map((s: any) => {
                    // Mapper le type unifié vers le type local
                    let type: 'pharmacie' | 'hopital' | 'laboratoire' | 'agence_voyage' | 'covoiturage' | 'taxi' = 'pharmacie';
                    if (s.type === 'hopital') type = 'hopital';
                    else if (s.type === 'laboratoire') type = 'laboratoire';
                    else if (s.type === 'agence_voyage') type = 'agence_voyage';
                    else if (s.type === 'covoiturage') type = 'covoiturage';
                    else if (s.type === 'taxi') type = 'taxi';

                    // Extraire le nom selon le type
                    let nom = s.nom;
                    if (s.type === 'agence_voyage' && s.metadata?.nom_agence) {
                        nom = s.metadata.nom_agence;
                    } else if (s.type === 'covoiturage' && s.metadata) {
                        nom = `${s.metadata.depart} → ${s.metadata.destination}`;
                    } else if (s.type === 'taxi' && s.metadata?.nom_chauffeur) {
                        nom = s.metadata.nom_chauffeur || s.metadata.telephone;
                    }

                    return {
                        id: s.id,
                        service_id: s.service_id,
                        type,
                        nom: nom || s.nom,
                        nom_agence: s.metadata?.nom_agence,
                        nom_chauffeur: s.metadata?.nom_chauffeur,
                        depart: s.metadata?.depart,
                        destination: s.metadata?.destination,
                        is_active: s.is_active,
                        is_on_duty_now: s.is_available_now,
                        is_available_now: s.is_available_now,
                        created_at: s.created_at,
                    };
                });

                setServices(allServices);

                // ✅ Phase 6.2: Sauvegarder dans le cache si en ligne
                if (isOnline) {
                    try {
                        await offlineStorage.saveServices(allServices.map((s) => ({
                            id: s.id,
                            service_id: s.service_id,
                            type: s.type,
                            nom: getServiceName(s),
                            is_active: s.is_active || false,
                            is_available_now: s.is_available_now || s.is_on_duty_now || false,
                            created_at: s.created_at,
                            updated_at: s.created_at, // Utiliser created_at comme proxy
                            metadata: {},
                        })));
                        const stats = data.statistics || {
                            total: 0,
                            active: 0,
                            inactive: 0,
                            by_type: {},
                        };
                        await offlineStorage.saveStatistics(stats);
                        await offlineStorage.setLastSync(Date.now());
                        console.log('[GestionServicesSpecialises] ✅ Services sauvegardés en cache');
                    } catch (cacheError) {
                        console.error('[GestionServicesSpecialises] Erreur sauvegarde cache:', cacheError);
                    }
                }
            } else {
                setServices([]);
            }
        } catch (error) {
            console.error('Erreur chargement services spécialisés:', error);
            // ✅ Phase 6.2: En cas d'erreur, essayer de charger depuis le cache
            if (isOffline) {
                await loadFromCache();
            } else {
                Alert.alert(t('message.error'), t('gestionServices.cannotLoadServices'));
                setServices([]);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleDelete = async (service: SpecializedService) => {
        Alert.alert(
            t('gestionServices.confirmDelete'),
            t('gestionServices.confirmDeleteMsg'),
            [
                { text: t('message.cancel'), style: 'cancel' },
                {
                    text: t('message.delete'),
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            // ✅ Phase 6.3: Si hors ligne, ajouter à la queue
                            if (isOffline) {
                                await offlineStorage.addToSyncQueue({
                                    action: 'delete',
                                    service_id: service.service_id,
                                });
                                // Mettre à jour localement
                                setServices((prev) => prev.filter((s) => s.id !== service.id));
                                setPendingSyncCount((prev) => prev + 1);
                                setSyncStatus('pending');
                                Alert.alert(
                                    t('gestionServices.addedToQueue'),
                                    t('gestionServices.deleteQueueMsg')
                                );
                                return;
                            }

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
                                Alert.alert(t('message.success'), t('gestionServices.serviceDeleted'));
                                loadServices();
                            } else {
                                Alert.alert(t('message.error'), t('gestionServices.cannotDelete'));
                            }
                        } catch (error) {
                            console.error('Erreur suppression:', error);
                            Alert.alert(t('message.error'), t('gestionServices.genericError'));
                        }
                    },
                },
            ]
        );
    };

    const handleToggleStatus = async (service: SpecializedService) => {
        try {
            // ✅ Phase 6.3: Si hors ligne, ajouter à la queue
            if (isOffline) {
                await offlineStorage.addToSyncQueue({
                    action: 'toggle_status',
                    service_id: service.service_id,
                    data: { is_active: !service.is_active },
                });
                // Mettre à jour localement
                setServices((prev) =>
                    prev.map((s) =>
                        s.id === service.id ? { ...s, is_active: !s.is_active } : s
                    )
                );
                setPendingSyncCount((prev) => prev + 1);
                setSyncStatus('pending');
                Alert.alert(
                    t('gestionServices.addedToQueue'),
                    t('gestionServices.statusQueueMsg')
                );
                return;
            }

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
                Alert.alert(t('message.success'), service.is_active ? t('gestionServices.serviceDeactivated') : t('gestionServices.serviceActivated'));
                loadServices();
            } else {
                Alert.alert(t('message.error'), t('gestionServices.cannotChangeStatus'));
            }
        } catch (error) {
            console.error('Erreur modification statut:', error);
            Alert.alert(t('message.error'), t('gestionServices.genericError'));
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

    // ✅ NOUVEAU: Filtrer selon recherche, catégorie et filtres avancés
    const filteredServices = services.filter((service) => {
        // Filtre par catégorie (ancien filtre)
        let matchesCategory = true;
        if (filter === 'sante') {
            matchesCategory = ['pharmacie', 'hopital', 'laboratoire'].includes(service.type);
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

    // ✅ NOUVEAU: Convertir vers format unifié pour les composants
    const convertToUnified = (service: SpecializedService) => ({
        id: service.id,
        service_id: service.service_id,
        type: service.type,
        nom: getServiceName(service),
        is_active: service.is_active,
        is_available_now: service.is_available_now || service.is_on_duty_now,
        created_at: service.created_at,
        metadata: {
            nom_agence: service.nom_agence,
            nom_chauffeur: service.nom_chauffeur,
            depart: service.depart,
            destination: service.destination,
        },
    });

    // ✅ NOUVEAU: Render avec composants modernes selon le mode
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
            Alert.alert(t('gestionServices.noSelection'), t('gestionServices.selectAtLeastOne'));
            return;
        }

        // ✅ Phase 5.5: Confirmation pour actions destructives
        if (action === 'delete') {
            Alert.alert(
                t('gestionServices.confirmDelete'),
                t('gestionServices.confirmBatchDelete', { count: selectedServices.size }),
                [
                    { text: t('message.cancel'), style: 'cancel' },
                    {
                        text: t('message.delete'),
                        style: 'destructive',
                        onPress: async () => {
                            await performBatchAction(action);
                        },
                    },
                ]
            );
        } else {
            await performBatchAction(action);
        }
    };

    const performBatchAction = async (action: 'activate' | 'deactivate' | 'delete') => {
        try {
            // ✅ Phase 6.3: Si hors ligne, ajouter chaque action à la queue
            if (isOffline) {
                for (const serviceId of selectedServices) {
                    await offlineStorage.addToSyncQueue({
                        action: action === 'delete' ? 'delete' : 'toggle_status',
                        service_id: serviceId,
                        data: action === 'delete' ? undefined : {
                            is_active: action === 'activate',
                        },
                    });
                }
                // Mettre à jour localement
                if (action === 'delete') {
                    setServices((prev) => prev.filter((s) => !selectedServices.has(s.service_id)));
                } else {
                    setServices((prev) =>
                        prev.map((s) =>
                            selectedServices.has(s.service_id)
                                ? { ...s, is_active: action === 'activate' }
                                : s
                        )
                    );
                }
                setPendingSyncCount((prev) => prev + selectedServices.size);
                setSyncStatus('pending');
                setSelectedServices(new Set());
                setSelectionMode(false);
                Alert.alert(
                    t('gestionServices.addedToQueue'),
                    t('gestionServices.batchQueueMsg', { count: selectedServices.size })
                );
                return;
            }

            const response = await apiPatch('/api/specialized-services/batch', {
                service_ids: Array.from(selectedServices),
                action,
            });

            if (response.success) {
                const data = response.data as any;
                Alert.alert(
                    t('message.success'),
                    action === 'activate' ? t('gestionServices.batchActivated', { count: data?.processed || selectedServices.size }) : action === 'deactivate' ? t('gestionServices.batchDeactivated', { count: data?.processed || selectedServices.size }) : t('gestionServices.batchDeleted', { count: data?.processed || selectedServices.size })
                );
                setSelectedServices(new Set());
                setSelectionMode(false);
                loadServices();
            } else {
                Alert.alert(t('message.error'), t('gestionServices.genericError'));
            }
        } catch (error) {
            console.error('[GestionServicesSpecialises] Erreur action batch:', error);
            Alert.alert(t('message.error'), t('gestionServices.cannotPerformAction'));
        }
    };

    const renderServiceItem = ({ item }: { item: SpecializedService }) => {
        const unified = convertToUnified(item);
        const isSelected = selectedServices.has(item.service_id);

        // ✅ Phase 5.5: Menu contextuel (long press)
        const handleLongPress = () => {
            if (!selectionMode) {
                setSelectionMode(true);
                setSelectedServices(new Set([item.service_id]));
            }
        };

        if (viewMode === 'card') {
            return (
                <TouchableOpacity
                    onPress={() => {
                        if (selectionMode) {
                            toggleServiceSelection(item.service_id);
                        } else {
                            handleEdit(item);
                        }
                    }}
                    onLongPress={handleLongPress}
                    style={[selectionMode && isSelected && styles.selectedCard]}
                >
                    {selectionMode && (
                        <View style={styles.checkboxContainer}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                {isSelected && <SafeIcon name="check" size={16} color="#fff" />}
                            </View>
                        </View>
                    )}
                    <ServiceCard
                        service={unified}
                        onPress={() => {
                            if (selectionMode) {
                                toggleServiceSelection(item.service_id);
                            } else {
                                handleEdit(item);
                            }
                        }}
                        onEdit={() => handleEdit(item)}
                    />
                </TouchableOpacity>
            );
        } else {
            return (
                <TouchableOpacity
                    onPress={() => {
                        if (selectionMode) {
                            toggleServiceSelection(item.service_id);
                        } else {
                            handleEdit(item);
                        }
                    }}
                    onLongPress={handleLongPress}
                    style={[selectionMode && isSelected && styles.selectedListItem]}
                >
                    {selectionMode && (
                        <View style={styles.checkboxContainer}>
                            <View style={[styles.checkbox, isSelected && styles.checkboxChecked]}>
                                {isSelected && <SafeIcon name="check" size={16} color="#fff" />}
                            </View>
                        </View>
                    )}
                    <ServiceListItem
                        service={unified}
                        onPress={() => {
                            if (selectionMode) {
                                toggleServiceSelection(item.service_id);
                            } else {
                                handleEdit(item);
                            }
                        }}
                        onEdit={() => handleEdit(item)}
                    />
                </TouchableOpacity>
            );
        }
    };

    // Ancien render (gardé pour compatibilité avec boutons spéciaux agences)
    const renderServiceCard = ({ item }: { item: SpecializedService }) => (
        <NativeCard style={styles.serviceCard}>
            <View style={styles.serviceHeader}>
                <View style={styles.serviceIconContainer}>
                    <Text style={styles.serviceIcon}>{getServiceIcon(item.type)}</Text>
                </View>
                <View style={styles.serviceInfo}>
                    <Text style={styles.serviceName}>{getServiceName(item)}</Text>
                    <Text style={styles.serviceType}>
                        {item.type === 'pharmacie' ? 'Pharmacie' :
                            item.type === 'hopital' ? 'Hôpital/Clinique' :
                                item.type === 'laboratoire' ? 'Laboratoire' :
                                    item.type === 'agence_voyage' ? 'Agence de Voyage' :
                                        item.type === 'covoiturage' ? 'Covoiturage' :
                                            item.type === 'taxi' ? 'Taxi' : ''}
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

            {/* Boutons spéciaux pour agences de voyage */}
            {item.type === 'agence_voyage' && (
                <View style={styles.agencyButtonsContainer}>
                    <TouchableOpacity
                        style={[styles.ticketsButton, styles.agencyButton]}
                        onPress={() => (navigation as any).navigate('AgencyTicketManagement')}
                    >
                        <SafeIcon name="ticket" size={18} color="#fff" />
                        <Text style={styles.ticketsButtonText}>Gérer les tickets</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.ticketsButton, styles.agencyButton, { backgroundColor: modernColors.primary }]}
                        onPress={() => (navigation as any).navigate('ManageAgencySchedules')}
                    >
                        <SafeIcon name="clock" size={18} color="#fff" />
                        <Text style={styles.ticketsButtonText}>Horaires de départ</Text>
                    </TouchableOpacity>
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

    // ✅ NOUVEAU: Vérifier que l'utilisateur est un partenaire
    if (user?.role !== 'partenaire') {
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
                <View style={styles.emptyContainer}>
                    <SafeIcon name="shield-off" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyTitle}>Accès réservé aux partenaires</Text>
                    <Text style={styles.emptyText}>
                        Cette section est réservée aux partenaires commerciaux. Si vous souhaitez devenir partenaire, veuillez vous inscrire depuis l'écran de connexion.
                    </Text>
                    <TouchableOpacity
                        style={styles.createButton}
                        onPress={() => navigation.goBack()}
                    >
                        <Text style={styles.createButtonText}>Retour</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // ✅ NOUVEAU: Afficher skeleton loaders pendant le chargement
    if (loading) {
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

                {/* Skeleton pour la barre de recherche */}
                <View style={styles.searchContainer}>
                    <View style={[styles.searchBar, { opacity: 0.5 }]}>
                        <View style={{ width: 20, height: 20, backgroundColor: modernColors.textSecondary + '30', borderRadius: 4 }} />
                        <View style={{ flex: 1, height: 20, backgroundColor: modernColors.textSecondary + '30', borderRadius: 4 }} />
                    </View>
                </View>

                {/* Skeleton pour les filtres */}
                <View style={styles.filtersContainer}>
                    <View style={styles.filtersRow}>
                        <View style={[styles.filterChip, { backgroundColor: modernColors.textSecondary + '30', width: 60, height: 32 }]} />
                        <View style={[styles.filterChip, { backgroundColor: modernColors.textSecondary + '30', width: 60, height: 32 }]} />
                        <View style={[styles.filterChip, { backgroundColor: modernColors.textSecondary + '30', width: 80, height: 32 }]} />
                    </View>
                    <View style={[styles.viewModeToggle, { opacity: 0.5 }]} />
                </View>

                {/* Skeleton pour les services */}
                <FlatList
                    data={[1, 2, 3, 4, 5, 6]} // 6 items skeleton
                    renderItem={() => <ServiceSkeleton mode={viewMode} />}
                    keyExtractor={(item) => `skeleton-${item}`}
                    contentContainerStyle={styles.listContent}
                    numColumns={viewMode === 'card' ? 2 : 1}
                    columnWrapperStyle={viewMode === 'card' ? styles.cardRow : undefined}
                />
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
                <View style={styles.headerActions}>
                    {/* ✅ Phase 6.2 & 6.5: Indicateur mode hors ligne et statut sync */}
                    {isOffline && (
                        <View style={styles.offlineIndicator}>
                            <SafeIcon name="wifi-off" size={16} color={modernColors.warning} />
                            <Text style={styles.offlineText}>Hors ligne</Text>
                        </View>
                    )}
                    {!isOffline && (
                        <SyncStatusIndicator
                            status={syncStatus}
                            pendingCount={pendingSyncCount}
                            onPress={() => {
                                if (pendingSyncCount > 0 && !syncService.getIsSyncing()) {
                                    performSync();
                                }
                            }}
                        />
                    )}
                    {/* ✅ Phase 5.5: Bouton mode sélection */}
                    {!selectionMode ? (
                        <>
                            <TouchableOpacity
                                onPress={() => (navigation as any).navigate('ServicesDashboard')}
                                style={styles.dashboardButton}
                            >
                                <SafeIcon name="bar-chart" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => (navigation as any).navigate('MesReservations')}
                                style={styles.dashboardButton}
                            >
                                <SafeIcon name="calendar" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => (navigation as any).navigate('PrestataireReservations')}
                                style={styles.dashboardButton}
                            >
                                <SafeIcon name="inbox" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setNotificationPrefsVisible(true)}
                                style={styles.notificationButton}
                            >
                                <SafeIcon name="bell" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setSelectionMode(true)}
                                style={styles.selectionButton}
                            >
                                <SafeIcon name="check-square" size={20} color={modernColors.primary} />
                            </TouchableOpacity>
                        </>
                    ) : (
                        <>
                            <TouchableOpacity
                                onPress={() => {
                                    setSelectionMode(false);
                                    setSelectedServices(new Set());
                                }}
                                style={styles.cancelSelectionButton}
                            >
                                <Text style={styles.cancelSelectionText}>Annuler</Text>
                            </TouchableOpacity>
                            <Text style={styles.selectionCount}>
                                {selectedServices.size} sélectionné{selectedServices.size > 1 ? 's' : ''}
                            </Text>
                        </>
                    )}
                </View>
            </View>

            {/* ✅ Phase 5.3: Barre de recherche avec tri */}
            <ServiceSortSearchBar
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                sortConfig={sortConfig}
                onSortChange={setSortConfig}
                placeholder="Rechercher dans la liste..."
            />

            {/* Filtres et Toggle */}
            <View style={styles.filtersContainer}>
                <View style={styles.filtersRow}>
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
                    {/* ✅ Phase 5.2: Bouton filtres avancés */}
                    <TouchableOpacity
                        style={[
                            styles.filterChip,
                            (advancedFilters.type !== 'all' || advancedFilters.status !== 'all' || advancedFilters.dateRange !== 'all') && styles.filterChipActive,
                        ]}
                        onPress={() => setShowFiltersModal(true)}
                    >
                        <SafeIcon name="filter" size={16} color={(advancedFilters.type !== 'all' || advancedFilters.status !== 'all' || advancedFilters.dateRange !== 'all') ? '#fff' : modernColors.textSecondary} />
                        <Text
                            style={[
                                styles.filterChipText,
                                (advancedFilters.type !== 'all' || advancedFilters.status !== 'all' || advancedFilters.dateRange !== 'all') && styles.filterChipTextActive,
                            ]}
                        >
                            Filtres
                        </Text>
                        {(advancedFilters.type !== 'all' || advancedFilters.status !== 'all' || advancedFilters.dateRange !== 'all') && (
                            <View style={styles.filterBadge}>
                                <Text style={styles.filterBadgeText}>!</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* ✅ NOUVEAU: Toggle carte/liste */}
                <View style={styles.viewModeToggle}>
                    <TouchableOpacity
                        style={[
                            styles.viewModeButton,
                            viewMode === 'card' && styles.viewModeButtonActive,
                        ]}
                        onPress={() => {
                            setViewMode('card');
                            saveViewModePreference('card');
                        }}
                    >
                        <SafeIcon
                            name="grid"
                            size={18}
                            color={viewMode === 'card' ? '#fff' : modernColors.textSecondary}
                        />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.viewModeButton,
                            viewMode === 'list' && styles.viewModeButtonActive,
                        ]}
                        onPress={() => {
                            setViewMode('list');
                            saveViewModePreference('list');
                        }}
                    >
                        <SafeIcon
                            name="list"
                            size={18}
                            color={viewMode === 'list' ? '#fff' : modernColors.textSecondary}
                        />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Lien vers Dashboard */}
            <View style={styles.dashboardLinkContainer}>
                <TouchableOpacity
                    style={styles.dashboardLinkButton}
                    onPress={() => (navigation as any).navigate('ServicesDashboard')}
                >
                    <SafeIcon name="bar-chart-2" size={20} color={modernColors.primary} />
                    <Text style={styles.dashboardButtonText}>Accéder au Dashboard</Text>
                </TouchableOpacity>
            </View>

            {/* Liste des services */}
            {sortedServices.length === 0 ? (
                <View style={styles.emptyContainer}>
                    {/* ✅ AMÉLIORÉ: Illustration moderne avec gradient */}
                    <View style={styles.emptyIllustration}>
                        <LinearGradient
                            colors={[modernColors.primary + '20', modernColors.primary + '10']}
                            style={styles.emptyGradient}
                        >
                            <SafeIcon name="inbox" size={64} color={modernColors.primary} type="lucide" />
                        </LinearGradient>
                        <View style={styles.emptyDecoration}>
                            <View style={[styles.emptyDot, { top: 10, left: 20, backgroundColor: modernColors.primary + '40' }]} />
                            <View style={[styles.emptyDot, { top: 30, right: 15, backgroundColor: modernColors.primary + '30' }]} />
                            <View style={[styles.emptyDot, { bottom: 20, left: 15, backgroundColor: modernColors.primary + '50' }]} />
                        </View>
                    </View>
                    <Text style={styles.emptyTitle} accessibilityRole="header">
                        {searchQuery || filter !== 'tous'
                            ? 'Aucun résultat trouvé'
                            : 'Bienvenue sur votre espace partenaire'}
                    </Text>
                    <Text style={styles.emptyText} accessibilityRole="text">
                        {searchQuery || filter !== 'tous'
                            ? 'Aucun service ne correspond à vos critères de recherche. Essayez de modifier vos filtres.'
                            : 'Commencez par créer votre premier service pour proposer vos prestations aux utilisateurs de <Text style={styles.brandYuk}>Yuk</Text><Text style={styles.brandPo}>po</Text>.'}
                    </Text>
                    {/* ✅ AMÉLIORÉ: CTA avec navigation directe vers le bon formulaire selon le partner_type */}
                    <View style={styles.emptyActions}>
                        {user?.role === 'partenaire' && (() => {
                            const partnerFormMap: Record<string, { screen: string; label: string }> = {
                                'pharmacie': { screen: 'PharmacieForm', label: 'Enregistrer ma pharmacie' },
                                'hopital': { screen: 'HopitalForm', label: 'Enregistrer mon hôpital' },
                                'laboratoire': { screen: 'LaboratoireForm', label: 'Enregistrer mon laboratoire' },
                                'banquesang': { screen: 'BanqueSangForm', label: 'Enregistrer ma banque de sang' },
                                'agence de voyage': { screen: 'AgenceVoyageForm', label: 'Enregistrer mon agence' },
                                'hotel': { screen: 'HotelDashboard', label: 'Gérer mon hôtel' },
                                'meuble': { screen: 'HotelDashboard', label: 'Gérer mon meublé' },
                                'chauffeur': { screen: 'TaxiForm', label: 'Créer mon profil chauffeur' },
                                'supermarche': { screen: 'SupermarketHome', label: 'Gérer mon supermarché' },
                                'offres_emploi': { screen: 'CreateOffre', label: 'Publier une offre d\'emploi' },
                                'recruteur': { screen: 'CreateOffre', label: 'Publier une offre d\'emploi' },
                                'employeur': { screen: 'CreateOffre', label: 'Publier une offre d\'emploi' },
                            };
                            const formInfo = user.partner_type ? partnerFormMap[user.partner_type] : null;
                            const targetScreen = formInfo?.screen || 'MesServicesSpecialises';
                            const buttonLabel = formInfo?.label || 'Créer un service';
                            return (
                                <TouchableOpacity
                                    onPress={() => (navigation as any).navigate(targetScreen)}
                                    style={[styles.createButton, { backgroundColor: modernColors.primary }]}
                                    accessibilityRole="button"
                                    accessibilityLabel={buttonLabel}
                                    accessibilityHint="Ouvre le formulaire de création de service"
                                >
                                    <SafeIcon name="plus" size={18} color="#fff" />
                                    <Text style={styles.createButtonText}>{buttonLabel}</Text>
                                </TouchableOpacity>
                            );
                        })()}
                        {searchQuery || filter !== 'tous' ? (
                            <TouchableOpacity
                                onPress={() => {
                                    setSearchQuery('');
                                    setFilter('tous');
                                    setAdvancedFilters({
                                        type: 'all',
                                        status: 'all',
                                        dateRange: 'all',
                                    });
                                }}
                                style={[styles.createButton, styles.clearButton]}
                                accessibilityRole="button"
                                accessibilityLabel="Réinitialiser tous les filtres"
                            >
                                <SafeIcon name="x" size={18} color={modernColors.textSecondary} />
                                <Text style={styles.clearButtonText}>Réinitialiser les filtres</Text>
                            </TouchableOpacity>
                        ) : (
                            <TouchableOpacity
                                onPress={() => (navigation as any).navigate('SpecializedServicesHub')}
                                style={styles.exploreButton}
                                accessibilityRole="button"
                                accessibilityLabel="Explorer les services disponibles"
                            >
                                <SafeIcon name="compass" size={18} color={modernColors.primary} />
                                <Text style={styles.exploreButtonText}>Explorer les services</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            ) : (
                <FlatList
                    data={sortedServices}
                    renderItem={renderServiceItem}
                    keyExtractor={(item) => `${item.type}-${item.id}`}
                    contentContainerStyle={styles.listContent}
                    numColumns={viewMode === 'card' ? 2 : 1}
                    columnWrapperStyle={viewMode === 'card' ? styles.cardRow : undefined}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => loadServices(true)}
                            colors={[modernColors.primary]}
                        />
                    }
                    // ✅ Phase 7.3: Optimisations lazy loading
                    initialNumToRender={10} // Nombre d'éléments à rendre initialement
                    maxToRenderPerBatch={5} // Nombre d'éléments à rendre par batch
                    windowSize={10} // Taille de la fenêtre de rendu (multiples de initialNumToRender)
                    removeClippedSubviews={true} // Retirer les vues hors écran de la hiérarchie native
                    updateCellsBatchingPeriod={50} // Délai entre les batches (ms)
                    getItemLayout={(data, index) => {
                        // ✅ OPTIMISÉ: Calcul précis avec marges et padding
                        if (viewMode === 'card') {
                            // Hauteur réelle: header (120) + nom (44) + footer (32) + available badge (32 optionnel) + padding (32) + margin (12)
                            const cardHeight = 120 + 44 + 32 + 12 + 32; // 240px avec badge, 208px sans
                            const numColumns = 2;
                            const row = Math.floor(index / numColumns);
                            return {
                                length: cardHeight,
                                offset: row * cardHeight,
                                index,
                            };
                        } else {
                            // Hauteur réelle: padding (16*2) + contenu (~88) + margin (12)
                            const itemHeight = 16 + 88 + 16 + 12; // 132px
                            return {
                                length: itemHeight,
                                offset: index * itemHeight,
                                index,
                            };
                        }
                    }}
                />
            )}

            {/* ✅ Phase 5.5: Barre d'actions batch */}
            {selectionMode && selectedServices.size > 0 && (
                <View style={styles.batchActionsBar}>
                    <TouchableOpacity
                        style={[styles.batchActionButton, styles.activateButton]}
                        onPress={() => handleBatchAction('activate')}
                    >
                        <SafeIcon name="check-circle" size={18} color="#10B981" />
                        <Text style={[styles.batchActionText, { color: '#10B981' }]}>
                            Activer
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.batchActionButton, styles.deactivateButton]}
                        onPress={() => handleBatchAction('deactivate')}
                    >
                        <SafeIcon name="x-circle" size={18} color="#F59E0B" />
                        <Text style={[styles.batchActionText, { color: '#F59E0B' }]}>
                            Désactiver
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.batchActionButton, styles.deleteBatchButton]}
                        onPress={() => handleBatchAction('delete')}
                    >
                        <SafeIcon name="trash-2" size={18} color="#EF4444" />
                        <Text style={[styles.batchActionText, { color: '#EF4444' }]}>
                            Supprimer
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* ✅ Phase 5.2: Modal filtres avancés */}
            <ServiceFilters
                visible={showFiltersModal}
                onClose={() => setShowFiltersModal(false)}
                onApply={(filters) => {
                    setAdvancedFilters(filters);
                    loadServices(); // Recharger avec nouveaux filtres
                }}
                initialFilters={advancedFilters}
            />

            {/* ✅ Phase 6.4: Modal résolution de conflits */}
            <ConflictResolutionModal
                visible={conflictModalVisible}
                conflict={currentConflict}
                onResolve={handleResolveConflict}
                onClose={() => {
                    setConflictModalVisible(false);
                    setCurrentConflict(null);
                }}
            />

            {/* ✅ Phase 6.1: Modal préférences notifications */}
            <NotificationPreferencesModal
                visible={notificationPrefsVisible}
                onClose={() => setNotificationPrefsVisible(false)}
            />
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
        flex: 1,
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dashboardButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: modernColors.primary + '15',
    },
    notificationButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: modernColors.primary + '15',
        justifyContent: 'center',
        alignItems: 'center',
    },
    selectionButton: {
        padding: 8,
        borderRadius: 8,
        backgroundColor: modernColors.primary + '15',
    },
    cancelSelectionButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
    },
    cancelSelectionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
    },
    selectionCount: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.primary,
    },
    checkboxContainer: {
        position: 'absolute',
        top: 8,
        left: 8,
        zIndex: 10,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.primary,
        backgroundColor: '#fff',
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkboxChecked: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    selectedCard: {
        opacity: 0.7,
        borderWidth: 2,
        borderColor: modernColors.primary,
        borderRadius: 12,
    },
    selectedListItem: {
        opacity: 0.7,
        borderLeftWidth: 4,
        borderLeftColor: modernColors.primary,
    },
    batchActionsBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        padding: 12,
        gap: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
    },
    batchActionButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
    },
    activateButton: {
        borderColor: '#10B981',
        backgroundColor: '#10B981' + '15',
    },
    deactivateButton: {
        borderColor: '#F59E0B',
        backgroundColor: '#F59E0B' + '15',
    },
    deleteBatchButton: {
        borderColor: '#EF4444',
        backgroundColor: '#EF4444' + '15',
    },
    batchActionText: {
        fontSize: 14,
        fontWeight: '600',
    },
    offlineIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 6,
        backgroundColor: modernColors.warning + '15',
        borderRadius: 16,
    },
    offlineText: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.warning,
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
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        flex: 1,
    },
    viewModeToggle: {
        flexDirection: 'row',
        gap: 4,
        backgroundColor: '#F3F4F6',
        borderRadius: 8,
        padding: 2,
    },
    viewModeButton: {
        padding: 8,
        borderRadius: 6,
    },
    viewModeButtonActive: {
        backgroundColor: modernColors.primary,
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
    cardRow: {
        justifyContent: 'space-between',
    },
    dashboardLinkContainer: {
        padding: 16,
        backgroundColor: '#fff',
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    dashboardLinkButton: {
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
    agencyButtonsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    agencyButton: {
        flex: 1,
    },
    ticketsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 8,
    },
    ticketsButtonText: {
        fontSize: 14,
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
    emptyIllustration: {
        position: 'relative',
        marginBottom: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyGradient: {
        width: 120,
        height: 120,
        borderRadius: 60,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
    },
    emptyIcon: {
        fontSize: 80,
        marginBottom: 16,
    },
    emptyDecoration: {
        position: 'absolute',
        width: 120,
        height: 120,
        top: 0,
        left: '50%',
        marginLeft: -60,
    },
    emptyDot: {
        position: 'absolute',
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: modernColors.primary + '40',
    },
    emptyTitle: {
        fontSize: 22,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        textAlign: 'center',
    },
    emptyText: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 32,
        lineHeight: 22,
        paddingHorizontal: 16,
    },
    emptyActions: {
        width: '100%',
        gap: 12,
        alignItems: 'center',
    },
    createButton: {
        paddingHorizontal: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 200,
    },
    createButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },
    filterBadge: {
        position: 'absolute',
        top: -4,
        right: -4,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: '#EF4444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    filterBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '700',
    },
    clearButton: {
        backgroundColor: '#F3F4F6',
    },
    clearButtonText: {
        color: '#374151',
        fontSize: 15,
        fontWeight: '600',
    },
    exploreButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary + '40',
    },
    exploreButtonText: {
        color: modernColors.primary,
        fontSize: 15,
        fontWeight: '600',
    },
    brandYuk: {
        color: '#3B82F6', // Bleu (cohérent avec le logo officiel)
    },
    brandPo: {
        color: '#7C3AED', // Violet (cohérent avec le logo officiel)
    },
});

export default GestionServicesSpecialisesScreen;

