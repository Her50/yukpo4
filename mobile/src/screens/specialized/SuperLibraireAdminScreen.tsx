/**
 * SuperLibraireAdminScreen
 * Tableau de bord YukpoLibrairie — accessible aux admins et superadmins.
 * Fonctionnalités :
 *   - Onglet "Commandes" : liste temps réel des commandes actives avec countdown
 *   - Onglet "Équipe"    : gestion des membres (inviter / retirer)
 */

import { useFocusEffect, useNavigation } from '@react-navigation/native';
import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { superLibraireApi } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';

type Tab = 'commandes' | 'equipe';

const ROLE_LABELS: Record<string, string> = {
    manager: 'Manager',
    preparer: 'Préparateur',
    cashier: 'Caissier',
    owner: 'Propriétaire',
};

const STATUT_COLOR: Record<string, string> = {
    envoyee_super_librairie: modernColors.warning,
    envoyee_librairies: modernColors.info,
    en_validation: modernColors.primary,
    validee_partielle: modernColors.secondary,
    validee_complete: modernColors.success,
};

const SuperLibraireAdminScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const { user } = useAuth();
    const [tab, setTab] = useState<Tab>('commandes');

    // — Commandes —
    const [commandes, setCommandes] = useState<any[]>([]);
    const [loadingCmds, setLoadingCmds] = useState(true);
    const [refreshingCmds, setRefreshingCmds] = useState(false);
    const [liberating, setLiberating] = useState<string | null>(null);

    // — Équipe —
    const [members, setMembers] = useState<any[]>([]);
    const [loadingTeam, setLoadingTeam] = useState(false);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteTel, setInviteTel] = useState('');
    const [inviteRole, setInviteRole] = useState<'manager' | 'preparer' | 'cashier'>('manager');
    const [inviteNom, setInviteNom] = useState('');
    const [inviting, setInviting] = useState(false);

    const loadCommandes = useCallback(async (silent = false) => {
        if (!silent) setLoadingCmds(true);
        try {
            const data = await superLibraireApi.getDashboard({ limit: 50 });
            setCommandes(data.commandes);
        } catch (e: any) {
            if (!silent) Alert.alert('Erreur', e?.message || 'Impossible de charger les commandes');
        } finally {
            setLoadingCmds(false);
            setRefreshingCmds(false);
        }
    }, []);

    const loadTeam = useCallback(async () => {
        setLoadingTeam(true);
        try {
            const data = await superLibraireApi.listTeam();
            setMembers(data.members);
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Impossible de charger l\'équipe');
        } finally {
            setLoadingTeam(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        loadCommandes();
        loadTeam();
    }, [loadCommandes, loadTeam]));

    const handleLiberer = (commandeId: string, reference: string) => {
        Alert.alert(
            'Libérer la commande',
            `Libérer "${reference}" vers les librairies proches ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Libérer',
                    style: 'destructive',
                    onPress: async () => {
                        setLiberating(commandeId);
                        try {
                            await superLibraireApi.libererCommande(commandeId, 'Liberation manuelle admin');
                            await loadCommandes(true);
                        } catch (e: any) {
                            Alert.alert('Erreur', e?.message || 'Libération échouée');
                        } finally {
                            setLiberating(null);
                        }
                    },
                },
            ]
        );
    };

    const handleInvite = async () => {
        if (!inviteTel.trim()) {
            Alert.alert('Erreur', 'Le numéro de téléphone est requis');
            return;
        }
        setInviting(true);
        try {
            await superLibraireApi.inviteTeam(inviteTel.trim(), inviteRole, inviteNom.trim() || undefined);
            setShowInviteModal(false);
            setInviteTel('');
            setInviteNom('');
            await loadTeam();
            Alert.alert('Succès', 'Membre ajouté à l\'équipe YukpoLibrairie');
        } catch (e: any) {
            Alert.alert('Erreur', e?.message || 'Invitation échouée');
        } finally {
            setInviting(false);
        }
    };

    const handleRemoveMember = (memberId: number, nom: string) => {
        Alert.alert(
            'Retirer le membre',
            `Retirer "${nom}" de l\'équipe ?`,
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Retirer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await superLibraireApi.removeTeamMember(memberId);
                            await loadTeam();
                        } catch (e: any) {
                            Alert.alert('Erreur', e?.message || 'Retrait échoué');
                        }
                    },
                },
            ]
        );
    };

    const formatCountdown = (seconds: number | null) => {
        if (seconds === null || seconds === undefined) return null;
        if (seconds <= 0) return 'Expiré';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}m ${s}s`;
    };

    const renderCommande = ({ item }: { item: any }) => {
        const countdown = formatCountdown(item.secondes_restantes);
        const statusColor = STATUT_COLOR[item.statut] || modernColors.textSecondary;
        const isSuperActive = item.statut === 'envoyee_super_librairie' && !item.super_librairie_fallback_at;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Text style={styles.reference}>{item.reference_commande || item.id?.slice(0, 8)}</Text>
                    <View style={[styles.badge, { backgroundColor: statusColor + '22' }]}>
                        <Text style={[styles.badgeText, { color: statusColor }]}>
                            {item.statut?.replace(/_/g, ' ')}
                        </Text>
                    </View>
                </View>

                <Text style={styles.gps}>
                    <SafeIcon name="location-outline" size={13} color={modernColors.textSecondary} />{' '}
                    {item.adresse_livraison || item.gps_livraison || 'GPS non renseigné'}
                </Text>

                <View style={styles.cardRow}>
                    <Text style={styles.meta}>
                        {item.nb_neufs ?? 0} neuf(s) · {item.nb_occasion ?? 0} occasion(s)
                    </Text>
                    {item.budget_total && (
                        <Text style={styles.budget}>
                            {Number(item.budget_total).toLocaleString()} {item.devise || 'XAF'}
                        </Text>
                    )}
                </View>

                {isSuperActive && countdown && (
                    <View style={styles.countdownRow}>
                        <SafeIcon name="timer-outline" size={14} color={modernColors.warning} />
                        <Text style={styles.countdown}> Timeout dans {countdown}</Text>
                    </View>
                )}

                {isSuperActive && (
                    <TouchableOpacity
                        style={styles.libererBtn}
                        onPress={() => handleLiberer(item.id, item.reference_commande || item.id)}
                        disabled={liberating === item.id}
                    >
                        {liberating === item.id ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.libererBtnText}>Libérer aux librairies proches</Text>
                        )}
                    </TouchableOpacity>
                )}
            </View>
        );
    };

    const renderMember = ({ item }: { item: any }) => (
        <View style={styles.memberCard}>
            <View style={styles.memberAvatar}>
                <Text style={styles.memberAvatarText}>
                    {(item.nom_affiche || item.user_nom || '?').charAt(0).toUpperCase()}
                </Text>
            </View>
            <View style={styles.memberInfo}>
                <Text style={styles.memberName}>{item.nom_affiche || item.user_nom || 'Inconnu'}</Text>
                <Text style={styles.memberMeta}>{item.telephone || item.email}</Text>
                <View style={styles.roleBadge}>
                    <Text style={styles.roleText}>{ROLE_LABELS[item.role] || item.role}</Text>
                </View>
            </View>
            {item.role !== 'owner' && (
                <TouchableOpacity
                    style={styles.removeBtn}
                    onPress={() => handleRemoveMember(item.id, item.nom_affiche || item.user_nom || 'ce membre')}
                >
                    <SafeIcon name="person-remove-outline" size={20} color={modernColors.error} />
                </TouchableOpacity>
            )}
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <SafeIcon name="arrow-back" size={22} color={modernColors.text} />
                </TouchableOpacity>
                <View>
                    <Text style={styles.headerTitle}>YukpoLibrairie</Text>
                    <Text style={styles.headerSub}>Super libraire — Administration</Text>
                </View>
            </View>

            {/* Tabs */}
            <View style={styles.tabs}>
                <TouchableOpacity
                    style={[styles.tab, tab === 'commandes' && styles.tabActive]}
                    onPress={() => setTab('commandes')}
                >
                    <Text style={[styles.tabText, tab === 'commandes' && styles.tabTextActive]}>
                        Commandes {commandes.length > 0 ? `(${commandes.length})` : ''}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={[styles.tab, tab === 'equipe' && styles.tabActive]}
                    onPress={() => setTab('equipe')}
                >
                    <Text style={[styles.tabText, tab === 'equipe' && styles.tabTextActive]}>
                        Équipe {members.length > 0 ? `(${members.length})` : ''}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Contenu */}
            {tab === 'commandes' ? (
                loadingCmds ? (
                    <ActivityIndicator style={styles.centered} size="large" color={modernColors.primary} />
                ) : (
                    <FlatList
                        data={commandes}
                        keyExtractor={(item) => item.id}
                        renderItem={renderCommande}
                        contentContainerStyle={styles.list}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshingCmds}
                                onRefresh={() => { setRefreshingCmds(true); loadCommandes(); }}
                                colors={[modernColors.primary]}
                            />
                        }
                        ListEmptyComponent={
                            <View style={styles.empty}>
                                <SafeIcon name="book-outline" size={48} color={modernColors.textSecondary} />
                                <Text style={styles.emptyText}>Aucune commande active</Text>
                            </View>
                        }
                    />
                )
            ) : (
                <View style={{ flex: 1 }}>
                    <TouchableOpacity style={styles.inviteBtn} onPress={() => setShowInviteModal(true)}>
                        <SafeIcon name="person-add-outline" size={18} color="#fff" />
                        <Text style={styles.inviteBtnText}> Ajouter un membre</Text>
                    </TouchableOpacity>

                    {loadingTeam ? (
                        <ActivityIndicator style={styles.centered} size="large" color={modernColors.primary} />
                    ) : (
                        <FlatList
                            data={members}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={renderMember}
                            contentContainerStyle={styles.list}
                            ListEmptyComponent={
                                <View style={styles.empty}>
                                    <SafeIcon name="people-outline" size={48} color={modernColors.textSecondary} />
                                    <Text style={styles.emptyText}>Aucun membre dans l'équipe</Text>
                                </View>
                            }
                        />
                    )}
                </View>
            )}

            {/* Modal invitation */}
            <Modal visible={showInviteModal} transparent animationType="slide">
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.modalOverlay}
                >
                    <View style={styles.modalBox}>
                        <Text style={styles.modalTitle}>Ajouter un membre</Text>

                        <Text style={styles.inputLabel}>Téléphone *</Text>
                        <TextInput
                            style={styles.input}
                            value={inviteTel}
                            onChangeText={setInviteTel}
                            placeholder="+237 6XX XXX XXX"
                            keyboardType="phone-pad"
                            placeholderTextColor={modernColors.textSecondary}
                        />

                        <Text style={styles.inputLabel}>Nom affiché</Text>
                        <TextInput
                            style={styles.input}
                            value={inviteNom}
                            onChangeText={setInviteNom}
                            placeholder="Optionnel"
                            placeholderTextColor={modernColors.textSecondary}
                        />

                        <Text style={styles.inputLabel}>Rôle</Text>
                        <View style={styles.roleRow}>
                            {(['manager', 'preparer', 'cashier'] as const).map((r) => (
                                <TouchableOpacity
                                    key={r}
                                    style={[styles.roleChip, inviteRole === r && styles.roleChipActive]}
                                    onPress={() => setInviteRole(r)}
                                >
                                    <Text style={[styles.roleChipText, inviteRole === r && styles.roleChipTextActive]}>
                                        {ROLE_LABELS[r]}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <View style={styles.modalBtns}>
                            <TouchableOpacity
                                style={styles.modalCancelBtn}
                                onPress={() => setShowInviteModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Annuler</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.modalConfirmBtn, inviting && { opacity: 0.6 }]}
                                onPress={handleInvite}
                                disabled={inviting}
                            >
                                {inviting ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Ajouter</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </KeyboardAvoidingView>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: modernColors.background },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        paddingTop: 52,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
        gap: 12,
    },
    backBtn: { padding: 4 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: modernColors.text },
    headerSub: { fontSize: 12, color: modernColors.textSecondary, marginTop: 2 },
    tabs: {
        flexDirection: 'row',
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
    tabActive: { borderBottomWidth: 2, borderBottomColor: modernColors.primary },
    tabText: { fontSize: 14, color: modernColors.textSecondary, fontWeight: '500' },
    tabTextActive: { color: modernColors.primary, fontWeight: '700' },
    list: { padding: 16, gap: 12 },
    centered: { marginTop: 60 },
    empty: { alignItems: 'center', marginTop: 60, gap: 12 },
    emptyText: { color: modernColors.textSecondary, fontSize: 15 },

    // Commandes
    card: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 14,
        shadowColor: modernColors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 2,
        gap: 6,
    },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    reference: { fontSize: 15, fontWeight: '700', color: modernColors.text },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20 },
    badgeText: { fontSize: 11, fontWeight: '600' },
    gps: { fontSize: 12, color: modernColors.textSecondary },
    cardRow: { flexDirection: 'row', justifyContent: 'space-between' },
    meta: { fontSize: 12, color: modernColors.textSecondary },
    budget: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    countdownRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
    countdown: { fontSize: 12, color: modernColors.warning, fontWeight: '600' },
    libererBtn: {
        backgroundColor: modernColors.error,
        borderRadius: 8,
        padding: 10,
        alignItems: 'center',
        marginTop: 6,
    },
    libererBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

    // Equipe
    inviteBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: modernColors.primary,
        margin: 16,
        padding: 12,
        borderRadius: 10,
    },
    inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
    memberCard: {
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        padding: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        shadowColor: modernColors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1,
        shadowRadius: 3,
        elevation: 1,
    },
    memberAvatar: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: modernColors.primary + '22',
        justifyContent: 'center',
        alignItems: 'center',
    },
    memberAvatarText: { fontSize: 18, fontWeight: '700', color: modernColors.primary },
    memberInfo: { flex: 1, gap: 3 },
    memberName: { fontSize: 15, fontWeight: '600', color: modernColors.text },
    memberMeta: { fontSize: 12, color: modernColors.textSecondary },
    roleBadge: {
        alignSelf: 'flex-start',
        backgroundColor: modernColors.info + '20',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 10,
    },
    roleText: { fontSize: 11, color: modernColors.info, fontWeight: '600' },
    removeBtn: { padding: 8 },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalBox: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        gap: 10,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: modernColors.text, marginBottom: 6 },
    inputLabel: { fontSize: 13, color: modernColors.textSecondary, fontWeight: '500' },
    input: {
        borderWidth: 1,
        borderColor: modernColors.border,
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: modernColors.text,
        backgroundColor: modernColors.surfaceVariant,
    },
    roleRow: { flexDirection: 'row', gap: 8 },
    roleChip: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: modernColors.border,
        alignItems: 'center',
    },
    roleChipActive: { borderColor: modernColors.primary, backgroundColor: modernColors.primary + '15' },
    roleChipText: { fontSize: 13, color: modernColors.textSecondary, fontWeight: '500' },
    roleChipTextActive: { color: modernColors.primary, fontWeight: '700' },
    modalBtns: { flexDirection: 'row', gap: 12, marginTop: 8 },
    modalCancelBtn: {
        flex: 1,
        borderWidth: 1.5,
        borderColor: modernColors.border,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
    },
    modalCancelText: { color: modernColors.textSecondary, fontWeight: '600' },
    modalConfirmBtn: {
        flex: 1,
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
    },
    modalConfirmText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});

export default SuperLibraireAdminScreen;
