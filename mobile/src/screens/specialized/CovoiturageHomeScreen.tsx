// ✅ Écran Covoiturage MODERNE - Refonte complète avec UX digne d'une app de covoiturage
// Structure claire : Recherche de trajets vs Création de trajet

import { LinearGradient } from 'expo-linear-gradient';
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
import DateTimePicker from '@react-native-community/datetimepicker';
import SafeIcon from '../../components/SafeIcon';
import { KeyboardAwareScreen } from '../../components/KeyboardAwareScreen';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { useLocation } from '../../contexts/LocationContext';
import { covoiturageService, Covoiturage, SearchCovoituragesFilters, CreateCovoiturageRequest } from '../../services/covoiturageService';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';
import { NativeButton, NativeInput } from '../../components/SafeNativeDesign';
import LocationSelector, { LocationObject } from '../../components/LocationSelector';
import { useCurrencyDetection } from '../../hooks/useCurrencyDetection';
import { useToaster } from '../../components/ToasterProvider';

type ViewMode = 'search' | 'create';

const CovoiturageHomeScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const { location } = useLocation();
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
                console.warn('[CovoiturageHomeScreen] Erreur vérification statut chauffeur:', error);
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
    const [dateDepart, setDateDepart] = useState(new Date());
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [covoiturages, setCovoiturages] = useState<Covoiturage[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [totalResults, setTotalResults] = useState(0);
    const [hasSearched, setHasSearched] = useState(false); // ✅ NOUVEAU: Indique si une recherche a été effectuée

    // États pour création de trajet
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [creating, setCreating] = useState(false);
    
    // ✅ NOUVEAU: Détection automatique de devise depuis GPS/localisation
    // Utiliser les états depart/destination qui sont déjà définis
    const detectedCurrency = useCurrencyDetection(
        typeof depart === 'object' ? depart : 
        typeof destination === 'object' ? destination : 
        undefined
    );
    
    const [trajetForm, setTrajetForm] = useState<Partial<CreateCovoiturageRequest>>({
        nombre_places: 4,
        places_disponibles: 3,
        prix_par_place: 0,
        devise: detectedCurrency, // ✅ Utilise la devise détectée automatiquement
        bagages_autorises: true,
        animaux_autorises: false,
        fumeur_autorise: false,
        climatisation: true,
    });

    // ✅ MODIFIÉ: Ne plus charger automatiquement à l'ouverture - l'utilisateur doit choisir départ/destination d'abord
    // useEffect supprimé - chargement uniquement via bouton de recherche

    const loadNearbyTrips = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            if (location?.coords) {
                const response = await covoiturageService.searchCovoituragesNearby(
                    location.coords.latitude,
                    location.coords.longitude,
                    50,
                    dateDepart.toISOString().split('T')[0]
                );
                
                if (response.success && response.data?.data) {
                    setCovoiturages(response.data.data);
                    setTotalResults(response.data.total || 0);
                } else {
                    setError('Aucun trajet trouvé à proximité');
                    setCovoiturages([]);
                }
            } else {
                // Recherche sans GPS
                const filters: SearchCovoituragesFilters = {
                    limit: 20,
                    page: 1,
                };
                const response = await covoiturageService.searchCovoiturages(filters);
                if (response.success && response.data?.data) {
                    setCovoiturages(response.data.data);
                    setTotalResults(response.data.total || 0);
                }
            }
        } catch (err: any) {
            console.error('[CovoiturageHomeScreen] Erreur chargement:', err);
            setError(err.message || 'Erreur lors du chargement');
            setCovoiturages([]);
        } finally {
            setLoading(false);
        }
    }, [location, dateDepart]);

    // ✅ NOUVEAU: Vérifier si le bouton de recherche doit être activé
    const canSearch = () => {
        const departStr = typeof depart === 'string' 
            ? depart.trim()
            : (depart as LocationObject)?.components?.ville || (depart as LocationObject)?.place_name || '';
        
        const destinationStr = typeof destination === 'string'
            ? destination.trim()
            : (destination as LocationObject)?.components?.ville || (destination as LocationObject)?.place_name || '';

        return !!departStr && !!destinationStr;
    };

    const handleSearch = async () => {
        hapticPress();
        
        // ✅ VALIDATION: Vérifier que départ et destination sont remplis
        const departStr = typeof depart === 'string' 
            ? depart.trim()
            : (depart as LocationObject)?.components?.ville || (depart as LocationObject)?.place_name || '';
        
        const destinationStr = typeof destination === 'string'
            ? destination.trim()
            : (destination as LocationObject)?.components?.ville || (destination as LocationObject)?.place_name || '';

        if (!departStr || !destinationStr) {
            Alert.alert('Erreur', 'Veuillez sélectionner une ville de départ et une ville de destination');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const filters: SearchCovoituragesFilters = {
                depart: departStr,
                destination: destinationStr,
                date_depart: dateDepart.toISOString().split('T')[0],
                limit: 50,
                page: 1,
            };

            if (location?.coords) {
                filters.lat = location.coords.latitude;
                filters.lng = location.coords.longitude;
                filters.radius_km = 100;
            }

            const response = await covoiturageService.searchCovoiturages(filters);
            
            if (response.success && response.data?.data) {
                setCovoiturages(response.data.data);
                setTotalResults(response.data.total || 0);
                setHasSearched(true); // ✅ NOUVEAU: Marquer qu'une recherche a été effectuée
                setError(null);
            } else {
                setError('Aucun trajet trouvé pour ce trajet');
                setCovoiturages([]);
                setHasSearched(true);
            }
        } catch (err: any) {
            console.error('[CovoiturageHomeScreen] Erreur recherche:', err);
            setError(err.message || 'Erreur lors de la recherche');
            setCovoiturages([]);
            setHasSearched(true);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTrajet = async () => {
        if (!trajetForm.depart?.trim() || !trajetForm.destination?.trim()) {
            Alert.alert('Erreur', 'Veuillez remplir le départ et la destination');
            return;
        }
        
        if (!trajetForm.service_id) {
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
            const trajetData: CreateCovoiturageRequest = {
                service_id: trajetForm.service_id!,
                depart: trajetForm.depart!.trim(),
                destination: trajetForm.destination!.trim(),
                gps_depart: trajetForm.gps_depart,
                gps_destination: trajetForm.gps_destination,
                date_depart: trajetForm.date_depart || dateDepart.toISOString(),
                heure_depart: trajetForm.heure_depart || '08:00',
                type_vehicule: trajetForm.type_vehicule,
                marque_modele: trajetForm.marque_modele,
                nombre_places: trajetForm.nombre_places || 4,
                places_disponibles: trajetForm.places_disponibles || 3,
                prix_par_place: trajetForm.prix_par_place || 0,
                devise: trajetForm.devise || 'FCFA',
                bagages_autorises: trajetForm.bagages_autorises ?? true,
                animaux_autorises: trajetForm.animaux_autorises ?? false,
                fumeur_autorise: trajetForm.fumeur_autorise ?? false,
                climatisation: trajetForm.climatisation ?? true,
            };

            const response = await covoiturageService.createCovoiturage(trajetData);

            if (response.success) {
                Alert.alert('Succès', 'Trajet créé avec succès !', [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowCreateModal(false);
                            setTrajetForm({
                                nombre_places: 4,
                                places_disponibles: 3,
                                prix_par_place: 0,
                                devise: detectedCurrency, // ✅ Utilise la devise détectée
                                bagages_autorises: true,
                                animaux_autorises: false,
                                fumeur_autorise: false,
                                climatisation: true,
                            });
                            setViewMode('search');
                            loadNearbyTrips();
                        },
                    },
                ]);
            } else {
                Alert.alert('Erreur', 'Impossible de créer le trajet');
            }
        } catch (err: any) {
            console.error('[CovoiturageHomeScreen] Erreur création:', err);
            Alert.alert('Erreur', err.message || 'Erreur lors de la création');
        } finally {
            setCreating(false);
        }
    };

    const formatDate = (date: Date) => {
        return date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
    };

    const formatTime = (time: string) => {
        return time;
    };

    const formatPrice = (price: number, devise?: string) => {
        const currency = devise || detectedCurrency; // ✅ Utilise la devise détectée si non fournie
        return `${price.toLocaleString()} ${currency}`;
    };

    return (
        <SafeNativeView style={styles.container}>
            {/* Header sticky avec mode toggle */}
            <View style={styles.headerContainer}>
                <LinearGradient
                    colors={viewMode === 'search' ? ['#3B82F6', '#60A5FA'] : ['#10B981', '#34D399']}
                    style={styles.headerGradient}
                >
                    {/* ✅ MODIFIÉ: Barre d'actions en haut avec boutons isolés gauche/droite */}
                    <View style={styles.headerActionsBar}>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                (navigation as any).navigate('PartnerRegister', {
                                    partner_type: 'chauffeur',
                                });
                            }}
                            style={styles.registerDriverButtonLeft}
                        >
                            <SafeIcon name="user-plus" size={18} color="#FFFFFF" type="lucide" />
                                        <Text style={styles.registerDriverTextLeft} numberOfLines={1} adjustsFontSizeToFit>
                                            Devenir chauffeur
                                        </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => {
                                hapticPress();
                                if (!isDriverValidated) {
                                    toaster.warning('Vous devez d\'abord vous enregistrer comme chauffeur avant de pouvoir publier un trajet.');
                                    return;
                                }
                                (navigation as any).navigate('CovoiturageForm', {
                                    mode: 'create',
                                });
                            }}
                            style={[
                                styles.publishTrajetButtonRight,
                                !isDriverValidated && styles.publishTrajetButtonRightDisabled
                            ]}
                            disabled={checkingDriverStatus}
                        >
                            <SafeIcon 
                                name="plus" 
                                size={18} 
                                color={isDriverValidated ? "#FFFFFF" : "#9CA3AF"} 
                                type="lucide" 
                            />
                            <Text style={[
                                styles.publishTrajetTextRight,
                                !isDriverValidated && styles.publishTrajetTextRightDisabled
                            ]} numberOfLines={1} adjustsFontSizeToFit>
                                Publier un trajet
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
                            <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                        </TouchableOpacity>
                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>
                                {viewMode === 'search' ? 'Rechercher un trajet' : 'Publier un trajet'}
                            </Text>
                            {viewMode === 'search' && totalResults > 0 && (
                                <Text style={styles.headerSubtitle}>
                                    {totalResults} trajet{totalResults > 1 ? 's' : ''} disponible{totalResults > 1 ? 's' : ''}
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
                                    {/* Départ */}
                                    <View style={styles.routeInputContainer}>
                                        <Text style={styles.routeLabel}>
                                            <SafeIcon name="map-pin" size={12} color="#FFFFFF" type="lucide" /> Départ
                                        </Text>
                                        <LocationSelector
                                            label=""
                                            value={typeof depart === 'string' ? (depart ? { raw: depart, place_name: depart } : '') : depart}
                                            onSelect={(location: LocationObject) => {
                                                hapticPress();
                                                setDepart(location);
                                                // ✅ MODIFIÉ: Ne plus lancer automatiquement la recherche
                                            }}
                                            placeholder="Ville de départ"
                                            scope="city"
                                            enrichWithBackend={true}
                                        />
                                    </View>
                                    
                                    {/* Destination */}
                                    <View style={styles.routeInputContainer}>
                                        <Text style={styles.routeLabel}>
                                            <SafeIcon name="navigation" size={12} color="#FFFFFF" type="lucide" /> Destination
                                        </Text>
                                        <LocationSelector
                                            label=""
                                            value={typeof destination === 'string' ? (destination ? { raw: destination, place_name: destination } : '') : destination}
                                            onSelect={(location: LocationObject) => {
                                                hapticPress();
                                                setDestination(location);
                                                // ✅ MODIFIÉ: Ne plus lancer automatiquement la recherche
                                            }}
                                            placeholder="Ville d'arrivée"
                                            scope="city"
                                            enrichWithBackend={true}
                                        />
                                    </View>
                                </View>
                            </View>

                            {/* Date de départ */}
                            <TouchableOpacity
                                style={styles.dateButton}
                                onPress={() => setShowDatePicker(true)}
                            >
                                <SafeIcon name="calendar" size={18} color="#3B82F6" type="lucide" />
                                <Text style={styles.dateButtonText}>
                                    {formatDate(dateDepart)}
                                </Text>
                            </TouchableOpacity>

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
                </LinearGradient>
            </View>

            {/* Contenu selon le mode */}
            {viewMode === 'search' ? (
                // Mode recherche : Liste des trajets
                !hasSearched && !loading ? (
                    <View style={styles.centerContainer}>
                        <SafeIcon name="map-pin" size={64} color="#9CA3AF" />
                        <Text style={styles.emptyText}>Sélectionnez votre trajet</Text>
                        <Text style={styles.emptySubtext} numberOfLines={3}>
                            Choisissez une ville de départ et une ville de destination, puis cliquez sur "Rechercher"
                        </Text>
                    </View>
                ) : loading && covoiturages.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.loadingText}>Recherche de trajets...</Text>
                    </View>
                ) : error && covoiturages.length === 0 ? (
                    <View style={styles.centerContainer}>
                        <SafeIcon name="car" size={64} color="#9CA3AF" />
                        <Text style={styles.errorText}>{error}</Text>
                        <TouchableOpacity
                            style={styles.retryButton}
                            onPress={loadNearbyTrips}
                        >
                            <Text style={styles.retryButtonText}>Réessayer</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <FlatList
                        data={covoiturages}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={({ item }) => (
                            <TrajetCard
                                trajet={item}
                                onPress={() => navigation.navigate('CovoiturageDetails' as never, { covoiturageId: item.id } as never)}
                                onReserve={() => {
                                    hapticPress();
                                    navigation.navigate('CovoiturageBooking' as never, { covoiturageId: item.id } as never);
                                }}
                                formatPrice={formatPrice}
                                formatTime={formatTime}
                            />
                        )}
                        contentContainerStyle={styles.listContent}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={() => {
                                    setRefreshing(true);
                                    loadNearbyTrips();
                                }}
                                colors={[modernColors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <SafeIcon name="car" size={64} color="#9CA3AF" />
                                <Text style={styles.emptyText}>Aucun trajet trouvé</Text>
                                <Text style={styles.emptySubtext} numberOfLines={2}>
                                    Essayez de modifier vos critères de recherche
                                </Text>
                            </View>
                        }
                    />
                )
            ) : (
                // Mode création : Formulaire
                <CreateTrajetForm
                    trajetForm={trajetForm}
                    onFormChange={setTrajetForm}
                    onCreate={handleCreateTrajet}
                    creating={creating}
                    dateDepart={dateDepart}
                    onDateChange={setDateDepart}
                    showDatePicker={showDatePicker}
                    onShowDatePicker={setShowDatePicker}
                    location={location}
                />
            )}

            {/* Date Picker */}
            {showDatePicker && (
                <DateTimePicker
                    value={dateDepart}
                    mode="date"
                    display="default"
                    minimumDate={new Date()}
                    onChange={(event, selectedDate) => {
                        setShowDatePicker(false);
                        if (selectedDate) {
                            setDateDepart(selectedDate);
                        }
                    }}
                />
            )}
        </SafeNativeView>
    );
};

// Composant Card pour un trajet
interface TrajetCardProps {
    trajet: Covoiturage;
    onPress: () => void;
    onReserve: () => void;
    formatPrice: (price: number, devise?: string) => string;
    formatTime: (time: string) => string;
}

const TrajetCard: React.FC<TrajetCardProps> = ({ trajet, onPress, onReserve, formatPrice, formatTime }) => {
    return (
        <TouchableOpacity style={styles.trajetCard} onPress={onPress} activeOpacity={0.7}>
            <View style={styles.trajetHeader}>
                <View style={styles.trajetRoute}>
                    <View style={styles.routePoint}>
                        <View style={styles.routePointIcon}>
                            <SafeIcon name="map-pin" size={12} color="#3B82F6" type="lucide" />
                        </View>
                        <View style={styles.routeLine} />
                    </View>
                    <View style={styles.routeInfo}>
                        <Text style={styles.routeDepart} numberOfLines={1}>
                            {trajet.depart || 'Départ non spécifié'}
                        </Text>
                        <View style={styles.routeLineHorizontal} />
                        <Text style={styles.routeDestination} numberOfLines={1}>
                            {trajet.destination || 'Destination non spécifiée'}
                        </Text>
                    </View>
                </View>
                <View style={styles.trajetPrice}>
                    <Text style={styles.trajetPriceText}>
                        {formatPrice(trajet.prix_par_place, trajet.devise)}
                    </Text>
                    <Text style={styles.trajetPriceLabel}>par place</Text>
                </View>
            </View>

            <View style={styles.trajetMeta}>
                <View style={styles.trajetMetaItem}>
                    <SafeIcon name="clock" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.trajetMetaText}>
                        {new Date(trajet.date_depart).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} à {formatTime(trajet.heure_depart)}
                    </Text>
                </View>
                <View style={styles.trajetMetaItem}>
                    <SafeIcon name="users" size={14} color="#6B7280" type="lucide" />
                    <Text style={styles.trajetMetaText}>
                        {trajet.places_disponibles}/{trajet.nombre_places} places
                    </Text>
                </View>
            </View>

            {trajet.type_vehicule && (
                <View style={styles.trajetFeatures}>
                    <View style={styles.featureChip}>
                        <SafeIcon name="car" size={12} color="#6B7280" type="lucide" />
                        <Text style={styles.featureChipText}>{trajet.type_vehicule}</Text>
                    </View>
                    {trajet.climatisation && (
                        <View style={styles.featureChip}>
                            <SafeIcon name="wind" size={12} color="#6B7280" type="lucide" />
                            <Text style={styles.featureChipText}>Climatisation</Text>
                        </View>
                    )}
                    {trajet.bagages_autorises && (
                        <View style={styles.featureChip}>
                            <SafeIcon name="luggage" size={12} color="#6B7280" type="lucide" />
                            <Text style={styles.featureChipText}>Bagages</Text>
                        </View>
                    )}
                </View>
            )}

            <View style={styles.trajetFooter}>
                {trajet.driver_name && (
                    <View style={styles.driverInfo}>
                        <SafeIcon name="user" size={14} color="#6B7280" type="lucide" />
                        <Text style={styles.driverName}>{trajet.driver_name}</Text>
                        {trajet.driver_rating && (
                            <View style={styles.ratingContainer}>
                                <SafeIcon name="star" size={12} color="#F59E0B" type="lucide" />
                                <Text style={styles.ratingText}>{trajet.driver_rating.toFixed(1)}</Text>
                            </View>
                        )}
                    </View>
                )}
                <TouchableOpacity
                    style={styles.reserveButton}
                    onPress={(e) => {
                        e.stopPropagation();
                        onReserve();
                    }}
                >
                    <Text style={styles.reserveButtonText}>Réserver</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

// Formulaire de création de trajet
interface CreateTrajetFormProps {
    trajetForm: Partial<CreateCovoiturageRequest>;
    onFormChange: (form: Partial<CreateCovoiturageRequest>) => void;
    onCreate: () => void;
    creating: boolean;
    dateDepart: Date;
    onDateChange: (date: Date) => void;
    showDatePicker: boolean;
    onShowDatePicker: (show: boolean) => void;
    location: any;
}

const CreateTrajetForm: React.FC<CreateTrajetFormProps> = ({
    trajetForm,
    onFormChange,
    onCreate,
    creating,
    dateDepart,
    onDateChange,
    showDatePicker,
    onShowDatePicker,
    location,
}) => {
    return (
        <KeyboardAwareScreen style={styles.formContainer} contentContainerStyle={styles.formContent}>
            {!trajetForm.service_id && (
                <View style={styles.serviceWarning}>
                    <SafeIcon name="info" size={20} color="#F59E0B" type="lucide" />
                    <Text style={styles.serviceWarningText}>
                        Vous devez d'abord créer un service pour publier un trajet
                    </Text>
                    <TouchableOpacity
                        style={styles.serviceWarningButton}
                        onPress={() => {
                            // Navigation vers création de service
                            Alert.alert('Créer un service', 'Redirection vers la création de service...');
                        }}
                    >
                        <Text style={styles.serviceWarningButtonText}>Créer un service</Text>
                    </TouchableOpacity>
                </View>
            )}
            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Itinéraire *</Text>
                <View style={styles.locationInputs}>
                    <View style={styles.locationInput}>
                        <View style={styles.locationIcon}>
                            <SafeIcon name="map-pin" size={16} color="#3B82F6" type="lucide" />
                        </View>
                        <LocationSelector
                            label="Lieu de départ"
                            value={trajetForm.depart as LocationObject | string || ''}
                            onSelect={(location) => {
                                const departStr = location?.place_name || '';
                                const gps = location?.geometry?.coordinates
                                    ? `${location.geometry.coordinates[1]},${location.geometry.coordinates[0]}`
                                    : undefined;
                                onFormChange({ ...trajetForm, depart: departStr, gps_depart: gps });
                            }}
                            placeholder="Lieu de départ *"
                            scope="all"
                        />
                    </View>
                    <View style={styles.locationInput}>
                        <View style={[styles.locationIcon, styles.locationIconDest]}>
                            <SafeIcon name="map-pin" size={16} color="#EF4444" type="lucide" />
                        </View>
                        <LocationSelector
                            label="Destination"
                            value={trajetForm.destination as LocationObject | string || ''}
                            onSelect={(location) => {
                                const destStr = location?.place_name || '';
                                const gps = location?.geometry?.coordinates
                                    ? `${location.geometry.coordinates[1]},${location.geometry.coordinates[0]}`
                                    : undefined;
                                onFormChange({ ...trajetForm, destination: destStr, gps_destination: gps });
                            }}
                            placeholder="Destination *"
                            scope="all"
                        />
                    </View>
                </View>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Date et heure *</Text>
                <TouchableOpacity
                    style={styles.dateInput}
                    onPress={() => onShowDatePicker(true)}
                >
                    <SafeIcon name="calendar" size={18} color="#3B82F6" type="lucide" />
                    <Text style={styles.dateInputText}>
                        {dateDepart.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </Text>
                </TouchableOpacity>
                <NativeInput
                    placeholder="Heure de départ (HH:MM) *"
                    value={trajetForm.heure_depart || ''}
                    onChangeText={(text) => onFormChange({ ...trajetForm, heure_depart: text })}
                    style={styles.formInput}
                />
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Véhicule</Text>
                <NativeInput
                    placeholder="Type de véhicule (ex: Berline, SUV)"
                    value={trajetForm.type_vehicule || ''}
                    onChangeText={(text) => onFormChange({ ...trajetForm, type_vehicule: text })}
                    style={styles.formInput}
                />
                <NativeInput
                    placeholder="Marque et modèle (ex: Toyota Corolla)"
                    value={trajetForm.marque_modele || ''}
                    onChangeText={(text) => onFormChange({ ...trajetForm, marque_modele: text })}
                    style={styles.formInput}
                />
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Places et prix *</Text>
                <View style={styles.placesRow}>
                    <View style={styles.placesInput}>
                        <Text style={styles.placesLabel}>Places totales</Text>
                        <NativeInput
                            value={trajetForm.nombre_places?.toString() || '4'}
                            onChangeText={(text) => onFormChange({ ...trajetForm, nombre_places: parseInt(text) || 4 })}
                            keyboardType="numeric"
                            style={styles.formInput}
                        />
                    </View>
                    <View style={styles.placesInput}>
                        <Text style={styles.placesLabel}>Places disponibles</Text>
                        <NativeInput
                            value={trajetForm.places_disponibles?.toString() || '3'}
                            onChangeText={(text) => onFormChange({ ...trajetForm, places_disponibles: parseInt(text) || 3 })}
                            keyboardType="numeric"
                            style={styles.formInput}
                        />
                    </View>
                </View>
                <View style={styles.priceRow}>
                    <NativeInput
                        placeholder="Prix par place (FCFA) *"
                        value={trajetForm.prix_par_place?.toString() || ''}
                        onChangeText={(text) => onFormChange({ ...trajetForm, prix_par_place: parseInt(text) || 0 })}
                        keyboardType="numeric"
                        style={styles.formInput}
                    />
                </View>
            </View>

            <View style={styles.formSection}>
                <Text style={styles.formSectionTitle}>Options</Text>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...trajetForm, bagages_autorises: !trajetForm.bagages_autorises })}
                    >
                        {trajetForm.bagages_autorises && <SafeIcon name="check" size={16} color="#3B82F6" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Bagages autorisés</Text>
                </View>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...trajetForm, animaux_autorises: !trajetForm.animaux_autorises })}
                    >
                        {trajetForm.animaux_autorises && <SafeIcon name="check" size={16} color="#3B82F6" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Animaux autorisés</Text>
                </View>
                <View style={styles.checkboxRow}>
                    <TouchableOpacity
                        style={styles.checkbox}
                        onPress={() => onFormChange({ ...trajetForm, climatisation: !trajetForm.climatisation })}
                    >
                        {trajetForm.climatisation && <SafeIcon name="check" size={16} color="#3B82F6" type="lucide" />}
                    </TouchableOpacity>
                    <Text style={styles.checkboxLabel}>Climatisation</Text>
                </View>
            </View>

            <NativeButton
                title={creating ? 'Publication en cours...' : 'Publier le trajet'}
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
    },
    headerGradient: {
        paddingTop: 20,
        paddingBottom: 16,
        paddingHorizontal: 16,
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
    headerTitle: {
        fontSize: 24,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    headerSubtitle: {
        fontSize: 12,
        color: 'rgba(255, 255, 255, 0.9)',
        marginTop: 2,
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
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
    },
    registerDriverTextLeft: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    publishTrajetButtonRight: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    publishTrajetButtonRightDisabled: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    publishTrajetTextRight: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        flexShrink: 1,
    },
    publishTrajetTextRightDisabled: {
        color: '#9CA3AF',
    },
    searchContainer: {
        marginTop: 8,
    },
    // ✅ MODIFIÉ: Styles pour champs route empilés verticalement
    routeContainer: {
        marginBottom: 12,
    },
    routeColumn: {
        flexDirection: 'column',
        gap: 12,
    },
    routeInputContainer: {
        flex: 1,
        width: '100%',
    },
    routeLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: 'rgba(255, 255, 255, 0.9)',
        marginBottom: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    dateButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 12,
        marginBottom: 12,
    },
    dateButtonText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    searchButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 16,
        paddingHorizontal: 24,
        marginTop: 12,
        shadowColor: '#3B82F6',
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
        color: '#3B82F6',
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
        backgroundColor: '#3B82F6',
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
    // Trajet Card styles
    trajetCard: {
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
    trajetHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    trajetRoute: {
        flex: 1,
        flexDirection: 'row',
        gap: 12,
    },
    routePoint: {
        alignItems: 'center',
    },
    routePointIcon: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#DBEAFE',
        justifyContent: 'center',
        alignItems: 'center',
    },
    routeLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 4,
    },
    routeInfo: {
        flex: 1,
    },
    routeDepart: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    routeLineHorizontal: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 8,
    },
    routeDestination: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    trajetPrice: {
        alignItems: 'flex-end',
    },
    trajetPriceText: {
        fontSize: 20,
        fontWeight: '700',
        color: '#10B981',
    },
    trajetPriceLabel: {
        fontSize: 12,
        color: '#6B7280',
    },
    trajetMeta: {
        flexDirection: 'row',
        gap: 16,
        marginBottom: 12,
    },
    trajetMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    trajetMetaText: {
        fontSize: 12,
        color: '#6B7280',
    },
    trajetFeatures: {
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
    trajetFooter: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    driverInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    driverName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    ratingContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginLeft: 8,
    },
    ratingText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#F59E0B',
    },
    reserveButton: {
        backgroundColor: '#3B82F6',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
    },
    reserveButtonText: {
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
    dateInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#E5E7EB',
    },
    dateInputText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#111827',
    },
    placesRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 12,
    },
    placesInput: {
        flex: 1,
    },
    placesLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B7280',
        marginBottom: 8,
    },
    priceRow: {
        marginTop: 8,
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
        borderColor: '#3B82F6',
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
    serviceWarning: {
        backgroundColor: '#FEF3C7',
        borderRadius: 12,
        padding: 16,
        marginBottom: 24,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
    },
    serviceWarningText: {
        flex: 1,
        fontSize: 14,
        color: '#92400E',
        lineHeight: 20,
    },
    serviceWarningButton: {
        backgroundColor: '#F59E0B',
        borderRadius: 8,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginTop: 8,
    },
    serviceWarningButtonText: {
        fontSize: 14,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});

export default CovoiturageHomeScreen;

