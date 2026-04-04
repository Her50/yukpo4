// Brand Voice Screen — Yukpo
// Entraînement de la voix de marque IA + génération de posts personnalisés.

import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator, Alert, RefreshControl,
    ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import SafeIcon from '../../components/SafeIcon';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/api';

interface BrandVoiceProfile {
    id?: number;
    tone: string;
    style_keywords: string[];
    avoid_words: string[];
    signature_enabled: boolean;
    signature_style: string;
    custom_signature?: string;
    sample_posts: string[];
    consistency_score?: number;
    last_trained_at?: string;
}

interface GeneratedPost {
    platform: string;
    caption: string;
    hashtags: string[];
    score?: number;
}

const TONE_OPTIONS = [
    { key: 'professionnel', label: 'Professionnel', icon: 'briefcase-outline' },
    { key: 'amical', label: 'Amical', icon: 'people-outline' },
    { key: 'inspirant', label: 'Inspirant', icon: 'star-outline' },
    { key: 'humoristique', label: 'Humoristique', icon: 'happy-outline' },
    { key: 'educatif', label: 'Éducatif', icon: 'school-outline' },
    { key: 'exclusif', label: 'Exclusif', icon: 'diamond-outline' },
];

const SIGNATURE_STYLES = ['hashtag', 'phrase', 'emoji', 'none'];

type TabKey = 'profile' | 'generate' | 'samples';

export default function BrandVoiceScreen() {
    const route = useRoute<any>();
    const navigation = useNavigation<any>();
    const { token } = useAuth();
    const serviceId: number = route.params?.service_id ?? 0;

    const [tab, setTab] = useState<TabKey>('profile');
    const [profile, setProfile] = useState<BrandVoiceProfile>({
        tone: 'professionnel',
        style_keywords: [],
        avoid_words: [],
        signature_enabled: false,
        signature_style: 'hashtag',
        sample_posts: [],
    });
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);

    // Generate tab state
    const [genTopic, setGenTopic] = useState('');
    const [genPlatforms, setGenPlatforms] = useState<string[]>(['instagram', 'facebook']);
    const [generating, setGenerating] = useState(false);
    const [generatedPosts, setGeneratedPosts] = useState<GeneratedPost[]>([]);

    // Chips inputs
    const [keywordInput, setKeywordInput] = useState('');
    const [avoidInput, setAvoidInput] = useState('');
    const [sampleInput, setSampleInput] = useState('');

    const load = useCallback(async () => {
        try {
            const data = await apiGet(`/api/social-ai/brand-voice/${serviceId}`, token);
            if (data?.profile) setProfile(data.profile);
        } catch {
            /* premier chargement peut retourner 404 */
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [serviceId, token]);

    useEffect(() => { load(); }, [load]);

    const onRefresh = () => { setRefreshing(true); load(); };

    const save = async () => {
        setSaving(true);
        try {
            await apiPost(`/api/social-ai/brand-voice/${serviceId}`, profile, token);
            Alert.alert('Sauvegardé', 'Voix de marque mise à jour.');
        } catch {
            Alert.alert('Erreur', 'Impossible de sauvegarder.');
        } finally {
            setSaving(false);
        }
    };

    const trainAI = async () => {
        if (profile.sample_posts.length < 3) {
            Alert.alert('Insuffisant', 'Ajoutez au moins 3 exemples de posts pour entraîner l\'IA.');
            return;
        }
        setSaving(true);
        try {
            await apiPost(`/api/social-ai/brand-voice/${serviceId}/train`, {}, token);
            Alert.alert('Entraînement lancé', 'L\'IA analyse vos posts pour calibrer la voix de marque.');
        } catch {
            Alert.alert('Erreur', 'Entraînement échoué.');
        } finally {
            setSaving(false);
        }
    };

    const generatePosts = async () => {
        if (!genTopic.trim()) {
            Alert.alert('Sujet requis', 'Entrez un sujet ou une promotion à rédiger.');
            return;
        }
        setGenerating(true);
        setGeneratedPosts([]);
        try {
            const data = await apiPost(`/api/social-ai/brand-voice/${serviceId}/generate`, {
                topic: genTopic,
                platforms: genPlatforms,
            }, token);
            setGeneratedPosts(data?.posts ?? []);
        } catch {
            Alert.alert('Erreur', 'Génération impossible.');
        } finally {
            setGenerating(false);
        }
    };

    const addChip = (
        field: 'style_keywords' | 'avoid_words' | 'sample_posts',
        value: string,
        clear: () => void,
    ) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        setProfile(p => ({
            ...p,
            [field]: [...(p[field] as string[]), trimmed],
        }));
        clear();
    };

    const removeChip = (field: 'style_keywords' | 'avoid_words' | 'sample_posts', idx: number) => {
        setProfile(p => ({
            ...p,
            [field]: (p[field] as string[]).filter((_, i) => i !== idx),
        }));
    };

    const togglePlatform = (p: string) => {
        setGenPlatforms(prev =>
            prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]
        );
    };

    const consistencyColor = (score?: number) => {
        if (!score) return '#64748B';
        if (score >= 80) return '#10B981';
        if (score >= 50) return '#F59E0B';
        return '#EF4444';
    };

    return (
        <View style={s.container}>
            {/* Header */}
            <View style={s.header}>
                <TouchableOpacity onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-back" size={24} color="#fff" />
                </TouchableOpacity>
                <Text style={s.title}>Voix de marque IA</Text>
                {profile.consistency_score !== undefined && (
                    <View style={[s.scoreBadge, { backgroundColor: consistencyColor(profile.consistency_score) }]}>
                        <Text style={s.scoreText}>{profile.consistency_score}%</Text>
                    </View>
                )}
            </View>

            {/* Tabs */}
            <View style={s.tabs}>
                {([
                    { key: 'profile', label: 'Profil' },
                    { key: 'generate', label: 'Générer' },
                    { key: 'samples', label: 'Exemples' },
                ] as { key: TabKey; label: string }[]).map(t => (
                    <TouchableOpacity
                        key={t.key}
                        style={[s.tab, tab === t.key && s.tabActive]}
                        onPress={() => setTab(t.key)}
                    >
                        <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            {loading ? (
                <ActivityIndicator size="large" color="#6366F1" style={{ marginTop: 60 }} />
            ) : (
                <ScrollView
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                    contentContainerStyle={s.body}
                >
                    {/* ─── PROFILE TAB ─── */}
                    {tab === 'profile' && (
                        <>
                            {/* Tone selector */}
                            <Text style={s.sectionTitle}>Ton de marque</Text>
                            <View style={s.toneGrid}>
                                {TONE_OPTIONS.map(t => (
                                    <TouchableOpacity
                                        key={t.key}
                                        style={[s.toneCard, profile.tone === t.key && s.toneCardActive]}
                                        onPress={() => setProfile(p => ({ ...p, tone: t.key }))}
                                    >
                                        <SafeIcon
                                            name={t.icon as any}
                                            size={22}
                                            color={profile.tone === t.key ? '#fff' : '#94A3B8'}
                                        />
                                        <Text style={[s.toneLabel, profile.tone === t.key && s.toneLabelActive]}>
                                            {t.label}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Style keywords */}
                            <Text style={s.sectionTitle}>Mots-clés de style</Text>
                            <Text style={s.hint}>Ex: "élégant", "accessible", "local", "premium"</Text>
                            <View style={s.chipRow}>
                                {profile.style_keywords.map((kw, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={s.chip}
                                        onPress={() => removeChip('style_keywords', i)}
                                    >
                                        <Text style={s.chipText}>{kw}</Text>
                                        <SafeIcon name="close" size={12} color="#6366F1" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={s.inputRow}>
                                <TextInput
                                    style={s.input}
                                    value={keywordInput}
                                    onChangeText={setKeywordInput}
                                    placeholder="Ajouter un mot-clé…"
                                    placeholderTextColor="#475569"
                                    returnKeyType="done"
                                    onSubmitEditing={() =>
                                        addChip('style_keywords', keywordInput, () => setKeywordInput(''))
                                    }
                                />
                                <TouchableOpacity
                                    style={s.addBtn}
                                    onPress={() => addChip('style_keywords', keywordInput, () => setKeywordInput(''))}
                                >
                                    <SafeIcon name="add" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Avoid words */}
                            <Text style={s.sectionTitle}>Mots à éviter</Text>
                            <View style={s.chipRow}>
                                {profile.avoid_words.map((w, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        style={[s.chip, s.chipDanger]}
                                        onPress={() => removeChip('avoid_words', i)}
                                    >
                                        <Text style={[s.chipText, { color: '#EF4444' }]}>{w}</Text>
                                        <SafeIcon name="close" size={12} color="#EF4444" />
                                    </TouchableOpacity>
                                ))}
                            </View>
                            <View style={s.inputRow}>
                                <TextInput
                                    style={s.input}
                                    value={avoidInput}
                                    onChangeText={setAvoidInput}
                                    placeholder="Mot à bannir…"
                                    placeholderTextColor="#475569"
                                    returnKeyType="done"
                                    onSubmitEditing={() =>
                                        addChip('avoid_words', avoidInput, () => setAvoidInput(''))
                                    }
                                />
                                <TouchableOpacity
                                    style={s.addBtn}
                                    onPress={() => addChip('avoid_words', avoidInput, () => setAvoidInput(''))}
                                >
                                    <SafeIcon name="add" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {/* Signature */}
                            <Text style={s.sectionTitle}>Signature automatique</Text>
                            <TouchableOpacity
                                style={s.toggleRow}
                                onPress={() => setProfile(p => ({ ...p, signature_enabled: !p.signature_enabled }))}
                            >
                                <Text style={s.toggleLabel}>Activer la signature</Text>
                                <View style={[s.toggle, profile.signature_enabled && s.toggleOn]}>
                                    <View style={[s.toggleThumb, profile.signature_enabled && s.toggleThumbOn]} />
                                </View>
                            </TouchableOpacity>

                            {profile.signature_enabled && (
                                <>
                                    <View style={s.styleRow}>
                                        {SIGNATURE_STYLES.map(st => (
                                            <TouchableOpacity
                                                key={st}
                                                style={[s.styleChip, profile.signature_style === st && s.styleChipActive]}
                                                onPress={() => setProfile(p => ({ ...p, signature_style: st }))}
                                            >
                                                <Text style={[s.styleChipText, profile.signature_style === st && s.styleChipTextActive]}>
                                                    {st}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                    {profile.signature_style !== 'none' && (
                                        <TextInput
                                            style={s.input}
                                            value={profile.custom_signature ?? ''}
                                            onChangeText={v => setProfile(p => ({ ...p, custom_signature: v }))}
                                            placeholder="Texte personnalisé (ex: #YukpoPartenaire)"
                                            placeholderTextColor="#475569"
                                        />
                                    )}
                                </>
                            )}

                            {/* Save button */}
                            <TouchableOpacity style={s.saveBtn} onPress={save} disabled={saving}>
                                {saving
                                    ? <ActivityIndicator color="#fff" />
                                    : <Text style={s.saveBtnText}>Sauvegarder le profil</Text>
                                }
                            </TouchableOpacity>

                            {/* Train button */}
                            <TouchableOpacity style={s.trainBtn} onPress={trainAI} disabled={saving}>
                                <SafeIcon name="sparkles-outline" size={18} color="#6366F1" />
                                <Text style={s.trainBtnText}>Entraîner l'IA sur mes exemples</Text>
                            </TouchableOpacity>

                            {profile.last_trained_at && (
                                <Text style={s.trainedAt}>
                                    Dernier entraînement: {new Date(profile.last_trained_at).toLocaleDateString('fr-FR')}
                                </Text>
                            )}
                        </>
                    )}

                    {/* ─── GENERATE TAB ─── */}
                    {tab === 'generate' && (
                        <>
                            <Text style={s.sectionTitle}>Sujet / Promotion</Text>
                            <TextInput
                                style={[s.input, s.textArea]}
                                value={genTopic}
                                onChangeText={setGenTopic}
                                placeholder="Ex: Nouvelle collection de sacs, promo -20% ce weekend…"
                                placeholderTextColor="#475569"
                                multiline
                                numberOfLines={4}
                            />

                            <Text style={s.sectionTitle}>Plateformes cibles</Text>
                            <View style={s.chipRow}>
                                {['instagram', 'facebook', 'tiktok', 'linkedin'].map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={[s.chip, genPlatforms.includes(p) && s.chipSelected]}
                                        onPress={() => togglePlatform(p)}
                                    >
                                        <Text style={[s.chipText, genPlatforms.includes(p) && { color: '#fff' }]}>
                                            {p}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                style={[s.saveBtn, generating && { opacity: 0.6 }]}
                                onPress={generatePosts}
                                disabled={generating}
                            >
                                {generating
                                    ? <ActivityIndicator color="#fff" />
                                    : <>
                                        <SafeIcon name="create-outline" size={18} color="#fff" />
                                        <Text style={s.saveBtnText}>Générer avec ma voix</Text>
                                      </>
                                }
                            </TouchableOpacity>

                            {generatedPosts.map((gp, i) => (
                                <View key={i} style={s.genCard}>
                                    <View style={s.genCardHeader}>
                                        <Text style={s.genPlatform}>{gp.platform.toUpperCase()}</Text>
                                        {gp.score !== undefined && (
                                            <Text style={s.genScore}>Score: {gp.score.toFixed(0)}%</Text>
                                        )}
                                    </View>
                                    <Text style={s.genCaption}>{gp.caption}</Text>
                                    {gp.hashtags.length > 0 && (
                                        <Text style={s.genHashtags}>
                                            {gp.hashtags.map(h => `#${h}`).join(' ')}
                                        </Text>
                                    )}
                                    <TouchableOpacity
                                        style={s.useBtn}
                                        onPress={() => {
                                            Alert.alert('Copié', 'Post ajouté au brouillon.');
                                        }}
                                    >
                                        <SafeIcon name="copy-outline" size={15} color="#6366F1" />
                                        <Text style={s.useBtnText}>Utiliser ce post</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </>
                    )}

                    {/* ─── SAMPLES TAB ─── */}
                    {tab === 'samples' && (
                        <>
                            <Text style={s.sectionTitle}>Exemples de posts</Text>
                            <Text style={s.hint}>
                                Ajoutez au moins 3 posts représentatifs de votre style pour entraîner l'IA.
                            </Text>

                            <View style={s.inputRow}>
                                <TextInput
                                    style={[s.input, { flex: 1 }]}
                                    value={sampleInput}
                                    onChangeText={setSampleInput}
                                    placeholder="Collez un exemple de post…"
                                    placeholderTextColor="#475569"
                                    multiline
                                />
                                <TouchableOpacity
                                    style={s.addBtn}
                                    onPress={() => addChip('sample_posts', sampleInput, () => setSampleInput(''))}
                                >
                                    <SafeIcon name="add" size={20} color="#fff" />
                                </TouchableOpacity>
                            </View>

                            {profile.sample_posts.length === 0 && (
                                <View style={s.empty}>
                                    <SafeIcon name="document-text-outline" size={48} color="#334155" />
                                    <Text style={s.emptyText}>Aucun exemple ajouté</Text>
                                </View>
                            )}

                            {profile.sample_posts.map((sp, i) => (
                                <View key={i} style={s.sampleCard}>
                                    <Text style={s.sampleIndex}>Exemple {i + 1}</Text>
                                    <Text style={s.sampleText}>{sp}</Text>
                                    <TouchableOpacity
                                        style={s.removeBtn}
                                        onPress={() => removeChip('sample_posts', i)}
                                    >
                                        <SafeIcon name="trash-outline" size={16} color="#EF4444" />
                                        <Text style={s.removeBtnText}>Supprimer</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {profile.sample_posts.length >= 3 && (
                                <TouchableOpacity style={s.trainBtn} onPress={trainAI} disabled={saving}>
                                    <SafeIcon name="sparkles-outline" size={18} color="#6366F1" />
                                    <Text style={s.trainBtnText}>Entraîner l'IA maintenant</Text>
                                </TouchableOpacity>
                            )}
                        </>
                    )}
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
    scoreBadge: {
        borderRadius: 12, paddingHorizontal: 10, paddingVertical: 4,
    },
    scoreText: { color: '#fff', fontSize: 13, fontWeight: '700' },
    tabs: {
        flexDirection: 'row', backgroundColor: '#1E293B',
        paddingHorizontal: 8, paddingBottom: 8,
    },
    tab: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
    tabActive: { backgroundColor: '#6366F1' },
    tabText: { color: '#94A3B8', fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: '#fff' },
    body: { padding: 16, gap: 14 },
    sectionTitle: { color: '#E2E8F0', fontSize: 15, fontWeight: '700', marginTop: 8 },
    hint: { color: '#64748B', fontSize: 12, marginTop: -8 },
    toneGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    toneCard: {
        width: '30%', alignItems: 'center', gap: 6,
        backgroundColor: '#1E293B', borderRadius: 12,
        padding: 14, borderWidth: 1, borderColor: '#334155',
    },
    toneCardActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    toneLabel: { color: '#94A3B8', fontSize: 12, textAlign: 'center' },
    toneLabelActive: { color: '#fff' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        backgroundColor: '#1E293B', borderRadius: 20,
        paddingHorizontal: 12, paddingVertical: 6,
        borderWidth: 1, borderColor: '#6366F1',
    },
    chipDanger: { borderColor: '#EF4444' },
    chipSelected: { backgroundColor: '#6366F1' },
    chipText: { color: '#6366F1', fontSize: 13 },
    inputRow: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
    input: {
        flex: 1, backgroundColor: '#1E293B', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 12,
        color: '#E2E8F0', fontSize: 14,
        borderWidth: 1, borderColor: '#334155',
    },
    textArea: { minHeight: 90, textAlignVertical: 'top' },
    addBtn: {
        backgroundColor: '#6366F1', borderRadius: 10,
        padding: 12, alignItems: 'center', justifyContent: 'center',
    },
    toggleRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        backgroundColor: '#1E293B', borderRadius: 12, padding: 16,
    },
    toggleLabel: { color: '#E2E8F0', fontSize: 15 },
    toggle: {
        width: 44, height: 24, borderRadius: 12,
        backgroundColor: '#334155', justifyContent: 'center', paddingHorizontal: 2,
    },
    toggleOn: { backgroundColor: '#6366F1' },
    toggleThumb: {
        width: 20, height: 20, borderRadius: 10, backgroundColor: '#94A3B8',
    },
    toggleThumbOn: { backgroundColor: '#fff', alignSelf: 'flex-end' },
    styleRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
    styleChip: {
        borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8,
        borderWidth: 1, borderColor: '#334155',
    },
    styleChipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    styleChipText: { color: '#94A3B8', fontSize: 13 },
    styleChipTextActive: { color: '#fff' },
    saveBtn: {
        backgroundColor: '#6366F1', borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        paddingVertical: 14,
    },
    saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    trainBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        borderWidth: 1, borderColor: '#6366F1', borderRadius: 12, paddingVertical: 13,
    },
    trainBtnText: { color: '#6366F1', fontSize: 15, fontWeight: '600' },
    trainedAt: { color: '#64748B', fontSize: 12, textAlign: 'center' },
    genCard: {
        backgroundColor: '#1E293B', borderRadius: 14, padding: 16, gap: 10,
    },
    genCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    genPlatform: { color: '#6366F1', fontSize: 12, fontWeight: '700' },
    genScore: { color: '#10B981', fontSize: 12, fontWeight: '600' },
    genCaption: { color: '#E2E8F0', fontSize: 14, lineHeight: 21 },
    genHashtags: { color: '#818CF8', fontSize: 12 },
    useBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        borderWidth: 1, borderColor: '#6366F1', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 8, alignSelf: 'flex-start',
    },
    useBtnText: { color: '#6366F1', fontSize: 13, fontWeight: '600' },
    sampleCard: {
        backgroundColor: '#1E293B', borderRadius: 12, padding: 14, gap: 8,
    },
    sampleIndex: { color: '#64748B', fontSize: 12, fontWeight: '600' },
    sampleText: { color: '#E2E8F0', fontSize: 13, lineHeight: 20 },
    removeBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end',
    },
    removeBtnText: { color: '#EF4444', fontSize: 12 },
    empty: { alignItems: 'center', paddingTop: 40, gap: 10 },
    emptyText: { color: '#64748B', fontSize: 15 },
});
