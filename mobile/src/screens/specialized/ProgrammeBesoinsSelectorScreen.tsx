/**
 * Parcours « liste au programme » : optionnellement lier un établissement (orientation),
 * choisir une classe, cocher les manuels du programme officiel Yukpo, préciser neuf / occasion / les deux,
 * puis voir les annonces correspondantes sur la bourse (API v2).
 */

import { useNavigation } from '@react-navigation/native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { bourseLivreV2Api, ProgrammeScolaire } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

type EtatSouhaite = 'neuf' | 'occasion' | 'les_deux';

interface EtablissementLite {
    id: number;
    nom_etablissement: string;
    ville: string;
    type_etablissement: string;
}

interface ClasseRow {
    classe: string;
    niveau: string;
    total_livres: number;
    au_programme?: number;
    entrees_programme?: number;
}

function livreEstNeuf(l: any): boolean {
    const a = `${l?.etat_classification ?? ''} ${l?.etat_livre ?? ''}`.toLowerCase();
    return a.includes('neuf');
}

function filtrerSelonPreference(livres: any[], pref: EtatSouhaite): any[] {
    if (pref === 'neuf') return livres.filter(livreEstNeuf);
    if (pref === 'occasion') return livres.filter((l) => !livreEstNeuf(l));
    return livres;
}

function prixOfficielPositif(v: unknown): number {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

const ProgrammeBesoinsSelectorScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();

    const [villeEtab, setVilleEtab] = useState('');
    const [etabLoading, setEtabLoading] = useState(false);
    const [etabs, setEtabs] = useState<EtablissementLite[]>([]);
    const [etabSelectionne, setEtabSelectionne] = useState<EtablissementLite | null>(null);

    const [classes, setClasses] = useState<ClasseRow[]>([]);
    const [classesLoading, setClassesLoading] = useState(true);
    const [classe, setClasse] = useState<string | null>(null);

    const [programmes, setProgrammes] = useState<ProgrammeScolaire[]>([]);
    const [progLoading, setProgLoading] = useState(false);

    /** programmeId -> préférence si coché */
    const [checked, setChecked] = useState<Record<number, EtatSouhaite>>({});

    const [stepResultats, setStepResultats] = useState(false);
    const [resultLoading, setResultLoading] = useState(false);
    const [resultatsParLigne, setResultatsParLigne] = useState<
        Array<{
            prog: ProgrammeScolaire;
            pref: EtatSouhaite;
            livres: any[];
        }>
    >([]);

    const loadClasses = useCallback(async () => {
        try {
            setClassesLoading(true);
            const rows = await bourseLivreV2Api.getClassesWithProgrammes();
            const mapped: ClasseRow[] = (rows || []).map((r: any) => ({
                classe: r.classe,
                niveau: r.niveau,
                total_livres: r.total_livres ?? 0,
                au_programme: r.au_programme,
                entrees_programme: r.entrees_programme,
            }));
            mapped.sort((a, b) => a.classe.localeCompare(b.classe, 'fr'));
            setClasses(mapped);
        } catch (e) {
            console.error('[ProgrammeBesoins] classes', e);
            setClasses([]);
        } finally {
            setClassesLoading(false);
        }
    }, []);

    useEffect(() => {
        loadClasses();
    }, [loadClasses]);

    const chargerProgrammes = useCallback(async (c: string) => {
        try {
            setProgLoading(true);
            const list = await bourseLivreV2Api.getProgrammes(c);
            setProgrammes(list);
            setChecked({});
        } catch (e) {
            console.error('[ProgrammeBesoins] programmes', e);
            setProgrammes([]);
        } finally {
            setProgLoading(false);
        }
    }, []);

    useEffect(() => {
        if (classe) chargerProgrammes(classe);
        else {
            setProgrammes([]);
            setChecked({});
        }
    }, [classe, chargerProgrammes]);

    const rechercherEtabs = useCallback(async () => {
        try {
            setEtabLoading(true);
            const params = new URLSearchParams({ page: '1', limit: '25' });
            if (villeEtab.trim()) params.append('ville', villeEtab.trim());
            const response = await apiGet(`/api/orientation-scolaire/etablissements/search?${params}`);
            const data = (response?.data || response) as any;
            if (data?.success) {
                setEtabs(data.data || []);
            } else {
                setEtabs([]);
            }
        } catch (e) {
            console.error('[ProgrammeBesoins] etabs', e);
            setEtabs([]);
        } finally {
            setEtabLoading(false);
        }
    }, [villeEtab]);

    const toggleLigne = useCallback((id: number) => {
        hapticPress();
        setChecked((prev) => {
            const next = { ...prev };
            if (next[id]) delete next[id];
            else next[id] = 'les_deux';
            return next;
        });
    }, []);

    const setPref = useCallback((id: number, pref: EtatSouhaite) => {
        hapticPress();
        setChecked((prev) => ({ ...prev, [id]: pref }));
    }, []);

    const toutCocher = useCallback(() => {
        hapticPress();
        const next: Record<number, EtatSouhaite> = {};
        programmes.forEach((p) => {
            next[p.id] = checked[p.id] ?? 'les_deux';
        });
        setChecked(next);
    }, [programmes, checked]);

    const toutDecocher = useCallback(() => {
        hapticPress();
        setChecked({});
    }, []);

    const selectionCount = useMemo(() => Object.keys(checked).length, [checked]);

    /** Somme des prix catalogue officiel pour les lignes « neuf » ou « les deux » (hors seul occasion). */
    const budgetNeufSelection = useMemo(() => {
        let sum = 0;
        let withPrice = 0;
        let withoutPrice = 0;
        let countNeufPath = 0;
        for (const p of programmes) {
            if (!checked[p.id]) continue;
            const pref = checked[p.id];
            if (pref === 'occasion') continue;
            countNeufPath++;
            const px = prixOfficielPositif(p.prix_officiel);
            if (px > 0) {
                sum += px;
                withPrice++;
            } else {
                withoutPrice++;
            }
        }
        return { sum, withPrice, withoutPrice, countNeufPath };
    }, [programmes, checked]);

    const lancerRechercheAnnonces = useCallback(async () => {
        if (!classe || selectionCount === 0) return;
        hapticPress();
        setResultLoading(true);
        setStepResultats(true);
        try {
            const ids = Object.keys(checked).map(Number);
            const lignes = programmes.filter((p) => ids.includes(p.id));
            const chunks = await Promise.all(
                lignes.map(async (prog) => {
                    const pref = checked[prog.id];
                    const search =
                        prog.titre_livre.length > 2 ? prog.titre_livre.slice(0, 80) : undefined;
                    let livres = await bourseLivreV2Api.browseByClass(
                        classe,
                        prog.matiere,
                        undefined,
                        undefined,
                        undefined,
                        search,
                        40
                    );
                    livres = filtrerSelonPreference(livres, pref);
                    return { prog, pref, livres };
                })
            );
            setResultatsParLigne(chunks);
        } catch (e) {
            console.error('[ProgrammeBesoins] browse', e);
            setResultatsParLigne([]);
        } finally {
            setResultLoading(false);
        }
    }, [classe, checked, programmes, selectionCount]);

    const renderPrefChips = (progId: number) => {
        const pref = checked[progId] || 'les_deux';
        const chip = (key: EtatSouhaite, label: string) => (
            <TouchableOpacity
                key={key}
                style={[styles.prefChip, pref === key && styles.prefChipOn]}
                onPress={() => setPref(progId, key)}
                activeOpacity={0.85}
            >
                <Text style={[styles.prefChipText, pref === key && styles.prefChipTextOn]}>{label}</Text>
            </TouchableOpacity>
        );
        return (
            <View style={styles.prefRow}>
                {chip('neuf', t('programmeBesoins.neuf', 'Neuf'))}
                {chip('occasion', t('programmeBesoins.occasion', 'Occasion'))}
                {chip('les_deux', t('programmeBesoins.lesDeux', 'Les deux'))}
            </View>
        );
    };

    if (stepResultats) {
        return (
            <SafeNativeView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => {
                            hapticPress();
                            setStepResultats(false);
                        }}
                    >
                        <SafeIcon name="arrow-left" size={22} color={modernColors.primary} type="lucide" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('programmeBesoins.resultatsTitle', 'Annonces pour votre sélection')}</Text>
                </View>
                {resultLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                        <Text style={styles.muted}>{t('programmeBesoins.chargement', 'Chargement…')}</Text>
                    </View>
                ) : (
                    <FlatList
                        data={resultatsParLigne}
                        keyExtractor={(item) => String(item.prog.id)}
                        contentContainerStyle={styles.listPad}
                        ListHeaderComponent={
                            etabSelectionne ? (
                                <Text style={styles.etabHint}>
                                    {t('programmeBesoins.etabContext', 'Établissement : {{nom}} — {{ville}}', {
                                        nom: etabSelectionne.nom_etablissement,
                                        ville: etabSelectionne.ville,
                                    })}
                                </Text>
                            ) : null
                        }
                        renderItem={({ item }) => (
                            <View style={styles.resultSection}>
                                <Text style={styles.resultSectionTitle} numberOfLines={2}>
                                    {item.prog.titre_livre}
                                </Text>
                                <Text style={styles.resultSectionMeta}>
                                    {item.prog.matiere} · {classe} ·{' '}
                                    {item.pref === 'neuf'
                                        ? t('programmeBesoins.neuf', 'Neuf')
                                        : item.pref === 'occasion'
                                          ? t('programmeBesoins.occasion', 'Occasion')
                                          : t('programmeBesoins.lesDeux', 'Les deux')}
                                </Text>
                                {item.livres.length === 0 ? (
                                    <Text style={styles.muted}>
                                        {t('programmeBesoins.aucuneAnnonce', 'Aucune annonce pour ces critères.')}
                                    </Text>
                                ) : (
                                    item.livres.map((livre: any) => (
                                        <TouchableOpacity
                                            key={livre.id}
                                            style={styles.miniCard}
                                            onPress={() =>
                                                navigation.navigate('LivreScolaireDetails', { livreId: livre.id })
                                            }
                                            activeOpacity={0.88}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.miniTitle} numberOfLines={2}>
                                                    {livre.titre}
                                                </Text>
                                                <Text style={styles.miniMeta} numberOfLines={1}>
                                                    {(livre.etat_classification || livre.etat_livre || '—') +
                                                        (livre.ville ? ` · ${livre.ville}` : '')}
                                                </Text>
                                            </View>
                                            <SafeIcon name="chevron-right" size={18} color="#9ca3af" type="lucide" />
                                        </TouchableOpacity>
                                    ))
                                )}
                            </View>
                        )}
                    />
                )}
            </SafeNativeView>
        );
    }

    return (
        <SafeNativeView style={styles.safe}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()}>
                    <SafeIcon name="arrow-left" size={22} color={modernColors.primary} type="lucide" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('programmeBesoins.title', 'Besoins au programme')}</Text>
            </View>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                <Text style={styles.lead}>
                    {t(
                        'programmeBesoins.lead',
                        'Choisissez une classe, cochez les manuels du programme officiel, indiquez si vous cherchez du neuf, de l’occasion ou les deux, puis lancez la recherche sur la bourse.'
                    )}
                </Text>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>
                        {t('programmeBesoins.etablissementSection', 'Établissement (optionnel)')}
                    </Text>
                    <Text style={styles.cardHint}>
                        {t(
                            'programmeBesoins.etablissementHint',
                            'Repérez votre école pour accéder aux documents de programme sur l’orientation. La liste des manuels ci‑dessous est le référentiel Yukpo (officiel), indépendante de l’établissement.'
                        )}
                    </Text>
                    <View style={styles.rowInput}>
                        <TextInput
                            style={styles.input}
                            placeholder={t('programmeBesoins.villePlaceholder', 'Ville (ex. Douala)')}
                            value={villeEtab}
                            onChangeText={setVilleEtab}
                            placeholderTextColor="#9ca3af"
                        />
                        <TouchableOpacity style={styles.btnSecondary} onPress={rechercherEtabs}>
                            <Text style={styles.btnSecondaryText}>{t('programmeBesoins.chercherEtab', 'Chercher')}</Text>
                        </TouchableOpacity>
                    </View>
                    {etabLoading && <ActivityIndicator color={modernColors.primary} />}
                    {etabs.length > 0 && (
                        <FlatList
                            scrollEnabled={false}
                            data={etabs}
                            keyExtractor={(e) => String(e.id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.etabRow,
                                        etabSelectionne?.id === item.id && styles.etabRowOn,
                                    ]}
                                    onPress={() => {
                                        hapticPress();
                                        setEtabSelectionne(item);
                                    }}
                                >
                                    <Text style={styles.etabName}>{item.nom_etablissement}</Text>
                                    <Text style={styles.etabVille}>
                                        {item.ville} · {item.type_etablissement}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    )}
                    {etabSelectionne && (
                        <View style={styles.etabActions}>
                            <TouchableOpacity
                                onPress={() => {
                                    hapticPress();
                                    navigation.navigate('ProgrammesScolaires', {
                                        etablissement_id: etabSelectionne.id,
                                    });
                                }}
                            >
                                <Text style={styles.link}>
                                    {t('programmeBesoins.voirPdfProgramme', 'Programmes / PDF de cet établissement')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEtabSelectionne(null)}>
                                <Text style={styles.linkMuted}>{t('programmeBesoins.retirerEtab', 'Retirer')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>{t('programmeBesoins.classeTitle', 'Classe')}</Text>
                    {classesLoading ? (
                        <ActivityIndicator color={modernColors.primary} />
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                            {classes.map((c) => (
                                <TouchableOpacity
                                    key={c.classe}
                                    style={[styles.chip, classe === c.classe && styles.chipOn]}
                                    onPress={() => {
                                        hapticPress();
                                        setClasse(c.classe);
                                    }}
                                >
                                    <Text style={[styles.chipText, classe === c.classe && styles.chipTextOn]}>
                                        {c.classe}
                                    </Text>
                                    {c.entrees_programme != null && c.entrees_programme > 0 ? (
                                        <Text style={styles.chipSub}>
                                            {t('programmeBesoins.refProgramme', '{{n}} au programme', {
                                                n: c.entrees_programme,
                                            })}
                                        </Text>
                                    ) : c.total_livres > 0 ? (
                                        <Text style={styles.chipSub}>
                                            {t('programmeBesoins.annonces', '{{n}} annonces', { n: c.total_livres })}
                                        </Text>
                                    ) : null}
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    )}
                </View>

                {classe && (
                    <View style={styles.card}>
                        <View style={styles.rowBetween}>
                            <Text style={styles.cardTitle}>
                                {t('programmeBesoins.livresProgramme', 'Livres au programme')} — {classe}
                            </Text>
                            <View style={styles.bulkRow}>
                                <TouchableOpacity onPress={toutCocher}>
                                    <Text style={styles.link}>{t('programmeBesoins.toutCocher', 'Tout cocher')}</Text>
                                </TouchableOpacity>
                                <Text style={styles.dot}>·</Text>
                                <TouchableOpacity onPress={toutDecocher}>
                                    <Text style={styles.linkMuted}>{t('programmeBesoins.toutDecocher', 'Tout décocher')}</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        {progLoading ? (
                            <ActivityIndicator color={modernColors.primary} style={{ marginVertical: 16 }} />
                        ) : programmes.length === 0 ? (
                            <Text style={styles.muted}>
                                {t(
                                    'programmeBesoins.emptyProgramme',
                                    'Aucune entrée de programme pour cette classe dans la base. Essayez une autre classe ou utilisez la recherche libre.'
                                )}
                            </Text>
                        ) : (
                            programmes.map((p) => {
                                const isOn = !!checked[p.id];
                                return (
                                    <View key={p.id} style={[styles.ligne, isOn && styles.ligneOn]}>
                                        <TouchableOpacity style={styles.ligneMain} onPress={() => toggleLigne(p.id)}>
                                            <View style={[styles.checkbox, isOn && styles.checkboxOn]}>
                                                {isOn && <SafeIcon name="check" size={14} color="#fff" type="lucide" />}
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.ligneTitre} numberOfLines={2}>
                                                    {p.titre_livre}
                                                </Text>
                                                <Text style={styles.ligneMeta}>
                                                    {p.matiere}
                                                    {p.prix_officiel != null
                                                        ? ` · ${Number(p.prix_officiel).toLocaleString()} ${p.devise || 'XAF'}`
                                                        : ''}
                                                </Text>
                                            </View>
                                        </TouchableOpacity>
                                        {isOn && renderPrefChips(p.id)}
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {classe && programmes.length > 0 && selectionCount > 0 && budgetNeufSelection.countNeufPath > 0 && (
                    <View style={styles.budgetCard}>
                        <Text style={styles.budgetCardTitle}>
                            {t('programmeBesoins.budgetNeufTitle', 'Budget neuf (prix catalogue officiel)')}
                        </Text>
                        {budgetNeufSelection.sum > 0 ? (
                            <Text style={styles.budgetCardMain}>
                                {t('programmeBesoins.budgetNeufMontant', '{{montant}} XAF — {{withPrice}} / {{count}}', {
                                    montant: Math.round(budgetNeufSelection.sum).toLocaleString(),
                                    withPrice: budgetNeufSelection.withPrice,
                                    count: budgetNeufSelection.countNeufPath,
                                })}
                            </Text>
                        ) : (
                            <Text style={styles.budgetCardMuted}>
                                {t('programmeBesoins.budgetNeufSansTotal')}
                            </Text>
                        )}
                        {budgetNeufSelection.withoutPrice > 0 && budgetNeufSelection.sum > 0 ? (
                            <Text style={styles.budgetCardMuted}>
                                {t('programmeBesoins.budgetSansPrix', '{{n}} titre(s) sans prix officiel en base.', {
                                    n: budgetNeufSelection.withoutPrice,
                                })}
                            </Text>
                        ) : null}
                        {Object.values(checked).some((pr) => pr === 'occasion' || pr === 'les_deux') ? (
                            <Text style={styles.budgetCardMuted}>
                                {t(
                                    'programmeBesoins.budgetOccasionHint',
                                    'Pour l’occasion, les montants varient selon les annonces.'
                                )}
                            </Text>
                        ) : null}
                        <TouchableOpacity
                            style={styles.budgetLinkBtn}
                            onPress={() => {
                                hapticPress();
                                navigation.navigate('NewBooks', { classe: classe! });
                            }}
                        >
                            <Text style={styles.link}>
                                {t('programmeBesoins.ouvrirComparateur', 'Comparateur neuf / occasion (budget détaillé)')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {classe && programmes.length > 0 && (
                    <TouchableOpacity
                        style={[styles.cta, selectionCount === 0 && styles.ctaDisabled]}
                        disabled={selectionCount === 0}
                        onPress={lancerRechercheAnnonces}
                    >
                        <SafeIcon name="search" size={20} color="#fff" type="lucide" />
                        <Text style={styles.ctaText}>
                            {t('programmeBesoins.ctaRechercher', 'Voir les annonces ({{n}})', { n: selectionCount })}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={styles.footerLink}
                    onPress={() => navigation.navigate('LivreScolaireSearch')}
                >
                    <Text style={styles.link}>{t('programmeBesoins.rechercheAvancee', 'Recherche avancée et filtres')}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={styles.footerLink}
                    onPress={() => {
                        hapticPress();
                        navigation.navigate('NewBooks', classe ? { classe } : undefined);
                    }}
                >
                    <Text style={styles.link}>{t('programmeBesoins.catalogueNeuf', 'Catalogue livres neufs & comparateur')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f8fafc' },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 10,
        backgroundColor: '#fff',
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#e5e7eb',
    },
    backBtn: { padding: 8 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#0f172a', flex: 1 },
    scroll: { padding: 16, paddingBottom: 40 },
    lead: { fontSize: 14, color: '#475569', lineHeight: 20, marginBottom: 16 },
    card: {
        backgroundColor: '#fff',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    cardTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', marginBottom: 6 },
    cardHint: { fontSize: 12, color: '#64748b', marginBottom: 10, lineHeight: 17 },
    rowInput: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    btnSecondary: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 10,
    },
    btnSecondaryText: { fontWeight: '600', color: '#0369a1', fontSize: 14 },
    etabRow: {
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: '#f1f5f9',
    },
    etabRowOn: { backgroundColor: '#eff6ff', marginHorizontal: -8, paddingHorizontal: 8, borderRadius: 8 },
    etabName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    etabVille: { fontSize: 12, color: '#64748b', marginTop: 2 },
    etabActions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
    link: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    linkMuted: { fontSize: 13, color: '#94a3b8' },
    chipsScroll: { flexGrow: 0 },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
    },
    chipOn: { backgroundColor: '#dbeafe', borderColor: modernColors.primary },
    chipText: { fontWeight: '600', color: '#475569', fontSize: 14 },
    chipTextOn: { color: modernColors.primary },
    chipSub: { fontSize: 10, color: '#64748b', marginTop: 2 },
    rowBetween: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
    bulkRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap' },
    dot: { color: '#cbd5e1', marginHorizontal: 6 },
    ligne: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        backgroundColor: '#fafafa',
    },
    ligneOn: { borderColor: '#93c5fd', backgroundColor: '#f8fbff' },
    ligneMain: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    checkbox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#cbd5e1',
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxOn: { backgroundColor: modernColors.primary, borderColor: modernColors.primary },
    ligneTitre: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    ligneMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
    prefRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10, marginLeft: 32 },
    prefChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    prefChipOn: { backgroundColor: '#dbeafe', borderColor: modernColors.primary },
    prefChipText: { fontSize: 12, fontWeight: '600', color: '#64748b' },
    prefChipTextOn: { color: modernColors.primary },
    cta: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: modernColors.primary,
        paddingVertical: 14,
        borderRadius: 14,
        marginBottom: 12,
    },
    ctaDisabled: { opacity: 0.45 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    footerLink: { marginBottom: 10 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    muted: { color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center' },
    listPad: { padding: 16, paddingBottom: 32 },
    etabHint: { fontSize: 13, color: '#475569', marginBottom: 12 },
    resultSection: { marginBottom: 22 },
    resultSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
    resultSectionMeta: { fontSize: 12, color: '#64748b', marginBottom: 8 },
    miniCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    miniTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
    miniMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
    budgetCard: {
        backgroundColor: '#ecfdf5',
        borderRadius: 14,
        padding: 14,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#a7f3d0',
    },
    budgetCardTitle: { fontSize: 15, fontWeight: '800', color: '#065f46', marginBottom: 8 },
    budgetCardMain: { fontSize: 16, fontWeight: '700', color: '#047857', marginBottom: 6 },
    budgetCardMuted: { fontSize: 12, color: '#047857', opacity: 0.85, marginBottom: 6, lineHeight: 17 },
    budgetLinkBtn: { marginTop: 4 },
});

export default ProgrammeBesoinsSelectorScreen;
