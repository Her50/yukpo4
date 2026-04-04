// ✅ Écran Import permanent via lien Drive / cloud
//
// Permet à un partenaire (pharmacie, supermarché, e-commerce) de :
//   1. Coller son lien Google Drive / Dropbox / URL directe vers un CSV
//   2. Choisir la fréquence de synchronisation (horaire / quotidien / hebdo)
//   3. Voir le statut de ses liens et déclencher une sync manuelle
//
// Le backend convertit automatiquement le lien en URL de téléchargement direct
// et lance un import CSV → upsert produits dans la bonne table selon service_type.

import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Linking,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { apiDelete, apiGet, apiPatch, apiPost } from '../../services/api';
import { hapticPress } from '../../utils/hapticFeedback';

interface ImportLink {
    id: number;
    service_type: string;
    service_id: number;
    drive_url: string;
    file_format: string;
    sync_schedule: string;
    sync_hour: number;
    label?: string;
    is_active: boolean;
    last_sync_at?: string;
    last_sync_status?: string;
    last_sync_count?: number;
    last_sync_error?: string;
    created_at: string;
}

const SCHEDULES = [
    { key: 'manual',  label: 'Manuel uniquement',    icon: 'hand' },
    { key: 'hourly',  label: 'Toutes les heures',    icon: 'clock' },
    { key: 'daily',   label: 'Chaque jour',           icon: 'calendar' },
    { key: 'weekly',  label: 'Chaque semaine',        icon: 'repeat' },
];

const STATUS_COLORS: Record<string, string> = {
    success: '#059669',
    error:   '#EF4444',
    running: '#F59E0B',
};

const DriveImportLinkScreen: React.FC = () => {
    const navigation = useNavigation();
    const route = useRoute();
    const { serviceType, serviceId, serviceName } = (route.params as any) || {};

    const [links, setLinks] = useState<ImportLink[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Form state
    const [driveUrl, setDriveUrl] = useState('');
    const [label, setLabel] = useState('');
    const [syncSchedule, setSyncSchedule] = useState('daily');
    const [syncHour, setSyncHour] = useState('3');
    const [saving, setSaving] = useState(false);
    const [showForm, setShowForm] = useState(false);

    // Syncing state (linkId → boolean)
    const [syncing, setSyncing] = useState<Record<number, boolean>>({});

    useFocusEffect(useCallback(() => {
        loadLinks();
    }, []));

    const loadLinks = async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        try {
            const res = await apiGet<any>('/api/partner/import-links');
            if (res.success) {
                const filtered = (res.links || []).filter(
                    (l: ImportLink) => l.service_type === serviceType && l.service_id === serviceId
                );
                setLinks(filtered);
            }
        } catch (e) {
            console.error('[DriveImportLinkScreen] erreur:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleSave = async () => {
        if (!driveUrl.trim()) {
            Alert.alert('Champ requis', 'Collez votre lien Google Drive, Dropbox ou URL directe.');
            return;
        }
        hapticPress();
        setSaving(true);
        try {
            const res = await apiPost<any>('/api/partner/import-links', {
                service_type: serviceType,
                service_id: serviceId,
                drive_url: driveUrl.trim(),
                sync_schedule: syncSchedule,
                sync_hour: parseInt(syncHour) || 3,
                label: label.trim() || undefined,
            });
            if (res.success) {
                Alert.alert(
                    'Lien enregistré !',
                    `Votre fichier sera synchronisé ${SCHEDULES.find(s => s.key === syncSchedule)?.label?.toLowerCase() || syncSchedule}.\n\nVoulez-vous lancer une première synchronisation maintenant ?`,
                    [
                        { text: 'Plus tard', style: 'cancel', onPress: () => { setShowForm(false); resetForm(); loadLinks(); } },
                        {
                            text: 'Sync maintenant',
                            onPress: async () => {
                                setShowForm(false);
                                resetForm();
                                await loadLinks();
                                // Sync le lien qui vient d'être créé
                                if (res.link_id) handleManualSync(res.link_id);
                            },
                        },
                    ]
                );
            } else {
                Alert.alert('Erreur', res.error || 'Impossible d\'enregistrer le lien');
            }
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Erreur réseau');
        } finally {
            setSaving(false);
        }
    };

    const resetForm = () => {
        setDriveUrl('');
        setLabel('');
        setSyncSchedule('daily');
        setSyncHour('3');
    };

    const handleManualSync = async (linkId: number) => {
        hapticPress();
        setSyncing(prev => ({ ...prev, [linkId]: true }));
        try {
            const res = await apiPost<any>(`/api/partner/import-links/${linkId}/sync`, {});
            if (res.success) {
                Alert.alert('Sync lancée', 'Import en cours en arrière-plan. Actualisez dans quelques secondes pour voir le résultat.');
                setTimeout(loadLinks, 4000); // refresh auto après 4s
            } else {
                Alert.alert('Erreur', res.error || 'Impossible de lancer la sync');
            }
        } catch (e: any) {
            Alert.alert('Erreur', e.message || 'Erreur réseau');
        } finally {
            setSyncing(prev => ({ ...prev, [linkId]: false }));
        }
    };

    const handleToggle = async (linkId: number) => {
        hapticPress();
        try {
            const res = await apiPatch<any>(`/api/partner/import-links/${linkId}/toggle`, {});
            if (res.success) {
                setLinks(prev => prev.map(l => l.id === linkId ? { ...l, is_active: res.is_active } : l));
            }
        } catch {}
    };

    const handleDelete = (linkId: number) => {
        Alert.alert(
            'Supprimer ce lien ?',
            'La synchronisation automatique sera arrêtée. Les produits déjà importés restent dans le catalogue.',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await apiDelete<any>(`/api/partner/import-links/${linkId}`);
                            setLinks(prev => prev.filter(l => l.id !== linkId));
                        } catch {}
                    },
                },
            ]
        );
    };

    const formatLastSync = (at?: string, status?: string, count?: number, err?: string) => {
        if (!at) return 'Jamais synchronisé';
        const d = new Date(at);
        const dateStr = d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
        if (status === 'success') return `${dateStr} · ${count ?? 0} produits`;
        if (status === 'error') return `${dateStr} · Erreur`;
        if (status === 'running') return 'En cours…';
        return dateStr;
    };

    return (
        <SafeNativeView style={styles.container}>
            <LinearGradient colors={['#7C3AED', '#A78BFA']} style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={24} color="#FFFFFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={styles.headerTitle}>Import via lien Drive</Text>
                    <Text style={styles.headerSub}>{serviceName || serviceType}</Text>
                </View>
                <TouchableOpacity style={styles.backBtn} onPress={() => loadLinks(true)}>
                    <SafeIcon name="refresh-cw" size={20} color="#FFFFFF" type="lucide" />
                </TouchableOpacity>
            </LinearGradient>

            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => loadLinks(true)} colors={['#7C3AED']} />}
            >
                {/* Info */}
                <View style={styles.infoCard}>
                    <SafeIcon name="info" size={16} color="#7C3AED" type="lucide" />
                    <View style={{ flex: 1 }}>
                        <Text style={styles.infoTitle}>Comment ça marche ?</Text>
                        <Text style={styles.infoText}>
                            1. Mettez votre fichier Excel/CSV à jour sur Google Drive, Dropbox ou tout service cloud.{'\n'}
                            2. Partagez le lien (accès "Toute personne avec le lien").{'\n'}
                            3. Collez le lien ici — l'import se fera automatiquement selon votre planning.
                        </Text>
                        <Text style={styles.infoFormatTitle}>Format CSV attendu :</Text>
                        <Text style={styles.infoCode}>nom;prix;stock;unite;categorie{'\n'}Paracetamol 500mg;1500;50;boite;Antalgique</Text>
                    </View>
                </View>

                {/* Bouton + nouveau lien */}
                {!showForm ? (
                    <TouchableOpacity style={styles.addButton} onPress={() => setShowForm(true)}>
                        <SafeIcon name="plus" size={20} color="#FFFFFF" type="lucide" />
                        <Text style={styles.addButtonText}>Ajouter un lien Drive</Text>
                    </TouchableOpacity>
                ) : (
                    <View style={styles.formCard}>
                        <Text style={styles.formTitle}>Nouveau lien Drive</Text>

                        <Text style={styles.fieldLabel}>Lien Drive / Dropbox / URL *</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="https://drive.google.com/file/d/... ou https://docs.google.com/spreadsheets/d/..."
                            value={driveUrl}
                            onChangeText={setDriveUrl}
                            autoCapitalize="none"
                            autoCorrect={false}
                            multiline
                        />

                        <Text style={styles.fieldLabel}>Étiquette (optionnel)</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="ex: Catalogue médicaments Avril 2026"
                            value={label}
                            onChangeText={setLabel}
                        />

                        <Text style={styles.fieldLabel}>Fréquence de synchronisation</Text>
                        <View style={styles.scheduleRow}>
                            {SCHEDULES.map(s => (
                                <TouchableOpacity
                                    key={s.key}
                                    style={[styles.scheduleChip, syncSchedule === s.key && styles.scheduleChipActive]}
                                    onPress={() => setSyncSchedule(s.key)}
                                >
                                    <Text style={[styles.scheduleChipText, syncSchedule === s.key && styles.scheduleChipTextActive]}>
                                        {s.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {(syncSchedule === 'daily' || syncSchedule === 'weekly') && (
                            <View style={styles.hourRow}>
                                <Text style={styles.fieldLabel}>Heure d'exécution (0-23 UTC) :</Text>
                                <TextInput
                                    style={[styles.input, styles.hourInput]}
                                    value={syncHour}
                                    onChangeText={setSyncHour}
                                    keyboardType="number-pad"
                                    maxLength={2}
                                />
                            </View>
                        )}

                        <View style={styles.formActions}>
                            <TouchableOpacity style={styles.cancelBtn} onPress={() => { setShowForm(false); resetForm(); }}>
                                <Text style={styles.cancelBtnText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.saveBtn, saving && { opacity: 0.6 }]} onPress={handleSave} disabled={saving}>
                                {saving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Liste des liens */}
                {loading ? (
                    <ActivityIndicator color="#7C3AED" style={{ marginTop: 24 }} />
                ) : links.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <SafeIcon name="link" size={40} color="#D1D5DB" type="lucide" />
                        <Text style={styles.emptyText}>Aucun lien Drive configuré</Text>
                    </View>
                ) : (
                    links.map(link => {
                        const statusColor = STATUS_COLORS[link.last_sync_status || ''] || '#6B7280';
                        return (
                            <View key={link.id} style={[styles.linkCard, !link.is_active && { opacity: 0.6 }]}>
                                <View style={styles.linkHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.linkLabel} numberOfLines={1}>
                                            {link.label || 'Lien Drive'}
                                        </Text>
                                        <Text style={styles.linkUrl} numberOfLines={1}>
                                            {link.drive_url}
                                        </Text>
                                    </View>
                                    <View style={[styles.activeBadge, { backgroundColor: link.is_active ? '#D1FAE5' : '#F3F4F6' }]}>
                                        <Text style={[styles.activeBadgeText, { color: link.is_active ? '#059669' : '#6B7280' }]}>
                                            {link.is_active ? 'Actif' : 'Inactif'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.linkMeta}>
                                    <SafeIcon name="clock" size={12} color="#6B7280" type="lucide" />
                                    <Text style={styles.metaText}>
                                        {SCHEDULES.find(s => s.key === link.sync_schedule)?.label || link.sync_schedule}
                                        {(link.sync_schedule === 'daily' || link.sync_schedule === 'weekly')
                                            ? ` à ${link.sync_hour}h UTC`
                                            : ''}
                                    </Text>
                                </View>

                                <View style={styles.linkLastSync}>
                                    <View style={[styles.syncDot, { backgroundColor: statusColor }]} />
                                    <Text style={[styles.lastSyncText, { color: link.last_sync_status === 'error' ? '#EF4444' : '#6B7280' }]}>
                                        {formatLastSync(link.last_sync_at, link.last_sync_status, link.last_sync_count, link.last_sync_error)}
                                    </Text>
                                </View>

                                {link.last_sync_error && (
                                    <Text style={styles.errorText} numberOfLines={2}>⚠ {link.last_sync_error}</Text>
                                )}

                                <View style={styles.linkActions}>
                                    {/* Sync manuelle */}
                                    <TouchableOpacity
                                        style={styles.actionBtn}
                                        onPress={() => handleManualSync(link.id)}
                                        disabled={!!syncing[link.id]}
                                    >
                                        {syncing[link.id]
                                            ? <ActivityIndicator size="small" color="#7C3AED" />
                                            : <SafeIcon name="download-cloud" size={16} color="#7C3AED" type="lucide" />
                                        }
                                        <Text style={styles.actionBtnText}>Sync maintenant</Text>
                                    </TouchableOpacity>

                                    {/* Activer/désactiver */}
                                    <TouchableOpacity style={styles.actionBtnGray} onPress={() => handleToggle(link.id)}>
                                        <SafeIcon name={link.is_active ? 'pause' : 'play'} size={14} color="#6B7280" type="lucide" />
                                        <Text style={styles.actionBtnGrayText}>{link.is_active ? 'Pause' : 'Activer'}</Text>
                                    </TouchableOpacity>

                                    {/* Ouvrir dans navigateur */}
                                    <TouchableOpacity style={styles.actionBtnGray} onPress={() => Linking.openURL(link.drive_url)}>
                                        <SafeIcon name="external-link" size={14} color="#6B7280" type="lucide" />
                                    </TouchableOpacity>

                                    {/* Supprimer */}
                                    <TouchableOpacity style={styles.actionBtnDanger} onPress={() => handleDelete(link.id)}>
                                        <SafeIcon name="trash-2" size={14} color="#EF4444" type="lucide" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}

                {/* Conseil sécurité */}
                <View style={styles.securityNote}>
                    <SafeIcon name="shield-check" size={14} color="#059669" type="lucide" />
                    <Text style={styles.securityText}>
                        Assurez-vous que votre fichier Drive est en accès "Toute personne disposant du lien". Les données sensibles (prix, stocks) restent sur votre Drive — seul l'import est automatisé.
                    </Text>
                </View>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F9FAFB' },
    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 16, paddingTop: 20, paddingBottom: 20, gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFFFFF' },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 2 },
    content: { padding: 16, gap: 16 },

    // Info
    infoCard: {
        flexDirection: 'row', gap: 10, backgroundColor: '#F5F3FF',
        borderRadius: 12, padding: 14, borderWidth: 1, borderColor: '#DDD6FE',
    },
    infoTitle: { fontSize: 13, fontWeight: '700', color: '#5B21B6', marginBottom: 6 },
    infoText: { fontSize: 12, color: '#6B7280', lineHeight: 18, marginBottom: 8 },
    infoFormatTitle: { fontSize: 11, fontWeight: '700', color: '#7C3AED', marginBottom: 4 },
    infoCode: {
        fontSize: 11, fontFamily: 'monospace', color: '#374151',
        backgroundColor: '#EDE9FE', borderRadius: 6, padding: 6, lineHeight: 16,
    },

    // Add button
    addButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#7C3AED', borderRadius: 14, paddingVertical: 14,
    },
    addButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },

    // Form
    formCard: {
        backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16,
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06, shadowRadius: 8, elevation: 3, gap: 12,
    },
    formTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
    fieldLabel: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: -4 },
    input: {
        borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827',
        backgroundColor: '#FAFAFA',
    },
    scheduleRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    scheduleChip: {
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
        borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB',
    },
    scheduleChipActive: { backgroundColor: '#7C3AED', borderColor: '#7C3AED' },
    scheduleChipText: { fontSize: 12, color: '#374151', fontWeight: '500' },
    scheduleChipTextActive: { color: '#FFFFFF' },
    hourRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    hourInput: { width: 60, textAlign: 'center' },
    formActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
    cancelBtn: {
        flex: 1, paddingVertical: 12, borderRadius: 10,
        borderWidth: 1.5, borderColor: '#E5E7EB', alignItems: 'center',
    },
    cancelBtnText: { fontSize: 14, color: '#6B7280', fontWeight: '600' },
    saveBtn: {
        flex: 2, paddingVertical: 12, borderRadius: 10,
        backgroundColor: '#7C3AED', alignItems: 'center',
    },
    saveBtnText: { fontSize: 14, color: '#FFFFFF', fontWeight: '700' },

    // Links list
    emptyBox: { alignItems: 'center', gap: 10, paddingVertical: 32 },
    emptyText: { fontSize: 14, color: '#9CA3AF' },
    linkCard: {
        backgroundColor: '#FFFFFF', borderRadius: 14, padding: 14,
        shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05, shadowRadius: 4, elevation: 2, gap: 8,
    },
    linkHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    linkLabel: { fontSize: 14, fontWeight: '700', color: '#111827' },
    linkUrl: { fontSize: 11, color: '#9CA3AF', marginTop: 2 },
    activeBadge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
    activeBadgeText: { fontSize: 11, fontWeight: '700' },
    linkMeta: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    metaText: { fontSize: 12, color: '#6B7280' },
    linkLastSync: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    syncDot: { width: 8, height: 8, borderRadius: 4 },
    lastSyncText: { fontSize: 12 },
    errorText: { fontSize: 11, color: '#EF4444', fontStyle: 'italic' },
    linkActions: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
    actionBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8,
        backgroundColor: '#F5F3FF', borderWidth: 1, borderColor: '#DDD6FE', flex: 1,
    },
    actionBtnText: { fontSize: 12, color: '#7C3AED', fontWeight: '600' },
    actionBtnGray: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
        backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    },
    actionBtnGrayText: { fontSize: 12, color: '#6B7280', fontWeight: '500' },
    actionBtnDanger: {
        paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
        backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA',
    },

    // Security note
    securityNote: {
        flexDirection: 'row', gap: 8, backgroundColor: '#F0FDF4',
        borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#BBF7D0',
    },
    securityText: { flex: 1, fontSize: 11, color: '#065F46', lineHeight: 16 },
});

export default DriveImportLinkScreen;
