import {
  AlertTriangle,
  Camera,
  ChevronRight,
  FileText,
  Loader2,
  MapPin,
  Phone,
  Pill,
  RefreshCw,
  ScanLine,
  Search,
  Send,
  Shield,
  Sparkles,
  Stethoscope,
  Tag,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import YukpoCostBadge from '@/components/YukpoCostBadge';
import LanguageSwitcherBourse from '@/components/LanguageSwitcherBourse';
import { useToast } from '@/hooks/use-toast';
import { useGpsWithFallback } from '@/hooks/useGpsWithFallback';
import { apiGet, apiPost } from '@/services/apiService';
import MedicationDetailSheet from './pharmacie/MedicationDetailSheet';

interface Medication {
  id: number;
  nom_produit: string;
  prix?: number;
  stock?: number;
  unite?: string;
  categorie?: string;
  description?: string;
  distance_km?: number;
  pharmacy_name?: string;
  pharmacy_ville?: string;
  pharmacy_quartier?: string;
  pharmacy_telephone?: string;
  pharmacy_service_id?: number;
}

interface InteractionsResult {
  severity: 'none' | 'minor' | 'moderate' | 'major' | 'contraindicated' | string;
  description: string;
  recommendation: string;
  alternative_suggestions: string[];
}

interface PharmacyMatch {
  id: number;
  nom: string;
  ville?: string;
  quartier?: string;
  telephone?: string;
  matching_score: number;
  found_count?: number;
  total_count?: number;
  distance_km?: number;
  medications_availability?: { name: string; available: boolean; price?: number }[];
}

type ScanKind = 'ordonnance' | 'boite' | 'symptom' | 'ask';

const PharmacieHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const ordonnanceInputRef = useRef<HTMLInputElement>(null);
  const boiteInputRef = useRef<HTMLInputElement>(null);

  const { gps, status: gpsStatus, detect: redetectGps } = useGpsWithFallback();

  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onDutyOnly, setOnDutyOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  // Sheets
  const [scanSheetOpen, setScanSheetOpen] = useState(false);
  const [aiSheetOpen, setAiSheetOpen] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [scanResult, setScanResult] = useState<string | null>(null);

  // Médicament en focus (fiche détaillée : posologie + alternatives)
  const [focusedMedication, setFocusedMedication] = useState<string | null>(null);

  // Résultats des scans d'ordonnance multi-médicaments
  const [interactions, setInteractions] = useState<InteractionsResult | null>(null);
  const [interactionsLoading, setInteractionsLoading] = useState(false);
  const [matchingPharmacies, setMatchingPharmacies] = useState<PharmacyMatch[] | null>(null);
  const [matchingLoading, setMatchingLoading] = useState(false);
  const [matchingTotal, setMatchingTotal] = useState(0);

  // AI chat state
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiUnavailable, setAiUnavailable] = useState(false);

  const QUICK_FILTERS = [
    { id: 'proche', label: t('pharmacie.filters.near'), icon: <MapPin className="w-3 h-3" /> },
    { id: 'disponible', label: t('pharmacie.filters.available'), icon: null },
    { id: 'garde', label: t('pharmacie.filters.onDuty'), icon: <Shield className="w-3 h-3" /> },
    { id: 'prix_bas', label: t('pharmacie.filters.lowPrice'), icon: <Tag className="w-3 h-3" /> },
  ];

  const loadMedications = useCallback(
    async (q?: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        const query = q !== undefined ? q : searchQuery;
        if (query) params.set('q', query);
        if (gps) {
          params.set('lat', gps.lat.toString());
          params.set('lng', gps.lng.toString());
          params.set('radius_km', radiusKm.toString());
        }
        if (onDutyOnly) params.set('on_duty_only', 'true');
        params.set('limit', '20');
        const res = await apiGet(`/api/medicines/nearby?${params}`, { isAuthenticated: false });
        if (!res.ok) {
          setMedications([]);
          return;
        }
        const text = await res.text();
        const data = text ? JSON.parse(text) : {};
        const items = data?.items || data?.data?.items || [];
        setMedications(Array.isArray(items) ? items : []);
      } catch {
        setMedications([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [gps, onDutyOnly, radiusKm, searchQuery],
  );

  useEffect(() => {
    loadMedications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gps?.lat, gps?.lng, onDutyOnly, radiusKm]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) {
      toast({ title: t('pharmacie.home.emptySearch'), variant: 'destructive' });
      return;
    }
    loadMedications(searchQuery);
  };

  const handleChip = (chipId: string) => {
    const next = activeChip === chipId ? null : chipId;
    setActiveChip(next);
    if (chipId === 'proche') setRadiusKm(next ? 5 : 20);
    if (chipId === 'garde') setOnDutyOnly(next !== null);
  };

  const askAI = useCallback(
    async (question: string) => {
      if (!question.trim()) return;
      setAiSheetOpen(true);
      setAiLoading(true);
      setAiResponse(null);
      setAiUnavailable(false);
      setAiQuestion(question);
      try {
        const medNames = medications.slice(0, 5).map(m => m.nom_produit);
        const res = await apiPost('/ai/chat', {
          question,
          message: question,
          context: `Pharmacie. Médicaments disponibles: ${medNames.join(', ')}`,
          type: 'pharmacy',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const msg = data?.data?.message || data?.message || data?.response;
        if (!msg) throw new Error('empty');
        setAiResponse(typeof msg === 'string' ? msg : JSON.stringify(msg));
      } catch {
        setAiUnavailable(true);
        setAiResponse(t('pharmacie.ai.unavailable'));
      } finally {
        setAiLoading(false);
      }
    },
    [medications, t],
  );

  const runInteractionsCheck = useCallback(async (meds: string[]) => {
    if (meds.length < 2) return;
    setInteractionsLoading(true);
    setInteractions(null);
    try {
      const res = await apiPost('/api/pharmacies/ai/interactions', { medications: meds });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data?.success) {
        setInteractions({
          severity: data.severity || 'none',
          description: data.description || '',
          recommendation: data.recommendation || '',
          alternative_suggestions: Array.isArray(data.alternative_suggestions)
            ? data.alternative_suggestions
            : [],
        });
      }
    } catch {
      // Silencieux : l'absence de bandeau d'interactions n'est pas critique
      // pour l'utilisateur. On évite d'afficher un faux "aucune interaction".
    } finally {
      setInteractionsLoading(false);
    }
  }, []);

  const runMatchingSearch = useCallback(
    async (meds: string[]) => {
      setMatchingLoading(true);
      setMatchingPharmacies(null);
      setMatchingTotal(meds.length);
      try {
        const res = await apiPost('/api/pharmacies/search-by-medications', {
          medications: meds.map(name => ({ name })),
          lat: gps?.lat,
          lng: gps?.lng,
          radius_km: radiusKm,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const items: PharmacyMatch[] =
          data?.pharmacies || data?.items || data?.data?.items || data?.data?.pharmacies || [];
        setMatchingPharmacies(Array.isArray(items) ? items : []);
      } catch {
        setMatchingPharmacies([]);
      } finally {
        setMatchingLoading(false);
      }
    },
    [gps?.lat, gps?.lng, radiusKm],
  );

  const handleScanFile = async (file: File, kind: 'ordonnance' | 'boite') => {
    setAnalyzingImage(true);
    setScanResult(null);
    setInteractions(null);
    setMatchingPharmacies(null);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(',')[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const res = await apiPost('/api/pharmacies/ai/extract-ordonnance', {
        image_base64: base64,
        lat: gps?.lat,
        lng: gps?.lng,
      });
      const data = await res.json();
      const meds: string[] =
        data?.medications?.map((m: any) => m.name || m.nom).filter(Boolean) || [];

      if (!data?.success || meds.length === 0) {
        setScanResult(t('pharmacie.scan.none'));
        toast({ title: t('pharmacie.scan.none'), variant: 'destructive' });
        return;
      }

      setScanResult(`${t('pharmacie.scan.extracted')} ${meds.join(', ')}`);

      if (kind === 'boite' || meds.length === 1) {
        // Photo de boîte ou ordonnance mono-médicament : on ouvre la fiche
        // médicament détaillée (posologie + alternatives) via les routes IA réelles.
        setFocusedMedication(meds[0]);
      } else {
        // Ordonnance multi-médicaments : on parallélise interactions + matching
        // pharmacies. Le chat IA générique n'est plus déclenché : l'utilisateur
        // a maintenant des données structurées et actionnables.
        runInteractionsCheck(meds);
        runMatchingSearch(meds);
      }
    } catch (e: any) {
      toast({
        title: t('pharmacie.errors.scanFailed'),
        description: e?.message,
        variant: 'destructive',
      });
      setScanResult(t('pharmacie.errors.scanFailed'));
    } finally {
      setAnalyzingImage(false);
    }
  };

  const handleScanChoice = (kind: ScanKind) => {
    setScanSheetOpen(false);
    if (kind === 'ordonnance') {
      ordonnanceInputRef.current?.click();
    } else if (kind === 'boite') {
      boiteInputRef.current?.click();
    } else if (kind === 'symptom') {
      setAiQuestion('');
      setAiResponse(null);
      setAiUnavailable(false);
      setAiSheetOpen(true);
    } else if (kind === 'ask') {
      setAiQuestion('');
      setAiResponse(null);
      setAiUnavailable(false);
      setAiSheetOpen(true);
    }
  };

  const aiSuggestions = [
    t('pharmacie.ai.suggestions.fever'),
    t('pharmacie.ai.suggestions.headache'),
    t('pharmacie.ai.suggestions.nearby'),
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-500">
      {/* === Hero header === */}
      <div className="px-5 pt-8 pb-5 text-white max-w-2xl mx-auto">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-white/15 flex items-center justify-center backdrop-blur-sm">
              <Pill className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-bold leading-tight">{t('pharmacie.home.appName')}</h1>
              <p className="text-xs text-blue-100 leading-snug">{t('pharmacie.home.greeting')}</p>
            </div>
          </div>
          <LanguageSwitcherBourse variant="minimal" tone="white" />
        </div>
      </div>

      {/* === Disclaimer permanent sticky — visible sur tous les écrans === */}
      <div className="max-w-2xl mx-auto px-5 pb-3">
        <div className="bg-amber-50/95 backdrop-blur-sm border border-amber-200 rounded-xl px-3 py-2 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <p className="text-[11px] text-amber-900 font-medium leading-tight">
            {t('pharmacie.disclaimer.permanent')}
          </p>
        </div>
      </div>

      {/* === Contenu principal blanc === */}
      <div className="bg-white rounded-t-3xl min-h-screen pb-28">
        <div className="max-w-2xl mx-auto">
          {/* Search bar + Scan button intégré */}
          <div className="px-4 pt-5">
            <form onSubmit={handleSearch} className="flex gap-2 mb-3">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                  placeholder={t('pharmacie.home.searchPlaceholder')}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  aria-label={t('pharmacie.home.searchPlaceholder')}
                />
              </div>
              <button
                type="button"
                onClick={() => setScanSheetOpen(true)}
                className="bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 rounded-xl border border-blue-200 inline-flex items-center justify-center"
                aria-label={t('pharmacie.scan.fab')}
              >
                <ScanLine className="w-5 h-5" />
              </button>
              <button
                type="submit"
                className="bg-blue-600 active:bg-blue-700 text-white px-4 py-3 rounded-xl font-semibold text-sm"
              >
                {t('pharmacie.home.searchSubmit')}
              </button>
            </form>

            {/* Quick filter chips */}
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-3 -mx-1 px-1">
              {QUICK_FILTERS.map(chip => (
                <button
                  key={chip.id}
                  onClick={() => handleChip(chip.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
                    activeChip === chip.id
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'border-gray-200 text-gray-600 bg-white'
                  }`}
                >
                  {chip.icon}
                  {chip.label}
                </button>
              ))}
            </div>
          </div>

          {/* GPS fallback banner */}
          {gpsStatus === 'manual_required' && (
            <div className="mx-4 mb-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-start gap-3">
              <MapPin className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900">{t('pharmacie.gps.manualNeeded')}</p>
                <p className="text-xs text-amber-800 mt-0.5 leading-snug">{t('pharmacie.gps.manualNeededHint')}</p>
                <button
                  onClick={redetectGps}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700 active:text-amber-900"
                >
                  <RefreshCw className="w-3 h-3" />
                  {t('pharmacie.gps.retry')}
                </button>
              </div>
            </div>
          )}

          {gpsStatus === 'detecting' && (
            <div className="mx-4 mb-3 text-xs text-blue-600 inline-flex items-center gap-1.5 px-3">
              <Loader2 className="w-3 h-3 animate-spin" />
              {t('pharmacie.gps.detecting')}
            </div>
          )}

          {/* Scan inline CTA — discret, sous les chips, juste avant la liste.
              Le bouton ScanLine dans la search bar sert d'entrée principale ;
              cette card sert de redirection pédagogique pour les nouveaux. */}
          <div className="px-4 mb-4">
            <button
              onClick={() => setScanSheetOpen(true)}
              className="w-full flex items-center gap-3 rounded-2xl border border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50 px-4 py-3 active:from-blue-100 active:to-indigo-100"
            >
              <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center shrink-0 border border-blue-100">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-semibold text-blue-900 leading-tight">{t('pharmacie.scan.sheetTitle')}</p>
                <p className="text-xs text-blue-700/80 leading-snug">{t('pharmacie.scan.sheetSubtitle')}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-blue-400 shrink-0" />
            </button>
          </div>

          {scanResult && (
            <div className="mx-4 mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 flex items-start gap-2">
              <Pill className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
              <div className="flex-1 min-w-0">{scanResult}</div>
              <button
                onClick={() => {
                  setScanResult(null);
                  setInteractions(null);
                  setMatchingPharmacies(null);
                }}
                className="text-emerald-600 active:text-emerald-800"
                aria-label="close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* === Bandeau interactions médicamenteuses (post-scan ordonnance) === */}
          {(interactionsLoading || interactions) && (
            <div className="mx-4 mb-4">
              <InteractionsBanner
                loading={interactionsLoading}
                result={interactions}
                onRetry={() => {
                  /* on garde la même liste de médicaments si on a déjà scanné */
                }}
              />
            </div>
          )}

          {/* === Liste des pharmacies matching (post-scan ordonnance multi-méd) === */}
          {(matchingLoading || matchingPharmacies !== null) && (
            <div className="px-4 mb-5">
              <h2 className="font-semibold text-gray-800 text-sm mb-3 inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-blue-600" />
                {t('pharmacie.matching.title')}
              </h2>
              {matchingLoading ? (
                <div className="flex items-center gap-2 text-sm text-blue-600 px-1">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pharmacie.matching.loading')}
                </div>
              ) : matchingPharmacies && matchingPharmacies.length === 0 ? (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                  {t('pharmacie.matching.empty')}
                  <button
                    onClick={() => setRadiusKm(r => Math.min(50, r + 15))}
                    className="block mt-2 text-xs font-semibold text-blue-600"
                  >
                    {t('pharmacie.matching.widen')}
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {matchingPharmacies?.map((ph, i) => {
                    const found = ph.found_count ?? ph.medications_availability?.filter(a => a.available).length ?? 0;
                    const total = ph.total_count ?? matchingTotal;
                    const isFull = total > 0 && found === total;
                    return (
                      <div
                        key={ph.id || i}
                        className={`rounded-2xl border px-4 py-3 cursor-pointer active:bg-gray-50 ${
                          isFull ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-100 bg-white'
                        }`}
                        onClick={() => ph.id && navigate(`/${ph.id}`)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 text-sm leading-tight truncate">
                              {ph.nom}
                            </p>
                            {(ph.quartier || ph.ville) && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate">
                                {[ph.quartier, ph.ville].filter(Boolean).join(', ')}
                              </p>
                            )}
                            <p
                              className={`text-xs font-semibold mt-1 inline-flex items-center gap-1 ${
                                isFull ? 'text-emerald-700' : 'text-blue-600'
                              }`}
                            >
                              <Pill className="w-3 h-3" />
                              {isFull
                                ? t('pharmacie.matching.scoreFull')
                                : t('pharmacie.matching.score', { found, total })}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            {ph.distance_km !== undefined && (
                              <p className="text-xs text-gray-400">
                                {ph.distance_km.toFixed(1)} {t('pharmacie.card.km')}
                              </p>
                            )}
                          </div>
                        </div>
                        {ph.telephone && (
                          <a
                            href={`tel:${ph.telephone}`}
                            onClick={e => e.stopPropagation()}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 active:text-emerald-800"
                          >
                            <Phone className="w-3 h-3" />
                            {ph.telephone}
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* === Liste médicaments === */}
          <div className="px-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800 text-sm">
                {gps ? t('pharmacie.home.nearbyTitle') : t('pharmacie.home.nearbyTitleNoGps')}
              </h2>
              <button
                onClick={() => {
                  setRefreshing(true);
                  loadMedications();
                }}
                disabled={refreshing}
                aria-label="refresh"
              >
                <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : medications.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-center">
                <Pill className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 text-sm">{t('pharmacie.home.nearbyEmpty')}</p>
                <p className="text-gray-400 text-xs mt-1">{t('pharmacie.home.nearbyEmptyHint')}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {medications.map((med, i) => (
                  <div
                    key={med.id || i}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 cursor-pointer active:bg-gray-50"
                    onClick={() => med.pharmacy_service_id && navigate(`/${med.pharmacy_service_id}`)}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm leading-tight">{med.nom_produit}</p>
                        {med.pharmacy_name && (
                          <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" />
                            <span className="truncate">
                              {med.pharmacy_name}
                              {(med.pharmacy_quartier || med.pharmacy_ville) &&
                                ` · ${[med.pharmacy_quartier, med.pharmacy_ville].filter(Boolean).join(', ')}`}
                            </span>
                          </p>
                        )}
                        {med.categorie && (
                          <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                            {med.categorie}
                          </span>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        {med.prix ? (
                          <p className="text-sm font-bold text-blue-600">
                            {Number(med.prix).toLocaleString()} {t('pharmacie.card.currency')}
                          </p>
                        ) : null}
                        {med.distance_km !== undefined && (
                          <p className="text-xs text-gray-400 mt-0.5">
                            {med.distance_km.toFixed(1)} {t('pharmacie.card.km')}
                          </p>
                        )}
                        {med.stock === 0 && (
                          <p className="text-xs text-red-500 mt-0.5">{t('pharmacie.card.outOfStock')}</p>
                        )}
                      </div>
                    </div>
                    {med.pharmacy_telephone && (
                      <a
                        href={`tel:${med.pharmacy_telephone}`}
                        onClick={e => e.stopPropagation()}
                        className="inline-flex items-center gap-1 mt-2 text-xs text-emerald-600 active:text-emerald-800"
                      >
                        <Phone className="w-3 h-3" />
                        {med.pharmacy_telephone}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}

            <button
              onClick={() => navigate('/search')}
              className="w-full mt-5 border-2 border-blue-600 text-blue-600 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 active:bg-blue-50"
            >
              <Search className="w-4 h-4" />
              {t('pharmacie.home.advancedSearch')}
            </button>
          </div>
        </div>
      </div>

      {/* === Inputs cachés (capture caméra mobile) === */}
      <input
        ref={ordonnanceInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleScanFile(f, 'ordonnance');
          e.target.value = '';
        }}
      />
      <input
        ref={boiteInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={e => {
          const f = e.target.files?.[0];
          if (f) handleScanFile(f, 'boite');
          e.target.value = '';
        }}
      />

      {/* === Bottom sheet : Scan options === */}
      {scanSheetOpen && (
        <SheetOverlay onClose={() => setScanSheetOpen(false)}>
          <div className="px-5 pt-2 pb-6">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <h3 className="text-base font-bold text-gray-900">{t('pharmacie.scan.sheetTitle')}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{t('pharmacie.scan.sheetSubtitle')}</p>
            <div className="mt-4 space-y-2">
              <ScanOption
                icon={<FileText className="w-5 h-5 text-blue-600" />}
                iconBg="bg-blue-50"
                title={t('pharmacie.scan.ordonnance')}
                hint={t('pharmacie.scan.ordonnanceHint')}
                onClick={() => handleScanChoice('ordonnance')}
                badge={<YukpoCostBadge action="ordonnance_extract" variant="inline" />}
              />
              <ScanOption
                icon={<Camera className="w-5 h-5 text-indigo-600" />}
                iconBg="bg-indigo-50"
                title={t('pharmacie.scan.boite')}
                hint={t('pharmacie.scan.boiteHint')}
                onClick={() => handleScanChoice('boite')}
                badge={<YukpoCostBadge action="vision_image" variant="inline" />}
              />
              <ScanOption
                icon={<Stethoscope className="w-5 h-5 text-emerald-600" />}
                iconBg="bg-emerald-50"
                title={t('pharmacie.scan.symptom')}
                hint={t('pharmacie.scan.symptomHint')}
                onClick={() => handleScanChoice('symptom')}
                badge={<YukpoCostBadge action="chat_message" variant="inline" />}
              />
              <ScanOption
                icon={<Sparkles className="w-5 h-5 text-blue-600" />}
                iconBg="bg-blue-50"
                title={t('pharmacie.scan.ask')}
                hint={t('pharmacie.scan.askHint')}
                onClick={() => handleScanChoice('ask')}
                badge={<YukpoCostBadge action="chat_message" variant="inline" />}
              />
            </div>
          </div>
        </SheetOverlay>
      )}

      {/* === Bottom sheet : AI chat === */}
      {aiSheetOpen && (
        <SheetOverlay onClose={() => setAiSheetOpen(false)}>
          <div className="px-5 pt-2 pb-5 max-h-[80vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4" />
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">{t('pharmacie.ai.title')}</h3>
            </div>

            <div className="flex-1 overflow-y-auto mb-3 -mx-1 px-1">
              {analyzingImage && (
                <div className="flex items-center gap-2 mb-3 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pharmacie.scan.analyzing')}
                </div>
              )}
              {aiLoading && (
                <div className="flex items-center gap-2 mb-3 text-sm text-blue-600">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {t('pharmacie.ai.thinking')}
                </div>
              )}
              {aiResponse && (
                <div
                  className={`rounded-xl p-3 mb-3 text-sm leading-relaxed border ${
                    aiUnavailable
                      ? 'bg-amber-50 border-amber-200 text-amber-900'
                      : 'bg-blue-50 border-blue-100 text-gray-800'
                  }`}
                >
                  {aiResponse}
                  {aiUnavailable && aiQuestion && (
                    <button
                      onClick={() => askAI(aiQuestion)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-amber-700"
                    >
                      <RefreshCw className="w-3 h-3" />
                      {t('pharmacie.ai.retry')}
                    </button>
                  )}
                </div>
              )}

              {!aiLoading && !aiResponse && (
                <>
                  <p className="text-xs text-gray-500 mb-2">{t('pharmacie.ai.suggestionsTitle')}</p>
                  <div className="flex flex-col gap-2">
                    {aiSuggestions.map(s => (
                      <button
                        key={s}
                        onClick={() => askAI(s)}
                        className="text-left text-sm bg-blue-50 hover:bg-blue-100 text-blue-700 px-3 py-2 rounded-xl"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                placeholder={t('pharmacie.ai.placeholder')}
                value={aiQuestion}
                onChange={e => setAiQuestion(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && askAI(aiQuestion)}
              />
              <button
                onClick={() => askAI(aiQuestion)}
                disabled={aiLoading || !aiQuestion.trim()}
                className="bg-blue-600 disabled:bg-blue-300 text-white p-2.5 rounded-xl"
                aria-label={t('pharmacie.ai.send')}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </SheetOverlay>
      )}

      {/* Loader plein écran pendant l'analyse de l'image (en plus du sheet IA) */}
      {analyzingImage && !aiSheetOpen && !focusedMedication && (
        <div className="fixed inset-0 z-40 bg-black/40 flex items-end justify-center pb-32 pointer-events-none">
          <div className="bg-white rounded-full px-4 py-2 shadow-lg inline-flex items-center gap-2 text-sm text-blue-700">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t('pharmacie.scan.analyzing')}
          </div>
        </div>
      )}

      {/* === Fiche médicament (posologie + alternatives + warnings) === */}
      {focusedMedication && (
        <MedicationDetailSheet
          medicationName={focusedMedication}
          onClose={() => setFocusedMedication(null)}
          onFindPharmacies={med => {
            setSearchQuery(med);
            loadMedications(med);
          }}
        />
      )}
    </div>
  );
};

// ============================================================================
// Sous-composants locaux
// ============================================================================

const SheetOverlay: React.FC<{ onClose: () => void; children: React.ReactNode }> = ({ onClose, children }) => {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-2xl shadow-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up-sheet"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

interface ScanOptionProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  hint: string;
  onClick: () => void;
  badge?: React.ReactNode;
}

// Mapping severity IA → couleurs + clé i18n
const SEVERITY_STYLES: Record<string, { bg: string; border: string; text: string; iconColor: string; key: string }> = {
  none: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-900', iconColor: 'text-emerald-600', key: 'bannerTitleNone' },
  minor: { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-900', iconColor: 'text-yellow-600', key: 'bannerTitleMinor' },
  moderate: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-900', iconColor: 'text-orange-600', key: 'bannerTitleModerate' },
  major: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-900', iconColor: 'text-red-600', key: 'bannerTitleMajor' },
  contraindicated: { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-900', iconColor: 'text-red-700', key: 'bannerTitleContraindicated' },
};

const InteractionsBanner: React.FC<{
  loading: boolean;
  result: InteractionsResult | null;
  onRetry: () => void;
}> = ({ loading, result }) => {
  const { t } = useTranslation();
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-blue-600 px-3 py-2.5 rounded-xl border border-blue-100 bg-blue-50">
        <Loader2 className="w-4 h-4 animate-spin" />
        {t('pharmacie.interactions.checking')}
      </div>
    );
  }
  if (!result) return null;
  const styles = SEVERITY_STYLES[result.severity] || SEVERITY_STYLES.none;
  return (
    <div className={`rounded-2xl border-2 ${styles.border} ${styles.bg} px-4 py-3`}>
      <div className="flex items-start gap-3">
        <AlertTriangle className={`w-5 h-5 ${styles.iconColor} shrink-0 mt-0.5`} />
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-bold ${styles.text}`}>
            {t(`pharmacie.interactions.${styles.key}`)}
          </p>
          {result.description && (
            <p className={`text-xs ${styles.text} mt-1 leading-snug opacity-90`}>{result.description}</p>
          )}
          {result.recommendation && (
            <div className={`mt-2 text-xs ${styles.text}`}>
              <span className="font-semibold">{t('pharmacie.interactions.recommendation')} : </span>
              {result.recommendation}
            </div>
          )}
          {result.alternative_suggestions.length > 0 && (
            <div className={`mt-2 text-xs ${styles.text}`}>
              <p className="font-semibold mb-0.5">{t('pharmacie.interactions.alternativesLabel')}</p>
              <ul className="list-disc list-inside leading-snug opacity-90">
                {result.alternative_suggestions.map((s, i) => (
                  <li key={i}>{s}</li>
                ))}
              </ul>
            </div>
          )}
          <p className={`text-[11px] ${styles.text} mt-2 opacity-75 italic`}>
            {t('pharmacie.disclaimer.long')}
          </p>
        </div>
      </div>
    </div>
  );
};

const ScanOption: React.FC<ScanOptionProps> = ({ icon, iconBg, title, hint, onClick, badge }) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-3 py-3 rounded-2xl border border-gray-100 hover:bg-gray-50 active:bg-gray-100 text-left"
  >
    <div className={`w-10 h-10 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>{icon}</div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-semibold text-gray-900 leading-tight">{title}</p>
      <p className="text-xs text-gray-500 leading-snug">{hint}</p>
      {badge && <div className="mt-1">{badge}</div>}
    </div>
    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
  </button>
);

export default PharmacieHomePage;
