import React, { useEffect, useMemo, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiGet } from '../services/api';
import { PlaceScope, placesService } from '../services/placesService';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';

// ✅ Parser string location en composants
const parseLocationString = (locationStr: string): LocationObject => {
    const parts = locationStr.split(',').map(s => s.trim());

    const components: any = {};

    // Déduction selon nombre de parties
    if (parts.length >= 3) {
        components.ville = parts[0];
        components.region = parts[1];
        components.pays = parts[2];
    } else if (parts.length === 2) {
        components.ville = parts[0];
        components.pays = parts[1];
    } else if (parts.length === 1) {
        components.ville = parts[0];
    }

    return {
        raw: locationStr,
        place_name: parts[0] || locationStr,
        components,
    };
};

// ✅ Enrichir avec backend GeoNames
const enrichLocation = async (location: LocationObject): Promise<LocationObject> => {
    try {
        const response = await apiGet<any>(
            `/api/places/enrich?place_name=${encodeURIComponent(location.place_name)}&country=${encodeURIComponent(location.components?.pays || '')}`
        );

        if (response.success && response.data) {
            const data: any = response.data;

            return {
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
        }

        return location;
    } catch (error) {
        console.error('[enrichLocation] Erreur:', error);
        return location;
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
    const displayValue = typeof value === 'string' ? value : value?.raw || '';

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
                                                    onSelect(enriched);
                                                } catch (error) {
                                                    console.error('[LocationSelector] Erreur enrichissement:', error);
                                                    // Fallback : retourner sans enrichissement
                                                    onSelect(locationObj);
                                                } finally {
                                                    setEnriching(false);
                                                }
                                            } else {
                                                onSelect(locationObj);
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
