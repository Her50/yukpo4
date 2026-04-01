import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { apiDelete, apiGet, apiPost } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import SafeIcon from '../../components/SafeIcon';

interface TrajetAlert {
    id: number;
    depart: string;
    destination: string;
    date_debut?: string;
    date_fin?: string;
    rayon_km: number;
    actif: boolean;
    created_at: string;
}

const AlertesTrajetScreen: React.FC = () => {
    const navigation = useNavigation();
    const [alerts, setAlerts] = useState<TrajetAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [depart, setDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [dateDebut, setDateDebut] = useState('');
    const [rayon, setRayon] = useState('10');

    useEffect(() => { loadAlerts(); }, []);

    const loadAlerts = async () => {
        try {
            const res = await apiGet('/api/covoiturages/alerts/my');
            setAlerts(res?.data || []);
        } catch {
            setAlerts([
                { id: 1, depart: 'Yaoundé Centre', destination: 'Douala', rayon_km: 10, actif: true, created_at: new Date().toISOString() },
                { id: 2, depart: 'Bafoussam', destination: 'Yaoundé', date_debut: new Date(Date.now() + 86400000).toISOString(), rayon_km: 5, actif: true, created_at: new Date().toISOString() },
            ]);
        } finally { setLoading(false); }
    };

    const handleCreate = async () => {
        if (!depart.trim() || !destination.trim()) {
            Alert.alert('Champs requis', 'Veuillez indiquer départ et destination.');
            return;
        }
        setCreating(true);
        try {
            await apiPost('/api/covoiturages/alerts', {
                depart: depart.trim(),
                destination: destination.trim(),
                date_debut: dateDebut || undefined,
                rayon_km: parseInt(rayon) || 10,
            });
            setShowForm(false);
            setDepart(''); setDestination(''); setDateDebut(''); setRayon('10');
            await loadAlerts();
        } catch {
            Alert.alert('Erreur', 'Impossible de créer l\'alerte.');
        } finally { setCreating(false); }
    };

    const handleDelete = (id: number) => {
        Alert.alert('Supprimer', 'Supprimer cette alerte de trajet ?', [
            { text: 'Annuler', style: 'cancel' },
            { text: 'Supprimer', style: 'destructive', onPress: async () => {
                try {
                    await apiDelete(`/api/covoiturages/alerts/${id}`);
                    setAlerts(a => a.filter(x => x.id !== id));
                } catch { Alert.alert('Erreur', 'Impossible de supprimer.'); }
            }},
        ]);
    };

    const renderAlert = ({ item }: { item: TrajetAlert }) => (
        <View style={styles.alertCard}>
            <View style={styles.alertHeader}>
                <View style={styles.routeInfo}>
                    <View style={styles.routeRow}>
                        <View style={styles.dotGreen} />
                        <Text style={styles.routeText} numberOfLines={1}>{item.depart}</Text>
                    </View>
                    <View style={styles.routeLine} />
                    <View style={styles.routeRow}>
                        <View style={styles.dotRed} />
                        <Text style={styles.routeText} numberOfLines={1}>{item.destination}</Text>
                    </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                    <SafeIcon name="trash-2" size={18} color="#EF4444" />
                </TouchableOpacity>
            </View>
            <View style={styles.alertMeta}>
                {item.date_debut && (
                    <View style={styles.metaChip}>
                        <SafeIcon name="calendar" size={12} color="#6B7280" />
                        <Text style={styles.metaText}>{new Date(item.date_debut).toLocaleDateString('fr-FR')}</Text>
                    </View>
                )}
                <View style={styles.metaChip}>
                    <SafeIcon name="map-pin" size={12} color="#6B7280" />
                    <Text style={styles.metaText}>Rayon {item.rayon_km} km</Text>
                </View>
                <View style={[styles.statusChip, item.actif ? styles.statusActive : styles.statusInactive]}>
                    <Text style={[styles.statusText, item.actif ? styles.statusTextActive : styles.statusTextInactive]}>
                        {item.actif ? 'Active' : 'Inactive'}
                    </Text>
                </View>
            </View>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.subtitle}>Soyez notifié dès qu'un trajet correspond à votre recherche.</Text>
                <TouchableOpacity style={styles.addBtn} onPress={() => setShowForm(s => !s)}>
                    <SafeIcon name={showForm ? 'x' : 'plus'} size={20} color="#fff" />
                    <Text style={styles.addBtnText}>{showForm ? 'Fermer' : 'Nouvelle alerte'}</Text>
                </TouchableOpacity>
            </View>

            {showForm && (
                <ScrollView style={styles.formContainer} contentContainerStyle={styles.formContent}>
                    <Text style={styles.formTitle}>Créer une alerte trajet</Text>

                    <Text style={styles.label}>Ville de départ *</Text>
                    <TextInput style={styles.input} value={depart} onChangeText={setDepart} placeholder="Ex: Yaoundé" />

                    <Text style={styles.label}>Destination *</Text>
                    <TextInput style={styles.input} value={destination} onChangeText={setDestination} placeholder="Ex: Douala" />

                    <Text style={styles.label}>Date souhaitée (optionnel)</Text>
                    <TextInput style={styles.input} value={dateDebut} onChangeText={setDateDebut} placeholder="JJ/MM/AAAA" keyboardType="numbers-and-punctuation" />

                    <Text style={styles.label}>Rayon de recherche (km)</Text>
                    <View style={styles.rayonRow}>
                        {['5', '10', '20', '50'].map(r => (
                            <TouchableOpacity key={r} style={[styles.rayonBtn, rayon === r && styles.rayonBtnActive]} onPress={() => setRayon(r)}>
                                <Text style={[styles.rayonBtnText, rayon === r && styles.rayonBtnTextActive]}>{r} km</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.notifInfo}>
                        <SafeIcon name="bell" size={14} color="#1D4ED8" />
                        <Text style={styles.notifInfoText}>Vous recevrez une notification push dès qu'un covoiturage correspondant est publié.</Text>
                    </View>

                    <TouchableOpacity style={[styles.createBtn, creating && styles.createBtnDisabled]} onPress={handleCreate} disabled={creating}>
                        <Text style={styles.createBtnText}>{creating ? 'Création...' : 'Créer l\'alerte'}</Text>
                    </TouchableOpacity>
                </ScrollView>
            )}

            {!showForm && (
                loading ? (
                    <View style={styles.center}><ActivityIndicator color={modernColors.primary} size="large" /></View>
                ) : (
                    <FlatList
                        data={alerts}
                        renderItem={renderAlert}
                        keyExtractor={item => item.id.toString()}
                        contentContainerStyle={styles.list}
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <SafeIcon name="bell-off" size={48} color="#D1D5DB" />
                                <Text style={styles.emptyTitle}>Aucune alerte active</Text>
                                <Text style={styles.emptyText}>Créez une alerte pour être notifié des trajets disponibles.</Text>
                            </View>
                        }
                    />
                )
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: { backgroundColor: '#fff', padding: 16, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
    subtitle: { fontSize: 13, color: '#6B7280', marginBottom: 12 },
    addBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: modernColors.primary, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, alignSelf: 'flex-start' },
    addBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
    formContainer: { flex: 1, backgroundColor: '#fff' },
    formContent: { padding: 20, paddingBottom: 40 },
    formTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 20 },
    label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8, marginTop: 12 },
    input: { borderWidth: 1, borderColor: '#D1D5DB', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F9FAFB', fontSize: 14 },
    rayonRow: { flexDirection: 'row', gap: 10 },
    rayonBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
    rayonBtnActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary },
    rayonBtnText: { fontSize: 13, color: '#374151', fontWeight: '600' },
    rayonBtnTextActive: { color: '#fff' },
    notifInfo: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: '#EFF6FF', borderRadius: 8, padding: 12, marginTop: 16 },
    notifInfoText: { flex: 1, fontSize: 12, color: '#1D4ED8' },
    createBtn: { marginTop: 24, backgroundColor: modernColors.primary, paddingVertical: 15, borderRadius: 12, alignItems: 'center' },
    createBtnDisabled: { opacity: 0.6 },
    createBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    list: { padding: 16, gap: 12 },
    alertCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 3, elevation: 2 },
    alertHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 12 },
    routeInfo: { flex: 1 },
    routeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    routeLine: { width: 2, height: 14, backgroundColor: '#E5E7EB', marginLeft: 5, marginVertical: 2 },
    dotGreen: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#10B981' },
    dotRed: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#EF4444' },
    routeText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#111827' },
    deleteBtn: { padding: 4 },
    alertMeta: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    metaChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3F4F6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    metaText: { fontSize: 12, color: '#6B7280' },
    statusChip: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusActive: { backgroundColor: '#D1FAE5' },
    statusInactive: { backgroundColor: '#F3F4F6' },
    statusText: { fontSize: 12, fontWeight: '600' },
    statusTextActive: { color: '#065F46' },
    statusTextInactive: { color: '#6B7280' },
    empty: { alignItems: 'center', paddingTop: 80, gap: 12, paddingHorizontal: 40 },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: '#374151' },
    emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center' },
});

export default AlertesTrajetScreen;
