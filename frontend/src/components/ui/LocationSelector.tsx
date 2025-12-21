/**
 * LocationSelector - Composant web pour sélectionner un lieu avec enrichissement backend
 * Adapté depuis mobile/src/components/LocationSelector.tsx
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Search, X, MapPin, Loader2 } from 'lucide-react';
import { placesService, PlaceScope } from '@/services/placesService';
import { apiGet } from '@/services/api';

// ✅ Parser string location en composants (gère "Pays - Ville", "Quartier, Ville, Pays", "Pays" seul)
const parseLocationString = (locationStr: string): LocationObject => {
    const components: any = {};
    let placeName = locationStr;

    // Format 1 : "Pays - Ville" (retourné par placesService local pour villes)
    if (locationStr.includes(' - ')) {
        const parts = locationStr.split(' - ').map(s => s.trim());
        if (parts.length === 2) {
            components.pays = parts[0];
            components.ville = parts[1];
            placeName = parts[1]; // Ville est le lieu principal
        }
    }
    // Format 2 : "Quartier, Ville, Pays" ou "Ville, Région, Pays" (retourné par Google Autocomplete ou quartiers)
    else if (locationStr.includes(',')) {
        const parts = locationStr.split(',').map(s => s.trim());
        if (parts.length >= 3) {
            components.quartier = parts[0];
            components.ville = parts[1];
            components.pays = parts[2];
            placeName = parts[0]; // Quartier est le lieu principal
        } else if (parts.length === 2) {
            // "Ville, Pays"
            components.ville = parts[0];
            components.pays = parts[1];
            placeName = parts[0];
        }
    }
    // Format 3 : Simple (pays seul ou lieu simple)
    else {
        const paysConnus = ['Cameroun', 'Côte d\'Ivoire', 'Sénégal', 'Mali', 'Burkina Faso', 
                           'Niger', 'Tchad', 'Guinée', 'Bénin', 'Togo', 'Congo', 'Gabon', 
                           'Centrafrique', 'Madagascar', 'Burundi', 'Rwanda', 'Djibouti', 
                           'Comores', 'Mauritanie', 'RD Congo'];
        const isPays = paysConnus.some(p => locationStr.toLowerCase() === p.toLowerCase());
        
        if (isPays) {
            components.pays = locationStr;
            placeName = locationStr;
        } else {
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

const formatLocationDisplay = (location?: LocationObject | string | boolean | null): string => {
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
        return {
            ...location,
            raw: formatLocationDisplay(location),
        };
    }
};

// ✅ Structure objet complet pour localisation
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
}

interface LocationSelectorProps {
    label: string;
    value: string | LocationObject;  // ✅ Supporte string (ancien) ou objet (nouveau)
    onSelect: (value: LocationObject) => void;  // ✅ Retourne toujours objet
    placeholder?: string;
    scope?: PlaceScope | 'all'; // 'city' | 'point' | 'neighborhood' | 'all' (tous types géographiques)
    cityContext?: string; // For point/neighborhood search filtering
    required?: boolean;
    enrichWithBackend?: boolean;  // ✅ Si true, appelle /api/places/enrich
    readonly?: boolean;
    className?: string;
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
    label,
    value,
    onSelect,
    placeholder = 'Rechercher un lieu...',
    scope = 'all',
    cityContext,
    required = false,
    enrichWithBackend = false,
    readonly = false,
    className = '',
}) => {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);
    const [enriching, setEnriching] = useState(false);
    const [options, setOptions] = useState<string[]>([]);

    // ✅ Parser valeur affichée (string ou objet)
    const displayValue = formatLocationDisplay(value as any);

    // Debounce query
    const debouncedQuery = useMemo(() => query.trim(), [query]);

    useEffect(() => {
        let cancelled = false;
        const run = async () => {
            if (!debouncedQuery || debouncedQuery.length < 2) {
                setOptions([]);
                return;
            }

            setLoading(true);
            try {
                // ✅ Si scope est 'all', passer undefined pour recherche universelle
                const scopeParam = scope === 'all' ? undefined : scope as PlaceScope;
                const results = await placesService.autocomplete(debouncedQuery, scopeParam, cityContext);
                if (!cancelled) setOptions(results);
            } catch (error) {
                console.error('[LocationSelector] Erreur autocomplete:', error);
                if (!cancelled) setOptions([]);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [debouncedQuery, scope, cityContext]);

    const handleSelect = async (opt: string) => {
        setOpen(false);

        // ✅ Parser composants du lieu
        const locationObj = parseLocationString(opt);

        // ✅ Enrichir avec backend si demandé
        if (enrichWithBackend) {
            setEnriching(true);
            try {
                const enriched = await enrichLocation(locationObj);
                const display = formatLocationDisplay(enriched);
                onSelect({
                    ...enriched,
                    raw: display,
                });
            } catch (error) {
                console.error('[LocationSelector] Erreur enrichissement:', error);
                // Fallback : retourner sans enrichissement
                const display = formatLocationDisplay(locationObj);
                onSelect({
                    ...locationObj,
                    raw: display,
                });
            } finally {
                setEnriching(false);
            }
        } else {
            const display = formatLocationDisplay(locationObj);
            onSelect({
                ...locationObj,
                raw: display,
            });
        }
    };

    return (
        <div className={`space-y-2 ${className}`}>
            <label className="block text-sm font-medium text-gray-700">
                {label} {required && <span className="text-red-500">*</span>}
            </label>

            <div className="relative">
                <button
                    type="button"
                    onClick={() => !readonly && setOpen(true)}
                    disabled={readonly}
                    className={`w-full flex items-center justify-between text-sm h-10 px-3 border border-gray-300 rounded-lg transition-colors ${
                        readonly
                            ? 'bg-gray-50 cursor-not-allowed text-gray-600'
                            : 'bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:border-blue-500'
                    } ${!displayValue ? 'text-gray-400' : 'text-gray-900'}`}
                >
                    <span className="flex items-center gap-2 flex-1 min-w-0">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <span className="truncate">
                            {displayValue || placeholder}
                        </span>
                    </span>
                    <Search className="w-4 h-4 text-gray-400 flex-shrink-0 ml-2" />
                </button>

                {enriching && (
                    <div className="absolute top-full left-0 right-0 mt-1 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-700 flex items-center gap-2">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>🌍 Enrichissement en cours...</span>
                    </div>
                )}
            </div>

            {!!displayValue && !readonly && (
                <button
                    type="button"
                    onClick={() => onSelect({ raw: '', place_name: '' })}
                    className="flex items-center gap-1 text-xs text-red-600 hover:text-red-700"
                >
                    <X className="w-3 h-3" />
                    <span>Effacer</span>
                </button>
            )}

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black bg-opacity-50" onClick={() => setOpen(false)}>
                    <div className="bg-white rounded-t-xl sm:rounded-xl shadow-xl w-full sm:max-w-md max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Rechercher {
                                    scope === 'city' ? 'une ville' :
                                    scope === 'neighborhood' ? 'un quartier' :
                                    scope === 'point' ? 'un lieu' :
                                    'ville, quartier, pays...'
                                }
                            </h3>
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1 hover:bg-gray-100 rounded-full transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="p-4 border-b">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder={placeholder}
                                    value={query}
                                    onChange={(e) => setQuery(e.target.value)}
                                    className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    autoFocus
                                />
                                {query.length > 0 && (
                                    <button
                                        onClick={() => setQuery('')}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 p-1 hover:bg-gray-100 rounded-full"
                                    >
                                        <X className="w-4 h-4 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Options List */}
                        <div className="flex-1 overflow-y-auto">
                            {loading ? (
                                <div className="p-8 text-center">
                                    <Loader2 className="w-6 h-6 animate-spin text-gray-400 mx-auto mb-2" />
                                    <p className="text-sm text-gray-500">Chargement...</p>
                                </div>
                            ) : options.length === 0 ? (
                                <div className="p-8 text-center">
                                    <p className="text-sm text-gray-500">
                                        {query.length < 2 ? 'Tapez au moins 2 caractères...' : 'Aucun résultat'}
                                    </p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-200">
                                    {options.map((opt) => (
                                        <button
                                            key={opt}
                                            onClick={() => handleSelect(opt)}
                                            className="w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors"
                                        >
                                            <p className="text-sm text-gray-900">{opt}</p>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default LocationSelector;

