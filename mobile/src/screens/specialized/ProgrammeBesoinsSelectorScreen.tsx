/**
 * Liste scolaire : établissement (autocomplete) → classe → programme en tableau
 * (prix neuf + choix neuf / occasion / rien), puis récapitulatif multi-enfants.
 */

import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import BourseJourneySteps from '../../components/bourse/BourseJourneySteps';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { getSystemeEducatif } from '../../data/educationSystems';
import useUserCountry from '../../hooks/useUserCountry';
import { useLanguageSafe } from '../../contexts/LanguageContext';
import { apiGet } from '../../services/api';
import { bourseLivreV2Api, ProgrammeScolaire } from '../../services/bourseLivreV2Api';
import { modernColors } from '../../theme/modernTheme';
import { hapticPress } from '../../utils/hapticFeedback';

type PrefLigne = 'neuf' | 'occasion';

interface EtablissementLite {
    id: number;
    nom_etablissement: string;
    ville: string;
    type_etablissement?: string;
}

interface ExtraLigne {
    localId: string;
    titre: string;
    matiere: string;
    prix_officiel?: number;
    pref: PrefLigne;
}

interface EnfantSlot {
    id: string;
    prenom: string;
    classe: string | null;
    programmes: ProgrammeScolaire[];
    progLoading: boolean;
    /** id programme → neuf | occasion ; absence = ne souhaite pas ce livre */
    choix: Record<number, PrefLigne | undefined>;
    extraLignes: ExtraLigne[];
}

function newEnfantId(): string {
    return `e_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function newExtraId(): string {
    return `x_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
}

function prixOfficielPositif(v: unknown): number {
    if (v == null) return 0;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/\s/g, '').replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : 0;
}

function livreEstNeuf(l: any): boolean {
    const a = `${l?.etat_classification ?? ''} ${l?.etat_livre ?? ''}`.toLowerCase();
    return a.includes('neuf');
}

function classeLabelForDisplay(classeApi: string, codePays: string): string {
    const sys = getSystemeEducatif(codePays);
    const exact = sys.niveaux.find((n) => n.nom === classeApi || n.nom.startsWith(classeApi));
    if (exact) return exact.nom;
    const short = sys.niveaux.find((n) => n.nom.includes(classeApi));
    return short?.nom ?? classeApi;
}

const emptyEnfant = (): EnfantSlot => ({
    id: newEnfantId(),
    prenom: '',
    classe: null,
    programmes: [],
    progLoading: false,
    choix: {},
    extraLignes: [],
});

const ProgrammeBesoinsSelectorScreen: React.FC = () => {
    const navigation = useNavigation() as any;
    const { t } = useLanguageSafe();
    const { countryCode } = useUserCountry();
    const nomPays = useMemo(() => getSystemeEducatif(countryCode || 'CM').nomPays, [countryCode]);

    const [enfants, setEnfants] = useState<EnfantSlot[]>(() => [emptyEnfant()]);
    const [activeId, setActiveId] = useState(() => enfants[0].id);

    const [etabQuery, setEtabQuery] = useState('');
    const [etabResults, setEtabResults] = useState<EtablissementLite[]>([]);
    const [etabLoading, setEtabLoading] = useState(false);
    const [selectedEtab, setSelectedEtab] = useState<EtablissementLite | null>(null);
    const [classesEtab, setClassesEtab] = useState<string[]>([]);
    const [classesEtabLoading, setClassesEtabLoading] = useState(false);
    /** Référentiel national uniquement (établissement introuvable ou sans liste déposée) */
    const [nationalFallback, setNationalFallback] = useState(false);

    const [stepRecap, setStepRecap] = useState(false);
    const [modalExtra, setModalExtra] = useState(false);
    const [extraTitre, setExtraTitre] = useState('');
    const [extraMatiere, setExtraMatiere] = useState('');
    const [extraPrix, setExtraPrix] = useState('');
    const [extraPref, setExtraPref] = useState<PrefLigne>('neuf');

    const [stepAnnonces, setStepAnnonces] = useState(false);
    const [annoncesLoading, setAnnoncesLoading] = useState(false);
    const [annoncesBlocs, setAnnoncesBlocs] = useState<
        Array<{ enfantId: string; enfantLabel: string; prog: ProgrammeScolaire | null; extra?: ExtraLigne; pref: PrefLigne; livres: any[] }>
    >([]);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const active = useMemo(() => enfants.find((e) => e.id === activeId) ?? enfants[0], [enfants, activeId]);
    const activeClasse = active?.classe ?? null;

    const patchEnfant = useCallback((id: string, patch: Partial<EnfantSlot>) => {
        setEnfants((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    }, []);

    /** Autocomplete établissements */
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        const q = etabQuery.trim();
        if (q.length < 2) {
            setEtabResults([]);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setEtabLoading(true);
            try {
                const params = new URLSearchParams({ page: '1', limit: '20', q });
                const res = await apiGet<any>(`/api/orientation-scolaire/etablissements/search?${params.toString()}`);
                // apiCall met le corps JSON dans res.data → { success, data: [...], pagination }
                const body = (res?.data ?? res) as { data?: unknown[]; etablissements?: unknown[] };
                const rows = body?.data ?? body?.etablissements ?? [];
                const list: EtablissementLite[] = (Array.isArray(rows) ? rows : []).map((r: any) => ({
                    id: r.id,
                    nom_etablissement: r.nom_etablissement ?? '',
                    ville: r.ville ?? '',
                    type_etablissement: r.type_etablissement,
                }));
                setEtabResults(list);
            } catch (e) {
                console.warn('[ProgrammeBesoins] search etab', e);
                setEtabResults([]);
            } finally {
                setEtabLoading(false);
            }
        }, 350);
        return () => {
            if (debounceRef.current) clearTimeout(debounceRef.current);
        };
    }, [etabQuery]);

    /** Classes proposées à partir du référentiel bourse pour cet établissement */
    const loadClassesForEtab = useCallback(
        async (etab: EtablissementLite) => {
            setClassesEtabLoading(true);
            try {
                const all = await bourseLivreV2Api.getProgrammes(undefined, undefined, undefined, {
                    etablissementId: etab.id,
                });
                const setCls = new Set<string>();
                (all || []).forEach((p) => {
                    if (p.classe && String(p.classe).trim()) setCls.add(String(p.classe).trim());
                });
                const sorted = [...setCls].sort((a, b) => a.localeCompare(b, 'fr'));
                setClassesEtab(sorted);
            } catch (e) {
                console.warn('[ProgrammeBesoins] classes etab', e);
                setClassesEtab([]);
            } finally {
                setClassesEtabLoading(false);
            }
        },
        []
    );

    /** Classes distinctes du référentiel national (Yukpo), ou liste des niveaux du système éducatif si vide */
    const loadClassesNational = useCallback(async () => {
        setClassesEtabLoading(true);
        try {
            const all = await bourseLivreV2Api.getProgrammes(undefined, undefined, undefined, {
                pays: nomPays,
                nationalOnly: true,
            });
            const setCls = new Set<string>();
            (all || []).forEach((p) => {
                if (p.classe && String(p.classe).trim()) setCls.add(String(p.classe).trim());
            });
            let sorted = [...setCls].sort((a, b) => a.localeCompare(b, 'fr'));
            if (sorted.length === 0) {
                const sys = getSystemeEducatif(countryCode || 'CM');
                sorted = sys.niveaux.map((n) => n.nom);
            }
            setClassesEtab(sorted);
        } catch (e) {
            console.warn('[ProgrammeBesoins] classes national', e);
            const sys = getSystemeEducatif(countryCode || 'CM');
            setClassesEtab(sys.niveaux.map((n) => n.nom));
        } finally {
            setClassesEtabLoading(false);
        }
    }, [nomPays, countryCode]);

    const activerProgrammeNational = useCallback(() => {
        hapticPress();
        setNationalFallback(true);
        setSelectedEtab(null);
        setEtabQuery('');
        setEtabResults([]);
        setEnfants((prev) => prev.map((e) => ({ ...e, classe: null, programmes: [], choix: {}, progLoading: false })));
        loadClassesNational();
    }, [loadClassesNational]);

    const revenirRechercheEtablissement = useCallback(() => {
        hapticPress();
        setNationalFallback(false);
        setClassesEtab([]);
        setEnfants((prev) => prev.map((e) => ({ ...e, classe: null, programmes: [], choix: {}, progLoading: false })));
    }, []);

    const onSelectEtab = useCallback(
        (etab: EtablissementLite) => {
            hapticPress();
            setNationalFallback(false);
            setSelectedEtab(etab);
            setEtabQuery(etab.nom_etablissement);
            setEtabResults([]);
            setEnfants((prev) => prev.map((e) => ({ ...e, classe: null, programmes: [], choix: {}, progLoading: false })));
            loadClassesForEtab(etab);
        },
        [loadClassesForEtab]
    );

    const clearEtab = useCallback(() => {
        hapticPress();
        setNationalFallback(false);
        setSelectedEtab(null);
        setEtabQuery('');
        setEtabResults([]);
        setClassesEtab([]);
        setEnfants((prev) => prev.map((e) => ({ ...e, classe: null, programmes: [], choix: {}, extraLignes: [], progLoading: false })));
    }, []);

    /** Programme : fusion établissement + national, ou référentiel national seul */
    useEffect(() => {
        if (!activeClasse) {
            patchEnfant(activeId, { programmes: [], choix: {} });
            return;
        }
        if (nationalFallback) {
            let cancelled = false;
            (async () => {
                patchEnfant(activeId, { progLoading: true });
                try {
                    const list = await bourseLivreV2Api.getProgrammes(activeClasse, undefined, undefined, {
                        pays: nomPays,
                        nationalOnly: true,
                    });
                    if (!cancelled) {
                        patchEnfant(activeId, { programmes: list, choix: {}, progLoading: false });
                    }
                } catch (err) {
                    console.error('[ProgrammeBesoins] programmes national', err);
                    if (!cancelled) patchEnfant(activeId, { programmes: [], progLoading: false });
                }
            })();
            return () => {
                cancelled = true;
            };
        }
        if (!selectedEtab) {
            patchEnfant(activeId, { programmes: [], choix: {} });
            return;
        }
        let cancelled = false;
        (async () => {
            patchEnfant(activeId, { progLoading: true });
            try {
                let list = await bourseLivreV2Api.getProgrammes(activeClasse, undefined, undefined, {
                    pays: nomPays,
                    etablissementId: selectedEtab.id,
                });
                if (list.length === 0) {
                    list = await bourseLivreV2Api.getProgrammes(activeClasse, undefined, undefined, {
                        etablissementId: selectedEtab.id,
                    });
                }
                if (!cancelled) {
                    patchEnfant(activeId, { programmes: list, choix: {}, progLoading: false });
                }
            } catch (err) {
                console.error('[ProgrammeBesoins] programmes', err);
                if (!cancelled) patchEnfant(activeId, { programmes: [], progLoading: false });
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [activeId, activeClasse, selectedEtab, nomPays, nationalFallback, patchEnfant]);

    const setChoixProg = useCallback(
        (progId: number, pref: PrefLigne) => {
            hapticPress();
            const e = enfants.find((x) => x.id === activeId);
            if (!e) return;
            const cur = e.choix[progId];
            const next = { ...e.choix };
            if (cur === pref) delete next[progId];
            else next[progId] = pref;
            patchEnfant(activeId, { choix: next });
        },
        [activeId, enfants, patchEnfant]
    );

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

    const totalLignesSelectionnees = useMemo(() => {
        return enfants.reduce((acc, e) => {
            const nProg = Object.keys(e.choix).filter((k) => e.choix[Number(k)] != null).length;
            const nExtra = e.extraLignes.length;
            return acc + nProg + nExtra;
        }, 0);
    }, [enfants]);

    const budgetParEnfant = useCallback(
        (e: EnfantSlot) => {
            let sumNeuf = 0;
            let countNeuf = 0;
            let countOcc = 0;
            let sumRefOcc = 0;
            for (const p of e.programmes) {
                const pr = e.choix[p.id];
                if (pr === 'neuf') {
                    countNeuf++;
                    sumNeuf += prixOfficielPositif(p.prix_officiel);
                } else if (pr === 'occasion') {
                    countOcc++;
                    sumRefOcc += prixOfficielPositif(p.prix_officiel);
                }
            }
            for (const x of e.extraLignes) {
                if (x.pref === 'neuf') {
                    countNeuf++;
                    sumNeuf += prixOfficielPositif(x.prix_officiel);
                } else {
                    countOcc++;
                    sumRefOcc += prixOfficielPositif(x.prix_officiel);
                }
            }
            return { sumNeuf, countNeuf, countOcc, sumRefOcc };
        },
        []
    );

    /** Totaux sur tous les enfants : budget neuf catalogue + références occasion (indicatif troc). */
    const totauxRecapGlobal = useMemo(() => {
        let sumNeuf = 0;
        let countNeuf = 0;
        let countOcc = 0;
        let sumRefOcc = 0;
        for (const e of enfants) {
            for (const p of e.programmes) {
                const pr = e.choix[p.id];
                if (pr === 'neuf') {
                    countNeuf++;
                    sumNeuf += prixOfficielPositif(p.prix_officiel);
                } else if (pr === 'occasion') {
                    countOcc++;
                    sumRefOcc += prixOfficielPositif(p.prix_officiel);
                }
            }
            for (const x of e.extraLignes) {
                if (x.pref === 'neuf') {
                    countNeuf++;
                    sumNeuf += prixOfficielPositif(x.prix_officiel);
                } else {
                    countOcc++;
                    sumRefOcc += prixOfficielPositif(x.prix_officiel);
                }
            }
        }
        return { sumNeuf, countNeuf, countOcc, sumRefOcc };
    }, [enfants]);

    const journeySteps = useMemo(() => [
        { key: 'etab',      label: t('bourseJourney.etab',      'École'),    icon: 'school'          },
        { key: 'classe',    label: t('bourseJourney.classe',    'Classe'),   icon: 'layers'          },
        { key: 'programme', label: t('bourseJourney.programme', 'Livres'),   icon: 'book-open'       },
        { key: 'recap',     label: t('bourseJourney.recap',     'Récap'),    icon: 'clipboard-list'  },
        { key: 'annonces',  label: t('bourseJourney.annonces',  'Annonces'), icon: 'search'          },
    ], [t]);

    const journeyIndex = useMemo(() => {
        if (stepAnnonces) return 4;
        if (stepRecap) return 3;
        if (active?.classe) return 2;
        if (selectedEtab || nationalFallback) return 1;
        return 0;
    }, [stepAnnonces, stepRecap, active, selectedEtab, nationalFallback]);

    const ouvrirRecap = useCallback(() => {
        hapticPress();
        if (!nationalFallback && !selectedEtab) {
            Alert.alert(t('programmeBesoins.etabRequis', 'Établissement requis'), t('programmeBesoins.etabRequisBody', 'Choisissez un établissement.'));
            return;
        }
        if (totalLignesSelectionnees === 0) {
            Alert.alert(
                t('programmeBesoins.aucuneSelection', 'Aucune sélection'),
                t('programmeBesoins.aucuneSelectionBody', 'Indiquez au moins un livre (neuf ou occasion) pour un enfant.')
            );
            return;
        }
        setStepRecap(true);
    }, [nationalFallback, selectedEtab, totalLignesSelectionnees, t]);

    const retirerLigneRecap = useCallback(
        (enfantId: string, progId: number | null, extraLocalId?: string) => {
            hapticPress();
            setEnfants((prev) =>
                prev.map((e) => {
                    if (e.id !== enfantId) return e;
                    if (extraLocalId) {
                        return { ...e, extraLignes: e.extraLignes.filter((x) => x.localId !== extraLocalId) };
                    }
                    if (progId != null) {
                        const next = { ...e.choix };
                        delete next[progId];
                        return { ...e, choix: next };
                    }
                    return e;
                })
            );
        },
        []
    );

    const ajouterExtraLigne = useCallback(() => {
        hapticPress();
        const titre = extraTitre.trim();
        if (!titre) {
            Alert.alert(t('programmeBesoins.titreRequis', 'Titre requis'));
            return;
        }
        const prix = extraPrix.trim() ? parseFloat(extraPrix.replace(',', '.')) : undefined;
        const ligne: ExtraLigne = {
            localId: newExtraId(),
            titre,
            matiere: extraMatiere.trim() || '—',
            prix_officiel: Number.isFinite(prix) && (prix as number) > 0 ? prix : undefined,
            pref: extraPref,
        };
        setEnfants((prev) =>
            prev.map((e) => (e.id === activeId ? { ...e, extraLignes: [...e.extraLignes, ligne] } : e))
        );
        setExtraTitre('');
        setExtraMatiere('');
        setExtraPrix('');
        setExtraPref('neuf');
        setModalExtra(false);
    }, [activeId, extraMatiere, extraPrix, extraPref, extraTitre, t]);

    const lancerRechercheAnnoncesOccasion = useCallback(async () => {
        hapticPress();
        setAnnoncesLoading(true);
        setStepAnnonces(true);
        setStepRecap(false);
        const blocs: Array<{
            enfantId: string;
            enfantLabel: string;
            prog: ProgrammeScolaire | null;
            extra?: ExtraLigne;
            pref: PrefLigne;
            livres: any[];
        }> = [];
        try {
            for (const enfant of enfants) {
                const label =
                    enfant.prenom.trim() ||
                    t('programmeBesoins.enfantNum', 'Enfant {{n}}', { n: enfants.indexOf(enfant) + 1 });
                if (!enfant.classe) continue;

                for (const p of enfant.programmes) {
                    if (enfant.choix[p.id] !== 'occasion') continue;
                    const search = p.titre_livre.length > 2 ? p.titre_livre.slice(0, 80) : undefined;
                    let livres = await bourseLivreV2Api.browseByClass(
                        enfant.classe,
                        p.matiere,
                        undefined,
                        undefined,
                        undefined,
                        search,
                        40
                    );
                    livres = livres.filter((l: any) => !livreEstNeuf(l));
                    blocs.push({ enfantId: enfant.id, enfantLabel: label, prog: p, pref: 'occasion', livres });
                }
                for (const x of enfant.extraLignes) {
                    if (x.pref !== 'occasion') continue;
                    const search = x.titre.length > 2 ? x.titre.slice(0, 80) : undefined;
                    let livres = await bourseLivreV2Api.browseByClass(
                        enfant.classe,
                        x.matiere,
                        undefined,
                        undefined,
                        undefined,
                        search,
                        40
                    );
                    livres = livres.filter((l: any) => !livreEstNeuf(l));
                    blocs.push({ enfantId: enfant.id, enfantLabel: label, prog: null, extra: x, pref: 'occasion', livres });
                }
            }
            setAnnoncesBlocs(blocs);

            const nNeuf = enfants.reduce((n, e) => {
                let k = 0;
                for (const p of e.programmes) if (e.choix[p.id] === 'neuf') k++;
                for (const x of e.extraLignes) if (x.pref === 'neuf') k++;
                return n + k;
            }, 0);

            Alert.alert(
                t('programmeBesoins.valideTitle', 'Demande enregistrée'),
                t('programmeBesoins.valideBody', '{{occ}} recherche(s) occasion lancée(s). {{neuf}} ligne(s) neuf : les librairies partenaires peuvent être alertées selon le programme.', {
                    occ: blocs.length,
                    neuf: nNeuf,
                })
            );
        } finally {
            setAnnoncesLoading(false);
        }
    }, [enfants, t]);

    /** Récap */
    if (stepRecap) {
        return (
            <SafeNativeView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => {
                            hapticPress();
                            setStepRecap(false);
                        }}
                    >
                        <SafeIcon name="arrow-left" size={22} color={modernColors.primary} type="lucide" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('programmeBesoins.recapTitle', 'Récapitulatif')}</Text>
                </View>
                <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
                    <View style={styles.journeyCard}>
                        <BourseJourneySteps steps={journeySteps} currentIndex={journeyIndex} />
                    </View>
                    {nationalFallback ? (
                        <View style={[styles.etabRecapBanner, { backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }]}>
                            <SafeIcon name="book-marked" size={18} color="#047857" type="lucide" />
                            <Text style={[styles.etabRecapText, { color: '#065f46' }]}>
                                {t('programmeBesoins.recapNationalBanner', 'Programme national Yukpo (référentiel) — sans établissement sélectionné.')}
                            </Text>
                        </View>
                    ) : null}
                    {selectedEtab ? (
                        <View style={styles.etabRecapBanner}>
                            <SafeIcon name="school" size={18} color="#1e40af" type="lucide" />
                            <Text style={styles.etabRecapText}>
                                {selectedEtab.nom_etablissement} · {selectedEtab.ville}
                            </Text>
                        </View>
                    ) : null}

                    <View style={styles.recapSynthCard}>
                        <Text style={styles.recapSynthTitle}>
                            {t('programmeBesoins.recapSyntheseTitle', 'Synthèse budgétaire')}
                        </Text>
                        <Text style={styles.recapSynthNeuf}>
                            {t(
                                'programmeBesoins.recapBudgetNeufGlobal',
                                'Total livres neufs sélectionnés (prix catalogue) : {{m}} XAF · {{n}} titre(s)',
                                {
                                    m: Math.round(totauxRecapGlobal.sumNeuf).toLocaleString(),
                                    n: totauxRecapGlobal.countNeuf,
                                }
                            )}
                        </Text>
                        {totauxRecapGlobal.countNeuf > 0 && totauxRecapGlobal.sumNeuf <= 0 ? (
                            <Text style={styles.recapSynthHint}>
                                {t(
                                    'programmeBesoins.recapNeufSansPrix',
                                    'Certains titres neufs n’ont pas de prix catalogue en base — complétez avec votre libraire ou le comparateur.'
                                )}
                            </Text>
                        ) : null}
                        <Text style={styles.recapSynthOcc}>
                            {t(
                                'programmeBesoins.recapOccasionTroc',
                                'Occasion / troc : montant à déterminer selon les annonces et les échanges — {{n}} titre(s).',
                                { n: totauxRecapGlobal.countOcc }
                            )}
                        </Text>
                        {totauxRecapGlobal.countOcc > 0 && totauxRecapGlobal.sumRefOcc > 0 ? (
                            <Text style={styles.recapSynthRef}>
                                {t(
                                    'programmeBesoins.recapOccasionRefCatalogue',
                                    'Référence indicative (somme des prix neufs catalogue pour les titres « occasion ») : {{m}} XAF — utile pour estimer un troc ou une négociation, sans engagement.',
                                    { m: Math.round(totauxRecapGlobal.sumRefOcc).toLocaleString() }
                                )}
                            </Text>
                        ) : totauxRecapGlobal.countOcc > 0 ? (
                            <Text style={styles.recapSynthHint}>
                                {t(
                                    'programmeBesoins.recapOccasionSansRef',
                                    'Aucun prix catalogue pour ces titres occasion — le montant d’achat ou d’échange reste à déterminer sur les annonces.'
                                )}
                            </Text>
                        ) : null}
                    </View>

                    {enfants.map((e, idx) => {
                        const label = e.prenom.trim() || t('programmeBesoins.enfantNum', 'Enfant {{n}}', { n: idx + 1 });
                        const bud = budgetParEnfant(e);
                        return (
                            <View key={e.id} style={styles.recapCard}>
                                <Text style={styles.recapEnfantTitle}>{label}</Text>
                                {e.classe ? (
                                    <Text style={styles.recapMeta}>
                                        {t('programmeBesoins.classeLabel', 'Classe : {{c}}', { c: classeLabelForDisplay(e.classe, countryCode || 'CM') })}
                                    </Text>
                                ) : null}
                                <Text style={styles.recapBudget}>
                                    {t(
                                        'programmeBesoins.budgetApprox',
                                        'Budget neuf (catalogue) : {{m}} XAF · {{cn}} neuf · {{co}} occasion (troc à déterminer)',
                                        {
                                            m: Math.round(bud.sumNeuf).toLocaleString(),
                                            cn: bud.countNeuf,
                                            co: bud.countOcc,
                                        }
                                    )}
                                </Text>

                                <Text style={styles.recapSectionLabel}>{t('programmeBesoins.sectionNeuf', 'Neuf')}</Text>
                                {e.programmes
                                    .filter((p) => e.choix[p.id] === 'neuf')
                                    .map((p) => (
                                        <View key={p.id} style={styles.recapRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.recapRowTitle} numberOfLines={2}>
                                                    {p.titre_livre}
                                                </Text>
                                                <Text style={styles.recapRowMeta}>
                                                    {p.matiere}
                                                    {p.prix_officiel != null
                                                        ? ` · ${Number(p.prix_officiel).toLocaleString()} ${p.devise || 'XAF'}`
                                                        : ''}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => retirerLigneRecap(e.id, p.id)} hitSlop={12}>
                                                <SafeIcon name="trash-2" size={18} color="#dc2626" type="lucide" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                {e.extraLignes
                                    .filter((x) => x.pref === 'neuf')
                                    .map((x) => (
                                        <View key={x.localId} style={styles.recapRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.recapRowTitle}>{x.titre}</Text>
                                                <Text style={styles.recapRowMeta}>
                                                    {x.matiere}
                                                    {x.prix_officiel != null ? ` · ${x.prix_officiel.toLocaleString()} XAF` : ''}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => retirerLigneRecap(e.id, null, x.localId)} hitSlop={12}>
                                                <SafeIcon name="trash-2" size={18} color="#dc2626" type="lucide" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}

                                <Text style={[styles.recapSectionLabel, { marginTop: 12 }]}>{t('programmeBesoins.sectionOccasion', 'Occasion')}</Text>
                                {e.programmes
                                    .filter((p) => e.choix[p.id] === 'occasion')
                                    .map((p) => (
                                        <View key={`o-${p.id}`} style={styles.recapRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.recapRowTitle} numberOfLines={2}>
                                                    {p.titre_livre}
                                                </Text>
                                                <Text style={styles.recapRowMeta}>
                                                    {p.matiere}
                                                    {prixOfficielPositif(p.prix_officiel) > 0
                                                        ? ` · ${t('programmeBesoins.refNeufPourOccasion', 'Réf. neuf catalogue : {{m}} XAF — prix occasion/troc à déterminer', {
                                                              m: Math.round(prixOfficielPositif(p.prix_officiel)).toLocaleString(),
                                                          })}`
                                                        : ` · ${t('programmeBesoins.occasionPrixAdeterminer', 'Prix occasion / troc à déterminer (annonces)')}`}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => retirerLigneRecap(e.id, p.id)} hitSlop={12}>
                                                <SafeIcon name="trash-2" size={18} color="#dc2626" type="lucide" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}
                                {e.extraLignes
                                    .filter((x) => x.pref === 'occasion')
                                    .map((x) => (
                                        <View key={`xo-${x.localId}`} style={styles.recapRow}>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.recapRowTitle}>{x.titre}</Text>
                                                <Text style={styles.recapRowMeta}>
                                                    {x.matiere}
                                                    {prixOfficielPositif(x.prix_officiel) > 0
                                                        ? ` · ${t('programmeBesoins.refNeufPourOccasion', 'Réf. neuf catalogue : {{m}} XAF — prix occasion/troc à déterminer', {
                                                              m: Math.round(prixOfficielPositif(x.prix_officiel)).toLocaleString(),
                                                          })}`
                                                        : ` · ${t('programmeBesoins.occasionPrixAdeterminer', 'Prix occasion / troc à déterminer (annonces)')}`}
                                                </Text>
                                            </View>
                                            <TouchableOpacity onPress={() => retirerLigneRecap(e.id, null, x.localId)} hitSlop={12}>
                                                <SafeIcon name="trash-2" size={18} color="#dc2626" type="lucide" />
                                            </TouchableOpacity>
                                        </View>
                                    ))}

                                <TouchableOpacity
                                    style={styles.addLineBtn}
                                    onPress={() => {
                                        hapticPress();
                                        setActiveId(e.id);
                                        setModalExtra(true);
                                    }}
                                >
                                    <SafeIcon name="plus" size={16} color="#2563eb" type="lucide" />
                                    <Text style={styles.addLineBtnText}>{t('programmeBesoins.ajouterLivre', 'Ajouter un livre')}</Text>
                                </TouchableOpacity>
                            </View>
                        );
                    })}

                    <TouchableOpacity style={styles.cta} onPress={lancerRechercheAnnoncesOccasion}>
                        <SafeIcon name="check" size={20} color="#fff" type="lucide" />
                        <Text style={styles.ctaText}>{t('programmeBesoins.validerCommande', 'Valider et lancer les recherches occasion')}</Text>
                    </TouchableOpacity>
                </ScrollView>

                <Modal visible={modalExtra} transparent animationType="fade" onRequestClose={() => setModalExtra(false)}>
                    <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setModalExtra(false)}>
                        <TouchableOpacity style={styles.modalBox} activeOpacity={1} onPress={(ev) => ev.stopPropagation()}>
                            <Text style={styles.modalTitle}>{t('programmeBesoins.ajouterLivre', 'Ajouter un livre')}</Text>
                            <TextInput
                                style={styles.input}
                                placeholder={t('programmeBesoins.titrePlaceholder', 'Titre')}
                                value={extraTitre}
                                onChangeText={setExtraTitre}
                                placeholderTextColor="#9ca3af"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder={t('programmeBesoins.matierePlaceholder', 'Matière')}
                                value={extraMatiere}
                                onChangeText={setExtraMatiere}
                                placeholderTextColor="#9ca3af"
                            />
                            <TextInput
                                style={styles.input}
                                placeholder={t('programmeBesoins.prixPlaceholder', 'Prix neuf (optionnel)')}
                                value={extraPrix}
                                onChangeText={setExtraPrix}
                                keyboardType="decimal-pad"
                                placeholderTextColor="#9ca3af"
                            />
                            <View style={styles.modalPrefRow}>
                                <TouchableOpacity
                                    style={[styles.modalChip, extraPref === 'neuf' && styles.modalChipOn]}
                                    onPress={() => setExtraPref('neuf')}
                                >
                                    <Text style={styles.modalChipText}>{t('programmeBesoins.neuf', 'Neuf')}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.modalChip, extraPref === 'occasion' && styles.modalChipOn]}
                                    onPress={() => setExtraPref('occasion')}
                                >
                                    <Text style={styles.modalChipText}>{t('programmeBesoins.occasion', 'Occasion')}</Text>
                                </TouchableOpacity>
                            </View>
                            <TouchableOpacity style={styles.cta} onPress={ajouterExtraLigne}>
                                <Text style={styles.ctaText}>{t('programmeBesoins.ajouter', 'Ajouter')}</Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>
            </SafeNativeView>
        );
    }

    /** Annonces occasion (après validation) */
    if (stepAnnonces) {
        return (
            <SafeNativeView style={styles.safe}>
                <View style={styles.header}>
                    <TouchableOpacity
                        style={styles.backBtn}
                        onPress={() => {
                            hapticPress();
                            setStepAnnonces(false);
                            setStepRecap(true);
                        }}
                    >
                        <SafeIcon name="arrow-left" size={22} color={modernColors.primary} type="lucide" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('programmeBesoins.annoncesOccasion', 'Annonces occasion')}</Text>
                </View>
                {annoncesLoading ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={modernColors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={annoncesBlocs}
                        keyExtractor={(item, i) => `${item.enfantId}-${item.prog?.id ?? 'x'}-${i}`}
                        contentContainerStyle={styles.listPad}
                        ListHeaderComponent={
                            <View style={styles.journeyCard}>
                                <BourseJourneySteps steps={journeySteps} currentIndex={journeyIndex} />
                                <Text style={styles.journeyHint}>
                                    {t(
                                        'bourseUx.resultsHint',
                                        'Les prix affichés sur les fiches sont ceux des vendeurs. Pour le neuf, les librairies partenaires peuvent être alertées après validation.'
                                    )}
                                </Text>
                            </View>
                        }
                        renderItem={({ item }) => (
                            <View style={styles.resultSection}>
                                <Text style={styles.resultEnfantBadge}>{item.enfantLabel}</Text>
                                <Text style={styles.resultSectionTitle} numberOfLines={2}>
                                    {item.prog?.titre_livre ?? item.extra?.titre}
                                </Text>
                                {item.livres.length === 0 ? (
                                    <Text style={styles.mutedLeft}>
                                        {t(
                                            'bourseUx.noListingHint',
                                            'Aucune annonce pour ce titre — élargissez la recherche dans le catalogue ou le comparateur neuf/occasion.'
                                        )}
                                    </Text>
                                ) : (
                                    item.livres.map((livre: any) => (
                                        <TouchableOpacity
                                            key={livre.id}
                                            style={styles.miniCard}
                                            onPress={() => navigation.navigate('LivreScolaireDetails', { livreId: livre.id })}
                                        >
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.miniTitle} numberOfLines={2}>
                                                    {livre.titre}
                                                </Text>
                                                <Text style={styles.miniMeta} numberOfLines={1}>
                                                    {(livre.etat_classification || livre.etat_livre || '—') + (livre.ville ? ` · ${livre.ville}` : '')}
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

    /** Formulaire principal */
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
                        'programmeBesoins.heroSubtitleV2',
                        'Choisissez l’établissement, la classe, puis pour chaque livre : neuf, occasion, ou laissez vide si vous n’en avez pas besoin.'
                    )}
                </Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                <View style={styles.journeyCard}>
                    <BourseJourneySteps steps={journeySteps} currentIndex={journeyIndex} />
                </View>
                {/* Établissement */}
                <View style={styles.cardElevated}>
                    <View style={styles.stepHeader}>
                        <SafeIcon name="school" size={20} color="#059669" type="lucide" />
                        <Text style={styles.stepTitle}>{t('programmeBesoins.etablissement', 'Établissement scolaire')}</Text>
                    </View>
                    <TextInput
                        style={styles.input}
                        placeholder={t('programmeBesoins.etabPlaceholder', 'Tapez le nom ou la ville…')}
                        placeholderTextColor="#9ca3af"
                        value={etabQuery}
                        onChangeText={(txt) => {
                            setEtabQuery(txt);
                            if (selectedEtab && txt !== selectedEtab.nom_etablissement) setSelectedEtab(null);
                        }}
                    />
                    {etabLoading ? <ActivityIndicator color={modernColors.primary} style={{ marginVertical: 8 }} /> : null}
                    {!selectedEtab && etabResults.length > 0 ? (
                        <View style={styles.autocompleteBox}>
                            {etabResults.map((et) => (
                                <TouchableOpacity key={et.id} style={styles.autocompleteRow} onPress={() => onSelectEtab(et)} activeOpacity={0.7}>
                                    <Text style={styles.autocompleteName} numberOfLines={2}>
                                        {et.nom_etablissement}
                                    </Text>
                                    <Text style={styles.autocompleteVille} numberOfLines={1}>
                                        {et.ville}
                                        {et.type_etablissement ? ` · ${et.type_etablissement}` : ''}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    ) : null}
                    {selectedEtab ? (
                        <View style={styles.etabSelectedRow}>
                            <Text style={styles.etabSelectedText} numberOfLines={2}>
                                ✓ {selectedEtab.nom_etablissement} ({selectedEtab.ville})
                            </Text>
                            <TouchableOpacity onPress={clearEtab}>
                                <Text style={styles.link}>{t('programmeBesoins.changerEtab', 'Changer')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    {nationalFallback ? (
                        <View style={styles.nationalInfoBanner}>
                            <SafeIcon name="book-marked" size={18} color="#047857" type="lucide" />
                            <Text style={styles.nationalInfoText}>
                                {t(
                                    'programmeBesoins.modeNationalActif',
                                    'Vous utilisez le référentiel national Yukpo (hors établissement). Les listes déposées par les écoles peuvent être plus précises.'
                                )}
                            </Text>
                            <TouchableOpacity onPress={revenirRechercheEtablissement} style={styles.nationalBackBtn}>
                                <Text style={styles.link}>{t('programmeBesoins.revenirEtab', 'Rechercher un établissement')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : null}
                    {!nationalFallback && !selectedEtab ? (
                        <TouchableOpacity style={styles.fallbackLinkWrap} onPress={activerProgrammeNational} activeOpacity={0.7}>
                            <Text style={styles.fallbackLink}>
                                {t('programmeBesoins.fallbackNationalLink', 'Je ne trouve pas mon établissement — utiliser le programme national')}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>

                {/* Enfants */}
                <View style={styles.enfantRow}>
                    <View style={styles.sectionTitleRow}>
                        <SafeIcon name="users" size={18} color={modernColors.primary} type="lucide" />
                        <Text style={styles.sectionIconTitle}>{t('programmeBesoins.enfants', 'Enfants')}</Text>
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
                        <Text style={styles.linkMutedSmall}>{t('programmeBesoins.retirerEnfantActif', 'Retirer cet enfant')}</Text>
                    </TouchableOpacity>
                )}

                {/* Classes (établissement ou référentiel national) */}
                {selectedEtab || nationalFallback ? (
                    <View style={styles.cardElevated}>
                        <View style={styles.stepHeader}>
                            <SafeIcon name="graduation-cap" size={20} color="#2563eb" type="lucide" />
                            <Text style={styles.stepTitle}>{t('programmeBesoins.stepClasse', 'Classe')}</Text>
                        </View>
                        {classesEtabLoading ? (
                            <ActivityIndicator color={modernColors.primary} />
                        ) : classesEtab.length === 0 ? (
                            <>
                                <Text style={styles.mutedLeft}>
                                    {nationalFallback
                                        ? t(
                                              'programmeBesoins.noClassesNational',
                                              'Aucune classe trouvée dans le référentiel national pour votre pays. Les administrateurs peuvent enrichir les données.'
                                          )
                                        : t(
                                              'programmeBesoins.noClassesEtab',
                                              'Aucune classe listée pour cet établissement dans Yukpo. Les dépôts de listes par l’établissement enrichissent cette section.'
                                          )}
                                </Text>
                                {!nationalFallback && selectedEtab ? (
                                    <TouchableOpacity style={styles.fallbackLinkWrap} onPress={activerProgrammeNational} activeOpacity={0.7}>
                                        <Text style={styles.fallbackLink}>
                                            {t(
                                                'programmeBesoins.fallbackNationalFromEtab',
                                                'Utiliser le programme national Yukpo pour choisir une classe'
                                            )}
                                        </Text>
                                    </TouchableOpacity>
                                ) : null}
                            </>
                        ) : (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsScrollContent}>
                                {classesEtab.map((cl) => {
                                    const selected = active?.classe === cl;
                                    const sub = classeLabelForDisplay(cl, countryCode || 'CM');
                                    return (
                                        <TouchableOpacity
                                            key={cl}
                                            style={[styles.chip, selected && styles.chipOn]}
                                            onPress={() => {
                                                hapticPress();
                                                patchEnfant(activeId, { classe: cl });
                                            }}
                                        >
                                            <Text style={[styles.chipText, selected && styles.chipTextOn]} numberOfLines={2}>
                                                {sub}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        )}
                    </View>
                ) : null}

                {/* Tableau programme */}
                {(nationalFallback || selectedEtab) && active?.classe ? (
                    <View style={styles.cardElevated}>
                        <View style={styles.stepHeader}>
                            <SafeIcon name="library" size={20} color="#7c3aed" type="lucide" />
                            <Text style={styles.stepTitle}>
                                {t('programmeBesoins.tableProgramme', 'Programme — {{classe}}', {
                                    classe: classeLabelForDisplay(active.classe!, countryCode || 'CM'),
                                })}
                            </Text>
                        </View>
                        <View style={styles.tableHeaderRow}>
                            <Text style={[styles.th, { flex: 2.2 }]}>{t('programmeBesoins.colLivre', 'Livre')}</Text>
                            <Text style={[styles.th, { flex: 0.9 }]}>{t('programmeBesoins.colMatiere', 'Matière')}</Text>
                            <Text style={[styles.th, { flex: 0.9 }]}>{t('programmeBesoins.colPrixNeuf', 'Prix neuf')}</Text>
                            <Text style={[styles.th, { flex: 1.1 }]}>{t('programmeBesoins.colSouhait', 'Souhait')}</Text>
                        </View>
                        {active.progLoading ? (
                            <ActivityIndicator color={modernColors.primary} style={{ marginVertical: 16 }} />
                        ) : active.programmes.length === 0 ? (
                            <Text style={styles.mutedLeft}>
                                {nationalFallback
                                    ? t(
                                          'programmeBesoins.emptyProgrammeNational',
                                          'Aucune ligne du référentiel national pour cette classe. Elle sera affichée dès que les administrateurs auront importé les données.'
                                      )
                                    : t('programmeBesoins.emptyProgramme', 'Aucune ligne de programme pour cette classe.')}
                            </Text>
                        ) : (
                            active.programmes.map((p) => {
                                const pref = active.choix[p.id];
                                return (
                                    <View key={p.id} style={styles.tableRow}>
                                        <Text style={[styles.td, { flex: 2.2 }]} numberOfLines={3}>
                                            {p.titre_livre}
                                        </Text>
                                        <Text style={[styles.td, { flex: 0.9 }]} numberOfLines={2}>
                                            {p.matiere}
                                        </Text>
                                        <Text style={[styles.td, { flex: 0.9 }]} numberOfLines={1}>
                                            {p.prix_officiel != null
                                                ? `${Number(p.prix_officiel).toLocaleString()} ${p.devise || 'XAF'}`
                                                : '—'}
                                        </Text>
                                        <View style={[styles.tdActions, { flex: 1.1 }]}>
                                            <TouchableOpacity
                                                style={[styles.miniPref, pref === 'neuf' && styles.miniPrefOn]}
                                                onPress={() => setChoixProg(p.id, 'neuf')}
                                            >
                                                <Text style={[styles.miniPrefText, pref === 'neuf' && styles.miniPrefTextOn]}>
                                                    {t('programmeBesoins.neuf', 'Neuf')}
                                                </Text>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={[styles.miniPref, pref === 'occasion' && styles.miniPrefOnOcc]}
                                                onPress={() => setChoixProg(p.id, 'occasion')}
                                            >
                                                <Text style={[styles.miniPrefText, pref === 'occasion' && styles.miniPrefTextOn]}>
                                                    {t('programmeBesoins.occasion', 'Occas.')}
                                                </Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                );
                            })
                        )}
                        <Text style={styles.hintSouhait}>
                            {t(
                                'programmeBesoins.hintSouhait',
                                'Ne cochez rien si vous ne voulez pas ce livre. Neuf et occasion s’excluent.'
                            )}
                        </Text>
                    </View>
                ) : null}

                {(nationalFallback || selectedEtab) && active?.classe && active.programmes.length > 0 ? (
                    <TouchableOpacity
                        style={[styles.ctaSecondary, totalLignesSelectionnees === 0 && styles.ctaDisabled]}
                        disabled={totalLignesSelectionnees === 0}
                        onPress={ouvrirRecap}
                    >
                        <SafeIcon name="list-checks" size={20} color="#fff" type="lucide" />
                        <Text style={styles.ctaText}>
                            {t('programmeBesoins.ctaRecap', 'Voir le récapitulatif ({{n}})', { n: totalLignesSelectionnees })}
                        </Text>
                    </TouchableOpacity>
                ) : null}
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
    heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
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
    center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
    mutedLeft: { color: '#64748b', fontSize: 14, marginTop: 8, textAlign: 'left' },
    link: { fontSize: 13, fontWeight: '600', color: modernColors.primary },
    enfantRow: { marginBottom: 12 },
    sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    sectionIconTitle: { fontSize: 15, fontWeight: '700', color: '#0f172a' },
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
        elevation: 2,
    },
    stepHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
    stepTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a', flex: 1 },
    input: {
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 11,
        fontSize: 15,
        color: '#0f172a',
        backgroundColor: '#f8fafc',
    },
    autocompleteBox: {
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        borderRadius: 12,
        overflow: 'hidden',
        maxHeight: 220,
    },
    autocompleteRow: { padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
    autocompleteName: { fontSize: 15, fontWeight: '600', color: '#0f172a' },
    autocompleteVille: { fontSize: 12, color: '#64748b', marginTop: 2 },
    etabSelectedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10, gap: 8 },
    etabSelectedText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#065f46' },
    nationalInfoBanner: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#a7f3d0',
        gap: 8,
    },
    nationalInfoText: { fontSize: 13, color: '#065f46', lineHeight: 19 },
    nationalBackBtn: { alignSelf: 'flex-start' },
    fallbackLinkWrap: { marginTop: 10, paddingVertical: 4 },
    fallbackLink: { fontSize: 14, fontWeight: '600', color: '#2563eb', textDecorationLine: 'underline' },
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
    tableHeaderRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#e2e8f0', paddingBottom: 8, marginBottom: 8 },
    th: { fontSize: 11, fontWeight: '700', color: '#64748b', textTransform: 'uppercase' },
    tableRow: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
    td: { fontSize: 12, color: '#0f172a', paddingRight: 4 },
    tdActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, justifyContent: 'flex-end' },
    miniPref: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    miniPrefOn: { backgroundColor: '#dcfce7', borderColor: '#16a34a' },
    miniPrefOnOcc: { backgroundColor: '#ffedd5', borderColor: '#ea580c' },
    miniPrefText: { fontSize: 10, fontWeight: '700', color: '#64748b' },
    miniPrefTextOn: { color: '#0f172a' },
    journeyCard: {
        backgroundColor: '#fff',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    journeyHint: {
        fontSize: 12,
        color: '#64748b',
        lineHeight: 17,
        marginTop: 4,
        marginBottom: 8,
    },
    hintSouhait: { fontSize: 12, color: '#64748b', marginTop: 12, lineHeight: 17 },
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
    ctaSecondary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
        backgroundColor: '#059669',
        paddingVertical: 15,
        borderRadius: 16,
        marginTop: 8,
    },
    ctaDisabled: { opacity: 0.45 },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    recapCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#e2e8f0',
    },
    etabRecapBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#eff6ff',
        padding: 12,
        borderRadius: 12,
        marginBottom: 12,
    },
    etabRecapText: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1e3a8a' },
    recapSynthCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#c7d2fe',
        borderLeftWidth: 4,
        borderLeftColor: '#4f46e5',
    },
    recapSynthTitle: { fontSize: 15, fontWeight: '800', color: '#312e81', marginBottom: 10 },
    recapSynthNeuf: { fontSize: 15, fontWeight: '700', color: '#047857', lineHeight: 22, marginBottom: 8 },
    recapSynthOcc: { fontSize: 14, fontWeight: '600', color: '#9a3412', lineHeight: 21, marginBottom: 8 },
    recapSynthRef: { fontSize: 13, color: '#57534e', lineHeight: 19, marginBottom: 4 },
    recapSynthHint: { fontSize: 12, color: '#64748b', lineHeight: 18, marginBottom: 6, fontStyle: 'italic' },
    recapEnfantTitle: { fontSize: 17, fontWeight: '800', color: '#0f172a', marginBottom: 4 },
    recapMeta: { fontSize: 13, color: '#64748b', marginBottom: 6 },
    recapBudget: { fontSize: 14, fontWeight: '600', color: '#047857', marginBottom: 12 },
    recapSectionLabel: { fontSize: 12, fontWeight: '800', color: '#64748b', textTransform: 'uppercase', marginBottom: 6 },
    recapRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#f1f5f9' },
    recapRowTitle: { fontSize: 14, fontWeight: '600', color: '#0f172a' },
    recapRowMeta: { fontSize: 12, color: '#64748b', marginTop: 2 },
    addLineBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
    addLineBtnText: { fontSize: 14, fontWeight: '600', color: '#2563eb' },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        padding: 24,
    },
    modalBox: { backgroundColor: '#fff', borderRadius: 16, padding: 16 },
    modalTitle: { fontSize: 18, fontWeight: '800', marginBottom: 12, color: '#0f172a' },
    modalPrefRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
    modalChip: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#e2e8f0',
        alignItems: 'center',
    },
    modalChipOn: { backgroundColor: '#dbeafe', borderColor: modernColors.primary },
    modalChipText: { fontWeight: '700', color: '#475569' },
    listPad: { padding: 16, paddingBottom: 32 },
    resultSection: { marginBottom: 22 },
    resultEnfantBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#e0e7ff',
        overflow: 'hidden',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        fontSize: 12,
        fontWeight: '700',
        color: '#3730a3',
        marginBottom: 8,
    },
    resultSectionTitle: { fontSize: 16, fontWeight: '700', color: '#0f172a' },
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
});

export default ProgrammeBesoinsSelectorScreen;
