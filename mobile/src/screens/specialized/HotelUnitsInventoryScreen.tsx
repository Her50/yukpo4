import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
import {
    Alert,
    FlatList,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { NativeButton } from '../../components/SafeNativeDesign';
import MediaUploader, { MediaItem } from '../../components/specialized/MediaUploader';
import { immobilierService, HotelUnit } from '../../services/immobilierService';

const emptyForm = {
    unit_number: '',
    unit_type: 'chambre',
    standing: 'standard',
    capacite_max_adultes: '2',
    capacite_max_enfants: '0',
    prix_nuitee: '',
    virtual_tour_url: '',
    floor_number: '',
    room_position: '',
    notes: '',
};

const HotelUnitsInventoryScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute() as any;
    const propertyId = Number(route?.params?.propertyId || 0);
    const propertyName = String(route?.params?.propertyName || 'Bien');

    const [loading, setLoading] = useState(false);
    const [units, setUnits] = useState<HotelUnit[]>([]);
    const [showModal, setShowModal] = useState(false);
    const [editingUnit, setEditingUnit] = useState<HotelUnit | null>(null);
    const [form, setForm] = useState(emptyForm);
    const [unitMedia, setUnitMedia] = useState<MediaItem[]>([]);
    const [tourMedia, setTourMedia] = useState<MediaItem[]>([]);

    const loadUnits = useCallback(async () => {
        if (!propertyId) return;
        try {
            setLoading(true);
            const res = await immobilierService.getPropertyUnits(propertyId);
            const data = ((res as any)?.data?.data || (res as any)?.data || []) as HotelUnit[];
            setUnits(Array.isArray(data) ? data : []);
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de charger les unités.');
        } finally {
            setLoading(false);
        }
    }, [propertyId]);

    useEffect(() => {
        loadUnits();
    }, [loadUnits]);

    const openCreate = () => {
        setEditingUnit(null);
        setForm(emptyForm);
        setUnitMedia([]);
        setTourMedia([]);
        setShowModal(true);
    };

    const openEdit = (u: HotelUnit) => {
        setEditingUnit(u);
        setForm({
            unit_number: u.unit_number || '',
            unit_type: u.unit_type || 'chambre',
            standing: u.standing || 'standard',
            capacite_max_adultes: String(u.capacite_max_adultes || 2),
            capacite_max_enfants: String(u.capacite_max_enfants || 0),
            prix_nuitee: u.prix_nuitee != null ? String(u.prix_nuitee) : '',
            virtual_tour_url: u.virtual_tour_url || '',
            floor_number: u.floor_number != null ? String(u.floor_number) : '',
            room_position: u.room_position != null ? String(u.room_position) : '',
            notes: u.notes || '',
        });
        setUnitMedia([
            ...(u.photos || []).map((url) => ({ uri: url, type: 'image' as const, uploaded: true, uploadUrl: url })),
            ...(u.video_urls || []).map((url) => ({ uri: url, type: 'video' as const, uploaded: true, uploadUrl: url })),
        ]);
        setTourMedia((u.virtual_tour_media || []).map((url) => ({ uri: url, type: 'video' as const, uploaded: true, uploadUrl: url })));
        setShowModal(true);
    };

    const submit = async () => {
        if (!form.unit_number.trim()) {
            Alert.alert('Erreur', 'Numéro de chambre requis.');
            return;
        }
        try {
            setLoading(true);
            const payload = {
                unit_number: form.unit_number.trim(),
                unit_type: form.unit_type.trim() || 'chambre',
                standing: form.standing.trim() || 'standard',
                capacite_max_adultes: parseInt(form.capacite_max_adultes, 10) || 2,
                capacite_max_enfants: parseInt(form.capacite_max_enfants, 10) || 0,
                prix_nuitee: form.prix_nuitee ? parseFloat(form.prix_nuitee) : undefined,
                virtual_tour_url: form.virtual_tour_url.trim() || undefined,
                floor_number: form.floor_number ? parseInt(form.floor_number, 10) : undefined,
                room_position: form.room_position ? parseInt(form.room_position, 10) : undefined,
                photos: unitMedia.filter((m) => m.type === 'image').map((m) => m.uploadUrl || m.uri).filter(Boolean),
                video_urls: unitMedia.filter((m) => m.type === 'video').map((m) => m.uploadUrl || m.uri).filter(Boolean),
                virtual_tour_media: tourMedia.map((m) => m.uploadUrl || m.uri).filter(Boolean),
                notes: form.notes.trim() || undefined,
            };
            if (editingUnit?.id) {
                await immobilierService.updatePropertyUnit(editingUnit.id, payload);
            } else {
                await immobilierService.createPropertyUnit(propertyId, payload);
            }
            setShowModal(false);
            await loadUnits();
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Enregistrement impossible.');
        } finally {
            setLoading(false);
        }
    };

    const removeUnit = async (u: HotelUnit) => {
        Alert.alert('Suppression', `Supprimer ${u.unit_number} ?`, [
            { text: 'Annuler', style: 'cancel' },
            {
                text: 'Supprimer',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await immobilierService.deletePropertyUnit(u.id);
                        await loadUnits();
                    } catch (e: any) {
                        Alert.alert('Erreur', e?.message || 'Suppression impossible.');
                    }
                },
            },
        ]);
    };

    return (
        <View style={s.container}>
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={22} color="#111827" />
                </TouchableOpacity>
                <Text style={s.title} numberOfLines={1}>{`Inventaire chambres · ${propertyName}`}</Text>
                <TouchableOpacity onPress={openCreate}>
                    <SafeIcon name="plus" size={22} color="#2563EB" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={units}
                keyExtractor={(item) => String(item.id)}
                onRefresh={loadUnits}
                refreshing={loading}
                contentContainerStyle={{ padding: 14, paddingBottom: 120 }}
                renderItem={({ item }) => (
                    <View style={s.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={s.unitNumber}>{item.unit_number}</Text>
                            <Text style={s.meta}>{`${item.unit_type || 'chambre'} · ${item.standing || 'standard'}`}</Text>
                            <Text style={s.meta}>{`Capacité: ${item.capacite_max_total || 0}`}</Text>
                            <Text style={s.meta}>{`Prix: ${item.prix_nuitee || 0} / nuit`}</Text>
                            <Text style={s.meta}>{`Médias: ${(item.photos || []).length} photos · ${(item.video_urls || []).length} vidéos`}</Text>
                            {(item.virtual_tour_url || (item.virtual_tour_media || []).length > 0) ? <Text style={s.tour}>Visite 360 liée</Text> : null}
                        </View>
                        <View style={{ gap: 10 }}>
                            <TouchableOpacity onPress={() => openEdit(item)}>
                                <SafeIcon name="edit" size={18} color="#2563EB" />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => removeUnit(item)}>
                                <SafeIcon name="trash-2" size={18} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
                ListEmptyComponent={<Text style={s.empty}>Aucune unité créée.</Text>}
            />

            <Modal visible={showModal} transparent animationType="slide" onRequestClose={() => setShowModal(false)}>
                <View style={s.overlay}>
                    <View style={s.modal}>
                        <Text style={s.modalTitle}>{editingUnit ? 'Modifier unité' : 'Nouvelle unité'}</Text>
                        {[
                            ['Numéro', 'unit_number'],
                            ['Type', 'unit_type'],
                            ['Standing', 'standing'],
                            ['Capacité adultes', 'capacite_max_adultes'],
                            ['Capacité enfants', 'capacite_max_enfants'],
                            ['Prix/nuit', 'prix_nuitee'],
                            ['URL visite virtuelle', 'virtual_tour_url'],
                            ['Etage', 'floor_number'],
                            ['Position', 'room_position'],
                            ['Notes', 'notes'],
                        ].map(([label, key]) => (
                            <View key={key} style={{ marginBottom: 8 }}>
                                <Text style={s.label}>{label}</Text>
                                <TextInput
                                    style={s.input}
                                    value={(form as any)[key]}
                                    onChangeText={(v) => setForm((p) => ({ ...p, [key]: v }))}
                                    placeholder={label}
                                />
                            </View>
                        ))}
                        <MediaUploader
                            media={unitMedia}
                            onMediaChange={setUnitMedia}
                            maxImages={12}
                            maxVideos={6}
                            allowVideos
                            label="Médias unité (photos + vidéos)"
                        />
                        <MediaUploader
                            media={tourMedia}
                            onMediaChange={setTourMedia}
                            maxImages={0}
                            maxVideos={4}
                            allowVideos
                            label="Visite 360 (1..n vidéos)"
                        />
                        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                            <NativeButton title="Annuler" variant="secondary" onPress={() => setShowModal(false)} style={{ flex: 1 }} />
                            <NativeButton title="Enregistrer" variant="primary" onPress={submit} style={{ flex: 1 }} />
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F3F4F6' },
    header: { paddingTop: 50, paddingHorizontal: 14, paddingBottom: 12, backgroundColor: '#fff', flexDirection: 'row', alignItems: 'center', gap: 10 },
    title: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
    card: { backgroundColor: '#fff', borderRadius: 12, padding: 12, marginBottom: 10, flexDirection: 'row', gap: 10 },
    unitNumber: { fontSize: 16, fontWeight: '700', color: '#111827' },
    meta: { fontSize: 12, color: '#4B5563', marginTop: 2 },
    tour: { fontSize: 12, color: '#2563EB', marginTop: 4, fontWeight: '600' },
    empty: { textAlign: 'center', color: '#6B7280', marginTop: 40 },
    overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
    modal: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, padding: 14, maxHeight: '88%' },
    modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 8 },
    label: { fontSize: 12, color: '#374151', marginBottom: 4 },
    input: { backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
});

export default HotelUnitsInventoryScreen;

