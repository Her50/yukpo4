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
                // ✅ Utiliser l'API Google Places Autocomplete depuis la configuration
                const GOOGLE_MAPS_API_KEY = ENVIRONMENT.GOOGLE_MAPS_API_KEY;

                if (!GOOGLE_MAPS_API_KEY) {
                    console.warn('[ModernGPSModal] ⚠️ Clé API Google Maps non configurée');
                    return;
                }

                // ✅ CORRIGÉ: Utiliser la localisation GPS réelle de l'utilisateur en priorité
                let locationBias: { lat: number; lng: number };
                if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
                    locationBias = {
                        lat: userLocation.coords.latitude,
                        lng: userLocation.coords.longitude
                    };
                } else if (selectedLocation) {
                    locationBias = selectedLocation;
                } else if (currentLocation) {
                    locationBias = currentLocation;
                } else {
                    // Fallback sur Douala, Cameroun
                    locationBias = { lat: 4.031716, lng: 9.817201 };
                }

                // ✅ CORRIGÉ 2026-02-25: Ajout components=country:cm pour biaiser vers le Cameroun
                // + strictbounds pour prioriser la zone autour de l'utilisateur
                // + PAS de paramètre types pour inclure TOUS les résultats:
                //   villes, quartiers, hôpitaux, pharmacies, restaurants, écoles, stations, etc.
                const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&location=${locationBias.lat},${locationBias.lng}&radius=50000&strictbounds=true&components=country:cm|country:ci|country:sn|country:cd|country:ga|country:cg|country:bf|country:ml|country:td|country:ne|country:gn|country:bj|country:tg&key=${GOOGLE_MAPS_API_KEY}&language=fr`;

                const response = await fetch(url);
                const data = await response.json();

                if (data.status === 'OK' && data.predictions) {
                    // ✅ NOUVEAU 2026-01-04: Ajouter les lieux sauvegardés aux suggestions
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

                    // Combiner les suggestions Google avec les lieux sauvegardés (lieux sauvegardés en premier)
                    setPlaceSuggestions([...savedMatches, ...data.predictions]);
                    setShowSuggestions(true);
                } else {
                    setPlaceSuggestions([]);
                    setShowSuggestions(false);
                }
            } catch (error) {
                console.error('[ModernGPSModal] Erreur autocomplete:', error);
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
                {/* Header compact et moderne - OPTIMISÉ */}
                <LinearGradient
                    colors={[modernColors.primary, modernColors.primaryDark]}
                    style={styles.header}
                >
                    <TouchableOpacity
                        style={styles.closeButton}
                        onPress={onClose}
                        accessibilityLabel="Fermer la sélection GPS"
                        accessibilityRole="button"
                    >
                        <SafeIcon name="x" size={20} color="#FFFFFF" />
                    </TouchableOpacity>

                    <View style={styles.headerContent}>
                        <SafeIcon name="map-pin" size={16} color="#FFFFFF" />
                        <Text
                            style={[styles.headerTitle, { flex: 1, marginHorizontal: 6 }]}
                            numberOfLines={1}
                            ellipsizeMode="middle"
                        >
                            {title}
                        </Text>
                        <View style={styles.headerIcons}>
                            <SafeIcon name="smartphone" size={12} color="#FFFFFF" />
                            <SafeIcon name="map" size={12} color="#FFFFFF" />
                        </View>
                    </View>

                    <TouchableOpacity style={styles.layerButton} onPress={toggleMapStyle}>
                        <SafeIcon name="layers" size={18} color="#FFFFFF" />
                        <Text style={styles.layerButtonText}>{getMapStyleText()}</Text>
                    </TouchableOpacity>
                </LinearGradient>

                {/* ✅ REFONTE COMPLÈTE: Barre de contrôles ultra-intuitive et compacte */}
                <View style={styles.topControlBar}>
                    {/* Mode de sélection - HORIZONTAL ET INTUITIF */}
                    <View style={[styles.topControlSection, { flex: 1.2 }]}>
                        <Text style={[styles.topControlLabel, { fontSize: 8, fontWeight: '700' }]} numberOfLines={1} ellipsizeMode="clip">Mode de sélection</Text>
                        <View style={styles.horizontalModeButtons}>
                            <TouchableOpacity
                                style={[
                                    styles.horizontalModeButton,
                                    styles.pointModeButton,
                                    zoneType === 'point' && styles.horizontalModeButtonActive
                                ]}
                                onPress={() => setZoneType('point')}
                            >
                                <SafeIcon
                                    name="circle"
                                    size={16}
                                    color={zoneType === 'point' ? '#FFFFFF' : modernColors.primary}
                                />
                            </TouchableOpacity>

                            {allowZoneSelection && (
                                <TouchableOpacity
                                    style={[
                                        styles.horizontalModeButton,
                                        styles.zoneModeButton,
                                        zoneType === 'polygon' && styles.horizontalModeButtonActive
                                    ]}
                                    onPress={() => setZoneType('polygon')}
                                >
                                    <SafeIcon
                                        name="maximize"
                                        size={16}
                                        color={zoneType === 'polygon' ? '#FFFFFF' : modernColors.primary}
                                    />
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    {/* Recherche d'adresse - AGRANDIE AVEC AUTOCOMPLETE */}
                    <View style={[styles.topControlSection, { flex: 2.5 }]}>
                        <View style={styles.controlHeader}>
                            <SafeIcon name="search" size={10} color={modernColors.success} />
                            <Text style={[styles.topControlLabel, { fontSize: 9, fontWeight: '700' }]} numberOfLines={1} ellipsizeMode="tail">RECHERCHE DE LIEU</Text>
                        </View>
                        <View style={styles.topSearchContainer}>
                            <TextInput
                                style={[styles.topSearchInput, { fontSize: 12, paddingHorizontal: 10, paddingVertical: 8 }]}
                                placeholder="Rechercher un lieu..."
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
                            <TouchableOpacity
                                style={styles.topSearchButton}
                                onPress={handleSearch}
                                disabled={loading}
                            >
                                <SafeIcon name="search" size={14} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Ma position GPS - SIMPLIFIÉ ET CLAIR */}
                    <View style={[styles.topControlSection, { flex: 0.8 }]}>
                        <Text style={[styles.topControlLabel, { fontSize: 8, fontWeight: '700' }]} numberOfLines={1} ellipsizeMode="clip">MA POS.</Text>
                        <TouchableOpacity
                            style={styles.topGPSButton}
                            onPress={handleGetCurrentLocation}
                            disabled={loading}
                        >
                            <SafeIcon
                                name={loading ? "loader" : "map-pin"}
                                size={16}
                                color="#FFFFFF"
                            />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ✅ NOUVEAU: Barre de coordonnées sous la barre principale */}
                <View style={styles.coordsBar}>
                    <View style={styles.coordsBarContent}>
                        <SafeIcon name="map-pin" size={12} color={modernColors.primary} />
                        <Text style={styles.coordsBarLabel}>COORDONNÉES:</Text>
                        {selectedLocation && selectedLocation.lat != null && selectedLocation.lng != null ? (
                            <Text style={styles.coordsBarValue} numberOfLines={1}>
                                {Number.isFinite(selectedLocation.lat) ? selectedLocation.lat.toFixed(6) : '0.000000'}, {Number.isFinite(selectedLocation.lng) ? selectedLocation.lng.toFixed(6) : '0.000000'}
                            </Text>
                        ) : (
                            <Text style={styles.coordsBarPlaceholder}>Aucune sélection</Text>
                        )}
                    </View>
                </View>

                {/* ✅ NOUVEAU: Suggestions autocomplete au-dessus de tout (y compris la carte) */}
                {showSuggestions && placeSuggestions.length > 0 && (
                    <View style={styles.suggestionsOverlay}>
                        <TouchableWithoutFeedback onPress={() => setShowSuggestions(false)}>
                            <View style={styles.suggestionsBackdrop} />
                        </TouchableWithoutFeedback>
                        <View style={styles.suggestionsContainer}>
                            <ScrollView
                                style={styles.suggestionsScrollView}
                                nestedScrollEnabled={true}
                                keyboardShouldPersistTaps="handled"
                            >
                                {placeSuggestions.slice(0, 5).map((suggestion, index) => (
                                    <TouchableOpacity
                                        key={suggestion.place_id || index}
                                        style={[
                                            styles.suggestionItem,
                                            index === placeSuggestions.slice(0, 5).length - 1 && styles.suggestionItemLast,
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

                <TouchableWithoutFeedback onPress={() => setShowSuggestions(false)}>
                    <View style={styles.content}>
                        {/* ✅ SUPPRIMÉ: Barre gauche pour maximiser l'espace carte */}
                        {/* Les coordonnées sont maintenant affichées en haut */}

                        {/* Carte interactive - PLUS D'ESPACE */}
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
                                                // Recharger en rouvrant
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
                </TouchableWithoutFeedback>

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
        paddingVertical: 12,
        paddingTop: 50, // Status bar
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 4,
    },
    closeButton: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        marginLeft: 12,
    },
    headerTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
        marginLeft: 6,
        flex: 1,
        textAlign: 'center',
    },
    headerIcons: {
        flexDirection: 'row',
        marginLeft: 8,
        gap: 4,
    },
    layerButton: {
        flexDirection: 'row',
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
    },
    layerButtonText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    content: {
        flex: 1,
        flexDirection: 'row',
    },
    leftPanel: {
        display: 'none', // ✅ SUPPRIMÉ COMPLÈTEMENT pour maximiser la carte
    },
    // ✅ NOUVEAU: Styles pour la barre de contrôle horizontale
    topControlBar: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        elevation: 2,
        gap: 10,
    },
    // ✅ NOUVEAU: Barre de coordonnées compacte
    coordsBar: {
        backgroundColor: '#F9FAFB',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    coordsBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    coordsBarLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#6B7280',
        letterSpacing: 0.3,
        textTransform: 'uppercase',
    },
    coordsBarValue: {
        fontSize: 10,
        fontWeight: '600',
        color: modernColors.primary,
        fontFamily: 'monospace',
        flex: 1,
    },
    coordsBarPlaceholder: {
        fontSize: 10,
        fontWeight: '500',
        color: '#9CA3AF',
        fontStyle: 'italic',
        flex: 1,
    },
    topControlSection: {
        flex: 1,
        minWidth: 0, // ✅ Pour permettre au flex de bien fonctionner
    },
    controlHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 4,
    },
    topControlLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#1F2937',
        letterSpacing: 0.2,
        textTransform: 'uppercase',
        includeFontPadding: false,
        textAlignVertical: 'center',
        flexShrink: 1,
    },
    topModeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    horizontalModeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    horizontalModeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        gap: 4,
        minHeight: 36,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    pointModeButton: {
        borderRadius: 20, // ✅ Forme arrondie (circulaire) pour "Point"
    },
    zoneModeButton: {
        borderRadius: 4, // ✅ Forme plus carrée pour "Zone"
    },
    horizontalModeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
        shadowOpacity: 0.2,
        elevation: 3,
    },
    horizontalModeButtonText: {
        fontSize: 10,
        fontWeight: '700',
        color: modernColors.primary,
        letterSpacing: 0.1,
        textAlign: 'center',
    },
    horizontalModeButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    topModeButton: {
        flex: 1,
        flexDirection: 'row', // ✅ CORRIGÉ: Horizontal au lieu de vertical
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#E5E7EB',
        backgroundColor: '#FFFFFF',
        gap: 8, // ✅ Augmenté de 4 à 8 pour plus d'espace entre icône et texte
        minHeight: 48, // ✅ RÉDUIT de 68 à 48 pour moins d'espace vertical
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 3,
        elevation: 2,
    },
    topModeButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
        shadowOpacity: 0.4,
        elevation: 5,
    },
    topModeButtonText: {
        fontSize: 13, // ✅ RÉDUIT de 14 à 13 pour meilleur fit
        fontWeight: '700',
        color: modernColors.primary,
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    topModeButtonTextActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },
    topSearchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    topSearchInput: {
        flex: 1,
        height: 36,
        borderWidth: 2,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 11,
        backgroundColor: '#FFFFFF',
        color: '#111827',
        fontWeight: '600',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    topSearchButton: {
        width: 36,
        height: 36,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: modernColors.primary,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 3,
    },
    // ✅ NOUVEAU: Overlay pour les suggestions (au-dessus de tout)
    suggestionsOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
        elevation: 9999,
        pointerEvents: 'box-none', // Permet les clics à travers le backdrop
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
        top: 140, // Position sous la barre de recherche et coordonnées
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
    topGPSButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 10,
        backgroundColor: modernColors.success, // ✅ Vert pour "Me localiser"
        gap: 4,
        minHeight: 36,
        shadowColor: modernColors.success,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3,
        elevation: 3,
    },
    // ✅ NOUVEAU: Styles pour l'affichage des coordonnées en haut
    coordsDisplayContainer: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1.5,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingVertical: 6,
        paddingHorizontal: 8,
        minHeight: 36,
        justifyContent: 'center',
    },
    coordsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginVertical: 2,
    },
    coordsLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: modernColors.textSecondary,
        textTransform: 'uppercase',
        minWidth: 30,
    },
    coordsValue: {
        fontSize: 13,
        fontWeight: '700',
        color: modernColors.text,
        fontFamily: 'monospace',
        letterSpacing: 0.3,
    },
    coordsCompact: {
        fontSize: 9,
        fontWeight: '600',
        color: modernColors.text,
        fontFamily: 'monospace',
        textAlign: 'center',
        lineHeight: 12,
    },
    coordsPlaceholder: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.textSecondary,
        textAlign: 'center',
        fontStyle: 'italic',
    },
    topGPSIcon: {
        fontSize: 22,
    },
    topGPSButtonText: {
        fontSize: 12, // ✅ RÉDUIT de 13 à 12 pour éviter le wrap
        fontWeight: '700',
        color: '#FFFFFF',
        letterSpacing: 0.2,
        textAlign: 'center',
    },
    controlCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 8,
        flexWrap: 'nowrap',
    },
    cardTitle: {
        fontSize: 14, // ✅ Augmenté de 12 à 14 pour meilleure lisibilité
        fontWeight: '700', // ✅ Plus gras
        color: '#1F2937', // ✅ Plus contrasté
        marginLeft: 6,
        flexShrink: 1,
        flexWrap: 'nowrap',
    },
    selectionModeButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    modeButton: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: modernColors.primary,
        backgroundColor: '#FFFFFF',
        gap: 4,
    },
    modeButtonActive: {
        backgroundColor: modernColors.primary,
    },
    modeButtonText: {
        fontSize: 11,
        fontWeight: '500',
        color: modernColors.primary,
        marginLeft: 4,
        textAlign: 'center',
        flexShrink: 0,
    },
    modeButtonTextActive: {
        color: '#FFFFFF',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 32,
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 12,
        backgroundColor: '#FFFFFF',
    },
    searchButton: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },
    gpsButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: modernColors.primary,
    },
    gpsButtonText: {
        fontSize: 12,
        fontWeight: '500',
        color: '#FFFFFF',
        marginLeft: 6,
        textAlign: 'center',
        flexShrink: 0,
    },
    selectedLocationContainer: {
        marginTop: 4,
        flexDirection: 'column',
        flexWrap: 'wrap',
    },
    selectedLocationText: {
        fontSize: 13, // ✅ Augmenté pour meilleure lisibilité
        fontWeight: '700', // ✅ Plus gras
        color: '#111827', // ✅ Plus contrasté
        fontFamily: 'monospace',
        flexWrap: 'wrap',
        textAlign: 'left',
    },
    selectedAddressText: {
        fontSize: 12, // ✅ Augmenté pour meilleure lisibilité
        fontWeight: '600', // ✅ Plus gras
        color: '#374151', // ✅ Plus contrasté
        marginTop: 4,
        flexWrap: 'wrap',
        textAlign: 'left',
        lineHeight: 17,
    },
    clearButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: '#FEF2F2',
        marginTop: 4,
    },
    clearButtonText: {
        fontSize: 10,
        color: '#EF4444',
        marginLeft: 4,
        fontWeight: '500',
        textAlign: 'center',
        flexShrink: 0,
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