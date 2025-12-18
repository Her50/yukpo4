import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../services/api';
import { PlaceScope, placesService } from '../services/placesService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

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
            // Détecter si c'est un quartier (premier élément court, souvent un nom de quartier)
            // ou une ville (premier élément peut être plus long)
            // Pour simplifier, on assume que 3 parties = "Quartier, Ville, Pays"
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
}

export const LocationSelector: React.FC<LocationSelectorProps> = ({
    label,
    value,
    onSelect,
    placeholder = 'Rechercher... ',
    scope = 'all', // ✅ NOUVEAU: Par défaut, recherche universelle (tous types géographiques)
    cityContext,
    required = false,
    enrichWithBackend = false,
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
            setLoading(true);
            try {
                // ✅ NOUVEAU: Si scope est 'all', passer undefined pour recherche universelle
                const scopeParam = scope === 'all' ? undefined : scope as PlaceScope;
                const results = await placesService.autocomplete(debouncedQuery, scopeParam, cityContext);
                if (!cancelled) setOptions(results);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };
        run();
        return () => { cancelled = true; };
    }, [debouncedQuery, scope, cityContext]);

    return (
        <View style={styles.container}>
            <Text style={styles.label}>
                {label} {required && <Text style={styles.required}>*</Text>}
            </Text>
            <TouchableOpacity
                style={[styles.selector, !displayValue && styles.selectorPlaceholder]}
                onPress={() => setOpen(true)}
            >
                <View style={{ flex: 1 }}>
                    <Text style={[styles.selectorText, !displayValue && styles.placeholderText]}>
                        {displayValue || placeholder}
                    </Text>
                    {enriching && (
                        <Text style={styles.enrichingText}>🌍 Enrichissement en cours...</Text>
                    )}
                </View>
                <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
            </TouchableOpacity>

            {!!displayValue && (
                <TouchableOpacity
                    style={styles.clearButton}
                    onPress={() => onSelect({ raw: '', place_name: '' })}
                >
                    <SafeIcon name="x-circle" size={16} color={modernColors.error} />
                    <Text style={styles.clearText}>Effacer</Text>
                </TouchableOpacity>
            )}

            <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Rechercher {
                                    scope === 'city' ? 'une ville' :
                                        scope === 'neighborhood' ? 'un quartier' :
                                            scope === 'point' ? 'un lieu' :
                                                'ville, quartier, pays...'
                                }
                            </Text>
                            <TouchableOpacity onPress={() => setOpen(false)} style={styles.closeButton}>
                                <SafeIcon name="x" size={22} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={18} color={modernColors.textSecondary} />
                            <TextInput
                                placeholder={placeholder}
                                value={query}
                                onChangeText={setQuery}
                                style={styles.searchInput}
                                placeholderTextColor={modernColors.textSecondary}
                                autoFocus
                            />
                            {query.length > 0 && (
                                <TouchableOpacity onPress={() => setQuery('')}>
                                    <SafeIcon name="x-circle" size={18} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>

                        <ScrollView style={styles.optionsList}>
                            {loading ? (
                                <Text style={styles.loadingText}>Chargement...</Text>
                            ) : options.length === 0 ? (
                                <Text style={styles.emptyText}>Aucun résultat</Text>
                            ) : (
                                options.map((opt) => (
                                    <TouchableOpacity
                                        key={opt}
                                        style={styles.optionItem}
                                        onPress={async () => {
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
                                        }}
                                    >
                                        <Text style={styles.optionText}>{opt}</Text>
                                    </TouchableOpacity>
                                ))
                            )}
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { marginBottom: 12 },
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
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    selectorPlaceholder: { borderColor: modernColors.border },
    selectorText: { fontSize: 14, color: modernColors.text },
    placeholderText: { color: modernColors.textSecondary },
    enrichingText: { fontSize: 11, color: modernColors.primary, marginTop: 2 },
    clearButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
    clearText: { fontSize: 12, color: modernColors.error, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', justifyContent: 'flex-end' },
    modalContainer: { backgroundColor: modernColors.surface, borderTopLeftRadius: 12, borderTopRightRadius: 12, maxHeight: '75%' },
    modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    modalTitle: { fontSize: 16, fontWeight: '700', color: modernColors.text },
    closeButton: { padding: 6 },
    searchContainer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
    searchInput: { flex: 1, borderWidth: 1, borderColor: modernColors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, color: modernColors.text },
    optionsList: { paddingHorizontal: 6 },
    loadingText: { padding: 16, color: modernColors.textSecondary },
    emptyText: { padding: 16, color: modernColors.textSecondary },
    optionItem: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: modernColors.border },
    optionText: { fontSize: 14, color: modernColors.text },
});

export default LocationSelector;
