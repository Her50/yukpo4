import { useNavigation, useRoute } from '@react-navigation/native';
import { ResizeMode, Video } from 'expo-av';
import React, { useEffect, useState } from 'react';
import { Alert, FlatList, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { immobilierService, HotelUnit } from '../../services/immobilierService';

const PLAN_REFRESH_MS = 10000;

const HotelUnitSelectionScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const propertyId = Number(route?.params?.propertyId || 0);
    const dateArrivee = String(route?.params?.dateArrivee || '');
    const dateDepart = String(route?.params?.dateDepart || '');
    const nombreAdultes = Number(route?.params?.nombreAdultes || 1);
    const nombreEnfants = Number(route?.params?.nombreEnfants || 0);

    const [loading, setLoading] = useState(false);
    const [units, setUnits] = useState<HotelUnit[]>([]);
    const [planUnits, setPlanUnits] = useState<HotelUnit[]>([]);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [lastRefreshAt, setLastRefreshAt] = useState<Date | null>(null);
    const [selectedFloor, setSelectedFloor] = useState<number | 'all'>('all');
    const [selectedType, setSelectedType] = useState<string>('all');
    const [selectedStanding, setSelectedStanding] = useState<string>('all');
    const [recentlyChangedIds, setRecentlyChangedIds] = useState<number[]>([]);
    const [recentChangeLabels, setRecentChangeLabels] = useState<Record<number, string>>({});
    const [prevStatusByUnitId, setPrevStatusByUnitId] = useState<Record<number, string>>({});

    const statusToLabel = (status?: string): string => {
        if (status === 'available') return 'Dispo';
        if (status === 'occupied') return 'Occupee';
        if (status === 'blocked') return 'Bloquee';
        return 'Indispo';
    };

    const loadData = async (silent = false) => {
        if (!propertyId || !dateArrivee || !dateDepart) return;
        try {
            if (!silent) setLoading(true);
            const [res, planRes] = await Promise.all([
                immobilierService.getAvailableUnits(propertyId, {
                    date_arrivee: dateArrivee,
                    date_depart: dateDepart,
                    nombre_adultes: nombreAdultes,
                    nombre_enfants: nombreEnfants,
                }),
                immobilierService.getUnitsPlan(propertyId, {
                    date_arrivee: dateArrivee,
                    date_depart: dateDepart,
                }),
            ]);
            const data = ((res as any)?.data?.data || (res as any)?.data || []) as HotelUnit[];
            setUnits(Array.isArray(data) ? data : []);
            const planData = ((planRes as any)?.data?.data || (planRes as any)?.data || []) as HotelUnit[];
            const normalizedPlan = Array.isArray(planData) ? planData : [];
            const changedIds: number[] = [];
            const changedLabels: Record<number, string> = {};
            normalizedPlan.forEach((u) => {
                if (!u?.id) return;
                const prev = prevStatusByUnitId[u.id];
                const curr = u.status || '';
                if (prev && curr && prev !== curr) {
                    changedIds.push(u.id);
                    changedLabels[u.id] = `${statusToLabel(prev)} -> ${statusToLabel(curr)}`;
                }
            });
            if (changedIds.length > 0) {
                setRecentlyChangedIds(changedIds);
                setRecentChangeLabels((prev) => ({ ...prev, ...changedLabels }));
                setTimeout(() => {
                    setRecentlyChangedIds((old) => old.filter((id) => !changedIds.includes(id)));
                    setRecentChangeLabels((old) => {
                        const next = { ...old };
                        changedIds.forEach((id) => { delete next[id]; });
                        return next;
                    });
                }, PLAN_REFRESH_MS);
            }
            const nextStatusMap: Record<number, string> = {};
            normalizedPlan.forEach((u) => {
                if (u?.id) nextStatusMap[u.id] = u.status || '';
            });
            setPrevStatusByUnitId(nextStatusMap);
            setPlanUnits(normalizedPlan);
            setLastRefreshAt(new Date());
        } catch (e: any) {
            if (!silent) {
                Alert.alert('Erreur', e?.message || 'Impossible de charger les chambres disponibles.');
            }
        } finally {
            if (!silent) setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [propertyId, dateArrivee, dateDepart, nombreAdultes, nombreEnfants]);

    useEffect(() => {
        const timer = setInterval(() => {
            loadData(true);
        }, PLAN_REFRESH_MS);
        return () => clearInterval(timer);
    }, [propertyId, dateArrivee, dateDepart, nombreAdultes, nombreEnfants]);

    const availableFloors = Array.from(
        new Set(
            planUnits
                .map((u) => (typeof u.floor_number === 'number' ? u.floor_number : 0))
        )
    ).sort((a, b) => a - b);
    const availableTypes = Array.from(
        new Set(planUnits.map((u) => (u.unit_type || 'chambre').trim()))
    ).sort();
    const availableStandings = Array.from(
        new Set(planUnits.map((u) => (u.standing || 'standard').trim()))
    ).sort();

    const filteredPlanUnits = planUnits.filter((u) => {
        const floorOk = selectedFloor === 'all' || (u.floor_number || 0) === selectedFloor;
        const typeOk = selectedType === 'all' || (u.unit_type || 'chambre') === selectedType;
        const standingOk = selectedStanding === 'all' || (u.standing || 'standard') === selectedStanding;
        return floorOk && typeOk && standingOk;
    });

    const planByFloor = filteredPlanUnits.reduce<Record<string, HotelUnit[]>>((acc, unit) => {
        const floor = String(unit.floor_number || 0);
        if (!acc[floor]) acc[floor] = [];
        acc[floor].push(unit);
        return acc;
    }, {});
    const sortedFloors = Object.keys(planByFloor).sort((a, b) => Number(a) - Number(b));

    const choose = (u: HotelUnit) => {
        (navigation as any).navigate('HotelBooking', {
            selectedUnit: {
                id: u.id,
                unit_number: u.unit_number,
                prix_nuitee: u.prix_nuitee || 0,
                virtual_tour_url: u.virtual_tour_url || null,
                virtual_tour_media: u.virtual_tour_media || [],
            },
        });
        navigation.goBack();
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={s.title}>Choisir ma chambre</Text>
                <View style={{ width: 22 }} />
            </View>
            <Text style={s.sub}>{`${dateArrivee} -> ${dateDepart}`}</Text>

            <FlatList
                data={units}
                keyExtractor={(item) => String(item.id)}
                refreshing={loading}
                onRefresh={() => loadData()}
                contentContainerStyle={{ padding: 14, paddingBottom: 80 }}
                renderItem={({ item }) => (
                    <View style={s.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.unit}>{`Chambre ${item.unit_number}`}</Text>
                            <Text style={s.meta}>{`${item.unit_type || 'chambre'} · ${item.standing || 'standard'}`}</Text>
                            <Text style={s.meta}>{`Capacité ${item.capacite_max_total || 0}`}</Text>
                            <Text style={s.price}>{`${item.prix_nuitee || 0} / nuit`}</Text>
                            {(item.virtual_tour_media || []).length > 0 ? (
                                <TouchableOpacity onPress={() => setVideoUrl(item.virtual_tour_media?.[0] || null)}>
                                    <Text style={s.link}>Lire visite 360 (in-app)</Text>
                                </TouchableOpacity>
                            ) : item.virtual_tour_url ? (
                                <TouchableOpacity onPress={() => setVideoUrl(item.virtual_tour_url || null)}>
                                    <Text style={s.link}>Lire vidéo de visite (in-app)</Text>
                                </TouchableOpacity>
                            ) : null}
                        </View>
                        <TouchableOpacity style={s.btn} onPress={() => choose(item)}>
                            <Text style={s.btnTxt}>Choisir</Text>
                        </TouchableOpacity>
                    </View>
                )}
                ListEmptyComponent={<Text style={s.empty}>Aucune chambre disponible pour ces dates.</Text>}
                ListHeaderComponent={(
                    <View style={s.planWrap}>
                        <Text style={s.planTitle}>Mini-plan étage/chambres (temps réel)</Text>
                        <View style={s.legendRow}>
                            <View style={s.legendItem}><View style={[s.legendDot, s.cellAvailable]} /><Text style={s.legendText}>Disponible</Text></View>
                            <View style={s.legendItem}><View style={[s.legendDot, s.cellOccupied]} /><Text style={s.legendText}>Occupée</Text></View>
                            <View style={s.legendItem}><View style={[s.legendDot, s.cellBlocked]} /><Text style={s.legendText}>Bloquée</Text></View>
                        </View>
                        <View style={s.refreshRow}>
                            <Text style={s.refreshText}>
                                {lastRefreshAt ? `Maj: ${lastRefreshAt.toLocaleTimeString()} · auto ${PLAN_REFRESH_MS / 1000}s` : 'Maj en cours...'}
                            </Text>
                            <TouchableOpacity style={s.refreshBtn} onPress={() => loadData()}>
                                <SafeIcon name="refresh-cw" size={12} color="#2563EB" />
                                <Text style={s.refreshBtnTxt}>Forcer refresh</Text>
                            </TouchableOpacity>
                        </View>

                        <View style={s.filtersWrap}>
                            <Text style={s.filterLabel}>Etage</Text>
                            <View style={s.filterRow}>
                                <TouchableOpacity style={[s.filterChip, selectedFloor === 'all' && s.filterChipActive]} onPress={() => setSelectedFloor('all')}>
                                    <Text style={[s.filterChipTxt, selectedFloor === 'all' && s.filterChipTxtActive]}>Tous</Text>
                                </TouchableOpacity>
                                {availableFloors.map((f) => (
                                    <TouchableOpacity key={`f-${f}`} style={[s.filterChip, selectedFloor === f && s.filterChipActive]} onPress={() => setSelectedFloor(f)}>
                                        <Text style={[s.filterChipTxt, selectedFloor === f && s.filterChipTxtActive]}>{f}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={s.filterLabel}>Type</Text>
                            <View style={s.filterRow}>
                                <TouchableOpacity style={[s.filterChip, selectedType === 'all' && s.filterChipActive]} onPress={() => setSelectedType('all')}>
                                    <Text style={[s.filterChipTxt, selectedType === 'all' && s.filterChipTxtActive]}>Tous</Text>
                                </TouchableOpacity>
                                {availableTypes.map((t) => (
                                    <TouchableOpacity key={`t-${t}`} style={[s.filterChip, selectedType === t && s.filterChipActive]} onPress={() => setSelectedType(t)}>
                                        <Text style={[s.filterChipTxt, selectedType === t && s.filterChipTxtActive]}>{t}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <Text style={s.filterLabel}>Standing</Text>
                            <View style={s.filterRow}>
                                <TouchableOpacity style={[s.filterChip, selectedStanding === 'all' && s.filterChipActive]} onPress={() => setSelectedStanding('all')}>
                                    <Text style={[s.filterChipTxt, selectedStanding === 'all' && s.filterChipTxtActive]}>Tous</Text>
                                </TouchableOpacity>
                                {availableStandings.map((st) => (
                                    <TouchableOpacity key={`s-${st}`} style={[s.filterChip, selectedStanding === st && s.filterChipActive]} onPress={() => setSelectedStanding(st)}>
                                        <Text style={[s.filterChipTxt, selectedStanding === st && s.filterChipTxtActive]}>{st}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {sortedFloors.map((floor) => {
                            const floorUnits = planByFloor[floor]
                                .slice()
                                .sort((a, b) => (a.room_position || 0) - (b.room_position || 0) || String(a.unit_number).localeCompare(String(b.unit_number)));
                            const dispo = floorUnits.filter((u) => u.status === 'available').length;
                            const occ = floorUnits.filter((u) => u.status === 'occupied').length;
                            const blocked = floorUnits.filter((u) => u.status !== 'available' && u.status !== 'occupied').length;
                            return (
                                <View key={`floor-${floor}`} style={s.floorSection}>
                                    <View style={s.floorHeader}>
                                        <Text style={s.floorTitle}>{`Etage ${floor}`}</Text>
                                        <Text style={s.floorCounters}>{`Dispo ${dispo} · Occupées ${occ} · Bloquées ${blocked}`}</Text>
                                    </View>
                                    <View style={s.planGrid}>
                                        {floorUnits.map((u) => (
                                            <View key={`plan-${u.id}`} style={[s.cell, u.status === 'available' ? s.cellAvailable : u.status === 'occupied' ? s.cellOccupied : s.cellBlocked]}>
                                                <Text style={s.cellNumber}>{u.unit_number}</Text>
                                                <Text style={s.cellState}>
                                                    {u.status === 'available' ? 'Dispo' : u.status === 'occupied' ? 'Occupée' : 'Bloquée'}
                                                </Text>
                                                {recentlyChangedIds.includes(u.id) ? (
                                                    <View style={s.changedBadge}>
                                                        <Text style={s.changedBadgeTxt}>
                                                            {recentChangeLabels[u.id] || 'Changement'}
                                                        </Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                        ))}
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}
            />
            <Modal visible={!!videoUrl} transparent animationType="fade" onRequestClose={() => setVideoUrl(null)}>
                <View style={s.videoOverlay}>
                    <TouchableOpacity style={s.videoClose} onPress={() => setVideoUrl(null)}>
                        <SafeIcon name="x" size={22} color="#fff" />
                    </TouchableOpacity>
                    {videoUrl ? (
                        <Video
                            source={{ uri: videoUrl }}
                            style={s.video}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                        />
                    ) : null}
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { paddingTop: 50, paddingHorizontal: 14, paddingBottom: 10, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, fontSize: 18, fontWeight: '700', color: '#111827', textAlign: 'center' },
    sub: { paddingHorizontal: 14, paddingVertical: 10, color: '#4B5563', fontSize: 12 },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 12 },
    unit: { fontSize: 16, fontWeight: '700', color: '#111827' },
    meta: { fontSize: 12, color: '#6B7280', marginTop: 2 },
    price: { fontSize: 13, color: '#2563EB', fontWeight: '700', marginTop: 4 },
    link: { color: '#7C3AED', marginTop: 6, fontSize: 12, fontWeight: '600' },
    planWrap: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 12 },
    planTitle: { fontSize: 13, color: '#111827', fontWeight: '700', marginBottom: 8 },
    legendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 6 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 12, height: 12, borderRadius: 6 },
    legendText: { fontSize: 11, color: '#374151', fontWeight: '600' },
    refreshText: { fontSize: 11, color: '#6B7280', marginBottom: 8 },
    refreshRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
    refreshBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderColor: '#BFDBFE', backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
    refreshBtnTxt: { fontSize: 11, color: '#2563EB', fontWeight: '700' },
    filtersWrap: { marginBottom: 8 },
    filterLabel: { fontSize: 11, color: '#374151', fontWeight: '700', marginTop: 2, marginBottom: 4 },
    filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    filterChip: { borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#F9FAFB', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
    filterChipActive: { borderColor: '#2563EB', backgroundColor: '#DBEAFE' },
    filterChipTxt: { fontSize: 11, color: '#4B5563', fontWeight: '600' },
    filterChipTxtActive: { color: '#1D4ED8' },
    floorSection: { marginBottom: 10 },
    floorHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
    floorTitle: { fontSize: 12, color: '#111827', fontWeight: '800' },
    floorCounters: { fontSize: 11, color: '#4B5563', fontWeight: '700' },
    planGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    cell: { width: 76, borderRadius: 10, paddingVertical: 8, paddingHorizontal: 6, alignItems: 'center' },
    cellAvailable: { backgroundColor: '#DCFCE7' },
    cellOccupied: { backgroundColor: '#FEE2E2' },
    cellBlocked: { backgroundColor: '#E5E7EB' },
    cellNumber: { fontSize: 12, color: '#111827', fontWeight: '700' },
    cellState: { fontSize: 10, color: '#374151', marginTop: 2, fontWeight: '600' },
    changedBadge: { marginTop: 4, backgroundColor: '#FEF3C7', borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
    changedBadgeTxt: { fontSize: 9, color: '#92400E', fontWeight: '800' },
    btn: { alignSelf: 'center', backgroundColor: '#2563EB', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
    btnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
    empty: { textAlign: 'center', marginTop: 40, color: '#6B7280' },
    videoOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center', alignItems: 'center' },
    video: { width: '100%', height: 320 },
    videoClose: { position: 'absolute', top: 46, right: 16, zIndex: 2, backgroundColor: 'rgba(0,0,0,0.4)', padding: 6, borderRadius: 16 },
});

export default HotelUnitSelectionScreen;

