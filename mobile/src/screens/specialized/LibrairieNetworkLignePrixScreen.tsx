/**
 * Prix / bornes pour les lignes « neufs » d'une commande parent.
 * Une même commande peut être couverte par plusieurs librairies (panier partiel chacune) ;
 * cet écran ne représente que la part gérée par le partenaire connecté.
 */
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import React, { useCallback, useEffect, useState } from 'react';
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
    patchLigneNeufPrix,
} from '../../services/librairieNetworkApi';
import { modernColors } from '../../theme/modernTheme';

type RouteParams = { commandeId?: string };

const LibrairieNetworkLignePrixScreen: React.FC = () => {
    const { t } = useLanguageSafe();
    const navigation = useNavigation();
    const route = useRoute();
    const params = (route.params ?? {}) as RouteParams;

    const [commandeId, setCommandeId] = useState('');
    const [mesCommandes, setMesCommandes] = useState<CommandeMixteListeItem[]>([]);
    const [listLoading, setListLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [savingId, setSavingId] = useState<string | null>(null);
    const [lignes, setLignes] = useState<LigneNeufBornes[]>([]);
    const [drafts, setDrafts] = useState<Record<string, string>>({});

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

    useFocusEffect(
        useCallback(() => {
            loadListeCommandes();
        }, [loadListeCommandes])
    );

    useEffect(() => {
        const id = typeof params.commandeId === 'string' ? params.commandeId.trim() : '';
        if (id) {
            setCommandeId(id);
        }
    }, [params.commandeId]);

    const applyLignes = useCallback((list: LigneNeufBornes[]) => {
        setLignes(list);
        const next: Record<string, string> = {};
        for (const l of list) {
            next[l.ligne_id] = String(l.prix_final ?? '');
        }
        setDrafts(next);
    }, []);

    const loadBornes = useCallback(async () => {
        const id = commandeId.trim();
        if (!id) {
            Alert.alert(t('message.error', 'Erreur'), t('librairieNetworkPrix.needCommandeId', 'Choisissez une commande ou saisissez son UUID'));
            return;
        }
        try {
            setLoading(true);
            const { lignes: list } = await getLignesNeufsBornes(id);
            applyLignes(list);
        } catch (e: any) {
            Alert.alert(t('message.error', 'Erreur'), e?.message || 'Chargement impossible');
        } finally {
            setLoading(false);
        }
    }, [commandeId, t, applyLignes]);

    useEffect(() => {
        const id = typeof params.commandeId === 'string' ? params.commandeId.trim() : '';
        if (!id) return;
        let cancelled = false;
        (async () => {
            try {
                setLoading(true);
                const { lignes: list } = await getLignesNeufsBornes(id);
                if (!cancelled) applyLignes(list);
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
    }, [params.commandeId, applyLignes, t]);

    const selectCommande = (c: CommandeMixteListeItem) => {
        if (!c.id) return;
        setCommandeId(c.id);
        setLoading(true);
        getLignesNeufsBornes(c.id)
            .then(({ lignes: list }) => applyLignes(list))
            .catch((e: any) => Alert.alert(t('message.error', 'Erreur'), e?.message || 'Chargement impossible'))
            .finally(() => setLoading(false));
    };

    const saveLigne = async (l: LigneNeufBornes) => {
        const id = commandeId.trim();
        const raw = drafts[l.ligne_id] ?? '';
        const prix = parseFloat(raw.replace(',', '.'));
        if (!id || !Number.isFinite(prix)) {
            Alert.alert(t('message.error', 'Erreur'), t('librairieNetworkPrix.invalidPrix', 'Prix invalide'));
            return;
        }
        try {
            setSavingId(l.ligne_id);
            await patchLigneNeufPrix(id, l.ligne_id, prix);
            await loadBornes();
        } catch (e: any) {
            Alert.alert(t('message.error', 'Erreur'), e?.message || 'Enregistrement refusé');
        } finally {
            setSavingId(null);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.inner}>
            <View style={styles.titleRow}>
                <Text style={[styles.title, styles.titleFlex]}>
                    {t('librairieNetworkPrix.title', 'Commande mixte — prix neufs')}
                </Text>
                <YukpoContextHelpChip
                    messageKey="bourseUx.librairieYukpoSeedLignePrix"
                    defaultMessage="Je suis sur l'écran « Commande mixte — prix neufs » (partenaire librairie). Aide-moi : comment fixer un prix dans les bornes, ce qu'est une commande multi-librairies, et quand passer à la validation des lignes."
                    a11yKey="bourseUx.librairieYukpoHelpLignePrixA11y"
                    defaultA11y="Yukpo IA — aide prix neufs commande mixte"
                />
            </View>
            {commandeId.trim() ? (
                <TouchableOpacity
                    style={styles.linkRow}
                    onPress={() =>
                        navigation.navigate(
                            'LibrairieNetworkValidation' as never,
                            { commandeId: commandeId.trim() } as never
                        )
                    }
                >
                    <SafeIcon name="check-circle" size={18} color={modernColors.primary} />
                    <Text style={styles.linkText}>
                        {t('librairieNetworkPrix.gotoValidation', 'Disponibilité / validation des lignes')}
                    </Text>
                    <SafeIcon name="chevron-right" size={18} color="#94a3b8" />
                </TouchableOpacity>
            ) : null}
            <Text style={styles.hint}>
                {t(
                    'librairieNetworkPrix.hint2',
                    'Choisissez une commande dans la liste (librairie associée) ou ouvrez cet écran avec le paramètre commandeId (notif / lien).'
                )}
            </Text>

            <Text style={styles.sectionLabel}>
                {t('librairieNetworkPrix.sectionMesCommandes', 'Mes commandes mixtes (librairie)')}
            </Text>
            {listLoading ? (
                <ActivityIndicator style={{ marginVertical: 12 }} color={modernColors.primary} />
            ) : mesCommandes.length === 0 ? (
                <Text style={styles.emptyList}>
                    {t(
                        'librairieNetworkPrix.noCommandes',
                        "Aucune commande liée à votre librairie pour l'instant."
                    )}
                </Text>
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

            <Text style={[styles.sectionLabel, { marginTop: 16 }]}>
                {t('librairieNetworkPrix.sectionManualUuid', 'UUID manuel (optionnel)')}
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
            <TouchableOpacity style={styles.primaryBtn} onPress={loadBornes} disabled={loading}>
                {loading ? (
                    <ActivityIndicator color="#fff" />
                ) : (
                    <Text style={styles.primaryBtnText}>
                        {t('librairieNetworkPrix.loadBornes', 'Charger les bornes')}
                    </Text>
                )}
            </TouchableOpacity>

            {lignes.map((l) => {
                const locked = l.prix_officiel_verrouille;
                const minV = l.prix_plancher;
                const maxV = l.prix_plafond;
                const sug = l.prix_suggere;
                return (
                    <View key={l.ligne_id} style={styles.card}>
                        <Text style={styles.cardTitle} numberOfLines={2}>
                            {l.titre}
                        </Text>
                        <Text style={styles.meta}>
                            {locked
                                ? t('librairieNetworkPrix.lockedOfficial', 'Prix officiel verrouillé')
                                : t('librairieNetworkPrix.freeBounds', 'Bornes marché')}
                        </Text>
                        {!locked && (
                            <Text style={styles.meta}>
                                min {minV != null ? Math.round(minV) : '—'} — max {maxV != null ? Math.round(maxV) : '—'}
                                {sug != null ? ` · sugg. ${Math.round(sug)}` : ''}
                                {l.bornes_source ? ` (${l.bornes_source})` : ''}
                            </Text>
                        )}
                        <Text style={styles.meta}>
                            {t('librairieNetworkPrix.qty', 'Qté')}: {l.quantite}
                        </Text>
                        {locked ? (
                            <Text style={styles.lockedPrix}>
                                {Math.round(l.prix_final)} XAF ({t('librairieNetworkPrix.fixed', 'fixe')})
                            </Text>
                        ) : (
                            <>
                                <TextInput
                                    style={styles.inputSmall}
                                    keyboardType="decimal-pad"
                                    value={drafts[l.ligne_id] ?? ''}
                                    onChangeText={(txt) =>
                                        setDrafts((d) => ({
                                            ...d,
                                            [l.ligne_id]: txt,
                                        }))
                                    }
                                />
                                <TouchableOpacity
                                    style={[styles.saveBtn, savingId === l.ligne_id && { opacity: 0.7 }]}
                                    onPress={() => saveLigne(l)}
                                    disabled={savingId !== null}
                                >
                                    {savingId === l.ligne_id ? (
                                        <ActivityIndicator color="#fff" size="small" />
                                    ) : (
                                        <Text style={styles.saveBtnText}>
                                            {t('librairieNetworkPrix.savePrix', 'Enregistrer le prix')}
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                );
            })}

            {lignes.length === 0 && !loading ? (
                <View style={styles.empty}>
                    <SafeIcon name="book-open" size={32} color="#cbd5e1" />
                    <Text style={styles.emptyText}>
                        {t('librairieNetworkPrix.empty', 'Aucune ligne — chargez une commande.')}
                    </Text>
                </View>
            ) : null}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#f8fafc' },
    inner: { padding: 14, paddingBottom: 32 },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 10,
        marginBottom: 6,
    },
    title: { fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 6 },
    titleFlex: { flex: 1, marginBottom: 0 },
    linkRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 12,
        padding: 10,
        backgroundColor: '#fffbeb',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#fcd34d',
    },
    linkText: { flex: 1, fontSize: 13, fontWeight: '600', color: '#92400e' },
    hint: { fontSize: 12, color: '#6b7280', marginBottom: 12 },
    sectionLabel: { fontSize: 13, fontWeight: '700', color: '#374151', marginBottom: 8 },
    emptyList: { fontSize: 12, color: '#94a3b8', marginBottom: 8 },
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
    inputSmall: {
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: '#fff',
        marginTop: 8,
        fontSize: 15,
        fontWeight: '600',
    },
    primaryBtn: {
        backgroundColor: modernColors.primary,
        borderRadius: 10,
        paddingVertical: 12,
        alignItems: 'center',
        marginBottom: 16,
    },
    primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },
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
    lockedPrix: { marginTop: 8, fontSize: 16, fontWeight: '800', color: '#16a34a' },
    saveBtn: {
        marginTop: 10,
        backgroundColor: '#111827',
        borderRadius: 8,
        paddingVertical: 10,
        alignItems: 'center',
    },
    saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    empty: { alignItems: 'center', paddingVertical: 40 },
    emptyText: { marginTop: 8, color: '#94a3b8', fontSize: 13 },
});

export default LibrairieNetworkLignePrixScreen;
