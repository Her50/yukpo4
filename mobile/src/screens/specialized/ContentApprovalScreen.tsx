// Content Approval Screen — Yukpo
// Validation humaine des posts IA avant publication.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, RefreshControl,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';

interface PendingPost {
    id: number;
    platform: string;
    caption: string;
    status: string;
    content_type: string;
    media_urls?: string[];
    scheduled_at?: string;
    created_at: string;
    reviewer_note?: string;
    tone?: string;
    hashtags?: string[];
}

const PLATFORM_COLOR: Record<string, string> = {
    instagram: '#E1306C',
    facebook: '#1877F2',
    tiktok: '#010101',
    linkedin: '#0A66C2',
    twitter: '#1DA1F2',
};

const STATUS_COLOR: Record<string, string> = {
    draft: '#64748B',
    pending_review: '#F59E0B',
    approved: '#10B981',
    rejected: '#EF4444',
    published: '#6366F1',
};

type FilterTab = 'pending_review' | 'approved' | 'rejected' | 'all';

export default function ContentApprovalScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { token } = useAuth();
    const serviceId: number = route.params?.service_id ?? 0;

    const [posts, setPosts] = useState<PendingPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState<FilterTab>('pending_review');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [note, setNote] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const load = useCallback(async () => {
        try {
            const data = await apiGet(
                `/api/social-ai/content/${serviceId}/pending?status=${filter === 'all' ? '' : filter}`,
                token,
            );
            setPosts(data?.posts ?? []);
        } catch {
            /* silencieux */
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [serviceId, token, filter]);

    useEffect(() => { setLoading(true); load(); }, [load]);

    const onRefresh = () => { setRefreshing(true); load(); };

    const handleAction = async (postId: number, action: 'approve' | 'reject', reviewerNote?: string) => {
        setSubmitting(true);
        try {
            await apiPost(
                `/api/social-ai/content/${serviceId}/posts/${postId}/${action}`,
                { reviewer_note: reviewerNote ?? '' },
                token,
            );
            setSelectedId(null);
            setNote('');
            await load();
        } catch {
            Alert.alert('Erreur', 'Action impossible, réessayez.');
        } finally {
            setSubmitting(false);
        }
    };

    const confirmReject = (postId: number) => {
        Alert.alert(
            'Rejeter ce post',
            'Ajoutez une note pour le rédacteur IA (optionnel)',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Rejeter',
                    style: 'destructive',
                    onPress: () => handleAction(postId, 'reject', note),
                },
            ],
        );
    };

    const filtered = filter === 'all'
        ? posts
        : posts.filter(p => p.status === filter);

    const pendingCount = posts.filter(p => p.status === 'pending_review').length;

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={s.title}>Validation contenu</Text>
                {pendingCount > 0 && (
                    <View style={s.badge}>
                        <Text style={s.badgeText}>{pendingCount}</Text>
                    </View>
                )}
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                {(['pending_review', 'approved', 'rejected', 'all'] as FilterTab[]).map(tab => (
                    <TouchableOpacity
                        key={tab}
                        style={[s.tab, filter === tab && s.tabActive]}
                        onPress={() => setFilter(tab)}
                    >
                        <Text style={[s.tabText, filter === tab && s.tabTextActive]}>
                            {tab === 'pending_review' ? 'En attente' :
                             tab === 'approved' ? 'Approuvés' :
                             tab === 'rejected' ? 'Rejetés' : 'Tous'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 60 }} />
            ) : (
                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={s.list}
                >
                    {filtered.length === 0 && (
                        <View style={s.empty}>
                            <SafeIcon name="checkmark-circle-outline" size={48} color="#64748B" />
                            <Text style={s.emptyText}>Aucun post dans cette catégorie</Text>
                        </View>
                    )}

                    {filtered.map(post => (
                        <View key={post.id} style={s.card}>
                            {/* Card header */}
                            <View style={s.cardHeader}>
                                <View style={[s.platformBadge, { backgroundColor: PLATFORM_COLOR[post.platform] ?? '#64748B' }]}>
                                    <Text style={s.platformText}>{post.platform.toUpperCase()}</Text>
                                </View>
                                <View style={[s.statusChip, { backgroundColor: STATUS_COLOR[post.status] + '22' }]}>
                                    <Text style={[s.statusText, { color: STATUS_COLOR[post.status] }]}>
                                        {post.status === 'pending_review' ? 'En attente' :
                                         post.status === 'approved' ? 'Approuvé' :
                                         post.status === 'rejected' ? 'Rejeté' : post.status}
                                    </Text>
                                </View>
                                <Text style={s.date}>
                                    {new Date(post.created_at).toLocaleDateString('fr-FR')}
                                </Text>
                            </View>

                            {/* Caption */}
                            <Text style={s.caption} numberOfLines={selectedId === post.id ? undefined : 4}>
                                {post.caption}
                            </Text>

                            {/* Hashtags */}
                            {post.hashtags && post.hashtags.length > 0 && (
                                <Text style={s.hashtags} numberOfLines={2}>
                                    {post.hashtags.map(h => `#${h}`).join(' ')}
                                </Text>
                            )}

                            {/* Tone & type */}
                            <View style={s.metaRow}>
                                {post.tone && (
                                    <Text style={s.meta}>Ton: {post.tone}</Text>
                                )}
                                {post.content_type && (
                                    <Text style={s.meta}>{post.content_type}</Text>
                                )}
                                {post.scheduled_at && (
                                    <Text style={s.meta}>
                                        Prévu: {new Date(post.scheduled_at).toLocaleDateString('fr-FR')}
                                    </Text>
                                )}
                            </View>

                            {/* Reviewer note */}
                            {post.reviewer_note && (
                                <View style={s.noteBox}>
                                    <SafeIcon name="chatbubble-outline" size={14} color="#64748B" />
                                    <Text style={s.noteText}>{post.reviewer_note}</Text>
                                </View>
                            )}

                            {/* Expand / Actions */}
                            <View style={s.actions}>
                                <TouchableOpacity
                                    style={s.expandBtn}
                                    onPress={() => setSelectedId(selectedId === post.id ? null : post.id)}
                                >
                                    <Text style={s.expandText}>
                                        {selectedId === post.id ? 'Réduire' : 'Voir tout'}
                                    </Text>
                                </TouchableOpacity>

                                {post.status === 'pending_review' && (
                                    <View style={s.approvalBtns}>
                                        <TouchableOpacity
                                            style={s.rejectBtn}
                                            onPress={() => {
                                                setSelectedId(post.id);
                                                confirmReject(post.id);
                                            }}
                                            disabled={submitting}
                                        >
                                            <SafeIcon name="close" size={16} color="#EF4444" />
                                            <Text style={s.rejectText}>Rejeter</Text>
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            style={s.approveBtn}
                                            onPress={() => handleAction(post.id, 'approve')}
                                            disabled={submitting}
                                        >
                                            <SafeIcon name="checkmark" size={16} color="#fff" />
                                            <Text style={s.approveText}>Approuver</Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>

                            {/* Note input when selecting for rejection */}
                            {selectedId === post.id && post.status === 'pending_review' && (
                                <TextInput
                                    style={s.noteInput}
                                    placeholder="Note pour le rédacteur IA (optionnel)…"
                                    placeholderTextColor="#94A3B8"
                                    value={note}
                                    onChangeText={setNote}
                                    multiline
                                />
                            )}
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0F172A' },
    header: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        paddingHorizontal: 16, paddingTop: 52, paddingBottom: 12,
        backgroundColor: '#1E293B',
    },
    title: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '700' },
    badge: {
        backgroundColor: '#F59E0B', borderRadius: 12,
        paddingHorizontal: 8, paddingVertical: 2,
    },
    badgeText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    tabs: {
        flexDirection: 'row', backgroundColor: '#1E293B',
        paddingHorizontal: 8, paddingBottom: 8,
    },
    tab: {
        flex: 1, alignItems: 'center', paddingVertical: 8,
        borderRadius: 8,
    },
    tabActive: { backgroundColor: '#6366F1' },
    tabText: { color: '#94A3B8', fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    list: { padding: 16, gap: 14 },
    empty: { alignItems: 'center', paddingTop: 60, gap: 12 },
    emptyText: { color: '#64748B', fontSize: 16 },
    card: {
        backgroundColor: '#1E293B', borderRadius: 14,
        padding: 16, gap: 10,
    },
    cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    platformBadge: {
        borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    },
    platformText: { color: '#fff', fontSize: 10, fontWeight: '700' },
    statusChip: {
        borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    },
    statusText: { fontSize: 11, fontWeight: '600' },
    date: { color: '#64748B', fontSize: 12, marginLeft: 'auto' },
    caption: { color: '#E2E8F0', fontSize: 14, lineHeight: 21 },
    hashtags: { color: '#818CF8', fontSize: 12 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    meta: {
        color: '#64748B', fontSize: 12,
        backgroundColor: '#0F172A', borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    noteBox: {
        flexDirection: 'row', gap: 6, alignItems: 'flex-start',
        backgroundColor: '#0F172A', borderRadius: 8, padding: 10,
    },
    noteText: { color: '#94A3B8', fontSize: 12, flex: 1 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    expandBtn: { paddingVertical: 4 },
    expandText: { color: '#6366F1', fontSize: 13 },
    approvalBtns: { flexDirection: 'row', gap: 10 },
    rejectBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        borderWidth: 1, borderColor: '#EF4444',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    },
    rejectText: { color: '#EF4444', fontSize: 13, fontWeight: '600' },
    approveBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#10B981',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7,
    },
    approveText: { color: '#fff', fontSize: 13, fontWeight: '600' },
    noteInput: {
        backgroundColor: '#0F172A', borderRadius: 10, padding: 12,
        color: '#E2E8F0', fontSize: 14, minHeight: 72,
        borderWidth: 1, borderColor: '#334155',
    },
});
