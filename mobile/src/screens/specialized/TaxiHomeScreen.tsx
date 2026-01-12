// ✅ Écran Taxi MODERNE - Refonte complète avec UX digne d'une app de taxi
// Structure claire : Recherche de taxis vs Création de service taxi

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { taxiService, Taxi, SearchTaxisFilters, CreateTaxiRequest } from '../../services/taxiService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { useToaster } from '../../components/ToasterProvider';

type ViewMode = 'search' | 'create';

const TaxiHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { location, getLocationAddress } = useLocation();
    const toaster = useToaster();
    
    // ✅ NOUVEAU: Vérifier si l'utilisateur est un chauffeur validé
    const [isDriverValidated, setIsDriverValidated] = useState(false);
    const [checkingDriverStatus, setCheckingDriverStatus] = useState(true);

    // ✅ NOUVEAU: Vérifier le statut chauffeur depuis l'API
    useEffect(() => {
        const checkDriverStatus = async () => {
            if (!user?.id) {
                setIsDriverValidated(false);
                setCheckingDriverStatus(false);
                return;
            }

            try {
                // Vérifier depuis les données utilisateur locales d'abord
                const localCheck = user?.role === 'driver' || 
                                  (user as any)?.is_driver === true || 
                                  (user as any)?.driver_status === 'validated' ||
                                  (user as any)?.driver_status === 'approved';
                
                if (localCheck) {
                    setIsDriverValidated(true);
                    setCheckingDriverStatus(false);
                    return;
                }

                // Si pas trouvé localement, vérifier via API
                const { apiGet } = await import('../../services/api');
                const response = await apiGet(`/api/users/${user.id}/driver-status`);
                
                if (response.success && response.data) {
                    const driverStatus = response.data.driver_status || response.data.is_driver;
                    setIsDriverValidated(driverStatus === 'validated' || driverStatus === 'approved' || driverStatus === true);
                } else {
                    setIsDriverValidated(false);
                }
            } catch (error) {
                console.warn('[TaxiHomeScreen] Erreur vérification statut chauffeur:', error);
                // En cas d'erreur, utiliser la vérification locale
                setIsDriverValidated(
                    user?.role === 'driver' || 
                    (user as any)?.is_driver === true || 
                    (user as any)?.driver_status === 'validated' ||
                    (user as any)?.driver_status === 'approved'
                );
            } finally {
                setCheckingDriverStatus(false);
            }
        };

        checkDriverStatus();
    }, [user]);

    // Mode d'affichage : recherche ou création
    const [viewMode, setViewMode] = useState<ViewMode>('search');

    // États de recherche
    const [depart, setDepart] = useState<LocationObject | string>('');
    const [destination, setDestination] = useState<LocationObject | string>('');
    const [taxis, setTaxis] = useState<Taxi[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [hasSearched, setHasSearched] = useState(false); // ✅ NOUVEAU: Indique si une recherche a été effectuée
    const [initializingDepart, setInitializingDepart] = useState(true); // ✅ NOUVEAU: Indique si on initialise le départ avec GPS

    // ✅ NOUVEAU: Détection automatique de devise depuis GPS/localisation
    const detectedCurrency = useCurrencyDetection(
        typeof depart === 'object' ? depart : 
        typeof destination === 'object' ? destination : 
        undefined
    );

    // États pour création de service taxi
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    const [taxiForm, setTaxiForm] = useState<Partial<CreateTaxiRequest>>({
        devise: detectedCurrency, // ✅ Utilise la devise détectée automatiquement
        paiement_cash: true,
        paiement_mobile_money: true,
        paiement_carte: false,
        climatisation: true,
        wifi: false,
    });

    // ✅ NOUVEAU: Initialiser le départ avec la position GPS actuelle
    useEffect(() => {
        const initializeDepartFromGPS = async () => {
            if (location?.coords && !depart && initializingDepart) {
                try {
                    setInitializingDepart(true);
                    // Obtenir l'adresse depuis les coordonnées GPS
                    const address = await getLocationAddress(location);
                    
                    if (address) {
                        // Créer un LocationObject à partir de l'adresse et des coordonnées
                        const locationObject: LocationObject = {
                            raw: address,
                            place_name: address,
                            components: {
                                ville: address.split(',')[0] || address,
                            },
                            geometry: {
                                coordinates: [location.coords.longitude, location.coords.latitude],
                                type: 'Point',
                            },
                        };
                        setDepart(locationObject);
                    } else {
                        // Si pas d'adresse, créer un objet avec juste les coordonnées
                        const locationObject: LocationObject = {
                            raw: `Position actuelle (${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)})`,
                            place_name: 'Ma position actuelle',
                            components: {},
                            geometry: {
                                coordinates: [location.coords.longitude, location.coords.latitude],
                                type: 'Point',
                            },
                        };
                        setDepart(locationObject);
                    }
                } catch (err) {
                    console.warn('[TaxiHomeScreen] Erreur initialisation départ GPS:', err);
                    // En cas d'erreur, laisser le champ vide pour que l'utilisateur puisse le remplir
                } finally {
                    setInitializingDepart(false);
                }
            } else if (!location?.coords && initializingDepart) {
                // Pas de GPS disponible, laisser vide
                setInitializingDepart(false);
            }
        };

        initializeDepartFromGPS();
    }, [location, depart, initializingDepart, getLocationAddress]);

    const loadNearbyTaxis = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const filters: SearchTaxisFilters = {
                limit: 50,
                page: 1,
            };

            if (location?.coords) {
                filters.lat = location.coords.latitude;
                filters.lng = location.coords.longitude;
                filters.radius_km = 20; // 20km radius pour taxis
            }

            if (availableOnly) {
                // Note: Le backend devrait supporter available_only
            }

            const response = await taxiService.searchTaxis(filters);
            
            if (response.success && response.data?.data) {
                // Filtrer par disponibilité côté client si nécessaire
                let filteredTaxis = response.data.data;
                if (availableOnly) {
                    filteredTaxis = filteredTaxis.filter(t => t.is_available !== false);
                }
                setTaxis(filteredTaxis);
                setTotalResults(filteredTaxis.length);
            } else {
                setError('Aucun taxi trouvé à proximité');
                setTaxis([]);
            }
        } catch (err: any) {
            console.error('[TaxiHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setTaxis([]);
        } finally {
            setLoading(false);
        }
    }, [location, availableOnly]);

    // ✅ MODIFIÉ: Vérifier si le bouton de recherche doit être activé (départ peut être GPS, destination obligatoire)
    const canSearch = () => {
        // Le départ est valide s'il existe (peut être GPS ou lieu sélectionné)
        const departValid = depart && (
            typeof depart === 'string' ? depart.trim() !== '' :
            (depart as LocationObject)?.place_name || 
            (depart as LocationObject)?.geometry?.coordinates?.length === 2
        );
        
        // La destination est obligatoire et doit être un lieu précis
        const destinationStr = typeof destination === 'string'
            ? destination.trim()
            : (destination as LocationObject)?.place_name || '';

        return !!departValid && !!destinationStr;
    };

    const handleSearch = async () => {
        hapticPress();
        
        // ✅ VALIDATION: Vérifier que départ (GPS ou lieu) et destination (lieu précis) sont remplis
        const departLocation = typeof depart === 'object' ? depart as LocationObject : null;
        const departStr = typeof depart === 'string' 
            ? depart.trim()
            : departLocation?.place_name || '';
        
        const destinationLocation = typeof destination === 'object' ? destination as LocationObject : null;
        const destinationStr = typeof destination === 'string'
            ? destination.trim()
            : destinationLocation?.place_name || '';

        if (!departStr || !destinationStr) {
            Alert.alert('Erreur', 'Veuillez sélectionner un point de départ et une destination précise');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const filters: SearchTaxisFilters = {
                limit: 50,
                page: 1,
            };

            // ✅ AMÉLIORÉ: Utiliser les coordonnées GPS du départ si disponibles, sinon utiliser le texte
            if (departLocation?.geometry?.coordinates) {
                // Utiliser les coordonnées GPS du départ
                filters.lat = departLocation.geometry.coordinates[1]; // latitude
                filters.lng = departLocation.geometry.coordinates[0]; // longitude
                filters.radius_km = 20;
            } else if (typeof depart === 'object') {
                const location = depart as LocationObject;
                if (location.components?.ville) filters.ville = location.components.ville;
                if (location.components?.quartier) filters.quartier = location.components.quartier;
            } else if (departStr) {
                const parts = departStr.split(',').map(s => s.trim());
                if (parts.length > 0) filters.ville = parts[0];
                if (parts.length > 1) filters.quartier = parts[1];
            }

            // Fallback: utiliser la position GPS actuelle si pas de coordonnées dans le départ
            if (!filters.lat && !filters.lng && location?.coords) {
                filters.lat = location.coords.latitude;
                filters.lng = location.coords.longitude;
                filters.radius_km = 20;
            }

            const response = await taxiService.searchTaxis(filters);
            
            if (response.success && response.data?.data) {
                let filteredTaxis = response.data.data;
                if (availableOnly) {
                    filteredTaxis = filteredTaxis.filter(t => t.is_available !== false);
                }
                setTaxis(filteredTaxis);
                setTotalResults(filteredTaxis.length);
                setHasSearched(true); // ✅ NOUVEAU: Marquer qu'une recherche a été effectuée
                setError(null);
            } else {
                setError('Aucun taxi trouvé pour ce trajet');
                setTaxis([]);
                setHasSearched(true);
            }
        } catch (err: any) {
            console.error('[TaxiHomeScreen] Erreur recherche:', err);
            setError(err.message || 'Erreur lors de la recherche');
            setTaxis([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTaxi = async () => {
        if (!taxiForm.telephone?.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le numéro de téléphone');
            return;
        }
        
        if (!taxiForm.service_id) {
            Alert.alert(
                'Service requis',
                'Vous devez d\'abord créer un service. Voulez-vous le faire maintenant ?',
                [
                    { text: 'Annuler' },
                    {
                        text: 'Créer un service',
                        onPress: () => navigation.navigate('GestionServicesSpecialises' as never),
                    },
                ]
            );
            return;
        }

        hapticPress();
        setCreating(true);

        try {
            const taxiData: CreateTaxiRequest = {
                service_id: taxiForm.service_id,
                nom_chauffeur: taxiForm.nom_chauffeur,
                telephone: taxiForm.telephone,
                whatsapp: taxiForm.whatsapp,
                type_vehicule: taxiForm.type_vehicule,
                marque_modele: taxiForm.marque_modele,
                immatriculation: taxiForm.immatriculation,
                couleur: taxiForm.couleur,
                annee: taxiForm.annee,
                zone_intervention: taxiForm.zone_intervention,
                gps_actuel: location?.coords ? `${location.coords.latitude},${location.coords.longitude}` : undefined,
                tarif_base: taxiForm.tarif_base,
                tarif_par_km: taxiForm.tarif_par_km,
                devise: taxiForm.devise || detectedCurrency, // ✅ Utilise la devise détectée
                paiement_cash: taxiForm.paiement_cash ?? true,
                paiement_mobile_money: taxiForm.paiement_mobile_money ?? true,
                paiement_carte: taxiForm.paiement_carte ?? false,
                climatisation: taxiForm.climatisation ?? true,
                wifi: taxiForm.wifi ?? false,
            };

            const response = await taxiService.createTaxi(taxiData);

            if (response.success) {
                Alert.alert('Succès', 'Service taxi créé avec succès !', [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowCreateModal(false);
                            setTaxiForm({
                                devise: detectedCurrency, // ✅ Utilise la devise détectée
                                paiement_cash: true,
                                paiement_mobile_money: true,
                                paiement_carte: false,
                                climatisation: true,
                                wifi: false,
                            });
                            setViewMode('search');
                            loadNearbyTaxis();
                        },
                    },
                ]);
            } else {
                Alert.alert('Erreur', 'Impossible de créer le service taxi');
            }
        } catch (err: any) {
            console.error('[TaxiHomeScreen] Erreur création:', err);
            Alert.alert('Erreur', err.message || 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'N/A';
        return `${price.toLocaleString()} FCFA`;
    };

    const formatDistance = (distance?: number) => {
        if (!distance) return '';
        if (distance < 1) return `${Math.round(distance * 1000)}m`;
        return `${distance.toFixed(1)} km`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec mode toggle */}
            {/* ✅ REFONDU: Header avec fond blanc pour meilleur contraste */}
            <View style={styles.headerContainer}>
                <View style={styles.headerGradient}>
                    {/* ✅ MODIFIÉ: Barre d'actions en haut avec boutons isolés gauche/droite */}
                    <View style={styles.headerActionsBar}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                // ✅ CORRIGÉ: Navigation vers l'écran de création de profil chauffeur
                                // Essayer d'abord PartnerRegister, sinon CovoiturageForm en mode driver
                                try {
                                    (navigation as any).navigate('PartnerRegister', {
                                        partner_type: 'chauffeur',
                                    });
                                } catch (err) {
                                    // Fallback: naviguer vers TaxiForm en mode driver
                                    console.log('[TaxiHomeScreen] PartnerRegister non disponible, redirection vers TaxiForm');
                                    (navigation as any).navigate('TaxiForm', {
                                        mode: 'driver_profile',
                                    });
                                }
                            }}
                            style={styles.registerDriverButtonLeft}
                        >
                            <SafeIcon name="user" size={18} color="#06B6D4" type="lucide" />
                            <Text style={styles.registerDriverTextLeft} numberOfLines={1} adjustsFontSizeToFit>
                                Devenir chauffeur
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                if (!isDriverValidated) {
                                    toaster.warning('Vous devez d\'abord vous enregistrer comme chauffeur avant de pouvoir publier un service taxi.');
                                    return;
                                }
                                (navigation as any).navigate('TaxiForm', {
                                    mode: 'create',
                                });
                            }}
                            style={[
                                styles.publishServiceButtonRight,
                                !isDriverValidated && styles.publishServiceButtonRightDisabled
                            ]}
                            disabled={checkingDriverStatus}
                        >
                            <SafeIcon 
                                name="plus" 
                                size={18} 
                                color={isDriverValidated ? "#FFFFFF" : "#FFFFFF"} 
                                type="lucide" 
                            />
                            <Text style={[
                                styles.publishServiceTextRight,
                                !isDriverValidated && styles.publishServiceTextRightDisabled
                            ]} numberOfLines={1} adjustsFontSizeToFit>
                                Publier un service
                            </Text>
                        </TouchableOpacity>
                    </View>
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                navigation.goBack();
                            }}
                            style={styles.backButton}
                        >
                            <SafeIcon name="arrow-left" size={24} color="#111827" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>
                                {viewMode === 'search' ? 'Rechercher un taxi' : 'Créer un service taxi'}
                            </Text>
                            {viewMode === 'search' && totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} taxi{totalResults > 1 ? 's' : ''} disponible{totalResults > 1 ? 's' : ''}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* ✅ MODIFIÉ: Barre de recherche avec départ/destination empilés verticalement pour plus d'espace */}
                    {viewMode === 'search' && (
                        <View style={styles.searchContainer}>
                            {/* Champs départ et destination empilés verticalement */}
                            <View style={styles.routeContainer}>
                                <View style={styles.routeColumn}>
                                    {/* Départ - Initialisé avec position GPS, modifiable */}
                                    <View style={styles.routeInputContainer}>
                                        <Text style={styles.routeLabel}>
                                            <SafeIcon name="map-pin" size={12} color="#6B7280" type="lucide" /> Départ
                                        </Text>
                                        <LocationSelector
                                            label=""
                                            value={typeof depart === 'string' ? (depart ? { raw: depart, place_name: depart } : '') : depart}
                                            onSelect={(location: LocationObject) => {
                                                hapticPress();
                                                setDepart(location);
                                                setInitializingDepart(false); // ✅ Marquer qu'on a modifié manuellement
                                                // ✅ MODIFIÉ: Ne plus lancer automatiquement la recherche
                                            }}
                                            placeholder={initializingDepart ? "Chargement position..." : "Modifier le départ"}
                                            scope="all"
                                            enrichWithBackend={true}
                                        />
                                        {depart && !initializingDepart && (
                                            <TouchableOpacity
                                                style={styles.useCurrentLocationButton}
                                                onPress={async () => {
                                                    hapticPress();
                                                    if (location?.coords) {
                                                        try {
                                                            const address = await getLocationAddress(location);
                                                            
                                                            if (address) {
                                                                const locationObject: LocationObject = {
                                                                    raw: address,
                                                                    place_name: address,
                                                                    components: {
                                                                        ville: address.split(',')[0] || address,
                                                                    },
                                                                    geometry: {
                                                                        coordinates: [location.coords.longitude, location.coords.latitude],
                                                                        type: 'Point',
                                                                    },
                                                                };
                                                                setDepart(locationObject);
                                                            } else {
                                                                const locationObject: LocationObject = {
                                                                    raw: `Position actuelle (${location.coords.latitude.toFixed(6)}, ${location.coords.longitude.toFixed(6)})`,
                                                                    place_name: 'Ma position actuelle',
                                                                    components: {},
                                                                    geometry: {
                                                                        coordinates: [location.coords.longitude, location.coords.latitude],
                                                                        type: 'Point',
                                                                    },
                                                                };
                                                                setDepart(locationObject);
                                                            }
                                                        } catch (err) {
                                                            console.warn('[TaxiHomeScreen] Erreur récupération position:', err);
                                                        }
                                                    }
                                                }}
                                            >
                                                <SafeIcon name="crosshair" size={14} color="#06B6D4" type="lucide" />
                                                <Text style={styles.useCurrentLocationText}>Utiliser ma position</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                    
                                    {/* Destination - Obligatoire, lieu précis via autocomplete Google */}
                                    <View style={styles.routeInputContainer}>
                                        <Text style={styles.routeLabel}>
                                            <SafeIcon name="navigation" size={12} color="#6B7280" type="lucide" /> Destination *
                                        </Text>
                                        <LocationSelector
                                            label=""
                                            value={typeof destination === 'string' ? (destination ? { raw: destination, place_name: destination } : '') : destination}
                                            onSelect={(location: LocationObject) => {
                                                hapticPress();
                                                setDestination(location);
                                                // ✅ MODIFIÉ: Ne plus lancer automatiquement la recherche
                                            }}
                                            placeholder="Choisir une destination précise"
                                            scope="all"
                                            enrichWithBackend={true}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Filtres */}
                            <View style={styles.filtersRow}>
                                <TouchableOpacity
                                    style={[styles.filterChip, availableOnly && styles.filterChipActive]}
                                    onPress={() => {
                                        hapticPress();
                                        setAvailableOnly(!availableOnly);
                                    }}
                                >
                                    <SafeIcon 
                                        name={availableOnly ? 'check-circle' : 'circle'} 
                                        size={16} 
                                        color={availableOnly ? '#FFFFFF' : '#06B6D4'} 
                                        type="lucide" 
                                    />
                                    <Text style={[styles.filterChipText, availableOnly && styles.filterChipTextActive]}>
                                        Disponibles uniquement
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* ✅ MODIFIÉ: Bouton de recherche toujours visible et activé uniquement quand départ et destination sont remplis */}
                            <TouchableOpacity
                                style={[
                                    styles.searchButton,
                                    (!canSearch() || loading) && styles.searchButtonDisabled
                                ]}
                                onPress={handleSearch}
                                disabled={!canSearch() || loading}
                                activeOpacity={0.7}
                            >
                                {loading ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <SafeIcon name="search" size={18} color={canSearch() ? "#FFFFFF" : "#9CA3AF"} type="lucide" />
                                        <Text 
                                            style={[styles.searchButtonText, !canSearch() && styles.searchButtonTextDisabled]}
                                            numberOfLines={1}
                                        >
                                            Rechercher
                                        </Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    )}
                </View>
            </View>

            {/* Contenu selon le mode */}
            {viewMode === 'search' ? (
                // Mode recherche : Liste des taxis
                !hasSearched && !loading ? (
                    <View style={styles.centerContainer}>
                        <SafeIcon name="map-pin" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Sélectionnez votre trajet</Text>
                        <Text style={styles.emptySubtext} numberOfLines={3}>
                            Choisissez un point de départ et une destination précise, puis cliquez sur "Rechercher"
                        </Text>
                    </View>
                ) : loading && taxis.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Recherche de taxis...</Text>
                    </View>
                ) : error && taxis.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <SafeIcon name="taxi" size={64} color="#9CA3AF" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={loadNearbyTaxis}
                        >
                            <Text style={styles.retryButtonText}>Réessayer</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={taxis}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <TaxiCard
                                taxi={item}
                                onPress={() => navigation.navigate('TaxiDetails' as never, { taxiId: item.id } as never)}
                                onCall={() => {
                                    hapticPress();
                                    Alert.alert(
                                        'Appeler le taxi',
                                        `Voulez-vous appeler ${item.nom_chauffeur || item.telephone} ?`,
                                        [
                                            { text: 'Annuler' },
                                            { 
                                                text: 'Appeler', 
                                                onPress: () => {
                                                    // TODO: Implémenter l'appel
                                                    Alert.alert('Appel', `Appel vers ${item.telephone}`);
                                                }
                                            },
                                        ]
                                    );
                                }}
                                onBook={() => {
                                    hapticPress();
                                    navigation.navigate('TaxiBooking' as never, { 
                                        taxiId: item.id,
                                        depart: typeof depart === 'object' ? (depart as LocationObject)?.place_name : depart,
                                        destination: typeof destination === 'object' ? (destination as LocationObject)?.place_name : destination,
                                    } as never);
                                }}
                                formatPrice={formatPrice}
                                formatDistance={formatDistance}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    loadNearbyTaxis();
                                }}
                                colors={[modernColors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <SafeIcon name="taxi" size={64} color="#9CA3AF" />
                                <Text style={styles.emptyText}>Aucun taxi trouvé</Text>
                                <Text style={styles.emptySubtext} numberOfLines={2}>
                                    Essayez de modifier vos critères de recherche
                                </Text>
                            </View>
                        }
                    />
                )
            ) : (
                // Mode création : Formulaire
                <CreateTaxiForm
                    taxiForm={taxiForm}
                    onFormChange={setTaxiForm}
                    onCreate={handleCreateTaxi}
                    creating={creating}
                    location={location}
                />
            )}
        </SafeNativeView>
    );
};

// Composant Card pour un taxi
interface TaxiCardProps {
    taxi: Taxi;
    onPress: () => void;
    onCall: () => void;
    onBook: () => void;
    formatPrice: (price?: number) => string;
    formatDistance: (distance?: number) => string;
}

const TaxiCard: React.FC<TaxiCardProps> = ({ taxi, onPress, onCall, onBook, formatPrice, formatDistance }) => {
    return (
        <TouchableOpacity style={styles.taxiCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.taxiHeader}>
                <View style={styles.taxiInfo}>
                    <View style={styles.taxiIconContainer}>
                        <SafeIcon name="taxi" size={32} color="#06B6D4" type="lucide" />
                    </View>
                    <View style={styles.taxiDetails}>
                        <Text style={styles.taxiName} numberOfLines={1}>
                            {taxi.nom_chauffeur || `Taxi ${taxi.telephone}`}
                        </Text>
                        <Text style={styles.taxiPhone}>{taxi.telephone}</Text>
                        {taxi.type_vehicule && (
                            <Text style={styles.taxiVehicle}>
                                {taxi.type_vehicule} {taxi.marque_modele && `• ${taxi.marque_modele}`}
                            </Text>
                        )}
                    </View>
                </View>
                {taxi.is_available ? (
                    <View style={styles.availableBadge}>
                        <View style={styles.availableDot} />
                        <Text style={styles.availableText}>Disponible</Text>
                    </View>
                ) : (
                    <View style={styles.unavailableBadge}>
                        <Text style={styles.unavailableText}>Occupé</Text>
                    </View>
                )}
            </View>

            {taxi.distance_km && (
                <View style={styles.taxiMeta}>
                    <View style={styles.taxiMetaItem}>
                        <SafeIcon name="map-pin" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.taxiMetaText}>
                            {formatDistance(taxi.distance_km)} de vous
                        </Text>
                    </View>
                </View>
            )}

            <View style={styles.taxiFeatures}>
                {taxi.climatisation && (
                    <View style={styles.featureChip}>
                        <SafeIcon name="wind" size={12} color="#6B7280" type="lucide" />
                        <Text style={styles.featureChipText}>Climatisation</Text>
                    </View>
                )}
                {taxi.wifi && (
                    <View style={styles.featureChip}>
                        <SafeIcon name="wifi" size={12} color="#6B7280" type="lucide" />
                        <Text style={styles.featureChipText}>WiFi</Text>
                    </View>
                )}
                {taxi.paiement_cash && (
                    <View style={styles.featureChip}>
                        <SafeIcon name="dollar-sign" size={12} color="#6B7280" type="lucide" />
                        <Text style={styles.featureChipText}>Cash</Text>
                    </View>
                )}
                {taxi.paiement_mobile_money && (
                    <View style={styles.featureChip}>
                        <SafeIcon name="smartphone" size={12} color="#6B7280" type="lucide" />
                        <Text style={styles.featureChipText}>Mobile Money</Text>
                    </View>
                )}
            </View>

            {taxi.tarif_base && (
                <View style={styles.taxiPricing}>
                    <Text style={styles.pricingLabel}>Tarif de base:</Text>
                    <Text style={styles.pricingValue}>{formatPrice(taxi.tarif_base)}</Text>
                    {taxi.tarif_par_km && (
                        <Text style={styles.pricingKm}>+ {formatPrice(taxi.tarif_par_km)}/km</Text>
                    )}
                </View>
            )}

            <View style={styles.taxiFooter}>
                {taxi.rating && (
                    <View style={styles.ratingContainer}>
                        <SafeIcon name="star" size={14} color="#F59E0B" type="lucide" />
                        <Text style={styles.ratingText}>{taxi.rating.toFixed(1)}</Text>
                    </View>
                )}
                <View style={styles.actionButtons}>
                    <TouchableOpacity
                        style={styles.callButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onCall();
                        }}
                    >
                        <SafeIcon name="phone" size={16} color="#FFFFFF" type="lucide" />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.bookButton}
                        onPress={(e) => {
                            e.stopPropagation();
                            onBook();
                        }}
                    >
                        <SafeIcon name="navigation" size={16} color="#FFFFFF" type="lucide" />
                        <Text style={styles.bookButtonText}>Réserver</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};

// Formulaire de création de service taxi
interface CreateTaxiFormProps {
    taxiForm: Partial<CreateTaxiRequest>;
    onFormChange: (form: Partial<CreateTaxiRequest>) => void;
    onCreate: () => void;
    creating: boolean;
    location: any;
}

const CreateTaxiForm: React.FC<CreateTaxiFormProps> = ({
    taxiForm,
    onFormChange,
    onCreate,
    creating,
    location,
}) => {
    return (
        <KeyboardAwareScreen style={styles.formContainer} contentContainerStyle={styles.formContent}>
            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Informations du chauffeur *</Text>
                <NativeInput
                    placeholder="Nom du chauffeur"
                    value={taxiForm.nom_chauffeur || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, nom_chauffeur: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Téléphone *"
                    value={taxiForm.telephone || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, telephone: text })}
                    keyboardType="phone-pad"
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="WhatsApp (optionnel)"
                    value={taxiForm.whatsapp || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, whatsapp: text })}
                    keyboardType="phone-pad"
                    style={styles.formInput}
                />
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Véhicule</Text>
                <NativeInput
                    placeholder="Type de véhicule (ex: Berline, SUV)"
                    value={taxiForm.type_vehicule || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, type_vehicule: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Marque et modèle (ex: Toyota Corolla)"
                    value={taxiForm.marque_modele || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, marque_modele: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Immatriculation"
                    value={taxiForm.immatriculation || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, immatriculation: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Couleur"
                    value={taxiForm.couleur || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, couleur: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Année"
                    value={taxiForm.annee?.toString() || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, annee: parseInt(text) || undefined })}
                    keyboardType="numeric"
                    style={styles.formInput}
                />
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Tarifs</Text>
                <NativeInput
                    placeholder="Tarif de base (FCFA)"
                    value={taxiForm.tarif_base?.toString() || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, tarif_base: parseInt(text) || undefined })}
                    keyboardType="numeric"
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Tarif par km (FCFA)"
                    value={taxiForm.tarif_par_km?.toString() || ''}
                    onChangeText={(text) => onFormChange({ ...taxiForm, tarif_par_km: parseInt(text) || undefined })}
                    keyboardType="numeric"
                    style={styles.formInput}
                />
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Options</Text>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...taxiForm, climatisation: !taxiForm.climatisation })}
                    >
                        {taxiForm.climatisation && <SafeIcon name="check" size={16} color="#06B6D4" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Climatisation</Text>
                </View>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...taxiForm, wifi: !taxiForm.wifi })}
                    >
                        {taxiForm.wifi && <SafeIcon name="check" size={16} color="#06B6D4" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>WiFi</Text>
                </View>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Modes de paiement</Text>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...taxiForm, paiement_cash: !taxiForm.paiement_cash })}
                    >
                        {taxiForm.paiement_cash && <SafeIcon name="check" size={16} color="#06B6D4" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Espèces</Text>
                </View>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...taxiForm, paiement_mobile_money: !taxiForm.paiement_mobile_money })}
                    >
                        {taxiForm.paiement_mobile_money && <SafeIcon name="check" size={16} color="#06B6D4" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Mobile Money</Text>
                </View>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...taxiForm, paiement_carte: !taxiForm.paiement_carte })}
                    >
                        {taxiForm.paiement_carte && <SafeIcon name="check" size={16} color="#06B6D4" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Carte bancaire</Text>
                </View>
            </View>

            <NativeButton
                title={creating ? 'Création en cours...' : 'Créer le service taxi'}
                onPress={onCreate}
                variant="primary"
                disabled={creating}
                style={styles.submitButton}
            />
        </KeyboardAwareScreen>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    headerContainer: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
        zIndex: 10,
        width: '100%', // ✅ NOUVEAU: Assurer la largeur complète
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
        backgroundColor: '#FFFFFF',
        width: '100%', // ✅ NOUVEAU: Assurer la largeur complète
    },
    headerActionsBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 12,
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
    },
    backButton: {
        marginRight: 12,
    },
    headerTitleContainer: {
        flex: 1,
    },
    registerDriverButtonLeft: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#F3F4F6',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    registerDriverTextLeft: {
        fontSize: 13,
        fontWeight: '600',
        color: '#06B6D4',
        flexShrink: 1,
    },
    publishServiceButtonRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#06B6D4',
    },
    publishServiceButtonRightDisabled: {
        backgroundColor: '#D1D5DB',
    },
    publishServiceTextRight: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    publishServiceTextRightDisabled: {
        color: '#9CA3AF',
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 2,
    },
    searchContainer: {
        marginTop: 8,
        width: '100%', // ✅ NOUVEAU: Assurer la largeur complète
    },
    // ✅ MODIFIÉ: Styles pour champs route empilés verticalement
    routeContainer: {
        marginBottom: 12,
        width: '100%', // ✅ NOUVEAU: Assurer la largeur complète
    },
    routeColumn: {
        flexDirection: 'column',
        gap: 12,
        width: '100%', // ✅ NOUVEAU: Assurer la largeur complète
    },
    routeInputContainer: {
        flex: 1,
        width: '100%',
        minHeight: 70, // ✅ NOUVEAU: Hauteur minimale pour garantir la visibilité
        marginBottom: 4, // ✅ NOUVEAU: Espacement entre les champs
    },
    routeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    useCurrentLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        paddingVertical: 6,
        paddingHorizontal: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    useCurrentLocationText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#06B6D4',
        flexShrink: 1,
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        marginBottom: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#111827',
    },
    locationSelector: {
        flex: 1,
    },
    clearButton: {
        padding: 4,
    },
    filtersRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 16,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        gap: 6,
    },
    filterChipActive: {
        backgroundColor: '#FFFFFF',
        borderColor: '#FFFFFF',
    },
    filterChipText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    filterChipTextActive: {
        color: '#06B6D4',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#06B6D4', // ✅ CORRIGÉ: Fond bleu au lieu de blanc
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginTop: 12,
        shadowColor: '#06B6D4',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
    },
    searchButtonDisabled: {
        backgroundColor: '#D1D5DB',
        shadowOpacity: 0,
        elevation: 0,
    },
    searchButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF', // ✅ CORRIGÉ: Texte blanc sur fond bleu
        flexShrink: 1,
    },
    searchButtonTextDisabled: {
        color: '#9CA3AF',
    },
    centerContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    errorText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#EF4444',
        textAlign: 'center',
    },
    retryButton: {
        marginTop: 16,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#06B6D4',
        borderRadius: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    listContent: {
        padding: 16,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
        minHeight: 400,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 18,
        fontWeight: '600',
        color: '#6B7280',
    },
    emptySubtext: {
        marginTop: 8,
        fontSize: 14,
        color: '#9CA3AF',
        textAlign: 'center',
        paddingHorizontal: 16,
    },
    // Taxi Card styles
    taxiCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 3,
    },
    taxiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    taxiInfo: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    taxiIconContainer: {
        width: 56,
        height: 56,
        borderRadius: 16,
        backgroundColor: '#E0F2FE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    taxiDetails: {
        flex: 1,
    },
    taxiName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    taxiPhone: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 4,
    },
    taxiVehicle: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    availableBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#D1FAE5',
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
        gap: 6,
    },
    availableDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#10B981',
    },
    availableText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#065F46',
    },
    unavailableBadge: {
        backgroundColor: '#FEE2E2',
        borderRadius: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },
    unavailableText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#991B1B',
    },
    taxiMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    taxiMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    taxiMetaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    taxiFeatures: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    featureChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
        gap: 6,
    },
    featureChipText: {
        fontSize: 12,
        color: '#6B7280',
    },
    taxiPricing: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    pricingLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    pricingValue: {
        fontSize: 16,
        fontWeight: '700',
        color: '#10B981',
    },
    pricingKm: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    taxiFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#F59E0B',
    },
    actionButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    callButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#10B981',
        justifyContent: 'center',
        alignItems: 'center',
    },
    callButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    bookButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#06B6D4',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        gap: 6,
    },
    bookButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Form styles
    formContainer: {
        flex: 1,
    },
    formContent: {
        padding: 16,
    },
    formSection: {
        marginBottom: 24,
    },
    formSectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
    },
    formInput: {
        marginBottom: 12,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#06B6D4',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxLabel: {
        fontSize: 14,
        color: '#111827',
    },
    submitButton: {
        marginTop: 8,
        marginBottom: 32,
    },
});

export default TaxiHomeScreen;

