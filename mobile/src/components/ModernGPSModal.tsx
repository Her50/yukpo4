import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import React, { useEffect, useRef, useState } from 'react';
import {
    Alert,
    Dimensions,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    TouchableWithoutFeedback,
    View
} from 'react-native';
import ENVIRONMENT from '../config/environment';
import { useLocation } from '../contexts/LocationContext';
import { useSavedAddresses } from '../hooks/useSavedAddresses';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import ErrorBoundary from './ErrorBoundary';
import InteractiveMapView from './InteractiveMapView';
import { LocationObject } from './LocationSelector';
import SafeIcon from './SafeIcon';

const { width, height } = Dimensions.get('window');

interface ModernGPSModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (coordinates: string) => void; // Format: "lat,lng" ou "lat1,lng1|lat2,lng2|..."
    currentLocation?: { lat: number; lng: number } | null;
    title?: string;
    allowZoneSelection?: boolean;
}

const ModernGPSModal: React.FC<ModernGPSModalProps> = ({
    visible,
    onClose,
    onSelect,
    currentLocation,
    title = 'Sélection de localisation GPS',
    allowZoneSelection = true
}) => {
    const { location: userLocation } = useLocation();
    const { createAddressFromLocation, addresses: savedAddresses } = useSavedAddresses('both');
    const [selectedLocation, setSelectedLocation] = useState<{ lat: number; lng: number } | null>(currentLocation || null);
    const [selectedPolygon, setSelectedPolygon] = useState<{ lat: number; lng: number }[]>([]);
    const [loading, setLoading] = useState(false);
    const [permissionGranted, setPermissionGranted] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [address, setAddress] = useState('');
    const [mapStyle, setMapStyle] = useState<'standard' | 'satellite' | 'hybrid'>('hybrid');
    const [zoneType, setZoneType] = useState<'point' | 'polygon'>('point');
    const [placeSuggestions, setPlaceSuggestions] = useState<any[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    // ✅ NOUVEAU 2026-01-04: États pour sauvegarder un lieu personnalisé
    const [showSaveLocationModal, setShowSaveLocationModal] = useState(false);
    const [saveLocationName, setSaveLocationName] = useState('');
    const [savingLocation, setSavingLocation] = useState(false);
    // ✅ NOUVEAU: Tracker si la sélection vient d'un clic manuel sur la carte
    const [isManualSelection, setIsManualSelection] = useState(false);
    // ✅ CRITIQUE: Ref pour le debounce de l'autocomplete (évite les appels API excessifs)
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    // ✅ Position dynamique des suggestions (mesurée via onLayout)
    const [suggestionsTop, setSuggestionsTop] = useState(170);

    useEffect(() => {
        if (visible) {
            // ✅ CRITIQUE: Appeler la fonction async mais ne pas retourner sa Promise
            requestLocationPermission().catch(error => {
                console.error('[ModernGPSModal] Erreur requestLocationPermission:', error);
            });

            // ✅ NOUVEAU: Toujours centrer sur la position GPS courante de l'utilisateur à l'ouverture
            if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
                const currentUserLocation = {
                    lat: userLocation.coords.latitude,
                    lng: userLocation.coords.longitude,
                };
                setSelectedLocation(currentUserLocation);
                // ✅ NOUVEAU: Réinitialiser isManualSelection à chaque ouverture
                setIsManualSelection(false);
                // Obtenir l'adresse par défaut pour cette position
                getAddressFromCoordinates(currentUserLocation.lat, currentUserLocation.lng).then(addr => {
                    setAddress(addr);
                }).catch(() => {
                    setAddress(`${currentUserLocation.lat.toFixed(6)}, ${currentUserLocation.lng.toFixed(6)}`);
                });
            } else if (currentLocation) {
                // Fallback sur currentLocation si pas de position GPS courante
                setSelectedLocation(currentLocation);
                setIsManualSelection(false);
            }
        }
        // ✅ CRITIQUE: Retourner explicitement undefined (pas de cleanup nécessaire ici)
        return undefined;
    }, [visible, userLocation]);

    const requestLocationPermission = async () => {
        try {
            // ✅ CORRECTION CRASH: Timeout pour éviter les blocages
            const permissionPromise = Location.requestForegroundPermissionsAsync();
            const timeoutPromise = new Promise<{ status: string }>((_, reject) =>
                setTimeout(() => reject(new Error('GPS permission timeout')), 10000)
            );

            const { status } = await Promise.race([permissionPromise, timeoutPromise as Promise<Location.LocationPermissionResponse>]);
            setPermissionGranted(status === 'granted');
            if (status !== 'granted') {
                Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation pour utiliser cette fonctionnalité.');
            }
        } catch (error: any) {
            console.error('[ModernGPSModal] ❌ Erreur permission:', error);
            if (error?.message?.includes('timeout')) {
                console.warn('[ModernGPSModal] ⚠️ Timeout permission GPS');
                setPermissionGranted(false);
            }
        }
    };

    const handleGetCurrentLocation = async () => {
        if (!permissionGranted) {
            Alert.alert('Permission requise', 'Veuillez autoriser l\'accès à la localisation.');
            return;
        }

        setLoading(true);
        // ✅ NOUVEAU: Marquer que c'est une sélection via bouton GPS (pas manuelle)
        setIsManualSelection(false);
        try {
            // ✅ CORRECTION CRASH: Timeout pour éviter les blocages
            const locationPromise = Location.getCurrentPositionAsync({
                accuracy: Location.Accuracy.Balanced, // Moins précis mais plus rapide
            });
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error('GPS location timeout')), 15000)
            );

            const location = await Promise.race([locationPromise, timeoutPromise]) as Location.LocationObject;

            const newLocation = {
                lat: location.coords.latitude,
                lng: location.coords.longitude,
            };

            setSelectedLocation(newLocation);

            // ✅ CORRECTION CRASH: Timeout pour le géocodage inverse
            try {
                const geocodePromise = Location.reverseGeocodeAsync({ latitude: newLocation.lat, longitude: newLocation.lng });
                const geocodeTimeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Geocoding timeout')), 10000)
                );

                const reverseGeocode = await Promise.race([geocodePromise, geocodeTimeout]) as Location.LocationGeocodedAddress[];

                if (reverseGeocode && reverseGeocode.length > 0) {
                    const addr = reverseGeocode[0];
                    const fullAddress = `${addr.street || ''} ${addr.streetNumber || ''}, ${addr.city || ''}, ${addr.region || ''}`.trim();
                    setAddress(fullAddress);
                }
            } catch (geocodeError: any) {
                console.warn('[ModernGPSModal] ⚠️ Géocodage échoué:', geocodeError?.message);
                // Utiliser les coordonnées comme fallback
                setAddress(`${newLocation.lat.toFixed(6)}, ${newLocation.lng.toFixed(6)}`);
            }

        } catch (error: any) {
            console.error('[ModernGPSModal] ❌ Erreur géolocalisation:', error);
            if (error?.message?.includes('timeout')) {
                Alert.alert('Timeout GPS', 'La géolocalisation prend trop de temps. Veuillez réessayer.');
            } else {
                Alert.alert('Erreur', 'Impossible d\'obtenir votre position actuelle.');
            }
        } finally {
            setLoading(false);
        }
    };

    // ✅ CRITIQUE: Autocomplete Google Places avec VRAI debounce (500ms)
    // ⚠️ CORRECTION 2026-02-19: Ajout d'un debounce réel pour éviter les appels API excessifs
    const handleSearchQueryChange = (query: string) => {
        setSearchQuery(query);

        // ✅ ANNULER le timer précédent si l'utilisateur continue à taper
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }

        if (!query.trim() || query.length < 3) {
            setPlaceSuggestions([]);
            setShowSuggestions(false);
            return;
        }

        // ✅ ATTENDRE 500ms avant d'appeler l'API (debounce réel)
        debounceTimerRef.current = setTimeout(async () => {
            try {
                // ✅ CORRIGÉ 2026-03-01: Utiliser le backend proxy au lieu d'appeler Google directement
                // Avantages: pas besoin d'exposer la clé API, gestion centralisée des filtres,
                // et pas de problème de placeholder 'SET_VIA_EAS_SECRET_OR_ENV'

                // Déterminer la position GPS pour le biais géographique
                let locationParams = '';
                if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
                    locationParams = `&lat=${userLocation.coords.latitude}&lng=${userLocation.coords.longitude}&radius=50000`;
                } else if (selectedLocation) {
                    locationParams = `&lat=${selectedLocation.lat}&lng=${selectedLocation.lng}&radius=50000`;
                } else if (currentLocation) {
                    locationParams = `&lat=${currentLocation.lat}&lng=${currentLocation.lng}&radius=50000`;
                }

                const backendUrl = `/api/places/autocomplete?query=${encodeURIComponent(query)}${locationParams}`;
                console.log('[ModernGPSModal] Backend proxy call:', backendUrl);

                const response = await apiGet<{
                    success: boolean;
                    data?: string[];
                    results?: Array<{ description: string; place_id?: string; types?: string[] }>;
                    error?: string;
                }>(backendUrl);

                // ✅ FIX 2026-03-03: apiGet retourne { success, data: <backend_json> }
                // Le backend retourne { success, data: string[], results: PlaceResult[] }
                // Donc les résultats sont dans backendResp.results et backendResp.data
                const backendResp = response.data as any;
                let googlePredictions: any[] = [];
                if (response.success && backendResp?.success && backendResp.results && backendResp.results.length > 0) {
                    googlePredictions = backendResp.results.map((r: any) => ({
                        place_id: r.place_id || '',
                        description: r.description,
                        types: r.types || [],
                        structured_formatting: {
                            main_text: r.description.split(',')[0]?.trim() || r.description,
                            secondary_text: r.description.split(',').slice(1).join(',').trim() || ''
                        }
                    }));
                } else if (response.success && backendResp?.success && Array.isArray(backendResp.data) && backendResp.data.length > 0) {
                    googlePredictions = backendResp.data.map((desc: string) => ({
                        place_id: '',
                        description: desc,
                        structured_formatting: {
                            main_text: desc.split(',')[0]?.trim() || desc,
                            secondary_text: desc.split(',').slice(1).join(',').trim() || ''
                        }
                    }));
                }

                // Ajouter les lieux sauvegardés aux suggestions
                const savedMatches = savedAddresses
                    .filter(addr =>
                        addr.label.toLowerCase().includes(query.toLowerCase()) ||
                        addr.address.toLowerCase().includes(query.toLowerCase())
                    )
                    .map(addr => ({
                        place_id: `saved_${addr.id}`,
                        description: `${addr.label} - ${addr.address}`,
                        structured_formatting: {
                            main_text: addr.label,
                            secondary_text: addr.address
                        },
                        is_saved: true,
                        saved_address: addr
                    }));

                // Combiner les suggestions (lieux sauvegardés en premier)
                const allSuggestions = [...savedMatches, ...googlePredictions];
                if (allSuggestions.length > 0) {
                    setPlaceSuggestions(allSuggestions);
                    setShowSuggestions(true);
                } else {
                    // Backend a retourné vide — afficher les lieux sauvegardés s'il y en a
                    if (savedMatches.length > 0) {
                        setPlaceSuggestions(savedMatches);
                        setShowSuggestions(true);
                    } else {
                        console.warn('[ModernGPSModal] Backend proxy retourne 0 résultats pour:', query);
                        setPlaceSuggestions([]);
                        setShowSuggestions(false);
                    }
                }
            } catch (error) {
                console.error('[ModernGPSModal] Erreur autocomplete:', error);
                // En cas d'erreur backend, réessayer une fois avec le backend proxy
                try {
                    let retryParams = '';
                    if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
                        retryParams = `&lat=${userLocation.coords.latitude}&lng=${userLocation.coords.longitude}&radius=50000`;
                    }
                    const retryUrl = `/api/places/autocomplete?query=${encodeURIComponent(query)}${retryParams}`;
                    console.log('[ModernGPSModal] Retry backend proxy:', retryUrl);
                    const retryResponse = await apiGet<{
                        success: boolean;
                        data?: string[];
                        results?: Array<{ description: string; place_id?: string; types?: string[] }>;
                    }>(retryUrl);
                    const retryBackend = retryResponse.data as any;
                    if (retryResponse.success && retryBackend?.success && retryBackend.results && retryBackend.results.length > 0) {
                        const retryPredictions = retryBackend.results.map((r: any) => ({
                            place_id: r.place_id || '',
                            description: r.description,
                            types: r.types || [],
                            structured_formatting: {
                                main_text: r.description.split(',')[0]?.trim() || r.description,
                                secondary_text: r.description.split(',').slice(1).join(',').trim() || ''
                            }
                        }));
                        setPlaceSuggestions(retryPredictions);
                        setShowSuggestions(true);
                    }
                } catch (retryErr) {
                    console.error('[ModernGPSModal] Erreur retry backend:', retryErr);
                }
            }
        }, 500); // ✅ DEBOUNCE 500ms - Réduit drastiquement les appels API
    };

    // ✅ NETTOYER le timer au démontage du composant
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }
        };
    }, []);

    const handleSelectSuggestion = async (placeId: string, description: string, suggestion?: any) => {
        try {
            setLoading(true);
            setShowSuggestions(false);
            setSearchQuery(description);
            // ✅ NOUVEAU: Marquer que c'est une sélection via recherche (pas manuelle)
            setIsManualSelection(false);

            // ✅ NOUVEAU 2026-01-04: Si c'est un lieu sauvegardé, utiliser directement ses coordonnées
            if (suggestion?.is_saved && suggestion?.saved_address) {
                const savedAddr = suggestion.saved_address;
                setSelectedLocation({ lat: savedAddr.latitude, lng: savedAddr.longitude });
                setAddress(savedAddr.address);
                setLoading(false);
                return;
            }

            // ✅ Récupérer les détails du lieu avec l'API Place Details
            const GOOGLE_MAPS_API_KEY = ENVIRONMENT.GOOGLE_MAPS_API_KEY;

            if (!GOOGLE_MAPS_API_KEY) {
                console.warn('[ModernGPSModal] ⚠️ Clé API Google Maps non configurée');
                // Fallback sur le géocodage standard
                const results = await Location.geocodeAsync(description);
                if (results.length > 0) {
                    const result = results[0];
                    setSelectedLocation({ lat: result.latitude, lng: result.longitude });
                    setAddress(description);
                }
                return;
            }

            const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=geometry&key=${GOOGLE_MAPS_API_KEY}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'OK' && data.result?.geometry?.location) {
                const { lat, lng } = data.result.geometry.location;
                setSelectedLocation({ lat, lng });
                setAddress(description);
            } else {
                // Fallback sur le géocodage standard
                const results = await Location.geocodeAsync(description);
                if (results.length > 0) {
                    const result = results[0];
                    setSelectedLocation({ lat: result.latitude, lng: result.longitude });
                    setAddress(description);
                }
            }
        } catch (error) {
            console.error('[ModernGPSModal] Erreur sélection suggestion:', error);
            Alert.alert('Erreur', 'Impossible de localiser ce lieu.');
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        setShowSuggestions(false);
        // ✅ NOUVEAU: Marquer que c'est une sélection via recherche (pas manuelle)
        setIsManualSelection(false);
        try {
            // ✅ NOUVEAU 2026-01-04: Vérifier d'abord dans les lieux sauvegardés
            const savedMatch = savedAddresses.find(addr =>
                addr.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                addr.address.toLowerCase().includes(searchQuery.toLowerCase())
            );

            if (savedMatch) {
                // Utiliser le lieu sauvegardé
                setSelectedLocation({ lat: savedMatch.latitude, lng: savedMatch.longitude });
                setAddress(savedMatch.address);
                setSearchQuery(savedMatch.label);
                setLoading(false);
                return;
            }

            // Sinon, rechercher via Google Places ou expo-location
            const results = await Location.geocodeAsync(searchQuery);
            if (results.length > 0) {
                const result = results[0];
                setSelectedLocation({ lat: result.latitude, lng: result.longitude });
                setAddress(searchQuery);
            } else {
                Alert.alert('Aucun résultat', 'Aucune adresse trouvée pour cette recherche.');
            }
        } catch (error) {
            console.error('Erreur recherche adresse:', error);
            Alert.alert('Erreur', 'Impossible de rechercher cette adresse.');
        } finally {
            setLoading(false);
        }
    };

    const handleLocationSelect = async (location: { lat: number; lng: number }) => {
        setSelectedLocation(location);
        // ✅ NOUVEAU: Marquer que c'est une sélection manuelle (clic sur la carte)
        setIsManualSelection(true);
        // ✅ NOUVEAU: Obtenir automatiquement l'adresse depuis Google lors de la sélection
        try {
            const address = await getAddressFromCoordinates(location.lat, location.lng);
            setAddress(address);
        } catch (error) {
            // Fallback sur les coordonnées si le géocodage échoue
            setAddress(`${location.lat.toFixed(6)}, ${location.lng.toFixed(6)}`);
        }
    };

    const handlePolygonPointsChange = (points: { lat: number; lng: number }[]) => {
        setSelectedPolygon(points);
        console.log(`[ModernGPSModal] Points de polygone mis à jour: ${points.length} points`);
    };

    const confirmSelection = async () => {
        if (zoneType === 'point') {
            if (!selectedLocation) {
                Alert.alert('Erreur', 'Veuillez sélectionner une position sur la carte.');
                return;
            }

            // ✅ NOUVEAU: Ouvrir le modal de nom de lieu UNIQUEMENT si c'est une sélection manuelle (clic sur la carte)
            // Si c'est une sélection via recherche, retourner directement les coordonnées
            if (isManualSelection) {
                // Obtenir l'adresse par défaut depuis Google (géocodage inverse)
                try {
                    const defaultAddress = await getAddressFromCoordinates(selectedLocation.lat, selectedLocation.lng);
                    // Proposer l'adresse comme nom par défaut
                    setSaveLocationName(defaultAddress);
                } catch (error) {
                    // Si le géocodage échoue, utiliser les coordonnées comme nom par défaut
                    setSaveLocationName(`${selectedLocation.lat.toFixed(6)}, ${selectedLocation.lng.toFixed(6)}`);
                }

                // Ouvrir le modal de sauvegarde de nom
                setShowSaveLocationModal(true);
            } else {
                // Sélection via recherche ou bouton GPS : retourner directement les coordonnées
                const coordsString = `${selectedLocation.lat},${selectedLocation.lng}`;
                onSelect(coordsString);
                onClose();
            }
        } else {
            if ((selectedPolygon || []).length < 3) {
                Alert.alert('Erreur', 'Veuillez sélectionner au moins 3 points pour créer une zone.');
                return;
            }
            const coordsString = (selectedPolygon || []).map(p => `${p.lat},${p.lng}`).join('|');
            onSelect(coordsString);
            onClose();
        }
    };

    const toggleMapStyle = () => {
        const styles: ('standard' | 'satellite' | 'hybrid')[] = ['satellite', 'standard', 'hybrid'];
        const currentIndex = styles.indexOf(mapStyle);
        const nextIndex = (currentIndex + 1) % styles.length;
        setMapStyle(styles[nextIndex]);
    };

    const getMapStyleText = () => {
        switch (mapStyle) {
            case 'satellite': return 'Satellite';
            case 'hybrid': return 'Hybride';
            default: return 'Standard';
        }
    };

    const clearPolygon = () => {
        setSelectedPolygon([]);
        setZoneType('point');
    };

    // ✅ NOUVEAU 2026-01-04: Fonction pour obtenir l'adresse depuis les coordonnées (reverse geocoding)
    const getAddressFromCoordinates = async (lat: number, lng: number): Promise<string> => {
        try {
            const GOOGLE_MAPS_API_KEY = ENVIRONMENT.GOOGLE_MAPS_API_KEY;

            if (GOOGLE_MAPS_API_KEY) {
                // Utiliser Google Geocoding API pour obtenir l'adresse
                const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=fr&key=${GOOGLE_MAPS_API_KEY}`;
                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.results && data.results.length > 0) {
                    return data.results[0].formatted_address;
                }
            }

            // Fallback: utiliser expo-location
            const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
            if (results.length > 0) {
                const result = results[0];
                const parts = [];
                if (result.street) parts.push(result.street);
                if (result.city) parts.push(result.city);
                if (result.region) parts.push(result.region);
                if (result.country) parts.push(result.country);
                return parts.join(', ') || `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
            }
        } catch (error) {
            console.error('[ModernGPSModal] Erreur reverse geocoding:', error);
        }

        // Fallback final: retourner les coordonnées
        return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
    };

    // ✅ NOUVEAU 2026-01-04: Fonction pour ouvrir le modal de sauvegarde
    const handleSaveLocation = () => {
        if (!selectedLocation) {
            Alert.alert('Erreur', 'Veuillez d\'abord sélectionner un lieu sur la carte.');
            return;
        }
        setSaveLocationName('');
        setShowSaveLocationModal(true);
    };

    // ✅ NOUVEAU 2026-01-04: Fonction pour sauvegarder le lieu avec un nom personnalisé
    const handleConfirmSaveLocation = async () => {
        if (!selectedLocation || !saveLocationName.trim()) {
            Alert.alert('Erreur', 'Veuillez entrer un nom pour ce lieu.');
            return;
        }

        setSavingLocation(true);
        try {
            // Obtenir l'adresse complète depuis les coordonnées
            const fullAddress = await getAddressFromCoordinates(selectedLocation.lat, selectedLocation.lng);

            // Créer un LocationObject depuis les coordonnées sélectionnées
            const locationObject: LocationObject = {
                raw: fullAddress,
                place_name: saveLocationName.trim(),
                components: {},
                coordinates: {
                    lat: selectedLocation.lat,
                    lng: selectedLocation.lng
                }
            };

            // ✅ NOUVEAU: Optionnel - Sauvegarder le lieu si l'utilisateur le souhaite (pour retrouver facilement)
            // On peut laisser cette fonctionnalité optionnelle, mais pour l'instant on ne force pas la sauvegarde

            // Retourner les coordonnées avec le nom du lieu
            const coordsString = `${selectedLocation.lat},${selectedLocation.lng}`;

            // Fermer le modal de sauvegarde
            setShowSaveLocationModal(false);
            setSaveLocationName('');
            setSavingLocation(false);

            // Appeler onSelect avec les coordonnées
            onSelect(coordsString);

            // Fermer le modal principal
            onClose();
        } catch (error: any) {
            console.error('[ModernGPSModal] Erreur sauvegarde lieu:', error);
            // Même en cas d'erreur, on continue avec les coordonnées
            const coordsString = `${selectedLocation.lat},${selectedLocation.lng}`;
            setShowSaveLocationModal(false);
            setSaveLocationName('');
            setSavingLocation(false);
            onSelect(coordsString);
            onClose();
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                {/* Header simplifié */}
                <LinearGradient
                    colors={[modernColors.primary, modernColors.primaryDark]}
                    style={styles.header}
                >
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        accessibilityLabel="Fermer"
                        accessibilityRole="button"
                    >
                        <SafeIcon name="arrow-left" size={22} color="#FFFFFF" />
                    </TouchableOpacity>

                    <Text style={styles.headerTitle} numberOfLines={1}>
                        Localisation GPS
                    </Text>

                    <TouchableOpacity style={styles.layerButton} onPress={toggleMapStyle}>
                        <SafeIcon name="layers" size={18} color="#FFFFFF" />
                        <Text style={styles.layerButtonText}>{getMapStyleText()}</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* Barre de recherche + contrôles — compacte et claire */}
                <View style={styles.searchBar} onLayout={(e) => {
                    const { y, height: h } = e.nativeEvent.layout;
                    setSuggestionsTop(y + h);
                }}>
                    {/* Champ de recherche principal */}
                    <View style={styles.searchInputRow}>
                        <SafeIcon name="search" size={18} color="#9CA3AF" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Hôpital, pharmacie, quartier, restaurant..."
                            value={searchQuery}
                            onChangeText={handleSearchQueryChange}
                            placeholderTextColor="#9CA3AF"
                            returnKeyType="search"
                            onSubmitEditing={handleSearch}
                            onFocus={() => {
                                if (placeSuggestions.length > 0) {
                                    setShowSuggestions(true);
                                }
                            }}
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => { setSearchQuery(''); setPlaceSuggestions([]); setShowSuggestions(false); }}>
                                <SafeIcon name="x-circle" size={18} color="#9CA3AF" />
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={styles.searchButton}
                            onPress={handleSearch}
                            disabled={loading}
                        >
                            <SafeIcon name="search" size={16} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Boutons rapides sous la recherche */}
                    <View style={styles.quickActions}>
                        {/* Mode Point / Zone */}
                        <View style={styles.modeToggle}>
                            <TouchableOpacity
                                style={[styles.modeBtn, zoneType === 'point' && styles.modeBtnActive]}
                                onPress={() => setZoneType('point')}
                            >
                                <SafeIcon name="map-pin" size={14} color={zoneType === 'point' ? '#FFF' : modernColors.primary} />
                                <Text style={[styles.modeBtnText, zoneType === 'point' && styles.modeBtnTextActive]}>Point</Text>
                            </TouchableOpacity>
                            {allowZoneSelection && (
                                <TouchableOpacity
                                    style={[styles.modeBtn, zoneType === 'polygon' && styles.modeBtnActive]}
                                    onPress={() => setZoneType('polygon')}
                                >
                                    <SafeIcon name="hexagon" size={14} color={zoneType === 'polygon' ? '#FFF' : modernColors.primary} />
                                    <Text style={[styles.modeBtnText, zoneType === 'polygon' && styles.modeBtnTextActive]}>Zone</Text>
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Bouton Ma position */}
                        <TouchableOpacity
                            style={styles.gpsBtn}
                            onPress={handleGetCurrentLocation}
                            disabled={loading}
                        >
                            <SafeIcon name={loading ? 'loader' : 'navigation'} size={16} color="#FFF" />
                            <Text style={styles.gpsBtnText}>Ma position</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ✅ FIX 2026-03-07: Suppression de TouchableWithoutFeedback qui empêchait */}
                {/* le rendu natif de MapView sur Android (interception des événements tactiles) */}
                <View style={styles.content}>
                    {/* Carte interactive - PLEIN ESPACE */}
                    <View style={styles.mapContainer}>
                        <ErrorBoundary
                            fallback={
                                <View style={[styles.map, styles.mapErrorContainer]}>
                                    <SafeIcon name="alert-circle" size={48} color="#EF4444" />
                                    <Text style={styles.mapErrorText}>
                                        Impossible de charger la carte
                                    </Text>
                                    <Text style={styles.mapErrorSubtext}>
                                        Vérifiez votre connexion internet et les permissions GPS
                                    </Text>
                                    <TouchableOpacity
                                        style={styles.retryButton}
                                        onPress={() => {
                                            onClose();
                                        }}
                                    >
                                        <SafeIcon name="refresh-cw" size={16} color="#FFFFFF" />
                                        <Text style={styles.retryButtonText}>Réessayer</Text>
                                    </TouchableOpacity>
                                </View>
                            }
                        >
                            <InteractiveMapView
                                selectedLocation={selectedLocation}
                                onLocationSelect={handleLocationSelect}
                                mapStyle={mapStyle}
                                zoneType={zoneType}
                                polygonPoints={selectedPolygon}
                                onPolygonPointsChange={handlePolygonPointsChange}
                                initialRegion={userLocation?.coords?.latitude && userLocation?.coords?.longitude ? {
                                    latitude: userLocation.coords.latitude,
                                    longitude: userLocation.coords.longitude,
                                    latitudeDelta: 0.01,
                                    longitudeDelta: 0.01,
                                } : undefined}
                            />
                        </ErrorBoundary>
                    </View>
                </View>

                {/* ✅ FIX 2026-03-03: Suggestions autocomplete rendues APRÈS la carte */}
                {/* Sur Android, les MapView natives ont leur propre surface de rendu qui */}
                {/* passe au-dessus des View React Native même avec zIndex élevé. */}
                {/* La seule solution fiable: rendre les suggestions APRÈS la carte dans le JSX. */}
                {showSuggestions && placeSuggestions.length > 0 && (
                    <View style={styles.suggestionsOverlay}>
                        <TouchableWithoutFeedback onPress={() => setShowSuggestions(false)}>
                            <View style={styles.suggestionsBackdrop} />
                        </TouchableWithoutFeedback>
                        <View style={[styles.suggestionsContainer, { top: suggestionsTop }]}>
                            <ScrollView
                                style={styles.suggestionsScrollView}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                {placeSuggestions.slice(0, 8).map((suggestion, index) => (
                                    <TouchableOpacity
                                        key={suggestion.place_id || index}
                                        style={[
                                            styles.suggestionItem,
                                            index === placeSuggestions.slice(0, 8).length - 1 && styles.suggestionItemLast,
                                            suggestion.is_saved && styles.suggestionItemSaved
                                        ]}
                                        onPress={() => handleSelectSuggestion(suggestion.place_id, suggestion.description, suggestion)}
                                    >
                                        <SafeIcon
                                            name={suggestion.is_saved ? "bookmark" : "map-pin"}
                                            size={14}
                                            color={suggestion.is_saved ? modernColors.primary : modernColors.textSecondary}
                                        />
                                        <View style={styles.suggestionTextContainer}>
                                            <Text style={styles.suggestionMainText} numberOfLines={1}>
                                                {suggestion.structured_formatting?.main_text || suggestion.description}
                                            </Text>
                                            {suggestion.structured_formatting?.secondary_text && (
                                                <Text style={styles.suggestionSecondaryText} numberOfLines={1}>
                                                    {suggestion.structured_formatting.secondary_text}
                                                </Text>
                                            )}
                                        </View>
                                        {suggestion.is_saved && (
                                            <View style={styles.savedBadge}>
                                                <Text style={styles.savedBadgeText}>Sauvegardé</Text>
                                            </View>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    </View>
                )}

                {/* Actions en bas */}
                <View style={styles.actionBar}>
                    <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
                        <Text style={styles.cancelButtonText}>Annuler</Text>
                    </TouchableOpacity>

                    {/* ✅ NOUVEAU 2026-01-04: Bouton "Sauvegarder ce lieu" (uniquement pour les points) */}
                    {zoneType === 'point' && selectedLocation && (
                        <TouchableOpacity
                            style={styles.saveLocationButton}
                            onPress={handleSaveLocation}
                        >
                            <SafeIcon name="bookmark" size={16} color="#FFFFFF" />
                            <Text style={styles.saveLocationButtonText}>Sauvegarder</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.confirmButton,
                            (((!selectedLocation && zoneType === 'point') || (selectedPolygon.length < 3 && zoneType === 'polygon')) ? styles.confirmButtonDisabled : null)
                        ]}
                        onPress={confirmSelection}
                        disabled={(!selectedLocation && zoneType === 'point') || (selectedPolygon.length < 3 && zoneType === 'polygon')}
                    >
                        <Text style={styles.confirmButtonText}>Confirmer</Text>
                    </TouchableOpacity>
                </View>

                {/* ✅ NOUVEAU 2026-01-04: Modal pour nommer et sauvegarder le lieu */}
                <Modal
                    visible={showSaveLocationModal}
                    animationType="slide"
                    transparent={true}
                    onRequestClose={() => setShowSaveLocationModal(false)}
                >
                    <View style={styles.saveModalOverlay}>
                        <View style={styles.saveModalContainer}>
                            <View style={styles.saveModalHeader}>
                                <SafeIcon name="map-pin" size={24} color={modernColors.primary} />
                                <Text style={styles.saveModalTitle}>Nommer ce lieu</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        // ✅ NOUVEAU: Annuler = fermer le modal GPS sans confirmer
                                        setShowSaveLocationModal(false);
                                        setSaveLocationName('');
                                    }}
                                    style={styles.saveModalCloseButton}
                                >
                                    <SafeIcon name="x" size={20} color={modernColors.text} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.saveModalContent}>
                                <Text style={styles.saveModalLabel}>
                                    Donnez un nom précis à ce lieu pour votre contexte
                                </Text>
                                <Text style={styles.saveModalHint}>
                                    Un nom par défaut vous est proposé. Vous pouvez le modifier selon vos besoins.
                                </Text>

                                <TextInput
                                    style={styles.saveModalInput}
                                    placeholder="Nom du lieu..."
                                    value={saveLocationName}
                                    onChangeText={setSaveLocationName}
                                    autoFocus={true}
                                    maxLength={50}
                                />

                                {selectedLocation && (
                                    <View style={styles.saveModalLocationInfo}>
                                        <SafeIcon name="map-pin" size={14} color={modernColors.textSecondary} />
                                        <Text style={styles.saveModalLocationText}>
                                            {selectedLocation.lat.toFixed(6)}, {selectedLocation.lng.toFixed(6)}
                                        </Text>
                                    </View>
                                )}

                                <View style={styles.saveModalActions}>
                                    <TouchableOpacity
                                        style={styles.saveModalCancelButton}
                                        onPress={() => {
                                            // ✅ NOUVEAU: Annuler = fermer le modal GPS sans confirmer
                                            setShowSaveLocationModal(false);
                                            setSaveLocationName('');
                                        }}
                                    >
                                        <Text style={styles.saveModalCancelText}>Annuler</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.saveModalConfirmButton,
                                            (!saveLocationName.trim() || savingLocation) && styles.saveModalConfirmButtonDisabled
                                        ]}
                                        onPress={handleConfirmSaveLocation}
                                        disabled={!saveLocationName.trim() || savingLocation}
                                    >
                                        {savingLocation ? (
                                            <Text style={styles.saveModalConfirmText}>Confirmation...</Text>
                                        ) : (
                                            <>
                                                <SafeIcon name="check" size={16} color="#FFFFFF" />
                                                <Text style={styles.saveModalConfirmText}>Confirmer</Text>
                                            </>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </View>
                    </View>
                </Modal>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        paddingTop: 50,
        gap: 12,
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        flex: 1,
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    layerButton: {
        flexDirection: 'row',
        height: 34,
        paddingHorizontal: 12,
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    layerButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    // Barre de recherche
    searchBar: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 10,
    },
    searchInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F3F4F6',
        borderRadius: 10,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 42,
        fontSize: 14,
        color: '#111827',
        fontWeight: '500',
    },
    searchButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickActions: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    modeToggle: {
        flexDirection: 'row',
        gap: 8,
    },
    modeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderRadius: 20,
        borderWidth: 1.5,
        borderColor: modernColors.primary,
        backgroundColor: '#FFF',
        gap: 6,
    },
    modeBtnActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    modeBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.primary,
    },
    modeBtnTextActive: {
        color: '#FFFFFF',
    },
    gpsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#10B981',
        gap: 6,
    },
    gpsBtnText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    content: {
        flex: 1,
        flexDirection: 'column',
    },
    // Overlay pour les suggestions autocomplete
    suggestionsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
    },
    suggestionsBackdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
    },
    // ✅ NOUVEAU: Styles pour l'autocomplete Google Places
    suggestionsContainer: {
        position: 'absolute',
        // top est passé dynamiquement via style inline (mesuré par onLayout)
        left: 12,
        right: 12,
        backgroundColor: '#FFFFFF',
        borderRadius: 8,
        maxHeight: 250,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 12,
        elevation: 10,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        overflow: 'hidden',
    },
    suggestionsScrollView: {
        maxHeight: 200,
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F3F4F6',
        gap: 10,
    },
    suggestionItemLast: {
        borderBottomWidth: 0,
    },
    suggestionItemSaved: {
        backgroundColor: '#F0FDF4',
        borderLeftWidth: 3,
        borderLeftColor: modernColors.primary,
    },
    savedBadge: {
        backgroundColor: modernColors.primary,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        marginLeft: 8,
    },
    savedBadgeText: {
        fontSize: 10,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    suggestionTextContainer: {
        flex: 1,
    },
    suggestionMainText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    suggestionSecondaryText: {
        fontSize: 11,
        fontWeight: '400',
        color: modernColors.textSecondary,
    },
    mapContainer: {
        flex: 1,
        backgroundColor: '#F3F4F6',
    },
    map: {
        flex: 1,
    },
    mapErrorContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#F9FAFB',
        padding: 20,
    },
    mapErrorText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#EF4444',
        marginTop: 16,
        textAlign: 'center',
    },
    mapErrorSubtext: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 8,
        textAlign: 'center',
        lineHeight: 20,
    },
    retryButton: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.primary,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
        marginTop: 20,
        gap: 8,
    },
    retryButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },
    actionBar: {
        flexDirection: 'row',
        paddingHorizontal: 20,
        paddingVertical: 16,
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        gap: 12,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    cancelButtonText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
    },
    confirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    confirmButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU 2026-01-04: Styles pour le bouton "Sauvegarder ce lieu"
    saveLocationButton: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: modernColors.success || '#10B981',
        gap: 6,
    },
    saveLocationButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    // ✅ NOUVEAU 2026-01-04: Styles pour le modal de sauvegarde
    saveModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    saveModalContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        width: '100%',
        maxWidth: 400,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    saveModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        gap: 12,
    },
    saveModalTitle: {
        flex: 1,
        fontSize: 18,
        fontWeight: '700',
        color: modernColors.text,
    },
    saveModalCloseButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#F3F4F6',
        justifyContent: 'center',
        alignItems: 'center',
    },
    saveModalContent: {
        padding: 20,
    },
    saveModalLabel: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 8,
    },
    saveModalHint: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginBottom: 16,
        fontStyle: 'italic',
    },
    saveModalInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        padding: 12,
        fontSize: 16,
        color: modernColors.text,
        backgroundColor: '#FFFFFF',
        marginBottom: 12,
    },
    saveModalLocationInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#F9FAFB',
        borderRadius: 8,
        marginBottom: 20,
        gap: 8,
    },
    saveModalLocationText: {
        fontSize: 12,
        color: modernColors.textSecondary,
        fontFamily: 'monospace',
    },
    saveModalActions: {
        flexDirection: 'row',
        gap: 12,
    },
    saveModalCancelButton: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
    },
    saveModalCancelText: {
        fontSize: 14,
        fontWeight: '500',
        color: modernColors.text,
    },
    saveModalConfirmButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        gap: 6,
    },
    saveModalConfirmButtonDisabled: {
        backgroundColor: '#D1D5DB',
    },
    saveModalConfirmText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});

export default ModernGPSModal;