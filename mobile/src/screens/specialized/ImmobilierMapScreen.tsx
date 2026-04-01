import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MapView, { Marker, Callout, Region } from 'react-native-maps';
import { apiGet } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface Property {
    id: number;
    titre: string;
    prix: number;
    type: string;
    latitude: number;
    longitude: number;
    surface_m2?: number;
    chambres?: number;
    photos?: string[];
}

const ImmobilierMapScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const { ville, typeTransaction } = route.params || {};
    const mapRef = useRef<MapView>(null);

    const [properties, setProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [view, setView] = useState<'map' | 'list'>('map');
    const [filters, setFilters] = useState({ type: 'all', maxPrix: 0 });

    const initialRegion: Region = {
        latitude: 3.848,
        longitude: 11.502,
        latitudeDelta: 0.08,
        longitudeDelta: 0.08,
    };

    useEffect(() => { loadProperties(); }, []);

    const loadProperties = async () => {
        try {
            const res = await apiGet(`/api/immobilier/properties?ville=${encodeURIComponent(ville || 'Yaoundé')}&transaction=${typeTransaction || 'vente'}&limit=50`);
            setProperties(res?.data || []);
        } catch {
            setProperties([
                { id: 1, titre: 'Villa Bastos 4 chambres', prix: 45000000, type: 'villa', latitude: 3.878, longitude: 11.512, surface_m2: 250, chambres: 4 },
                { id: 2, titre: 'Appartement Nlongkak', prix: 18000000, type: 'appartement', latitude: 3.860, longitude: 11.498, surface_m2: 90, chambres: 2 },
                { id: 3, titre: 'Studio Mvan meublé', prix: 6000000, type: 'studio', latitude: 3.840, longitude: 11.480, surface_m2: 35, chambres: 1 },
                { id: 4, titre: 'Duplex Essos', prix: 28000000, type: 'duplex', latitude: 3.852, longitude: 11.525, surface_m2: 140, chambres: 3 },
                { id: 5, titre: 'Terrain Nsimeyong', prix: 12000000, type: 'terrain', latitude: 3.832, longitude: 11.495, surface_m2: 500 },
                { id: 6, titre: 'Commerce Mvog-Ada', prix: 35000000, type: 'commerce', latitude: 3.868, longitude: 11.535, surface_m2: 80 },
            ]);
        } finally { setLoading(false); }
    };

    const prixLabel = (prix: number) => {
        if (prix >= 1000000) return `${(prix / 1000000).toFixed(0)}M`;
        if (prix >= 1000) return `${(prix / 1000).toFixed(0)}K`;
        return prix.toString();
    };

    const typeColor = (type: string) => {
        const colors: Record<string, string> = { villa: '#7C3AED', appartement: modernColors.primary, studio: '#0891B2', duplex: '#D97706', terrain: '#059669', commerce: '#DC2626' };
        return colors[type] || '#6B7280';
    };

    const filteredProperties = properties.filter(p => {
        if (filters.type !== 'all' && p.type !== filters.type) return false;
        if (filters.maxPrix > 0 && p.prix > filters.maxPrix) return false;
        return true;
    });

    const selectedProperty = filteredProperties.find(p => p.id === selectedId);

    return (
        <View style={styles.container}>
            {/* View toggle */}
            <View style={styles.viewToggle}>
                <TouchableOpacity style={[styles.viewBtn, view === 'map' && styles.viewBtnActive]} onPress={() => setView('map')}>
                    <SafeIcon name="map" size={16} color={view === 'map' ? '#fff' : '#6B7280'} />
                    <Text style={[styles.viewBtnText, view === 'map' && styles.viewBtnTextActive]}>Carte</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.viewBtn, view === 'list' && styles.viewBtnActive]} onPress={() => setView('list')}>
                    <SafeIcon name="list" size={16} color={view === 'list' ? '#fff' : '#6B7280'} />
                    <Text style={[styles.viewBtnText, view === 'list' && styles.viewBtnTextActive]}>Liste</Text>
                </TouchableOpacity>
            </View>

            {/* Type filter */}
            <View style={styles.filterRow}>
                {['all', 'appartement', 'villa', 'studio', 'terrain'].map(t => (
                    <TouchableOpacity key={t} style={[styles.filterChip, filters.type === t && styles.filterChipActive]} onPress={() => setFilters(f => ({ ...f, type: t }))}>
                        <Text style={[styles.filterChipText, filters.type === t && styles.filterChipTextActive]}>
                            {t === 'all' ? 'Tous' : t.charAt(0).toUpperCase() + t.slice(1)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading && <View style={styles.loadingOverlay}><ActivityIndicator color={modernColors.primary} size="large" /></View>}

            {view === 'map' ? (
                <>
                    <MapView
                        ref={mapRef}
                        style={styles.map}
                        initialRegion={initialRegion}
                        showsUserLocation
                    >
                        {filteredProperties.map(p => (
                            <Marker
                                key={p.id}
                                coordinate={{ latitude: p.latitude, longitude: p.longitude }}
                                onPress={() => setSelectedId(p.id)}
                            >
                                <View style={[styles.priceMarker, { backgroundColor: selectedId === p.id ? typeColor(p.type) : '#fff', borderColor: typeColor(p.type) }]}>
                                    <Text style={[styles.priceMarkerText, { color: selectedId === p.id ? '#fff' : typeColor(p.type) }]}>{prixLabel(p.prix)}</Text>
                                </View>
                            </Marker>
                        ))}
                    </MapView>

                    {/* Bottom sheet selected */}
                    {selectedProperty && (
                        <View style={styles.bottomSheet}>
                            <View style={styles.bottomSheetHandle} />
                            <TouchableOpacity style={styles.propertyMiniCard} onPress={() => (navigation as any).navigate('ImmobilierDetails', { propertyId: selectedProperty.id })}>
                                <View style={[styles.typeTag, { backgroundColor: typeColor(selectedProperty.type) }]}>
                                    <Text style={styles.typeTagText}>{selectedProperty.type}</Text>
                                </View>
                                <Text style={styles.miniTitle} numberOfLines={1}>{selectedProperty.titre}</Text>
                                <Text style={styles.miniPrice}>{selectedProperty.prix.toLocaleString()} FCFA</Text>
                                {(selectedProperty.surface_m2 || selectedProperty.chambres) && (
                                    <View style={styles.miniDetails}>
                                        {selectedProperty.surface_m2 && <Text style={styles.miniDetail}>{selectedProperty.surface_m2}m²</Text>}
                                        {selectedProperty.chambres && <Text style={styles.miniDetail}>{selectedProperty.chambres} ch.</Text>}
                                    </View>
                                )}
                                <TouchableOpacity style={styles.viewDetailBtn} onPress={() => (navigation as any).navigate('ImmobilierDetails', { propertyId: selectedProperty.id })}>
                                    <Text style={styles.viewDetailBtnText}>Voir le détail</Text>
                                    <SafeIcon name="chevron-right" size={16} color={modernColors.primary} />
                                </TouchableOpacity>
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Count badge */}
                    <View style={styles.countBadge}>
                        <Text style={styles.countBadgeText}>{filteredProperties.length} biens</Text>
                    </View>
                </>
            ) : (
                <FlatList
                    data={filteredProperties}
                    keyExtractor={item => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.listCard} onPress={() => (navigation as any).navigate('ImmobilierDetails', { propertyId: item.id })}>
                            <View style={[styles.listTypeTag, { backgroundColor: `${typeColor(item.type)}20` }]}>
                                <Text style={[styles.listTypeTagText, { color: typeColor(item.type) }]}>{item.type}</Text>
                            </View>
                            <Text style={styles.listTitle}>{item.titre}</Text>
                            <Text style={styles.listPrice}>{item.prix.toLocaleString()} FCFA</Text>
                            {(item.surface_m2 || item.chambres) && (
                                <View style={styles.listMeta}>
                                    {item.surface_m2 && <Text style={styles.listMetaText}>{item.surface_m2}m²</Text>}
                                    {item.chambres && <Text style={styles.listMetaText}>{item.chambres} chambres</Text>}
                                </View>
                            )}
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    viewToggle: { flexDirection: 'row', margin: 12, gap: 8 },
    viewBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff' },
    viewBtnActive: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    viewBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
    viewBtnTextActive: { color: '#fff' },
    filterRow: { flexDirection: 'row', paddingHorizontal: 12, gap: 8, marginBottom: 8 },
    filterChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#fff' },
    filterChipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    filterChipText: { fontSize: 12, fontWeight: '600', color: '#374151' },
    filterChipTextActive: { color: '#fff' },
    map: { flex: 1 },
    loadingOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.7)', zIndex: 10 },
    priceMarker: { paddingHorizontal: 8, paddingVertical: 5, borderRadius: 20, borderWidth: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 3, elevation: 5 },
    priceMarkerText: { fontSize: 12, fontWeight: '800' },
    bottomSheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16, paddingBottom: 30, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10 },
    bottomSheetHandle: { width: 40, height: 4, backgroundColor: '#E5E7EB', borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
    propertyMiniCard: { gap: 6 },
    typeTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
    typeTagText: { color: '#fff', fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    miniTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    miniPrice: { fontSize: 20, fontWeight: '800', color: modernColors.primary },
    miniDetails: { flexDirection: 'row', gap: 12 },
    miniDetail: { fontSize: 13, color: '#6B7280' },
    viewDetailBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6', marginTop: 8 },
    viewDetailBtnText: { fontSize: 14, fontWeight: '700', color: modernColors.primary },
    countBadge: { position: 'absolute', top: 110, right: 16, backgroundColor: modernColors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
    countBadgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    listContent: { padding: 12, gap: 10 },
    listCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    listTypeTag: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, marginBottom: 8 },
    listTypeTagText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
    listTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginBottom: 4 },
    listPrice: { fontSize: 18, fontWeight: '800', color: modernColors.primary, marginBottom: 6 },
    listMeta: { flexDirection: 'row', gap: 12 },
    listMetaText: { fontSize: 13, color: '#6B7280' },
});

export default ImmobilierMapScreen;
