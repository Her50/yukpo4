/**
 * Validation des lignes « neufs » par la librairie : disponibilité (panier partiel) et refus explicite.
 * Les lignes non traitées restent pour d'autres partenaires (multi-paniers).
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import YukpoContextHelpChip from '../../components/bourse/YukpoContextHelpChip';
import SafeIcon from '../../components/SafeIcon';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import {
    CommandeMixteListeItem,
    getLibrairieMesCommandesMixtes,
    getLignesNeufsBornes,
    LigneNeufBornes,
    postValiderLignesCommande,
} from '../../services/librairieNetworkApi';
import { modernColors } from '../../theme/modernTheme';

type RouteParams = { commandeId?: string };

type ChoixLigne = 'aucun' | 'valide' | 'indispo';

const LibrairieNetworkValidationScreen: React.FC = () => {
    const { t } = useLanguageSafe();
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params ?? {}) as RouteParams;

    const [commandeId, setCommandeId] = useState('');
    const [mesCommandes, setMesCommandes] = useState<CommandeMixteListeItem[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [lignes, setLignes] = useState<LigneNeufBornes[]>([]);
    const [choix, setChoix] = useState<Record<string, ChoixLigne>>({});
    const [notes, setNotes] = useState('');

    const loadListeCommandes = useCallback(async () => {
        try {
            setListLoading(true);
            const { commandes } = await getLibrairieMesCommandesMixtes();
            setMesCommandes(commandes);
        } catch (e: any) {
            Alert.alert(t('message.error', 'Erreur'), e?.message || 'Liste indisponible');
        } finally {
            setListLoading(false);
        }
    }, [t]);

    useEffect(() => {
        loadListeCommandes();
    }, [loadListeCommandes]);

    useEffect(() => {
        const id = typeof params.commandeId === 'string' ? params.commandeId.trim() : '';
        if (id) setCommandeId(id);
    }, [params.commandeId]);

    const initChoixFromLignes = useCallback((list: LigneNeufBornes[]) => {
        const next: Record<string, ChoixLigne> = {};
        for (const l of list) {
            const id = l.ligne_id;
            const st = (l.statut_validation || '').toLowerCase();
            if (st === 'valide') next[id] = 'valide';
            else if (st === 'indisponible') next[id] = 'indispo';
            else next[id] = 'aucun';
        }
        setChoix(next);
    }, []);

    const loadLignes = useCallback(async () => {
        const id = commandeId.trim();
        if (!id) {
            Alert.alert(
                t('message.error', 'Erreur'),
                t('librairieNetworkValidation.needCommande', 'Sélectionnez ou saisissez une commande.')
            );
            return;
        }
        try {
            setLoading(true);
            const { lignes: list } = await getLignesNeufsBornes(id);
            setLignes(list);
            initChoixFromLignes(list);
        } catch (e: any) {
            Alert.alert(t('message.error', 'Erreur'), e?.message || 'Chargement impossible');
        } finally {
            setLoading(false);
        }
    }, [commandeId, t, initChoixFromLignes]);

    useEffect(() => {
        const id = typeof params.commandeId === 'string' ? params.commandeId.trim() : '';
        if (!id) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const { lignes: list } = await getLignesNeufsBornes(id);
                if (!cancelled) {
                    setLignes(list);
                    initChoixFromLignes(list);
                }
            } catch (e: any) {
                if (!cancelled) {
                    Alert.alert(t('message.error', 'Erreur'), e?.message || 'Chargement impossible');
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [params.commandeId, initChoixFromLignes, t]);

    const lignesEnAttente = useMemo(
        () => lignes.filter((l) => (l.statut_validation || '').toLowerCase() === 'en_attente'),
        [lignes]
    );

    const setChoixLigne = (ligneId: string, c: ChoixLigne) => {
        setChoix((prev) => ({ ...prev, [ligneId]: c }));
    };

    const soumettre = async () => {
        const id = commandeId.trim();
        if (!id) {
            Alert.alert(t('message.error', 'Erreur'), t('librairieNetworkValidation.needCommande', 'Sélectionnez une commande.'));
            return;
        }
        const livres_valides: string[] = [];
        const livres_indisponibles: string[] = [];
        for (const l of lignesEnAttente) {
            const c = choix[l.ligne_id] ?? 'aucun';
            if (c === 'valide') livres_valides.push(l.ligne_id);
            if (c === 'indispo') livres_indisponibles.push(l.ligne_id);
        }
        if (livres_valides.length === 0 && livres_indisponibles.length === 0) {
            Alert.alert(
                t('librairieNetworkValidation.rien', 'Aucune ligne'),
                t(
                    'librairieNetworkValidation.rienDetail',
                    'Indiquez au moins une ligne que vous fournissez ou que vous ne pouvez pas fournir, ou laissez tout en « Ne pas décider » pour d'autres librairies.'
                )
            );
            return;
        }
        try {
            setSubmitting(true);
            const res = await postValiderLignesCommande(id, {
                livres_valides,
                livres_indisponibles,
                notes_validation: notes.trim() || undefined,
            });
            Alert.alert(
                t('librairieNetworkValidation.okTitle', 'Envoyé'),
                res.message ||
                    t('librairieNetworkValidation.okBody', 'Votre réponse a été enregistrée.'),
                [
                    {
                        text: t('common.ok', 'OK'),
                        onPress: () => {
                            loadLignes();
                        },
                    },
                ]
            );
        } catch (e: any) {
            Alert.alert(t('message.error', 'Erreur'), e?.message || 'Échec');
        } finally {
            setSubmitting(false);
        }
    };

    const selectCommande = (c: CommandeMixteListeItem) => {
        if (!c.id) return;
        setCommandeId(c.id);
        setLoading(true);
        getLignesNeufsBornes(c.id)
            .then(({ lignes: list }) => {
                setLignes(list);
                initChoixFromLignes(list);
            })
            .catch((e: any) => Alert.alert(t('message.error', 'Erreur'), e?.message || 'Chargement impossible'))
            .finally(() => setLoading(false));
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
            <View style={styles.titleRow}>
                <Text style={[styles.title, styles.titleFlex]}>
                    {t('librairieNetworkValidation.title', 'Disponibilité — lignes neufs')}
                </Text>
                <YukpoContextHelpChip
                    messageKey="bourseUx.librairieYukpoSeedValidation"
                    defaultMessage="Je suis sur l'écran « Disponibilité — lignes neufs » (validation librairie). Explique-moi la différence entre valider une ligne, la marquer indisponible, ou « ne pas décider » ; et l'impact pour les autres librairies et les familles."
                    a11yKey="bourseUx.librairieYukpoHelpValidationA11y"
                    defaultA11y="Yukpo IA — aide validation lignes neufs"
                />
            </View>
            <Text style={styles.hint}>
                {t(
                    'librairieNetworkValidation.hint',
                    'Pour chaque ligne encore en attente : indiquez si vous la fournissez, si vous ne pouvez pas, ou laissez « Ne pas décider » pour que d'autres librairies puissent répondre.'
                )}
            </Text>

            <TouchableOpacity
                style={styles.linkRow}
                onPress={() => navigation.navigate('LibrairieNetworkLignePrix' as never, { commandeId } as never)}
            >
                <SafeIcon name="tag" size={18} color={modernColors.primary} style={{ marginRight: 8 }} />
                <Text style={styles.linkText}>
                    {t('librairieNetworkValidation.gotoPrix', 'Prix et bornes — même commande')}
                </Text>
                <SafeIcon name="chevron-right" size={18} color="#94a3b8" />
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>
                {t('librairieNetworkValidation.sectionMesCommandes', 'Mes commandes')}
            </Text>
            {listLoading ? (
                <ActivityIndicator style={{ marginVertical: 12 }} color={modernColors.primary} />
            ) : (
                mesCommandes.map((c) => (
                    <TouchableOpacity
                        key={c.id}
                        style={[styles.cmdRow, commandeId === c.id && styles.cmdRowActive]}
                        onPress={() => selectCommande(c)}
                    >
                        <View style={{ flex: 1 }}>
                            <Text style={styles.cmdRef}>{c.reference_commande || c.id}</Text>
                            <Text style={styles.cmdMeta}>
                                {c.statut || '—'} ·{' '}
                                {c.budget_total != null ? `${Math.round(c.budget_total)} XAF` : '—'}
                            </Text>
                        </View>
                        <SafeIcon name="chevron-right" size={18} color="#94a3b8" />
                    </TouchableOpacity>
                ))
            )}

            <Text style={[styles.sectionLabel, { marginTop: 12 }]}>
                {t('librairieNetworkValidation.uuid', 'UUID commande')}
            </Text>
            <TextInput
                style={styles.input}
                placeholder={t('librairieNetworkPrix.placeholderCommande', 'UUID commande mixte')}
                placeholderTextColor="#9ca3af"
                value={commandeId}
                onChangeText={setCommandeId}
                autoCapitalize="none"
                autoCorrect={false}
            />
            <TouchableOpacity style={styles.secondaryBtn} onPress={loadLignes} disabled={loading}>
                {loading ? (
                    <ActivityIndicator color={modernColors.primary} />
                ) : (
                    <Text style={styles.secondaryBtnText}>
                        {t('librairieNetworkValidation.load', 'Charger les lignes')}
                    </Text>
                )}
            </TouchableOpacity>

            <Text style={styles.sectionLabel}>
                {t('librairieNetworkValidation.notes', 'Notes (optionnel)')}
            </Text>
            <TextInput
                style={[styles.input, { minHeight: 72 }]}
                multiline
                placeholder={t('librairieNetworkValidation.notesPh', 'Commentaire pour la validation…')}
                placeholderTextColor="#9ca3af"
                value={notes}
                onChangeText={setNotes}
            />

            {lignes.length > 0 && (
                <Text style={styles.sectionLabel}>
                    {t('librairieNetworkValidation.lignes', 'Lignes')}
                </Text>
            )}

            {lignes.map((l) => {
                const st = (l.statut_validation || '').toLowerCase();
                const enAttente = st === 'en_attente';
                const c = choix[l.ligne_id] ?? 'aucun';
                return (
                    <View key={l.ligne_id} style={styles.card}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {l.titre}
                        </Text>
                        <Text style={styles.meta}>
                            {[l.classe, l.matiere].filter(Boolean).join(' · ') || '—'} ·{' '}
                            {t('librairieNetworkPrix.qty', 'Qté')}: {l.quantite}
                        </Text>
                        <Text style={styles.meta}>
                            {t('librairieNetworkValidation.statut', 'Statut')}: {st || '—'}
                        </Text>
                        {enAttente ? (
                            <View style={styles.choixRow}>
                                <TouchableOpacity
                                    style={[styles.chip, c === 'aucun' && styles.chipOn]}
                                    onPress={() => setChoixLigne(l.ligne_id, 'aucun')}
                                >
                                    <Text style={[styles.chipTxt, c === 'aucun' && styles.chipTxtOn]}>
                                        {t('librairieNetworkValidation.optAucun', 'Ne pas décider')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.chip, c === 'valide' && styles.chipOn]}
                                    onPress={() => setChoixLigne(l.ligne_id, 'valide')}
                                >
                                    <Text style={[styles.chipTxt, c === 'valide' && styles.chipTxtOn]}>
                                        {t('librairieNetworkValidation.optValide', 'Je fournis')}
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.chip, c === 'indispo' && styles.chipOn]}
                                    onPress={() => setChoixLigne(l.ligne_id, 'indispo')}
                                >
                                    <Text style={[styles.chipTxt, c === 'indispo' && styles.chipTxtOn]}>
                                        {t('librairieNetworkValidation.optIndispo', 'Indisponible ici')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <Text style={styles.metaMuted}>
                                {t(
                                    'librairieNetworkValidation.lectureSeule',
                                    'Ligne déjà traitée — pas de nouveau choix ici.'
                                )}
                            </Text>
                        )}
                    </View>
                );
            })}

            {lignesEnAttente.length > 0 && (
                <TouchableOpacity
                    style={[styles.primaryBtn, submitting && { opacity: 0.75 }]}
                    onPress={soumettre}
                    disabled={submitting}
                >
                    {submitting ? (
                        <ActivityIndicator color="#fff" />
                    ) : (
                        <Text style={styles.primaryBtnText}>
                            {t('librairieNetworkValidation.submit', 'Envoyer la validation')}
                        </Text>
                    )}
                </TouchableOpacity>
            )}

            {lignes.length === 0 && !loading ? (
                <View style={styles.empty}>
                    <SafeIcon name="book-open" size={32} color="#cbd5e1" />
                    <Text style={styles.emptyText}>
                        {t('librairieNetworkValidation.empty', 'Aucune ligne — chargez une commande.')}
                    </Text>
                </View>
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    inner: { padding: 14, paddingBottom: 40 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 6,
    },
    title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
    titleFlex: { flex: 1, marginBottom: 0 },
    hint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 14,
        padding: 10,
        backgroundColor: '#fffbeb',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fcd34d',
    },
    linkText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400e' },
    cmdRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 10,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cmdRowActive: { borderColor: '#ea580c', backgroundColor: '#fffbeb' },
    cmdRef: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
    cmdMeta: { fontSize: 12, color: '#6b7280', marginTop: 2 },
    input: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#fff',
        fontSize: 14,
        marginBottom: 10,
    },
    secondaryBtn: {
        borderWidth: 1,
        borderColor: modernColors.primary,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    secondaryBtnText: { color: modernColors.primary, fontWeight: '800', fontSize: 14 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#e5e7eb',
    },
    cardTitle: { fontSize: 14, fontWeight: '800', color: '#1f2937' },
    meta: { fontSize: 12, color: '#6b7280', marginTop: 4 },
    metaMuted: { fontSize: 11, color: '#94a3b8', marginTop: 8, fontStyle: 'italic' },
    choixRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
    chip: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        marginRight: 8,
        marginBottom: 8,
    },
    chipOn: { backgroundColor: '#1e293b', borderColor: '#1e293b' },
    chipTxt: { fontSize: 12, fontWeight: '800', color: '#475569' },
    chipTxtOn: { color: '#fff' },
    primaryBtn: {
        marginTop: 16,
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        paddingVertical: 14,
        alignItems: 'center',
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
    empty: { alignItems: 'center', paddingVertical: 32 },
    emptyText: { marginTop: 8, color: '#94a3b8', fontSize: 13 },
});

export default LibrairieNetworkValidationScreen;
