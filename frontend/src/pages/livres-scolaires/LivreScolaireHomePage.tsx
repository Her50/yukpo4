import {
  BookOpen, Camera, Check, ChevronRight, GraduationCap, HeartHandshake,
  MapPin, Package, Plus, RefreshCw, RepeatIcon, Scale,
  School, Search, ShoppingCart, Truck, User, X
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PAYS_PAR_DEFAUT, SYSTEMES_SCOLAIRES, getClasseFullName, getSystemesForPays,
  type PaysCode, type SystemeScolaire,
} from '../../data/schoolSystems';
import { detectPaysFromGPSOrNull } from '../../utils/paysFromGPS';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { useParentShop } from '../../hooks/useParentShop';
import { apiGet } from '../../services/apiService';

interface LivreScolaire {
  id: number;
  titre: string;
  matiere?: string;
  classe_actuelle?: string;
  etat_livre?: string;
  ville?: string;
  quartier?: string;
  images_urls?: string[];
  distance_km?: number;
}

const etatColor = (etat?: string) => {
  if (!etat) return 'bg-gray-100 text-gray-600';
  if (etat === 'Neuf') return 'bg-green-100 text-green-700';
  if (etat === 'Très bon') return 'bg-emerald-100 text-emerald-700';
  if (etat === 'Bon') return 'bg-yellow-100 text-yellow-700';
  return 'bg-orange-100 text-orange-700';
};

/* ─── Modale ajout classes (multi-pays, multi-sélection, séries) ─── */
interface ClasseSelection {
  systemeId: string;
  pays: PaysCode;
  systemeLabel: string;
  niveau: string;
  classe: string;       // nom de base, ex : "1ère"
  serie?: string;       // ex : "C"
  fullName: string;     // "1ère C"
}

function AddEnfantModal({
  onClose,
  onAdd,
  alreadyAdded,
  gps,
}: {
  onClose: () => void;
  onAdd: (selections: ClasseSelection[]) => void;
  alreadyAdded: Array<{ fullName: string; systemeId: string }>;
  gps: { lat: number; lon: number } | null;
}) {
  // Détection pays depuis GPS (silencieuse)
  const detectedPays: PaysCode = useMemo(() => {
    return detectPaysFromGPSOrNull(gps?.lat, gps?.lon) ?? PAYS_PAR_DEFAUT;
  }, [gps]);

  const systemesDisponibles = useMemo(() => {
    const arr = getSystemesForPays(detectedPays);
    // Si pays non supporté, fallback sur tous les systèmes
    return arr.length ? arr : SYSTEMES_SCOLAIRES;
  }, [detectedPays]);

  const [currentSystemeId, setCurrentSystemeId] = useState<string>(() => systemesDisponibles[0].id);
  const currentSysteme: SystemeScolaire = useMemo(
    () => systemesDisponibles.find(s => s.id === currentSystemeId) ?? systemesDisponibles[0],
    [systemesDisponibles, currentSystemeId]
  );

  // Niveau par défaut : collège/secondaire si présent
  const defaultNiveau = useMemo(() => {
    const prefer = currentSysteme.niveaux.find(n =>
      /collège|secondary|moyen|humanités|junior/i.test(n.nom)
    );
    return (prefer ?? currentSysteme.niveaux[0]).nom;
  }, [currentSysteme]);

  const [niveauNom, setNiveauNom] = useState<string>(defaultNiveau);
  useEffect(() => { setNiveauNom(defaultNiveau); }, [defaultNiveau]);

  const niveauObj = useMemo(
    () => currentSysteme.niveaux.find(n => n.nom === niveauNom) ?? currentSysteme.niveaux[0],
    [currentSysteme, niveauNom]
  );

  const [selected, setSelected] = useState<ClasseSelection[]>([]);

  const isAlreadyAdded = (fullName: string) =>
    alreadyAdded.some(a => a.fullName === fullName && a.systemeId === currentSystemeId);

  const isSelected = (fullName: string) =>
    selected.some(s => s.fullName === fullName && s.systemeId === currentSystemeId);

  const toggleClasse = (classeNom: string, serie?: string) => {
    const fullName = getClasseFullName(classeNom, serie);
    if (isAlreadyAdded(fullName)) return;
    setSelected(prev => {
      const idx = prev.findIndex(s => s.fullName === fullName && s.systemeId === currentSystemeId);
      if (idx !== -1) return prev.filter((_, i) => i !== idx);
      return [
        ...prev,
        {
          systemeId: currentSystemeId,
          pays: currentSysteme.pays,
          systemeLabel: currentSysteme.systemeLabel,
          niveau: niveauNom,
          classe: classeNom,
          serie,
          fullName,
        },
      ];
    });
  };

  const removeChip = (item: ClasseSelection) => {
    setSelected(prev => prev.filter(s => !(s.fullName === item.fullName && s.systemeId === item.systemeId)));
  };

  const showSystemeSwitch = systemesDisponibles.length > 1;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-10 sm:pb-6 max-h-[90vh] sm:max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-4">
          <div className="flex items-center justify-between">
            <h2 className="font-bold text-gray-900 text-lg">Ajouter des classes</h2>
            <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Sélectionnez une ou plusieurs classes — changez de niveau sans perdre votre sélection.
          </p>
        </div>

        {/* Chips sélection en cours */}
        {selected.length > 0 && (
          <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl">
            <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-2">
              Sélection ({selected.length})
            </p>
            <div className="flex flex-wrap gap-1.5">
              {selected.map(item => (
                <button
                  key={`${item.systemeId}-${item.fullName}`}
                  onClick={() => removeChip(item)}
                  className="flex items-center gap-1 px-2.5 py-1 bg-amber-500 text-white rounded-full text-xs font-semibold"
                >
                  {item.fullName}
                  <X className="w-3 h-3" />
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {/* Système scolaire — uniquement si pays a plusieurs (ex: Cameroun FR/EN) */}
          {showSystemeSwitch && (
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Système
              </label>
              <div className="grid grid-cols-2 gap-2">
                {systemesDisponibles.map(s => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentSystemeId(s.id)}
                    className={`py-3 rounded-xl text-sm font-semibold border transition-colors ${
                      currentSystemeId === s.id
                        ? 'bg-amber-500 text-white border-amber-500'
                        : 'bg-white text-gray-700 border-gray-200'
                    }`}
                  >
                    {s.systemeLabel}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Niveau */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Niveau
            </label>
            <div className="flex flex-wrap gap-2">
              {currentSysteme.niveaux.map(n => (
                <button
                  key={n.nom}
                  onClick={() => setNiveauNom(n.nom)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${
                    niveauNom === n.nom
                      ? 'bg-amber-500 text-white border-amber-500'
                      : 'bg-white text-gray-700 border-gray-200'
                  }`}
                >
                  {n.nom}
                </button>
              ))}
            </div>
          </div>

          {/* Classes + séries */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
              Classes <span className="text-gray-400 normal-case font-normal">(cliquez pour ajouter)</span>
            </label>
            <div className="space-y-3">
              {niveauObj.classes.map(c => {
                // Classe sans série → un seul bouton
                if (!c.series || c.series.length === 0) {
                  const already = isAlreadyAdded(c.nom);
                  const sel = isSelected(c.nom);
                  return (
                    <button
                      key={c.nom}
                      onClick={() => toggleClasse(c.nom)}
                      disabled={already}
                      className={`px-3 py-2 rounded-xl text-sm font-medium border transition-colors mr-2 ${
                        already
                          ? 'bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed line-through'
                          : sel
                          ? 'bg-amber-500 text-white border-amber-500'
                          : 'bg-white text-gray-600 border-gray-200 hover:border-amber-300'
                      }`}
                    >
                      {c.nom}{already && ' ✓'}
                    </button>
                  );
                }
                // Classe avec séries → sous-groupe
                return (
                  <div key={c.nom} className="p-2.5 bg-gray-50 rounded-xl">
                    <p className="text-[11px] font-bold text-gray-700 uppercase mb-1.5">
                      {c.nom} <span className="text-gray-400 font-normal">— séries</span>
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {c.series.map(s => {
                        const full = getClasseFullName(c.nom, s.code);
                        const already = isAlreadyAdded(full);
                        const sel = isSelected(full);
                        return (
                          <button
                            key={s.code}
                            onClick={() => toggleClasse(c.nom, s.code)}
                            disabled={already}
                            title={s.label}
                            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                              already
                                ? 'bg-gray-200 text-gray-400 cursor-not-allowed line-through'
                                : sel
                                ? 'bg-amber-500 text-white border-amber-500'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-amber-300'
                            }`}
                          >
                            {s.code}{already && ' ✓'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <button
          disabled={selected.length === 0}
          onClick={() => { if (selected.length > 0) onAdd(selected); }}
          className="mt-5 w-full bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-semibold py-3.5 rounded-2xl text-sm"
        >
          {selected.length === 0
            ? 'Sélectionnez au moins une classe'
            : `Ajouter ${selected.length} classe${selected.length > 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

/* ─── Popover autocomplete établissement ─── */
interface EtabSuggestion {
  id: number;
  nom: string;
  ville?: string;
  type_etablissement?: string;
  distance_km?: number;
}

function EcolePickerPopover({
  currentNom,
  gps,
  onSelect,
  onClose,
}: {
  currentNom?: string;
  gps: { lat: number; lon: number } | null;
  onSelect: (etab: { id: number; nom: string }) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState(currentNom ?? '');
  const [results, setResults] = useState<EtabSuggestion[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handler = setTimeout(async () => {
      if (q.trim().length < 2) { setResults([]); return; }
      setLoading(true);
      try {
        const params = new URLSearchParams({ q: q.trim() });
        if (gps) { params.set('gps_lat', String(gps.lat)); params.set('gps_lon', String(gps.lon)); params.set('rayon_km', '25'); }
        const res = await apiGet(`/api/orientation-scolaire/etablissements/search?${params}`, { isAuthenticated: false });
        const data = await res.json();
        setResults(data?.data?.etablissements || data?.etablissements || []);
      } catch { setResults([]); }
      finally { setLoading(false); }
    }, 250);
    return () => clearTimeout(handler);
  }, [q, gps]);

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md sm:max-w-lg p-5 pb-10 sm:pb-6 max-h-[80vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-gray-900 text-base">Choisir l'école</h3>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 mb-3">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            autoFocus
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Nom de l'école…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
        </div>
        {loading && <p className="text-xs text-gray-400 text-center py-2">Recherche…</p>}
        {!loading && q.trim().length >= 2 && results.length === 0 && (
          <p className="text-xs text-gray-400 text-center py-3">Aucune école trouvée</p>
        )}
        <div className="space-y-1.5">
          {results.map(etab => (
            <button
              key={etab.id}
              onClick={() => { onSelect({ id: etab.id, nom: etab.nom }); onClose(); }}
              className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl border border-gray-200 hover:border-amber-300 text-left"
            >
              <School className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{etab.nom}</p>
                <p className="text-xs text-gray-500 truncate">
                  {[etab.ville, etab.type_etablissement].filter(Boolean).join(' · ')}
                  {etab.distance_km !== undefined && ` · ${etab.distance_km.toFixed(1)} km`}
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Page principale ─── */
const LivreScolaireHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { enfants, addEnfant, updateEnfant, removeEnfant, countByEnfant, totalItems } = useParentShop();

  const [livres, setLivres] = useState<LivreScolaire[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [ecolePickerEnfantId, setEcolePickerEnfantId] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
      () => {}
    );
  }, []);

  const loadNearbyBooks = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: '12', offset: '0' });
      if (gps) {
        params.set('gps_lat', gps.lat.toString());
        params.set('gps_lon', gps.lon.toString());
        params.set('rayon_km', '20');
      }
      const res = await apiGet(`/api/bourse-livre/search?${params}`, { isAuthenticated: false });
      const data = await res.json();
      const items = (data?.data?.livres || data?.livres || []).map((item: any) => ({
        ...(item.livre || item),
        distance_km: item.distance_km,
      }));
      setLivres(items);
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gps]);

  useEffect(() => { loadNearbyBooks(); }, [gps]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-amber-600 via-amber-500 to-amber-400">
      {ecolePickerEnfantId && (() => {
        const enfant = enfants.find(e => e.id === ecolePickerEnfantId);
        if (!enfant) return null;
        return (
          <EcolePickerPopover
            currentNom={enfant.etablissementNom}
            gps={gps}
            onClose={() => setEcolePickerEnfantId(null)}
            onSelect={({ id, nom }) => {
              updateEnfant(enfant.id, { etablissementId: id, etablissementNom: nom });
              toast({ title: 'École liée', description: nom });
            }}
          />
        );
      })()}

      {showAddModal && (
        <AddEnfantModal
          onClose={() => setShowAddModal(false)}
          gps={gps}
          alreadyAdded={enfants.map(e => ({
            fullName: e.classe,
            systemeId: e.systemeId ?? (e.systeme === 'anglophone' ? 'CM-en' : 'CM-fr'),
          }))}
          onAdd={(selections) => {
            selections.forEach((sel) => {
              addEnfant({
                prenom: sel.fullName,
                systeme: sel.systemeLabel.toLowerCase().includes('anglo') ? 'anglophone' : 'francophone',
                niveau: sel.niveau,
                classe: sel.fullName,
                pays: sel.pays,
                serie: sel.serie,
                systemeId: sel.systemeId,
              });
            });
            setShowAddModal(false);
          }}
        />
      )}

      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-white">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <BookOpen className="w-7 h-7" />
            <h1 className="text-2xl font-bold">Bourse du Livre</h1>
          </div>
          {totalItems > 0 && (
            <button
              onClick={() => navigate('/recap')}
              className="relative flex items-center gap-1.5 bg-white/20 backdrop-blur-sm px-3 py-2 rounded-full"
            >
              <ShoppingCart className="w-4 h-4 text-white" />
              <span className="text-white text-sm font-semibold">{totalItems}</span>
            </button>
          )}
        </div>
        <p className="text-amber-100 text-sm">Organisez les fournitures classe par classe</p>
      </div>

      <div className="bg-white rounded-t-3xl min-h-screen px-4 pt-5 pb-28">

        {/* ── Section MES ENFANTS (hero parent) ── */}
        <div className="mb-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-bold text-gray-800">Mes classes</p>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-xs font-semibold text-amber-700"
            >
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>

          {enfants.length === 0 ? (
            <button
              onClick={() => setShowAddModal(true)}
              className="w-full flex flex-col items-center py-7 bg-amber-50 border-2 border-dashed border-amber-200 rounded-2xl"
            >
              <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-2">
                <User className="w-6 h-6 text-amber-500" />
              </div>
              <p className="text-sm font-semibold text-amber-700">Ajouter une première classe</p>
              <p className="text-xs text-amber-500 mt-0.5">Choisissez la classe pour voir les manuels</p>
            </button>
          ) : (
            <div className="space-y-2.5">
              {enfants.map(enfant => {
                const count = countByEnfant(enfant.id);
                return (
                  <div
                    key={enfant.id}
                    className="bg-white border border-gray-100 shadow-sm rounded-2xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-amber-700" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 text-sm truncate">{enfant.classe}</p>
                        <p className="text-xs text-gray-500 truncate">
                          {enfant.niveau}
                          {enfant.etablissementNom && <> · <span className="text-amber-600">{enfant.etablissementNom}</span></>}
                        </p>
                      </div>
                      {count > 0 && (
                        <span className="bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                          {count}
                        </span>
                      )}
                      <button
                        onClick={() => navigate(`/parent-selection?enfantId=${enfant.id}`)}
                        className="flex items-center gap-1 px-3 py-1.5 bg-amber-500 text-white rounded-xl text-xs font-semibold shrink-0"
                      >
                        Gérer <ChevronRight className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => removeEnfant(enfant.id)}
                        className="p-1.5 rounded-full bg-gray-100 ml-1"
                      >
                        <X className="w-3 h-3 text-gray-400" />
                      </button>
                    </div>

                    {/* Action row per class : Scanner + École */}
                    <div className="flex gap-2 mt-2.5 pt-2.5 border-t border-gray-100">
                      <button
                        onClick={() => navigate(`/scan-programme?enfantId=${enfant.id}`)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-xs font-semibold text-indigo-700 active:bg-indigo-100"
                      >
                        <Camera className="w-3.5 h-3.5" /> Scanner
                      </button>
                      <button
                        onClick={() => setEcolePickerEnfantId(enfant.id)}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-amber-50 border border-amber-200 rounded-xl text-xs font-semibold text-amber-700 active:bg-amber-100 min-w-0"
                      >
                        <School className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate">{enfant.etablissementNom ? 'Changer école' : 'École ▾'}</span>
                        {enfant.etablissementNom && <Check className="w-3 h-3 text-amber-600 shrink-0" />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* CTA global si enfants */}
              <button
                onClick={() => navigate('/parent-selection')}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-white rounded-2xl font-semibold text-sm mt-1"
              >
                <ShoppingCart className="w-4 h-4" />
                Gérer tous les achats
                {totalItems > 0 && (
                  <span className="bg-white text-amber-600 text-xs font-bold px-2 py-0.5 rounded-full ml-1">
                    {totalItems} sélectionné{totalItems > 1 ? 's' : ''}
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* ── Scan programme ── */}
        <button
          onClick={() => navigate('/scan-programme')}
          className="w-full flex items-center gap-4 bg-indigo-50 border-2 border-indigo-200 rounded-2xl px-4 py-4 active:bg-indigo-100 text-left mb-4"
        >
          <div className="w-11 h-11 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Camera className="w-6 h-6 text-indigo-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-indigo-800 text-sm leading-tight">Scanner une liste de classe</p>
            <p className="text-xs text-indigo-500 mt-0.5">Photo du programme → sélectionnez ce que vous voulez</p>
          </div>
          <span className="shrink-0 bg-indigo-100 text-indigo-600 text-xs font-bold px-2 py-1 rounded-lg">IA</span>
        </button>

        {/* ── Divider rôles ── */}
        <div className="relative flex items-center gap-2 mb-4">
          <div className="flex-1 h-px bg-gray-100" />
          <span className="text-xs text-gray-400 font-medium">Autres rôles</span>
          <div className="flex-1 h-px bg-gray-100" />
        </div>

        {/* Rôles secondaires */}
        <div className="flex gap-2 mb-5">
          <button
            onClick={() => navigate('/etablissement')}
            className="flex-1 flex items-center gap-2 py-3 px-3 bg-white border border-gray-200 rounded-2xl text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
              <School className="w-4 h-4 text-amber-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 leading-tight">Établissement</p>
              <p className="text-xs text-gray-400 truncate">Déposer liste manuels</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/livreur')}
            className="flex-1 flex items-center gap-2 py-3 px-3 bg-white border border-gray-200 rounded-2xl text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-teal-100 flex items-center justify-center shrink-0">
              <Truck className="w-4 h-4 text-teal-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 leading-tight">Livreur</p>
              <p className="text-xs text-gray-400 truncate">Tableau de bord</p>
            </div>
          </button>
          <button
            onClick={() => navigate('/nouveau')}
            className="flex-1 flex items-center gap-2 py-3 px-3 bg-white border border-gray-200 rounded-2xl text-left"
          >
            <div className="w-8 h-8 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
              <Package className="w-4 h-4 text-emerald-700" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-800 leading-tight">Vendre</p>
              <p className="text-xs text-gray-400 truncate">Mettre en vente</p>
            </div>
          </button>
        </div>

        {/* Quick chips */}
        <div className="mb-5">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { label: 'Récapitulatif', icon: ShoppingCart, route: '/recap' },
              { label: 'Troc', icon: RepeatIcon, route: '/trocs/mes-trocs' },
              { label: 'Mes besoins', icon: HeartHandshake, route: '/search' },
              { label: 'Comparer', icon: Scale, route: '/search' },
            ].map(chip => (
              <button
                key={chip.label}
                onClick={() => navigate(chip.route)}
                className="shrink-0 flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-full text-xs font-medium text-gray-600"
              >
                <chip.icon className="w-3.5 h-3.5 text-amber-600" />
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Livres disponibles ── */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm">
              {gps ? 'Livres disponibles près de vous' : 'Livres disponibles'}
            </h2>
            <button onClick={() => { setRefreshing(true); loadNearbyBooks(); }} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 text-amber-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : livres.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center">
              <BookOpen className="w-10 h-10 text-gray-200 mb-2" />
              <p className="text-gray-400 text-sm">Aucun livre disponible pour le moment</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {livres.map((livre, i) => (
                <div
                  key={livre.id || i}
                  className="flex gap-3 p-3 bg-white rounded-2xl border border-gray-100 shadow-sm cursor-pointer"
                  onClick={() => navigate(`/${livre.id}`)}
                >
                  {livre.images_urls?.[0] ? (
                    <img src={livre.images_urls[0]} alt={livre.titre} className="w-14 h-18 object-cover rounded-xl shrink-0" style={{ height: 72 }} />
                  ) : (
                    <div className="w-14 bg-amber-50 rounded-xl flex items-center justify-center shrink-0" style={{ height: 72 }}>
                      <BookOpen className="w-6 h-6 text-amber-300" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <p className="font-semibold text-gray-900 text-sm leading-tight line-clamp-2">{livre.titre}</p>
                      {livre.etat_livre && (
                        <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${etatColor(livre.etat_livre)}`}>
                          {livre.etat_livre}
                        </span>
                      )}
                    </div>
                    {livre.matiere && <p className="text-xs text-gray-500">{livre.matiere}</p>}
                    {livre.classe_actuelle && (
                      <p className="text-xs text-amber-600 font-medium">{livre.classe_actuelle}</p>
                    )}
                    {(livre.quartier || livre.ville || livre.distance_km !== undefined) && (
                      <p className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-3 h-3" />
                        {[livre.quartier, livre.ville].filter(Boolean).join(', ')}
                        {livre.distance_km !== undefined &&
                          ` · ${livre.distance_km < 1 ? `${Math.round(livre.distance_km * 1000)}m` : `${livre.distance_km.toFixed(1)} km`}`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LivreScolaireHomePage;
