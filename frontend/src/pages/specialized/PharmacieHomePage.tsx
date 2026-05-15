import {
  AlertTriangle,
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
  Tag,
  X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import LanguageSwitcherBourse from '@/components/LanguageSwitcherBourse';
import { useToast } from '@/hooks/use-toast';
import { useGpsWithFallback } from '@/hooks/useGpsWithFallback';
import { useHistoryBackClose } from '@/hooks/useHistoryBackClose';
import { useUser } from '@/hooks/useUser';
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


const PharmacieHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { gps, status: gpsStatus, detect: redetectGps } = useGpsWithFallback();
  const { user, isLoading: userLoading, isPartner, partnerType, isAdmin } = useUser();
  // Le pharmacien partenaire (et les admins Yukpo via leur ComptePage) peut
  // accéder à son dashboard pour uploader son catalogue, gérer commandes…
  const showPartnerCta = isPartner && partnerType === 'pharmacie';

  // ✅ 2026-05-14 : connexion obligatoire (parité Bourse du Livre).
  // Sans token, redirection vers /login avec source=shared_service pour
  // que le formulaire propose aussi le bouton "Devenir partenaire" pour les
  // pharmaciens qui veulent inscrire leur officine.
  useEffect(() => {
    if (!userLoading && !user) {
      navigate('/login?source=shared_service&redirect=%2F', { replace: true });
    }
  }, [userLoading, user, navigate]);

  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [onDutyOnly, setOnDutyOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  // Sheets — Le sheet "Que voulez-vous faire ?" a été supprimé : le bouton
  // scan ouvre directement la caméra et le routage post-extraction se fait
  // automatiquement (1 méd → fiche, N méds → matching pharmacies + interactions).
  // La recherche texte route vers l'IA si le texte ressemble à une question
  // (cf. looksLikeQuestion en haut de fichier).
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

  // ⚠️ Pas de filtre "Prix bas" : les prix des médicaments sont harmonisés
  // au Cameroun (régulation MINSANTE). Tous les pharmaciens vendent au même
  // tarif officiel → un filtre comparatif n'aurait pas de sens.
  const QUICK_FILTERS = [
    { id: 'proche', label: t('pharmacie.filters.near'), icon: <MapPin className="w-3 h-3" /> },
    { id: 'disponible', label: t('pharmacie.filters.available'), icon: null },
    { id: 'garde', label: t('pharmacie.filters.onDuty'), icon: <Shield className="w-3 h-3" /> },
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

  const [routingIntent, setRoutingIntent] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      toast({ title: t('pharmacie.home.emptySearch'), variant: 'destructive' });
      return;
    }
    // ✅ Routage par LLM côté backend (pas d'heuristique mots-clés) : on
    // demande à l'IA de classifier l'intention (médicament / symptôme /
    // question / chat). En cas d'échec réseau → fallback direct sur recherche
    // médicament classique pour ne pas bloquer l'utilisateur.
    setRoutingIntent(true);
    try {
      const res = await apiPost('/api/pharmacies/ai/route-intent', {
        text: q,
        lang: typeof document !== 'undefined' ? document.documentElement.lang || 'fr' : 'fr',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const intent: string = data?.intent || 'medication_search';
      if (intent === 'medication_search') {
        const query = data?.query_for_search || q;
        setSearchQuery(query);
        loadMedications(query);
      } else {
        const question = data?.question_for_chat || q;
        askAI(question);
      }
    } catch {
      // Fallback : routage médicament par défaut, jamais on ne bloque l'utilisateur
      loadMedications(q);
    } finally {
      setRoutingIntent(false);
    }
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

  // Workflow RFQ : émet une alerte de disponibilité aux pharmacies du rayon
  // (5 km par défaut). Les pharmaciens valident manuellement, l'utilisateur
  // voit les réponses classées en temps réel sur /alerts/:id.
  const broadcastAlert = useCallback(
    async (meds: string[]) => {
      if (meds.length === 0) {
        toast({ title: 'Aucun médicament à demander', variant: 'destructive' });
        return;
      }
      try {
        const res = await apiPost(
          '/api/medication-alerts',
          {
            query_items: meds.map(name => ({ name })),
            gps_lat: gps?.lat ?? 4.0511,
            gps_lng: gps?.lng ?? 9.7679,
            radius_km: 20,
          },
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        navigate(`/alerts/${data.alert_id}`);
      } catch (e: any) {
        toast({
          title: 'Impossible d’émettre l’alerte',
          description: e?.message,
          variant: 'destructive',
        });
      }
    },
    [gps?.lat, gps?.lng, navigate, toast],
  );

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
        // Ordonnance multi-médicaments : workflow RFQ.
        // - On vérifie les interactions en parallèle (banner)
        // - On broadcast une alerte aux pharmacies du rayon → l'utilisateur
        //   bascule sur la page /alerts/:id qui affiche les réponses en
        //   temps réel et le classement par taux de complétude.
        runInteractionsCheck(meds);
        broadcastAlert(meds);
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

        {/* CTA pharmacien partenaire connecté — accès direct au dashboard
            d'upload produits CSV/Excel, commandes, stats. Visible uniquement
            si l'utilisateur est partenaire pharmacie. */}
        {showPartnerCta && (
          <button
            onClick={() => navigate('/dashboard')}
            className="mt-4 w-full bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/30 rounded-2xl px-4 py-3 text-left inline-flex items-center gap-3 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
              <Pill className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white leading-tight">
                {t('pharmacie.home.partnerCtaTitle')}
              </p>
              <p className="text-[11px] text-blue-100 leading-snug truncate">
                {t('pharmacie.home.partnerCtaSubtitle')}
              </p>
            </div>
            <span className="text-xs font-semibold text-white shrink-0 inline-flex items-center gap-1">
              {t('pharmacie.home.partnerCtaButton')}
              <RefreshCw className="w-3 h-3" />
            </span>
          </button>
        )}

        {/* CTA admin Yukpo : ouvre la pharmacie officielle Yukpo en mode test
            (upload de produits, recherche, scan). Visible uniquement pour les
            comptes ayant role='admin' ou 'super_admin'. */}
        {isAdmin && (
          <button
            onClick={async () => {
              try {
                const res = await apiGet('/api/admin/pharmacie/yukpo-official');
                if (!res.ok) throw new Error(`HTTP ${res.status}`);
                const data = await res.json();
                navigate(`/dashboard/produits?service_id=${data.service_id}&official=1`);
              } catch (e: any) {
                toast({
                  title: 'Pharmacie officielle indisponible',
                  description: e?.message || 'Vérifiez la migration 20260514_002.',
                  variant: 'destructive',
                });
              }
            }}
            className="mt-2 w-full bg-amber-400/20 hover:bg-amber-400/30 backdrop-blur-sm border border-amber-200/40 rounded-2xl px-4 py-2.5 text-left inline-flex items-center gap-3 transition-colors"
          >
            <div className="w-8 h-8 rounded-lg bg-amber-300/30 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-amber-100" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white leading-tight">
                Tester Yukpo Pharmacie
              </p>
              <p className="text-[10px] text-amber-100/90 leading-snug truncate">
                Admin uniquement · upload Excel, recherche, scan
              </p>
            </div>
          </button>
        )}
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
              {/* Bouton scan unifié : ouvre directement la caméra. Le backend
                  détecte si c'est une ordonnance ou une boîte de médicament
                  et le routage (fiche médicament vs matching pharmacies) se
                  fait automatiquement selon le nombre de molécules extraites. */}
              <label
                className={`bg-blue-50 hover:bg-blue-100 text-blue-600 px-3 rounded-xl border border-blue-200 inline-flex items-center justify-center cursor-pointer ${
                  analyzingImage ? 'opacity-60 pointer-events-none' : ''
                }`}
                aria-label={t('pharmacie.scan.fab')}
              >
                {analyzingImage ? <Loader2 className="w-5 h-5 animate-spin" /> : <ScanLine className="w-5 h-5" />}
                <input
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
              </label>
              <button
                type="submit"
                disabled={routingIntent}
                className="bg-blue-600 active:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-3 rounded-xl font-semibold text-sm inline-flex items-center justify-center min-w-[48px]"
              >
                {routingIntent ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  t('pharmacie.home.searchSubmit')
                )}
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
                  {matchingPharmacies?.map((ph, i) => (
                    <PharmacyMatchCard
                      key={ph.id || i}
                      ph={ph}
                      fallbackTotal={matchingTotal}
                      onOpen={id => navigate(`/${id}`)}
                      onMedClick={med => setFocusedMedication(med)}
                    />
                  ))}
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
              <div className="flex flex-col items-center py-10 text-center">
                <Pill className="w-12 h-12 text-gray-200 mb-3" />
                <p className="text-gray-500 text-sm">{t('pharmacie.home.nearbyEmpty')}</p>
                <p className="text-gray-400 text-xs mt-1 mb-4">
                  {t('pharmacie.home.nearbyEmptyHint')}
                </p>
                {searchQuery.trim() && (
                  <button
                    onClick={() => broadcastAlert([searchQuery.trim()])}
                    className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white px-5 py-2.5 rounded-xl font-semibold text-sm inline-flex items-center gap-2"
                  >
                    <Sparkles className="w-4 h-4" />
                    Demander aux pharmacies du quartier
                  </button>
                )}
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


      {/* === Bottom sheet : AI chat === */}
      {aiSheetOpen && (
        <SheetOverlay onClose={() => setAiSheetOpen(false)}>
          <div className="px-5 pt-2 pb-5 max-h-[85vh] flex flex-col">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-3" />
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              <h3 className="text-base font-bold text-gray-900">{t('pharmacie.ai.title')}</h3>
            </div>
            {/* Disclaimer dans le sheet IA — toujours visible avant la conversation */}
            <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-3 flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <p className="text-[11px] text-amber-900 leading-snug">
                {t('pharmacie.disclaimer.long')}
              </p>
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
  // Bouton Retour navigateur (ou geste back Android) → ferme le sheet au lieu
  // de quitter la PWA. Le hook push une entrée d'historique fictive à
  // l'ouverture et la consomme à la fermeture.
  useHistoryBackClose(true, onClose);
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="bg-white rounded-t-3xl w-full max-w-2xl shadow-2xl pb-[env(safe-area-inset-bottom)] animate-slide-up-sheet max-h-[90vh] overflow-y-auto overscroll-contain"
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
};

// Carte d'une pharmacie matching avec détail médicaments + prix + budget total
const PharmacyMatchCard: React.FC<{
  ph: PharmacyMatch;
  fallbackTotal: number;
  onOpen: (id: number) => void;
  onMedClick: (medication: string) => void;
}> = ({ ph, fallbackTotal, onOpen, onMedClick }) => {
  const { t } = useTranslation();
  const avail = ph.medications_availability || [];
  const found = ph.found_count ?? avail.filter(a => a.available).length;
  const total = ph.total_count ?? (avail.length || fallbackTotal);
  const isFull = total > 0 && found === total;
  const budgetSum = avail
    .filter(a => a.available && typeof a.price === 'number')
    .reduce((s, a) => s + (a.price as number), 0);
  const missing = avail.filter(a => !a.available).map(a => a.name);

  return (
    <div
      className={`rounded-2xl border px-4 py-3 cursor-pointer active:bg-gray-50 ${
        isFull ? 'border-emerald-300 bg-emerald-50/50' : 'border-gray-100 bg-white'
      }`}
      onClick={() => ph.id && onOpen(ph.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm leading-tight truncate">{ph.nom}</p>
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
          {budgetSum > 0 && (
            <div className="mt-1">
              <p className="text-[10px] uppercase text-gray-500 leading-none tracking-wide">
                {t('pharmacie.matching.totalBudget')}
              </p>
              <p className="text-sm font-bold text-blue-700">
                {budgetSum.toLocaleString()} {t('pharmacie.card.currency')}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Liste détaillée des médicaments avec leur prix dans cette pharmacie */}
      {avail.length > 0 && (
        <div className="mt-3 space-y-1 border-t border-dashed border-gray-100 pt-2">
          {avail.map((m, i) => (
            <div key={`${m.name}-${i}`} className="flex items-center gap-2 text-xs">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  m.available ? 'bg-emerald-500' : 'bg-red-400'
                }`}
              />
              <span
                onClick={e => {
                  e.stopPropagation();
                  onMedClick(m.name);
                }}
                className={`flex-1 min-w-0 truncate hover:underline ${
                  m.available ? 'text-gray-800' : 'text-gray-400 line-through'
                }`}
              >
                {m.name}
              </span>
              {m.available ? (
                typeof m.price === 'number' ? (
                  <span className="text-blue-700 font-semibold shrink-0">
                    {m.price.toLocaleString()} {t('pharmacie.card.currency')}
                  </span>
                ) : (
                  <span className="text-gray-400 text-[10px] shrink-0">
                    {t('pharmacie.matching.priceUnavailable')}
                  </span>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <p className="text-[11px] text-amber-700 mt-2">
          {t('pharmacie.matching.missingHere')} : {missing.join(', ')}
        </p>
      )}

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
};

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

export default PharmacieHomePage;
