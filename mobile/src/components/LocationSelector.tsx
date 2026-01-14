import React, { useEffect, useMemo, useState, useRef } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../services/api';
import { PlaceScope, placesService, PlaceResult } from '../services/placesService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import ENVIRONMENT from '../config/environment';
import { useLocation } from '../contexts/LocationContext';

// ✅ AMÉLIORÉ: Parser string location en composants (gère établissements, "Pays - Ville", "Quartier, Ville, Pays", "Pays" seul)
const parseLocationString = (locationStr: string): LocationObject => {
    const components: any = {};
    let placeName = locationStr;

    // ✅ AMÉLIORÉ: Liste étendue pour détecter les établissements, sites, bâtiments, boutiques
    const establishmentKeywords = [
        'restaurant', 'café', 'cafe', 'hôtel', 'hotel', 'hôpital', 'hopital', 'clinique', 'pharmacie',
        'école', 'ecole', 'université', 'universite', 'banque', 'supermarché', 'supermarche', 
        'marché', 'marche', 'gare', 'aéroport', 'aeroport', 'station', 'église', 'eglise', 
        'mosquée', 'mosquee', 'stade', 'cinéma', 'cinema', 'théâtre', 'theatre', 'musée', 'musee',
        'bibliothèque', 'bibliotheque', 'parc', 'jardin', 'plage', 'bar', 'discothèque', 'discotheque',
        'boîte', 'boite', 'magasin', 'boutique', 'centre commercial', 'mall', 'bâtiment', 'batiment',
        'immeuble', 'tour', 'tower', 'centre', 'center', 'complexe', 'complex', 'siège', 'siege',
        'bureau', 'office', 'agence', 'poste', 'mairie', 'préfecture', 'prefecture'
    ];
    const isEstablishment = establishmentKeywords.some(keyword => 
        locationStr.toLowerCase().includes(keyword)
    );

    // Format 1 : "Pays - Ville" (retourné par placesService local pour villes)
    if (locationStr.includes(' - ')) {
        const parts = locationStr.split(' - ').map(s => s.trim());
        if (parts.length === 2) {
            components.pays = parts[0];
            components.ville = parts[1];
            placeName = parts[1]; // Ville est le lieu principal
        }
    }
    // Format 2 : "Établissement, Rue, Ville, Pays" ou "Quartier, Ville, Pays" (retourné par Google Autocomplete)
    else if (locationStr.includes(',')) {
        const parts = locationStr.split(',').map(s => s.trim());
        if (parts.length >= 3) {
            // Si le premier élément est un établissement, c'est "Établissement, Rue, Ville, Pays"
            if (isEstablishment) {
                placeName = parts[0]; // Nom de l'établissement
                if (parts.length >= 3) {
                    components.ville = parts[parts.length - 2] || parts[parts.length - 1];
                    components.pays = parts[parts.length - 1];
                }
            } else {
                // Sinon, c'est probablement "Quartier, Ville, Pays"
                components.quartier = parts[0];
                components.ville = parts[1];
                components.pays = parts[2];
                placeName = parts[0]; // Quartier est le lieu principal
            }
        } else if (parts.length === 2) {
            // "Ville, Pays" ou "Établissement, Ville"
            if (isEstablishment) {
                placeName = parts[0]; // Nom de l'établissement
                components.ville = parts[1];
            } else {
                components.ville = parts[0];
                components.pays = parts[1];
                placeName = parts[0];
            }
        }
    }
    // Format 3 : Simple (pays seul, établissement seul ou lieu simple)
    else {
        // ✅ NOUVEAU: Vérifier si c'est un pays connu
        const paysConnus = ['Cameroun', 'Côte d\'Ivoire', 'Sénégal', 'Mali', 'Burkina Faso', 
                           'Niger', 'Tchad', 'Guinée', 'Bénin', 'Togo', 'Congo', 'Gabon', 
                           'Centrafrique', 'Madagascar', 'Burundi', 'Rwanda', 'Djibouti', 
                           'Comores', 'Mauritanie', 'RD Congo'];
        const isPays = paysConnus.some(p => locationStr.toLowerCase() === p.toLowerCase());
        
        if (isPays) {
            // C'est un pays
            components.pays = locationStr;
            placeName = locationStr;
            // Ne pas mettre components.ville car c'est un pays
        } else if (isEstablishment) {
            // C'est un établissement seul (sans adresse complète)
            placeName = locationStr;
        } else {
            // Lieu simple (ville probablement)
            components.ville = locationStr;
            placeName = locationStr;
        }
    }

    return {
        raw: locationStr,
        place_name: placeName,
        components,
    };
};

// ✅ NOUVEAU: Mapper les types Google Places vers nos types locaux
const mapGoogleTypesToLocalType = (googleTypes?: string[]): 'city' | 'neighborhood' | 'establishment' | 'country' => {
    if (!googleTypes || googleTypes.length === 0) {
        return 'city'; // Par défaut
    }
    
    // Priorité: établissement > quartier > ville > pays
    // Types Google Places: https://developers.google.com/maps/documentation/places/web-service/autocomplete#place-types
    
    // Établissements (establishment, point_of_interest, etc.)
    const establishmentTypes = [
        'establishment', 'point_of_interest', 'restaurant', 'food', 'cafe', 'bar', 
        'hospital', 'pharmacy', 'doctor', 'dentist', 'school', 'university', 
        'store', 'shopping_mall', 'supermarket', 'bank', 'atm', 'gas_station',
        'church', 'mosque', 'synagogue', 'hindu_temple', 'stadium', 'movie_theater',
        'museum', 'library', 'park', 'zoo', 'amusement_park', 'gym', 'spa',
        'hotel', 'lodging', 'airport', 'train_station', 'bus_station', 'subway_station',
        'post_office', 'police', 'fire_station', 'courthouse', 'city_hall'
    ];
    
    // Quartiers (sublocality, neighborhood, etc.)
    const neighborhoodTypes = [
        'sublocality', 'sublocality_level_1', 'sublocality_level_2', 
        'neighborhood', 'political'
    ];
    
    // Villes (locality, administrative_area_level_2, etc.)
    const cityTypes = [
        'locality', 'administrative_area_level_2', 'administrative_area_level_3'
    ];
    
    // Pays (country, administrative_area_level_1, etc.)
    const countryTypes = [
        'country', 'administrative_area_level_1', 'political'
    ];
    
    // Vérifier dans l'ordre de priorité
    if (googleTypes.some(type => establishmentTypes.includes(type))) {
        return 'establishment';
    }
    if (googleTypes.some(type => neighborhoodTypes.includes(type))) {
        return 'neighborhood';
    }
    if (googleTypes.some(type => cityTypes.includes(type))) {
        return 'city';
    }
    if (googleTypes.some(type => countryTypes.includes(type))) {
        return 'country';
    }
    
    return 'city'; // Par défaut
};

// ✅ FALLBACK: Détecter le type de lieu depuis le texte (seulement si types Google non disponibles)
const detectPlaceTypeFromText = (placeText: string): 'city' | 'neighborhood' | 'establishment' | 'country' => {
    const text = placeText.toLowerCase();
    
    // ✅ LISTE ÉTENDUE: Mots-clés indiquant un établissement, site, bâtiment, boutique, etc.
    const establishmentKeywords = [
        // Restaurants & Cafés
        'restaurant', 'café', 'cafe', 'fast food', 'pizzeria', 'boulangerie', 'patisserie',
        // Hébergement
        'hôtel', 'hotel', 'auberge', 'resort', 'motel',
        // Santé
        'hôpital', 'hopital', 'clinique', 'pharmacie', 'laboratoire', 'cabinet médical', 'dispensaire',
        // Éducation
        'école', 'ecole', 'université', 'universite', 'lycée', 'lycee', 'collège', 'college', 'institut',
        // Commerce
        'banque', 'supermarché', 'supermarche', 'marché', 'marche', 'magasin', 'boutique', 'shop', 
        'centre commercial', 'mall', 'galerie', 'librairie', 'papeterie',
        // Transport
        'gare', 'aéroport', 'aeroport', 'station', 'terminal', 'arrêt', 'arret',
        // Religion
        'église', 'eglise', 'mosquée', 'mosquee', 'temple', 'cathédrale', 'cathedrale',
        // Culture & Loisirs
        'stade', 'cinéma', 'cinema', 'théâtre', 'theatre', 'musée', 'musee', 'bibliothèque', 'bibliotheque',
        'parc', 'jardin', 'plage', 'piscine', 'salle de sport', 'gym',
        // Divertissement
        'bar', 'discothèque', 'discotheque', 'boîte', 'boite', 'nightclub', 'club',
        // Bâtiments & Sites
        'bâtiment', 'batiment', 'immeuble', 'tour', 'tower', 'centre', 'center', 'complexe', 'complex',
        'siège', 'siege', 'bureau', 'office', 'agence', 'entrepôt', 'entrepot', 'usine', 'usine',
        // Autres établissements
        'poste', 'post office', 'mairie', 'préfecture', 'prefecture', 'tribunal', 'palais de justice',
        'commissariat', 'gendarmerie', 'caserne', 'ambassade', 'consulat'
    ];
    
    // ✅ Détection améliorée: vérifier si le texte contient un mot-clé d'établissement
    if (establishmentKeywords.some(keyword => text.includes(keyword))) {
        return 'establishment';
    }
    
    // ✅ Détection par format: Si contient une virgule avec plusieurs parties
    if (text.includes(',')) {
        const parts = text.split(',').map(p => p.trim());
        const firstPart = parts[0].toLowerCase();
        
        // Si le premier élément contient un mot-clé d'établissement, c'est un établissement
        if (establishmentKeywords.some(keyword => firstPart.includes(keyword))) {
            return 'establishment';
        }
        
        // Si le premier élément est court (< 20 caractères) et ne ressemble pas à une ville, c'est probablement un quartier
        if (parts.length >= 2 && parts[0].length < 20 && !firstPart.includes(' - ')) {
            // Vérifier si ce n'est pas un établissement avec un nom court
            const shortEstablishmentKeywords = ['bar', 'café', 'cafe', 'shop', 'boutique', 'magasin'];
            if (!shortEstablishmentKeywords.some(keyword => firstPart.includes(keyword))) {
                return 'neighborhood';
            }
        }
    }
    
    // ✅ Si contient " - " c'est probablement "Pays - Ville"
    if (text.includes(' - ')) {
        return 'city';
    }
    
    // ✅ Vérifier si c'est un pays connu
    const paysConnus = ['cameroun', 'côte d\'ivoire', 'cote d\'ivoire', 'sénégal', 'senegal', 
                        'mali', 'burkina faso', 'niger', 'tchad', 'guinée', 'guinee', 
                        'bénin', 'benin', 'togo', 'congo', 'gabon', 'centrafrique', 
                        'madagascar', 'burundi', 'rwanda', 'djibouti', 'comores', 
                        'mauritanie', 'rd congo'];
    if (paysConnus.includes(text.trim())) {
        return 'country';
    }
    
    // Par défaut, considérer comme ville
    return 'city';
};

// ✅ AMÉLIORÉ: Obtenir l'icône selon le type de lieu (utilise types Google Places si disponibles)
const getPlaceIcon = (
    placeType: 'city' | 'neighborhood' | 'establishment' | 'country', 
    placeText?: string,
    googleTypes?: string[]
): string => {
    switch (placeType) {
        case 'establishment': {
            // ✅ Utiliser les types Google Places pour une détection précise (plus fiable que le texte)
            if (googleTypes && googleTypes.length > 0) {
                // Mapping des types Google vers les icônes
                if (googleTypes.includes('restaurant') || googleTypes.includes('food') || googleTypes.includes('cafe')) {
                    return 'utensils';
                }
                if (googleTypes.includes('lodging') || googleTypes.includes('hotel')) {
                    return 'bed';
                }
                if (googleTypes.includes('hospital') || googleTypes.includes('pharmacy') || googleTypes.includes('doctor') || googleTypes.includes('dentist')) {
                    return 'heart';
                }
                if (googleTypes.includes('school') || googleTypes.includes('university')) {
                    return 'graduation-cap';
                }
                if (googleTypes.includes('store') || googleTypes.includes('shopping_mall') || googleTypes.includes('supermarket')) {
                    return 'shopping-bag';
                }
                if (googleTypes.includes('airport') || googleTypes.includes('train_station') || googleTypes.includes('bus_station') || googleTypes.includes('subway_station')) {
                    return 'navigation';
                }
                if (googleTypes.includes('church') || googleTypes.includes('mosque') || googleTypes.includes('synagogue') || googleTypes.includes('hindu_temple')) {
                    return 'church';
                }
                if (googleTypes.includes('stadium') || googleTypes.includes('movie_theater') || googleTypes.includes('museum') || googleTypes.includes('library') || googleTypes.includes('park')) {
                    return 'film';
                }
                if (googleTypes.includes('bank') || googleTypes.includes('atm')) {
                    return 'dollar-sign';
                }
            }
            
            // ✅ Fallback: Détection depuis le texte si types Google non disponibles
            if (placeText) {
                const text = placeText.toLowerCase();
                if (text.includes('restaurant') || text.includes('café') || text.includes('cafe')) {
                    return 'utensils';
                }
                if (text.includes('hôtel') || text.includes('hotel')) {
                    return 'bed';
                }
                if (text.includes('hôpital') || text.includes('hopital') || text.includes('pharmacie')) {
                    return 'heart';
                }
                if (text.includes('école') || text.includes('ecole') || text.includes('université')) {
                    return 'graduation-cap';
                }
                if (text.includes('magasin') || text.includes('boutique') || text.includes('mall')) {
                    return 'shopping-bag';
                }
                if (text.includes('gare') || text.includes('aéroport') || text.includes('aeroport')) {
                    return 'navigation';
                }
                if (text.includes('église') || text.includes('eglise') || text.includes('mosquée')) {
                    return 'church';
                }
                if (text.includes('banque')) {
                    return 'dollar-sign';
                }
            }
            return 'map-pin'; // Icône par défaut pour établissements
        }
        case 'neighborhood':
            return 'home'; // Icône pour quartiers
        case 'country':
            return 'globe'; // Icône pour pays
        case 'city':
        default:
            return 'map'; // Icône pour villes
    }
};

const formatLocationDisplay = (location?: LocationObject | string | boolean | null): string => {
    // ✅ CORRECTION: Gérer les valeurs non-string (boolean, null, undefined)
    if (!location || location === false || location === null) return '';
    if (typeof location === 'boolean') return '';
    if (typeof location === 'string') {
        return location;
    }

    const parts: string[] = [];

    if (location.components?.quartier && !parts.includes(location.components.quartier)) {
        parts.push(location.components.quartier);
    }

    if (location.components?.ville) {
        const ville = location.components.ville;
        if (!parts.includes(ville)) {
            parts.push(ville);
        }
    }

    if (location.components?.region) {
        const region = location.components.region;
        if (!parts.includes(region)) {
            parts.push(region);
        }
    }

    if (location.components?.pays) {
        const pays = location.components.pays;
        if (!parts.includes(pays)) {
            parts.push(pays);
        }
    }

    if (parts.length === 0) {
        return location.place_name || location.raw || '';
    }

    return parts.join(', ');
};

// ✅ Enrichir avec backend GeoNames
const enrichLocation = async (location: LocationObject): Promise<LocationObject> => {
    try {
        // ✅ CORRECTION: Ne pas envoyer country si vide (backend le déduit)
        const countryParam = location.components?.pays
            ? `&country=${encodeURIComponent(location.components.pays)}`
            : '';

        const response = await apiGet<any>(
            `/api/places/enrich?place_name=${encodeURIComponent(location.place_name)}${countryParam}`
        );

        if (response.success && response.data) {
            const data: any = response.data;

            const enriched: LocationObject = {
                raw: location.raw,
                place_name: data.place_name || location.place_name,
                components: {
                    ville: data.place_name || location.place_name,
                    region: data.hierarchy?.parents?.[0] || location.components?.region,
                    pays: data.metadata?.country || location.components?.pays,
                },
                coordinates: data.coordinates || location.coordinates,
                geoname_id: data.geoname_id,
                location_vector: data.location_vector,
            };

            return {
                ...enriched,
                raw: formatLocationDisplay(enriched),
            };
        }

        return {
            ...location,
            raw: formatLocationDisplay(location),
        };
    } catch (error) {
        console.error('[enrichLocation] Erreur:', error);
        // ✅ Fallback : retourner location originale sans crash
        return {
            ...location,
            raw: formatLocationDisplay(location),
        };
    }
};

// ✅ NOUVEAU 2025-11-02: Structure objet complet pour localisation
export interface LocationObject {
    raw: string;                    // "Douala, Littoral, Cameroun"
    place_name: string;             // "Douala"
    components?: {
        quartier?: string;
        ville?: string;
        region?: string;
        pays?: string;
    };
    coordinates?: {
        lat: number;
        lng: number;
    };
    geoname_id?: number;
    location_vector?: string[];     // Enrichi par backend
    google_types?: string[];        // ✅ NOUVEAU: Types Google Places API (évite le hardcodage)
    place_id?: string;              // ✅ NOUVEAU: Place ID Google Places
}

interface LocationSelectorProps {
    label?: string;  // ✅ Optionnel pour éviter les crashes
    value: string | LocationObject;  // ✅ Supporte string (ancien) ou objet (nouveau)
    onSelect: (value: LocationObject) => void;  // ✅ Retourne toujours objet
    placeholder?: string;
    scope?: PlaceScope | 'all'; // 'city' | 'point' | 'neighborhood' | 'all' (tous types géographiques)
    cityContext?: string; // For point/neighborhood search filtering
    required?: boolean;
    enrichWithBackend?: boolean;  // ✅ Si true, appelle /api/places/enrich
}

// ✅ NOUVEAU: Fonction pour déterminer automatiquement le scope basé sur le label
const determineScopeFromLabel = (label?: string, providedScope?: PlaceScope | 'all'): PlaceScope | 'all' => {
    // Si un scope est explicitement fourni, l'utiliser
    if (providedScope) {
        return providedScope;
    }
    
    // Si pas de label, retourner 'all' par défaut
    if (!label || typeof label !== 'string') {
        return 'all';
    }
    
    // Sinon, déterminer le scope basé sur le label
    const labelLower = label.toLowerCase().trim();
    
    // Détection pour "ville"
    if (labelLower.includes('ville') && !labelLower.includes('quartier') && !labelLower.includes('lieu')) {
        return 'city';
    }
    
    // Détection pour "quartier"
    if (labelLower.includes('quartier') && !labelLower.includes('lieu')) {
        return 'neighborhood';
    }
    
    // Détection pour "pays"
    if (labelLower.includes('pays') && !labelLower.includes('lieu') && !labelLower.includes('ville') && !labelLower.includes('quartier')) {
        return 'all'; // 'all' pour rechercher les pays
    }
    
    // Pour "lieu" ou autres champs génériques → recherche universelle (établissements + géographie)
    if (labelLower.includes('lieu') || labelLower.includes('localisation') || labelLower.includes('adresse')) {
        return 'all'; // Recherche universelle pour les lieux/établissements
    }
    
    // Par défaut, recherche universelle
    return 'all';
};

export const LocationSelector: React.FC<LocationSelectorProps> = ({
    label,
    value,
    onSelect,
    placeholder,
    scope,
    cityContext,
    required = false,
    enrichWithBackend = false,
}) => {
    // ✅ NOUVEAU: Déterminer automatiquement le scope basé sur le label si non fourni
    const finalScope = determineScopeFromLabel(label, scope);
    
    // ✅ NOUVEAU: Déterminer le placeholder par défaut basé sur le scope
    const defaultPlaceholder = placeholder || (
        finalScope === 'city' ? 'Rechercher une ville...' :
        finalScope === 'neighborhood' ? 'Rechercher un quartier...' :
        finalScope === 'all' && label && typeof label === 'string' && label.toLowerCase().includes('pays') ? 'Rechercher un pays...' :
        'Rechercher un lieu, ville, quartier...'
    );
    
    // ✅ NOUVEAU 2026-01-04: Utiliser useLocation pour obtenir la localisation de l'utilisateur
    const { location: userLocation } = useLocation();

    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [options, setOptions] = useState<string[]>([]);
    const [optionsEnriched, setOptionsEnriched] = useState<PlaceResult[]>([]); // ✅ NOUVEAU: Stocker résultats enrichis avec types

    // ✅ Parser valeur affichée (string ou objet)
    const displayValue = formatLocationDisplay(value as any);

    // Debounce query
    const debouncedQuery = useMemo(() => query.trim(), [query]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!debouncedQuery || debouncedQuery.length < 2) {
                setOptionsEnriched([]);
                setOptions([]);
                return;
            }

            setLoading(true);
            try {
                // ✅ NOUVEAU 2026-01-04: Utiliser directement Google Places Autocomplete API avec locationBias
                // Comme dans ModernGPSModal pour rechercher dans la zone géographique de l'utilisateur
                const GOOGLE_MAPS_API_KEY = ENVIRONMENT.GOOGLE_MAPS_API_KEY;

                if (GOOGLE_MAPS_API_KEY) {
                    // ✅ Utiliser la localisation GPS de l'utilisateur en priorité pour locationBias
                    let locationBias: { lat: number; lng: number };
                    if (userLocation?.coords?.latitude && userLocation?.coords?.longitude) {
                        locationBias = {
                            lat: userLocation.coords.latitude,
                            lng: userLocation.coords.longitude
                        };
                    } else {
                        // Fallback sur Douala, Cameroun
                        locationBias = { lat: 4.031716, lng: 9.817201 };
                    }

                    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(debouncedQuery)}&location=${locationBias.lat},${locationBias.lng}&radius=50000&key=${GOOGLE_MAPS_API_KEY}&language=fr`;

                    const response = await fetch(url);
                    const data = await response.json();

                    if (!cancelled && data.status === 'OK' && data.predictions) {
                        // Convertir les résultats Google Places en format PlaceResult
                        const resultsEnriched: PlaceResult[] = data.predictions.map((prediction: any) => ({
                            description: prediction.description,
                            place_id: prediction.place_id,
                            types: prediction.types || []
                        }));
                        setOptionsEnriched(resultsEnriched);
                        setOptions(resultsEnriched.map(r => r.description)); // Pour compatibilité
                    } else if (!cancelled) {
                        // Fallback sur placesService si Google Places API échoue
                        const scopeParam = finalScope === 'all' ? undefined : finalScope as PlaceScope;
                        const resultsEnriched = await placesService.autocompleteEnriched(debouncedQuery, scopeParam, cityContext);
                        setOptionsEnriched(resultsEnriched);
                        setOptions(resultsEnriched.map(r => r.description));
                    }
                } else {
                    // ✅ Fallback: Utiliser placesService si clé API non configurée
                    const scopeParam = finalScope === 'all' ? undefined : finalScope as PlaceScope;
                    const resultsEnriched = await placesService.autocompleteEnriched(debouncedQuery, scopeParam, cityContext);
                    if (!cancelled) {
                        setOptionsEnriched(resultsEnriched);
                        setOptions(resultsEnriched.map(r => r.description));
                    }
                }
            } catch (error) {
                console.error('[LocationSelector] Erreur autocomplete:', error);
                if (!cancelled) {
                    // Fallback sur placesService en cas d'erreur
                    try {
                        const scopeParam = finalScope === 'all' ? undefined : finalScope as PlaceScope;
                        const resultsEnriched = await placesService.autocompleteEnriched(debouncedQuery, scopeParam, cityContext);
                        setOptionsEnriched(resultsEnriched);
                        setOptions(resultsEnriched.map(r => r.description));
                    } catch (fallbackError) {
                        console.error('[LocationSelector] Erreur fallback:', fallbackError);
                        setOptionsEnriched([]);
                        setOptions([]);
                    }
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [debouncedQuery, finalScope, cityContext, userLocation]);

    const [isFocused, setIsFocused] = useState(false);
    const inputRef = React.useRef<TextInput>(null);

    // ✅ Synchroniser query avec displayValue quand on commence à taper
    useEffect(() => {
        if (isFocused && !query && displayValue) {
            setQuery(displayValue);
        }
    }, [isFocused]);

    const handleSelectOption = async (opt: string, index: number) => {
        // ✅ Parser composants du lieu
        const locationObj = parseLocationString(opt);
        const enrichedResult = optionsEnriched[index];

        // ✅ Enrichir avec backend si demandé
        if (enrichWithBackend) {
            setEnriching(true);
            try {
                const enriched = await enrichLocation(locationObj);
                const display = formatLocationDisplay(enriched);
                // ✅ NOUVEAU: Inclure les types Google Places dans LocationObject
                onSelect({
                    ...enriched,
                    raw: display,
                    google_types: enrichedResult?.types,
                    place_id: enrichedResult?.place_id,
                });
            } catch (error) {
                console.error('[LocationSelector] Erreur enrichissement:', error);
                // Fallback : retourner sans enrichissement
                const display = formatLocationDisplay(locationObj);
                onSelect({
                    ...locationObj,
                    raw: display,
                    google_types: enrichedResult?.types,
                    place_id: enrichedResult?.place_id,
                });
            } finally {
                setEnriching(false);
            }
        } else {
            const display = formatLocationDisplay(locationObj);
            onSelect({
                ...locationObj,
                raw: display,
                google_types: enrichedResult?.types,
                place_id: enrichedResult?.place_id,
            });
        }
        
        // ✅ Fermer les suggestions après sélection
        setQuery('');
        setIsFocused(false);
        inputRef.current?.blur();
    };

    return (
        <View style={styles.container}>
            {label && (
                <Text style={styles.label}>
                    {label} {required && <Text style={styles.required}>*</Text>}
                </Text>
            )}
            
            {/* ✅ NOUVEAU: Champ de saisie directe au lieu de TouchableOpacity */}
            <View style={[styles.selector, !displayValue && !isFocused && styles.selectorPlaceholder]}>
                <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                <TextInput
                    ref={inputRef}
                    placeholder={defaultPlaceholder}
                    value={isFocused ? query : displayValue}
                    onChangeText={(text) => {
                        setQuery(text);
                        setIsFocused(true);
                    }}
                    onFocus={() => {
                        setIsFocused(true);
                        if (displayValue) {
                            setQuery(displayValue);
                        }
                    }}
                    onBlur={() => {
                        // ✅ Délai pour permettre le clic sur une option
                        setTimeout(() => {
                            setIsFocused(false);
                            setQuery('');
                        }, 200);
                    }}
                    style={styles.input}
                    placeholderTextColor={modernColors.textSecondary}
                />
                {/* ✅ NOUVEAU: Croix rouge pour effacer rapidement le contenu */}
                {((isFocused && query.length > 0) || (!isFocused && displayValue)) && (
                    <TouchableOpacity 
                        onPress={() => {
                            if (isFocused) {
                                setQuery('');
                                inputRef.current?.focus();
                            } else {
                                onSelect({ raw: '', place_name: '' });
                            }
                        }}
                        style={styles.clearIconButton}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                        <SafeIcon name="x" size={18} color="#EF4444" type="lucide" />
                    </TouchableOpacity>
                )}
            </View>

            {enriching && (
                <Text style={styles.enrichingText}>🌍 Enrichissement en cours...</Text>
            )}

            {/* ✅ NOUVEAU: Suggestions affichées directement sous le champ (pas dans un modal) */}
            {isFocused && (query.length >= 2 || options.length > 0) && (
                <View style={styles.suggestionsContainer}>
                    <ScrollView 
                        style={styles.suggestionsList}
                        keyboardShouldPersistTaps="handled"
                        nestedScrollEnabled={true}
                    >
                        {loading ? (
                            <Text style={styles.loadingText}>Chargement...</Text>
                        ) : options.length === 0 && query.length >= 2 ? (
                            <Text style={styles.emptyText}>Aucun résultat</Text>
                        ) : (
                            options.map((opt, index) => {
                                // ✅ AMÉLIORÉ: Utiliser les types Google Places au lieu du hardcodage
                                const enrichedResult = optionsEnriched[index];
                                const placeType = enrichedResult?.types 
                                    ? mapGoogleTypesToLocalType(enrichedResult.types)
                                    : detectPlaceTypeFromText(opt);
                                const placeIcon = getPlaceIcon(placeType, opt, enrichedResult?.types);
                                
                                return (
                                    <TouchableOpacity
                                        key={`${opt}-${index}`}
                                        style={styles.optionItem}
                                        onPress={() => handleSelectOption(opt, index)}
                                    >
                                        <View style={styles.optionContent}>
                                            <SafeIcon 
                                                name={placeIcon} 
                                                size={18} 
                                                color={placeType === 'establishment' ? modernColors.primary : modernColors.textSecondary} 
                                            />
                                            <Text style={styles.optionText}>{opt}</Text>
                                        </View>
                                    </TouchableOpacity>
                                );
                            })
                        )}
                    </ScrollView>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 12, zIndex: 9999, position: 'relative', elevation: 1000 },
    label: { fontSize: 13, fontWeight: '600', color: modernColors.text, marginBottom: 6 },
    required: { color: modernColors.error },
    selector: {
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    selectorPlaceholder: { borderColor: modernColors.border },
    input: { 
        flex: 1, 
        fontSize: 14, 
        color: modernColors.text,
        padding: 0, // ✅ Important pour éviter le padding supplémentaire
    },
    enrichingText: { fontSize: 11, color: modernColors.primary, marginTop: 2 },
    clearIconButton: {
        padding: 4,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // ✅ NOUVEAU: Styles pour les suggestions affichées directement
    suggestionsContainer: {
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        backgroundColor: modernColors.surface,
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 8,
        marginTop: 4,
        maxHeight: 200,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 1000,
        zIndex: 99999,
    },
    suggestionsList: {
        maxHeight: 200,
    },
    loadingText: { padding: 16, color: modernColors.textSecondary, textAlign: 'center' },
    emptyText: { padding: 16, color: modernColors.textSecondary, textAlign: 'center' },
    optionItem: { 
        paddingHorizontal: 16, 
        paddingVertical: 14, 
        borderBottomWidth: 1, 
        borderBottomColor: modernColors.border,
    },
    optionContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    optionText: { fontSize: 14, color: modernColors.text, flex: 1 },
});

export default LocationSelector;
