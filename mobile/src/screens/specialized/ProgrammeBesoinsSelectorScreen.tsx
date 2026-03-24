/**
 * Parcours « liste au programme » : plusieurs enfants sur un même écran,
 * classes selon le système du pays de l’utilisateur, programme établissement prioritaire puis Yukpo national.
 */

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
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
import { getSystemeEducatif } from '../../data/educationSystems';
import useUserCountry from '../../hooks/useUserCountry';
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

/** Fallback : niveaux primaire → lycée du système éducatif du pays. */
function fallbackClassesForCountry(codePays: string): ClasseRow[] {
    const sys = getSystemeEducatif(codePays);
    return sys.niveaux
        .filter((n) => ['primaire', 'college', 'lycee'].includes(n.type))
        .map((n) => ({
            classe: n.nom,
            niveau: n.type,
            total_livres: 0,
        }));
}

function classeLabelForDisplay(classeApi: string, codePays: string): string {
    const sys = getSystemeEducatif(codePays);
    const exact = sys.niveaux.find((n) => n.nom === classeApi || n.nom.startsWith(classeApi));
    if (exact) return exact.nom;
    const short = sys.niveaux.find((n) => n.nom.includes(classeApi));
    return short?.nom ?? classeApi;
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

function newEnfantId(): string {
    return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

interface EnfantSlot {
    id: string;
    prenom: string;
    villeEtab: string;
    etab: EtablissementLite | null;
    etabs: EtablissementLite[];
    etabLoading: boolean;
    classe: string | null;
    programmes: ProgrammeScolaire[];
    progLoading: boolean;
    checked: Record<number, EtatSouhaite>;
}

const emptyEnfant = (): EnfantSlot => ({
    id: newEnfantId(),
    prenom: '',
    villeEtab: '',
    etab: null,
    etabs: [],
    etabLoading: false,
    classe: null,
    programmes: [],
    progLoading: false,
    checked: {},
});

const ProgrammeBesoinsSelectorScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { countryCode } = useUserCountry();

    const nomPays = useMemo(() => getSystemeEducatif(countryCode || 'CM').nomPays, [countryCode]);

    const [enfants, setEnfants] = useState<EnfantSlot[]>(() => [emptyEnfant()]);
    const [activeId, setActiveId] = useState(() => enfants[0].id);

    const [classes, setClasses] = useState<ClasseRow[]>([]);
    const [classesLoading, setClassesLoading] = useState(true);
    const [classesLoadError, setClassesLoadError] = useState(false);

    const [stepResultats, setStepResultats] = useState(false);
    const [resultLoading, setResultLoading] = useState(false);
    const [resultatsParEnfant, setResultatsParEnfant] = useState<
        Array<{
            enfantId: string;
            enfantLabel: string;
            prog: ProgrammeScolaire;
            pref: EtatSouhaite;
            livres: any[];
        }>
    >([]);

    const active = useMemo(() => enfants.find((e) => e.id === activeId) ?? enfants[0], [enfants, activeId]);
    const activeClasse = active?.classe ?? null;
    const activeEtabId = active?.etab?.id;

    const loadClasses = useCallback(async () => {
        try {
            setClassesLoading(true);
            setClassesLoadError(false);
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
            setClassesLoadError(true);
        } finally {
            setClassesLoading(false);
        }
    }, []);

    const displayClasses = useMemo(() => {
        if (classes.length > 0) return classes;
        if (!classesLoading) return fallbackClassesForCountry(countryCode || 'CM');
        return [];
    }, [classes, classesLoading, countryCode]);

    const usingFallbackClasses = classes.length === 0 && !classesLoading;

    useEffect(() => {
        loadClasses();
    }, [loadClasses]);

    const patchEnfant = useCallback((id: string, patch: Partial<EnfantSlot>) => {
        setEnfants((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    }, []);

    useEffect(() => {
        if (!activeClasse) {
            patchEnfant(activeId, { programmes: [], checked: {} });
            return;
        }
        let cancelled = false;
        (async () => {
            patchEnfant(activeId, { progLoading: true });
            try {
                const list = await bourseLivreV2Api.getProgrammes(activeClasse, undefined, undefined, {
                    pays: nomPays,
                    etablissementId: activeEtabId,
                });
                if (!cancelled) {
                    patchEnfant(activeId, { programmes: list, checked: {}, progLoading: false });
                }
            } catch (err) {
                console.error('[ProgrammeBesoins] programmes', err);
                if (!cancelled) {
                    patchEnfant(activeId, { programmes: [], progLoading: false });
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeId, activeClasse, activeEtabId, nomPays, patchEnfant]);

    const rechercherEtabs = useCallback(async () => {
        const e = enfants.find((x) => x.id === activeId);
        if (!e) return;
        try {
            patchEnfant(activeId, { etabLoading: true });
            const params = new URLSearchParams({ page: '1', limit: '25' });
            if (e.villeEtab.trim()) params.append('ville', e.villeEtab.trim());
            const response = await apiGet(`/api/orientation-scolaire/etablissements/search?${params}`);
            const data = (response?.data || response) as any;
            if (data?.success) {
                patchEnfant(activeId, { etabs: data.data || [] });
            } else {
                patchEnfant(activeId, { etabs: [] });
            }
        } catch (err) {
            console.error('[ProgrammeBesoins] etabs', err);
            patchEnfant(activeId, { etabs: [] });
        } finally {
            patchEnfant(activeId, { etabLoading: false });
        }
    }, [activeId, enfants, patchEnfant]);

    const toggleLigne = useCallback(
        (idProg: number) => {
            hapticPress();
            const e = enfants.find((x) => x.id === activeId);
            if (!e) return;
            const prev = e.checked;
            const next = { ...prev };
            if (next[idProg]) delete next[idProg];
            else next[idProg] = 'les_deux';
            patchEnfant(activeId, { checked: next });
        },
        [activeId, enfants, patchEnfant]
    );

    const setPref = useCallback(
        (idProg: number, pref: EtatSouhaite) => {
            hapticPress();
            const e = enfants.find((x) => x.id === activeId);
            if (!e) return;
            patchEnfant(activeId, { checked: { ...e.checked, [idProg]: pref } });
        },
        [activeId, enfants, patchEnfant]
    );

    const toutCocher = useCallback(() => {
        hapticPress();
        const e = enfants.find((x) => x.id === activeId);
        if (!e) return;
        const next: Record<number, EtatSouhaite> = {};
        e.programmes.forEach((p) => {
            next[p.id] = e.checked[p.id] ?? 'les_deux';
        });
        patchEnfant(activeId, { checked: next });
    }, [activeId, enfants, patchEnfant]);

    const toutDecocher = useCallback(() => {
        hapticPress();
        patchEnfant(activeId, { checked: {} });
    }, [activeId, patchEnfant]);

    const selectionCountActive = useMemo(
        () => Object.keys(active?.checked ?? {}).length,
        [active?.checked]
    );

    const totalSelectionsTous = useMemo(
        () => enfants.reduce((n, e) => n + Object.keys(e.checked).length, 0),
        [enfants]
    );

    const budgetNeufSelection = useMemo(() => {
        const e = active;
        if (!e) return { sum: 0, withPrice: 0, withoutPrice: 0, countNeufPath: 0 };
        let sum = 0;
        let withPrice = 0;
        let withoutPrice = 0;
        let countNeufPath = 0;
        for (const p of e.programmes) {
            if (!e.checked[p.id]) continue;
            const pref = e.checked[p.id];
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
    }, [active]);

    const lancerRechercheAnnonces = useCallback(async () => {
        hapticPress();
        setResultLoading(true);
        setStepResultats(true);
        const blocs: Array<{
            enfantId: string;
            enfantLabel: string;
            prog: ProgrammeScolaire;
            pref: EtatSouhaite;
            livres: any[];
        }> = [];
        try {
            for (const enfant of enfants) {
                if (!enfant.classe || Object.keys(enfant.checked).length === 0) continue;
                const ids = Object.keys(enfant.checked).map(Number);
                const lignes = enfant.programmes.filter((p) => ids.includes(p.id));
                const label =
                    enfant.prenom.trim() ||
                    t('programmeBesoins.enfantSansNom', 'Enfant {{n}}', {
                        n: enfants.indexOf(enfant) + 1,
                    });
                for (const prog of lignes) {
                    const pref = enfant.checked[prog.id];
                    const search = prog.titre_livre.length > 2 ? prog.titre_livre.slice(0, 80) : undefined;
                    let livres = await bourseLivreV2Api.browseByClass(
                        enfant.classe,
                        prog.matiere,
                        undefined,
                        undefined,
                        undefined,
                        search,
                        40
                    );
                    livres = filtrerSelonPreference(livres, pref);
                    blocs.push({ enfantId: enfant.id, enfantLabel: label, prog, pref, livres });
                }
            }
            if (blocs.length === 0) {
                setStepResultats(false);
                return;
            }
            setResultatsParEnfant(blocs);
        } finally {
            setResultLoading(false);
        }
    }, [enfants, t]);

    const renderPrefChips = (progId: number) => {
        const e = active;
        if (!e) return null;
        const pref = e.checked[progId] || 'les_deux';
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

    const ajouterEnfant = () => {
        hapticPress();
        const n = emptyEnfant();
        setEnfants((prev) => [...prev, n]);
        setActiveId(n.id);
    };

    const retirerEnfant = (id: string) => {
        if (enfants.length <= 1) return;
        hapticPress();
        setEnfants((prev) => {
            const next = prev.filter((e) => e.id !== id);
            if (activeId === id) setActiveId(next[0].id);
            return next;
        });
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
                        data={resultatsParEnfant}
                        keyExtractor={(item) => `${item.enfantId}-${item.prog.id}`}
                        contentContainerStyle={styles.listPad}
                        renderItem={({ item }) => (
                            <View style={styles.resultSection}>
                                <Text style={styles.resultEnfantBadge}>{item.enfantLabel}</Text>
                                <Text style={styles.resultSectionTitle} numberOfLines={2}>
                                    {item.prog.titre_livre}
                                </Text>
                                <Text style={styles.resultSectionMeta}>
                                    {item.prog.matiere} ·{' '}
                                    {item.pref === 'neuf'
                                        ? t('programmeBesoins.neuf', 'Neuf')
                                        : item.pref === 'occasion'
                                          ? t('programmeBesoins.occasion', 'Occasion')
                                          : t('programmeBesoins.lesDeux', 'Les deux')}
                                </Text>
                                {item.livres.length === 0 ? (
                                    <Text style={styles.mutedLeft}>
                                        {t('programmeBesoins.aucuneAnnonce', 'Aucune annonce pour ces critères.')}
                                    </Text>
                                ) : (
                                    item.livres.map((livre: any) => (
                                        <TouchableOpacity
                                            key={livre.id}
                                            style={styles.miniCard}
                                            onPress={() => navigation.navigate('LivreScolaireDetails', { livreId: livre.id })}
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
            <LinearGradient colors={['#1e3a8a', '#2563eb', '#3b82f6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
                <View style={styles.heroTop}>
                    <TouchableOpacity
                        style={styles.backBtnLight}
                        onPress={() => {
                            hapticPress();
                            navigation.goBack();
                        }}
                    >
                        <SafeIcon name="arrow-left" size={22} color="#fff" type="lucide" />
                    </TouchableOpacity>
                    <View style={styles.heroIconWrap}>
                        <SafeIcon name="book-marked" size={28} color="#fff" type="lucide" />
                    </View>
                </View>
                <Text style={styles.heroTitle}>{t('programmeBesoins.title', 'Votre liste scolaire')}</Text>
                <Text style={styles.heroSubtitle}>
                    {t(
                        'programmeBesoins.heroSubtitle',
                        'Classe, établissement optionnel, manuels — tout pour un ou plusieurs enfants.'
                    )}
                </Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.enfantRow}>
                    <View style={styles.sectionTitleRow}>
                        <SafeIcon name="users" size={18} color={modernColors.primary} type="lucide" />
                        <Text style={styles.sectionIconTitle}>{t('programmeBesoins.enfants', 'Mes enfants')}</Text>
                    </View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.enfantChips}>
                        {enfants.map((e, idx) => {
                            const activeChip = e.id === activeId;
                            const label =
                                e.prenom.trim() ||
                                t('programmeBesoins.enfantNum', 'Enfant {{n}}', { n: idx + 1 });
                            return (
                                <TouchableOpacity
                                    key={e.id}
                                    style={[styles.enfantChip, activeChip && styles.enfantChipOn]}
                                    onPress={() => {
                                        hapticPress();
                                        setActiveId(e.id);
                                    }}
                                >
                                    <Text style={[styles.enfantChipText, activeChip && styles.enfantChipTextOn]} numberOfLines={1}>
                                        {label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                        <TouchableOpacity style={styles.addEnfantBtn} onPress={ajouterEnfant}>
                            <SafeIcon name="plus" size={20} color="#2563eb" type="lucide" />
                        </TouchableOpacity>
                    </ScrollView>
                </View>

                {enfants.length > 1 && (
                    <TouchableOpacity style={styles.removeEnfantLink} onPress={() => retirerEnfant(activeId)}>
                        <Text style={styles.linkMutedSmall}>
                            {t('programmeBesoins.retirerEnfantActif', 'Retirer cet enfant du parcours')}
                        </Text>
                    </TouchableOpacity>
                )}

                <View style={styles.cardElevated}>
                    <View style={styles.stepHeader}>
                        <SafeIcon name="smile" size={20} color="#6366f1" type="lucide" />
                        <Text style={styles.stepTitle}>{t('programmeBesoins.prenomOptionnel', 'Prénom (optionnel)')}</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder={t('programmeBesoins.prenomPlaceholder', 'Ex. Marie')}
                        placeholderTextColor="#9ca3af"
                        value={active?.prenom ?? ''}
                        onChangeText={(txt) => patchEnfant(activeId, { prenom: txt })}
                    />
                </View>

                {classesLoadError ? (
                    <View style={styles.warnBanner}>
                        <SafeIcon name="wifi-off" size={18} color="#b45309" type="lucide" />
                        <Text style={styles.warnBannerText}>
                            {t(
                                'programmeBesoins.classesLoadError',
                                'Impossible de charger le référentiel en ligne. Classes standards affichées — vous pouvez réessayer.'
                            )}
                        </Text>
                        <TouchableOpacity style={styles.warnBannerBtn} onPress={loadClasses}>
                            <Text style={styles.warnBannerBtnText}>{t('programmeBesoins.retryClasses', 'Réessayer')}</Text>
                        </TouchableOpacity>
                    </View>
                ) : null}

                {usingFallbackClasses && !classesLoadError ? (
                    <View style={styles.infoBanner}>
                        <SafeIcon name="sparkles" size={18} color="#1d4ed8" type="lucide" />
                        <Text style={styles.infoBannerText}>
                            {t(
                                'programmeBesoins.fallbackClassesBannerV2',
                                'Niveaux selon le système {{pays}}. Les classes du référentiel Yukpo s’affichent si disponibles.',
                                { pays: nomPays }
                            )}
                        </Text>
                    </View>
                ) : null}

                <View style={styles.cardElevated}>
                    <View style={styles.stepHeader}>
                        <SafeIcon name="graduation-cap" size={20} color="#2563eb" type="lucide" />
                        <Text style={styles.stepTitle}>{t('programmeBesoins.stepClasse', 'Classe')}</Text>
                    </View>
                    {classesLoading ? (
                        <ActivityIndicator color={modernColors.primary} />
                    ) : (
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContent}>
                            {displayClasses.map((c) => {
                                const selected = active?.classe === c.classe;
                                const sub = classeLabelForDisplay(c.classe, countryCode || 'CM');
                                return (
                                    <TouchableOpacity
                                        key={c.classe}
                                        style={[styles.chip, selected && styles.chipOn]}
                                        onPress={() => {
                                            hapticPress();
                                            patchEnfant(activeId, { classe: c.classe });
                                        }}
                                    >
                                        <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={2}>
                                            {sub !== c.classe ? sub : c.classe}
                                        </Text>
                                        {c.entrees_programme != null && c.entrees_programme > 0 ? (
                                            <Text style={styles.chipSub}>
                                                {t('programmeBesoins.refProgramme', '{{n}} au programme', { n: c.entrees_programme })}
                                            </Text>
                                        ) : c.total_livres > 0 ? (
                                            <Text style={styles.chipSub}>
                                                {t('programmeBesoins.annonces', '{{n}} annonces', { n: c.total_livres })}
                                            </Text>
                                        ) : null}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>

                <View style={styles.cardElevated}>
                    <View style={styles.stepHeader}>
                        <SafeIcon name="school" size={20} color="#059669" type="lucide" />
                        <Text style={styles.stepTitle}>{t('programmeBesoins.stepEtablissement', 'Établissement (optionnel)')}</Text>
                    </View>
                    <Text style={styles.cardHintShort}>
                        {t(
                            'programmeBesoins.etablissementHintShort',
                            'Si votre école a un programme dans Yukpo, il est prioritaire sur le référentiel national.'
                        )}
                    </Text>
                    <View style={styles.rowInput}>
                        <TextInput
                            style={styles.input}
                            placeholder={t('programmeBesoins.villePlaceholder', 'Ville (ex. Douala)')}
                            value={active?.villeEtab ?? ''}
                            onChangeText={(txt) => patchEnfant(activeId, { villeEtab: txt })}
                            placeholderTextColor="#9ca3af"
                        />
                        <TouchableOpacity style={styles.btnSecondary} onPress={rechercherEtabs}>
                            <Text style={styles.btnSecondaryText}>{t('programmeBesoins.chercherEtab', 'Chercher')}</Text>
                        </TouchableOpacity>
                    </View>
                    {active?.etabLoading && <ActivityIndicator color={modernColors.primary} />}
                    {(active?.etabs?.length ?? 0) > 0 && (
                        <FlatList
                            scrollEnabled={false}
                            data={active?.etabs ?? []}
                            keyExtractor={(item) => String(item.id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.etabRow, active?.etab?.id === item.id && styles.etabRowOn]}
                                    onPress={() => {
                                        hapticPress();
                                        patchEnfant(activeId, { etab: item });
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
                    {active?.etab && (
                        <View style={styles.etabActions}>
                            <TouchableOpacity
                                onPress={() => {
                                    hapticPress();
                                    navigation.navigate('ProgrammesScolaires', { etablissement_id: active.etab!.id });
                                }}
                            >
                                <Text style={styles.link}>{t('programmeBesoins.voirPdfProgramme', 'Programmes / PDF de cet établissement')}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => patchEnfant(activeId, { etab: null })}>
                                <Text style={styles.linkMuted}>{t('programmeBesoins.retirerEtab', 'Retirer')}</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {active?.classe && (
                    <View style={styles.cardElevated}>
                        <View style={styles.rowBetween}>
                            <View style={styles.stepHeader}>
                                <SafeIcon name="library" size={20} color="#7c3aed" type="lucide" />
                                <Text style={styles.stepTitle}>
                                    {t('programmeBesoins.livresProgramme', 'Manuels')} — {active.classe}
                                </Text>
                            </View>
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
                        {active.progLoading ? (
                            <ActivityIndicator color={modernColors.primary} style={{ marginVertical: 16 }} />
                        ) : active.programmes.length === 0 ? (
                            <Text style={styles.mutedLeft}>
                                {t(
                                    'programmeBesoins.emptyProgramme',
                                    'Aucune entrée de programme pour cette classe dans la base. Essayez une autre classe ou utilisez la recherche libre.'
                                )}
                            </Text>
                        ) : (
                            active.programmes.map((p) => {
                                const isOn = !!active.checked[p.id];
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
                                                    {p.etablissement_id != null && p.etablissement_id > 0 ? (
                                                        <Text style={styles.badgeEtab}> · {t('programmeBesoins.sourceEtab', 'Établissement')}</Text>
                                                    ) : null}
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

                {active?.classe && active.programmes.length > 0 && budgetNeufSelection.countNeufPath > 0 && selectionCountActive > 0 && (
                    <View style={styles.budgetCard}>
                        <Text style={styles.budgetCardTitle} numberOfLines={2}>
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
                            <Text style={styles.budgetCardMuted}>{t('programmeBesoins.budgetNeufSansTotal')}</Text>
                        )}
                        <TouchableOpacity
                            style={styles.budgetLinkBtn}
                            onPress={() => {
                                hapticPress();
                                navigation.navigate('NewBooks', { classe: active.classe! });
                            }}
                        >
                            <Text style={styles.link}>{t('programmeBesoins.ouvrirComparateur', 'Comparateur neuf / occasion (budget détaillé)')}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {active?.classe && active.programmes.length > 0 && (
                    <TouchableOpacity
                        style={[styles.cta, totalSelectionsTous === 0 && styles.ctaDisabled]}
                        disabled={totalSelectionsTous === 0}
                        onPress={lancerRechercheAnnonces}
                    >
                        <SafeIcon name="search" size={20} color="#fff" type="lucide" />
                        <Text style={styles.ctaText}>
                            {t('programmeBesoins.ctaRechercherTous', 'Voir les annonces ({{n}} sélection(s))', {
                                n: totalSelectionsTous,
                            })}
                        </Text>
                    </TouchableOpacity>
                )}

                <TouchableOpacity style={styles.footerLink} onPress={() => navigation.navigate('LivreScolaireSearch')}>
                    <Text style={styles.link}>{t('programmeBesoins.rechercheAvancee', 'Recherche avancée et filtres')}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    style={styles.footerLink}
                    onPress={() => {
                        hapticPress();
                        navigation.navigate('NewBooks', active?.classe ? { classe: active.classe } : undefined);
                    }}
                >
                    <Text style={styles.link}>{t('programmeBesoins.catalogueNeuf', 'Catalogue livres neufs & comparateur')}</Text>
                </TouchableOpacity>
            </ScrollView>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: '#f1f5f9' },
    hero: {
        paddingTop: 14,
        paddingBottom: 20,
        paddingHorizontal: 16,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    backBtnLight: { padding: 8 },
    heroIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroTitle: { fontSize: 22, fontWeight: '800', color: '#fff', marginBottom: 6 },
    heroSubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.92)', lineHeight: 20 },
    scroll: { padding: 16, paddingBottom: 48 },
    enfantRow: { marginBottom: 12 },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    sectionIconTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: '#0f172a',
    },
    enfantChips: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
    enfantChip: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#e2e8f0',
        maxWidth: 160,
    },
    enfantChipOn: { borderColor: '#2563eb', backgroundColor: '#eff6ff' },
    enfantChipText: { fontSize: 14, fontWeight: '600', color: '#475569' },
    enfantChipTextOn: { color: '#1d4ed8' },
    addEnfantBtn: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: '#fff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        alignItems: 'center',
        justifyContent: 'center',
    },
    removeEnfantLink: { marginBottom: 12 },
    linkMutedSmall: { fontSize: 12, color: '#94a3b8', textAlign: 'center' },
    cardElevated: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
        elevation: 2,
    },
    stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    stepTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
    cardHintShort: { fontSize: 13, color: '#64748b', marginBottom: 12, lineHeight: 18 },
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
    warnBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#fffbeb',
        borderWidth: 1,
        borderColor: '#fcd34d',
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
    },
    warnBannerText: { flex: 1, fontSize: 13, color: '#92400e', lineHeight: 18 },
    warnBannerBtn: {
        backgroundColor: '#f59e0b',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        alignSelf: 'flex-start',
    },
    warnBannerBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
    },
    infoBannerText: { flex: 1, fontSize: 13, color: '#1e3a8a', lineHeight: 18 },
    rowInput: { flexDirection: 'row', gap: 8, alignItems: 'center' },
    input: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    btnSecondary: {
        backgroundColor: '#e0f2fe',
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 12,
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
    chipsScrollContent: { flexGrow: 1, alignItems: 'center', paddingVertical: 4, gap: 8 },
    chip: {
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderRadius: 16,
        backgroundColor: '#f1f5f9',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        maxWidth: 200,
    },
    chipOn: { backgroundColor: '#dbeafe', borderColor: modernColors.primary },
    chipText: { fontWeight: '600', color: '#475569', fontSize: 13 },
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
    badgeEtab: { fontWeight: '700', color: '#059669' },
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
        paddingVertical: 15,
        borderRadius: 16,
        marginBottom: 12,
    },
    ctaDisabled: { opacity: 0.45 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    footerLink: { marginBottom: 10 },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    muted: { color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'center' },
    mutedLeft: { color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'left' },
    listPad: { padding: 16, paddingBottom: 32 },
    resultSection: { marginBottom: 22 },
    resultEnfantBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e7ff',
        color: '#3730a3',
        overflow: 'hidden',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 8,
    },
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
