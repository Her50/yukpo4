// ✅ Portail Admin Établissement (CMS)
// Date : 2026-05-07
//
// Login obligatoire. Le gérant peut éditer les 10 blocs CMS de la page de
// son établissement, publier/dépublier, gérer annonces et événements,
// consulter les statistiques d'audience.

import {
  ArrowLeft, BarChart3, BookOpen, Bus, Calendar, Camera, Check, ChevronRight, Coffee, Copy, Edit2,
  ExternalLink, FileText, GraduationCap, Home as HomeIcon, Info, Loader2, LogOut, Megaphone,
  Paperclip, Phone, Plus, Save, School, Settings, Shirt, ShoppingCart, Sparkles, Trophy, Upload, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { isGuestAccount } from '../../hooks/useGuestAuth';
import { apiDelete, apiGet, apiPost, apiPut } from '../../services/apiService';
import { CYCLES, CycleId, SystemeScolaireDB } from '../../data/etablissementSetup';
import { LISTE_PAYS_UNIQUES, PaysCode } from '../../data/schoolSystems';

const TYPES_BLOCS = [
  'inscription', 'transport', 'cantine', 'perisco', 'internat',
  'uniforme', 'calendrier', 'annonces', 'contacts', 'laureats',
] as const;

const TYPE_ICONS: Record<string, any> = {
  inscription: FileText,
  transport: Bus,
  cantine: Coffee,
  perisco: Trophy,
  internat: HomeIcon,
  uniforme: Shirt,
  calendrier: Calendar,
  annonces: Megaphone,
  contacts: Phone,
  laureats: GraduationCap,
};

interface MyEtab {
  id: number;
  nom_etablissement: string;
  nom_abrege?: string | null;
  slug: string | null;
  type_etablissement: string | null;
  pays?: string | null;
  ville: string | null;
  quartier: string | null;
  systeme_scolaire?: SystemeScolaireDB | null;
  cycles_offerts?: string[];
  logo_url: string | null;
  banniere_url: string | null;
  page_status: string;
  page_published_at: string | null;
  qr_code_url: string | null;
  stats_views_30d: number;
  my_role?: 'owner' | 'manager' | 'editor' | 'viewer' | null;
}

// Hiérarchie des rôles : owner ≥ manager > editor > viewer.
function hasRole(my: MyEtab['my_role'], min: 'manager' | 'editor' | 'viewer'): boolean {
  const rank = (r?: string | null) => {
    if (r === 'owner' || r === 'manager') return 3;
    if (r === 'editor') return 2;
    if (r === 'viewer') return 1;
    return 0;
  };
  const need = min === 'manager' ? 3 : min === 'editor' ? 2 : 1;
  return rank(my || undefined) >= need;
}

// ============================================================================
// 1. Page d'entrée du portail (liste des établissements gérés)
// ============================================================================
export const EtablissementPortalHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [etabs, setEtabs] = useState<MyEtab[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const isGuest = isGuestAccount();
  // Le bouton "Nouvel établissement de démo" est réservé aux admins Yukpo
  // (et masqué pour les directeurs d'école qui ont déjà déclaré leur école).
  const isYukpoAdmin = (user?.role || '').toLowerCase() === 'admin'
    || (user?.role || '').toLowerCase() === 'super_admin';

  useEffect(() => {
    // Attendre la fin du chargement de l'auth — sinon double redirection
    if (authLoading) return;
    // Pas de double-redirect : RequireAuth gère déjà le cas !user.
    // On charge simplement les établissements pour l'utilisateur connecté.
    if (!user || isGuest) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const res = await apiGet('/api/v2/admin/etablissement/mes-etablissements');
        const d = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
        setEtabs(Array.isArray(d?.etablissements) ? d.etablissements : []);
      } catch (e: any) {
        setError(e?.message || t('common.error'));
      } finally {
        setLoading(false);
      }
    })();
  }, [user, authLoading, isGuest, t]);

  // Mode invité : afficher un écran d'invitation à créer un vrai compte
  if (!authLoading && isGuest) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
          <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
            <ArrowLeft className="w-5 h-5 text-gray-700" />
          </button>
          <h1 className="text-base font-bold text-gray-900 flex-1">
            {t('etabAdmin.portal.title')}
          </h1>
        </div>
        <div className="p-6 text-center">
          <School className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
          <p className="text-base font-semibold text-gray-900 mb-2">
            Connexion requise
          </p>
          <p className="text-sm text-gray-500 mb-6">
            L'espace établissement nécessite un compte Yukpo non-invité.
            Créez votre compte ou connectez-vous pour continuer.
          </p>
          <button
            onClick={() => navigate('/login?redirect=/etablissement-portal')}
            className="px-6 py-3 bg-emerald-600 text-white text-sm font-bold rounded-full"
          >
            Se connecter / S'inscrire
          </button>
        </div>
      </div>
    );
  }

  const createDemo = async () => {
    const nom = window.prompt('Nom de l\'établissement de démo :', 'Collège Bilingue La Gaieté');
    if (!nom?.trim()) return;
    try {
      const res = await apiPost('/api/v2/admin/etablissement/create-demo', {
        nom_etablissement: nom.trim(),
        ville: 'Douala',
        quartier: 'Yassa',
        type_etablissement: 'secondaire',
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || d?.error || `HTTP ${res.status}`);
      toast({ title: 'Établissement de démo créé', description: nom });
      window.location.reload();
    } catch (e: any) {
      toast({
        title: 'Erreur',
        description: e?.message || 'Impossible de créer la démo',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2">
        <button onClick={() => navigate('/')} className="p-2 -ml-2 rounded-full hover:bg-gray-100">
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900 flex-1">
          {t('etabAdmin.portal.title')}
        </h1>
      </div>

      <div className="p-4 space-y-3">
        {loading && (
          <p className="text-center text-sm text-gray-400 py-8">{t('common.loading')}</p>
        )}
        {error && <p className="text-sm text-red-600 text-center py-4">{error}</p>}

        {!loading && etabs.length === 0 && (
          <div className="text-center py-12 px-4">
            <School className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-base font-semibold text-gray-700 mb-2">
              {t('etabAdmin.portal.no_etab')}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              {isYukpoAdmin
                ? t('etabAdmin.portal.claim_help')
                : "Cliquez ci-dessous pour déclarer votre établissement scolaire et créer sa page officielle."}
            </p>
            <button
              onClick={createDemo}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-full"
            >
              <Plus className="w-4 h-4" />
              {isYukpoAdmin
                ? "Créer un établissement de démo (admin)"
                : "Déclarer mon établissement"}
            </button>
          </div>
        )}

        {etabs.length > 0 && (
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
            {t('etabAdmin.portal.my_etabs')}
          </p>
        )}

        {etabs.length > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-3 mb-3">
            <p className="text-xs text-emerald-800 leading-relaxed">
              {t('etabAdmin.portal.click_help')}
            </p>
          </div>
        )}

        {etabs.map(e => (
          <button
            key={e.id}
            onClick={() => navigate(`/etablissement-portal/${e.id}`)}
            className="w-full bg-white p-4 rounded-2xl border-2 border-emerald-100 hover:border-emerald-400 active:bg-emerald-50 text-left flex items-center gap-3 shadow-sm"
          >
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0 overflow-hidden">
              {e.logo_url ? (
                <img src={e.logo_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <School className="w-6 h-6 text-emerald-700" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-gray-900 truncate">
                {e.nom_etablissement}
              </p>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    e.page_status === 'published'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {e.page_status === 'published' ? t('etabAdmin.dashboard.published') : t('etabAdmin.dashboard.draft')}
                </span>
                {e.my_role && e.my_role !== 'owner' && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-violet-100 text-violet-700">
                    {e.my_role === 'manager'
                      ? '👤 Gestionnaire'
                      : e.my_role === 'editor'
                        ? '✏️ Éditeur'
                        : '👁 Consultation'}
                  </span>
                )}
                {(e.quartier || e.ville) && (
                  <span className="text-xs text-gray-500">
                    {[e.quartier, e.ville].filter(Boolean).join(', ')}
                  </span>
                )}
              </div>
              <p className="text-xs text-emerald-700 font-semibold mt-1.5 flex items-center gap-1">
                Configurer la page
                <ChevronRight className="w-3.5 h-3.5" />
              </p>
            </div>
            <div className="shrink-0 w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center">
              <ChevronRight className="w-5 h-5" />
            </div>
          </button>
        ))}

        {/* Bouton "Nouvel établissement" : visible UNIQUEMENT pour les admins
            Yukpo (test/démo). Les directeurs d'école n'ont normalement qu'un
            seul établissement à gérer, donc on masque ce bouton pour eux. */}
        {etabs.length > 0 && isYukpoAdmin && (
          <button
            onClick={createDemo}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-emerald-300 text-emerald-700 text-sm font-semibold rounded-full"
          >
            <Plus className="w-4 h-4" />
            Nouvel établissement de démo (admin)
          </button>
        )}

        {/* Outils admin Yukpo */}
        {isYukpoAdmin && (
          <div className="mt-4 bg-amber-50 border border-amber-200 rounded-2xl p-3">
            <p className="text-[10px] font-bold text-amber-800 uppercase tracking-wide mb-2">
              Outils admin Yukpo
            </p>
            <button
              onClick={() => navigate('/admin-yukpo/programme-national/import')}
              className="w-full inline-flex items-center justify-between gap-2 px-4 py-2.5 bg-white border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl"
            >
              <span className="flex items-center gap-2">
                <Upload className="w-3.5 h-3.5" />
                Importer un programme national (CSV)
              </span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// ============================================================================
// 2. Dashboard d'un établissement
// ============================================================================
interface BlocCMS {
  id: number;
  type_bloc: string;
  titre: string | null;
  contenu_json: any;
  medias_urls: string[] | null;
  position: number;
  is_active: boolean;
}

export const EtablissementDashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const { etabId = '' } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useTranslation();
  const { toast } = useToast();
  const [etab, setEtab] = useState<MyEtab | null>(null);
  const [blocs, setBlocs] = useState<BlocCMS[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);
  const [showIaUpload, setShowIaUpload] = useState(false);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [etabsRes, blocsRes, statsRes] = await Promise.all([
        apiGet('/api/v2/admin/etablissement/mes-etablissements'),
        apiGet(`/api/v2/admin/etablissement/${etabId}/blocs`),
        apiGet(`/api/v2/admin/etablissement/${etabId}/stats`),
      ]);
      const etabData = await etabsRes.json().catch(() => ({}));
      const blocsData = await blocsRes.json().catch(() => ({}));
      const statsData = await statsRes.json().catch(() => ({}));
      const list: MyEtab[] = etabData?.etablissements || [];
      setEtab(list.find(x => String(x.id) === etabId) || null);
      setBlocs(Array.isArray(blocsData?.blocs) ? blocsData.blocs : []);
      setStats(statsData);
    } finally {
      setLoading(false);
    }
  }, [etabId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-ouverture de la modale config / IA depuis un query param
  // (utilisé par la page Liste scolaire pour orienter vers la config).
  useEffect(() => {
    if (searchParams.get('config') === 'open') {
      setShowConfig(true);
      searchParams.delete('config');
      setSearchParams(searchParams, { replace: true });
    }
    if (searchParams.get('ia') === 'open') {
      setShowIaUpload(true);
      searchParams.delete('ia');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  const publier = async () => {
    try {
      const res = await apiPost(`/api/v2/admin/etablissement/${etabId}/publier`, {});
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      toast({ title: 'Page publiée' });
      load();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    }
  };

  const copyLink = () => {
    if (!etab?.slug) return;
    const url = `${window.location.origin}/ecole/${etab.slug}`;
    navigator.clipboard.writeText(url);
    toast({ title: 'Lien copié' });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-emerald-600" />
      </div>
    );
  }
  if (!etab) {
    return (
      <div className="p-8 text-center">
        <p className="text-sm text-gray-500">{t('etabAdmin.dashboard.not_found')}</p>
        <button onClick={() => navigate('/etablissement-portal')} className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-full text-sm">
          {t('etabAdmin.dashboard.back')}
        </button>
      </div>
    );
  }

  const blocsByType = new Map(blocs.map(b => [b.type_bloc, b]));
  const publicUrl = etab.slug ? `${window.location.origin}/ecole/${etab.slug}` : '';

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <div className="bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-2 sticky top-0 z-10">
        <button
          onClick={() => navigate('/etablissement-portal')}
          className="p-2 -ml-2 rounded-full hover:bg-gray-100 shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-gray-700" />
        </button>
        <h1 className="text-base font-bold text-gray-900 truncate flex-1 min-w-0">
          {etab.nom_etablissement}
        </h1>
        {hasRole(etab.my_role, 'manager') && (
          <button
            onClick={() => setShowConfig(true)}
            className="p-2 rounded-full hover:bg-gray-100 shrink-0"
            aria-label="Configuration"
            title="Configuration de l'établissement"
          >
            <Settings className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <span
          className={`text-[10px] px-2 py-1 rounded-full font-semibold whitespace-nowrap shrink-0 ${
            etab.page_status === 'published'
              ? 'bg-emerald-100 text-emerald-700'
              : 'bg-amber-100 text-amber-700'
          }`}
        >
          {etab.page_status === 'published' ? t('etabAdmin.dashboard.published') : t('etabAdmin.dashboard.draft')}
        </span>
      </div>

      <div className="p-3 sm:p-4 max-w-3xl mx-auto space-y-3 sm:space-y-4">
        {/* URL publique */}
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
            {t('etabAdmin.dashboard.page_url')}
          </p>
          <div className="flex items-center gap-2 mb-3">
            <input
              readOnly
              value={publicUrl}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700"
            />
            <button
              onClick={copyLink}
              className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"
              aria-label={t('etabAdmin.dashboard.copy_link')}
            >
              <Copy className="w-4 h-4" />
            </button>
            {etab.slug && (
              <a
                href={publicUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 bg-emerald-500 text-white rounded-lg"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
            )}
          </div>
          {etab.page_status !== 'published' && (
            <button
              onClick={publier}
              className="w-full bg-emerald-500 text-white py-2.5 rounded-xl text-sm font-semibold"
            >
              {t('etabAdmin.dashboard.publish')}
            </button>
          )}
        </div>

        {/* CTA Liste scolaire — gestion des programmes par classe */}
        <button
          onClick={() => navigate(`/etablissement-portal/${etabId}/liste-scolaire`)}
          className="w-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white p-4 rounded-2xl shadow-md flex items-center gap-3 active:from-emerald-700 active:to-teal-700"
        >
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <BookOpen className="w-6 h-6" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm">Liste scolaire</p>
            <p className="text-xs text-emerald-50 mt-0.5 leading-relaxed">
              Configurer les livres, cahiers et fournitures par classe
            </p>
          </div>
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* CTA IA — pré-remplissage automatique des blocs */}
        <button
          onClick={() => setShowIaUpload(true)}
          className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white p-4 rounded-2xl shadow-md flex items-center gap-3 active:from-violet-700 active:to-fuchsia-700"
        >
          <div className="w-11 h-11 bg-white/20 rounded-xl flex items-center justify-center shrink-0">
            <Sparkles className="w-6 h-6" />
          </div>
          <div className="flex-1 text-left">
            <p className="font-bold text-sm">{t('etabAdmin.ia.cta_title')}</p>
            <p className="text-xs text-violet-100 mt-0.5 leading-relaxed">
              {t('etabAdmin.ia.cta_desc')}
            </p>
          </div>
          <ChevronRight className="w-5 h-5" />
        </button>

        {/* Statistiques */}
        {stats && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-3">
              {t('etabAdmin.dashboard.stats_30d')}
            </p>
            <div className="grid grid-cols-3 gap-2">
              <StatCard
                label={t('etabAdmin.dashboard.visites')}
                value={stats.total_visites_30d || 0}
                color="indigo"
              />
              <StatCard
                label={t('etabAdmin.dashboard.clics_commande')}
                value={stats.total_clics_commande_30d || 0}
                color="emerald"
              />
              <StatCard
                label={t('etabAdmin.dashboard.clics_infos')}
                value={stats.total_clics_infos_30d || 0}
                color="amber"
              />
            </div>
          </div>
        )}

        {/* Équipe — visible uniquement aux managers/owners */}
        {hasRole(etab.my_role, 'manager') && (
          <TeamSection etabId={etabId} etabNom={etab.nom_etablissement} />
        )}

        {/* Liste des 10 blocs CMS */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide px-1">
            Blocs de la page établissement
          </p>
          {TYPES_BLOCS.map(typ => {
            const b = blocsByType.get(typ);
            const Icon = TYPE_ICONS[typ];
            const isFilled = !!b && Object.keys(b.contenu_json || {}).length > 0;
            return (
              <button
                key={typ}
                onClick={() => setEditingType(typ)}
                className="w-full bg-white p-3.5 rounded-2xl border border-gray-100 active:bg-gray-50 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
                  <Icon className="w-5 h-5 text-emerald-700" />
                </div>
                <div className="flex-1 text-left">
                  <p className="text-sm font-semibold text-gray-900">
                    {t(`bourse.infos.sections.${typ}`)}
                  </p>
                  <p className="text-xs text-gray-500">
                    {isFilled ? '✅ Rempli' : 'À remplir'}
                    {b && !b.is_active && ' · Désactivé'}
                  </p>
                </div>
                <Edit2 className="w-4 h-4 text-gray-400" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal édition bloc */}
      {editingType && (
        <BlocEditModal
          etabId={etabId}
          typeBloc={editingType}
          existingBloc={blocs.find(b => b.type_bloc === editingType) || null}
          onClose={() => setEditingType(null)}
          onSaved={() => {
            setEditingType(null);
            load();
          }}
        />
      )}

      {/* Modal Upload IA */}
      {showIaUpload && (
        <IaUploadModal
          etabId={etabId}
          onClose={() => setShowIaUpload(false)}
          onSuccess={() => {
            setShowIaUpload(false);
            load();
          }}
        />
      )}

      {/* Modal configuration établissement */}
      {showConfig && etab && (
        <EtablissementConfigModal
          etab={etab}
          onClose={() => setShowConfig(false)}
          onSaved={() => { setShowConfig(false); load(); }}
        />
      )}
    </div>
  );
};

// ============================================================================
// Modal d'upload IA — multi-fichiers (PDF, image, Word, Excel)
// ============================================================================
const IaUploadModal: React.FC<{
  etabId: string;
  onClose: () => void;
  onSuccess: () => void;
}> = ({ etabId, onClose, onSuccess }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const cameraInputRef = React.useRef<HTMLInputElement>(null);
  const galleryInputRef = React.useRef<HTMLInputElement>(null);
  const documentInputRef = React.useRef<HTMLInputElement>(null);

  const handleFiles = (list: FileList | null, append = true) => {
    if (!list) return;
    const arr = Array.from(list);
    setFiles(prev => {
      const merged = append ? [...prev, ...arr] : arr;
      return merged.slice(0, 12);
    });
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const submit = async () => {
    if (files.length === 0) {
      toast({ title: t('etabAdmin.ia.no_files'), variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const fichiers = await Promise.all(
        files.map(async (f) => ({
          nom: f.name,
          file_type: f.type || null,
          base64: await fileToBase64(f),
        }))
      );
      const token = localStorage.getItem('token');
      // Timeout long côté front : 6 min pour traiter plusieurs fichiers
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 360_000);
      const res = await fetch(`/api/v2/admin/etablissement/${etabId}/ia-extract`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ fichiers }),
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d?.message || d?.error || `HTTP ${res.status}`);
      }
      setResult(d);
      toast({
        title: t('etabAdmin.ia.success_title'),
        description: `${d.blocs_saved} blocs · ${d.events_saved} events · ${d.articles_saved} articles`,
      });
    } catch (e: any) {
      const msg = e?.name === 'AbortError'
        ? t('etabAdmin.ia.timeout_error')
        : e?.message || t('etabAdmin.ia.error');
      toast({ title: t('librairie.error'), description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-600" />
          <p className="font-bold text-gray-900 flex-1">{t('etabAdmin.ia.modal_title')}</p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-xs text-gray-600 leading-relaxed bg-violet-50 border border-violet-200 rounded-xl p-3">
            {t('etabAdmin.ia.tip')}
          </p>

          {!result && (
            <>
              {/* Trois sources d'import explicites — évite que le navigateur mobile
                  force la caméra par défaut quand `accept` mêle image/* et autres types */}
              <div className="grid grid-cols-3 gap-2">
                <label className="flex flex-col items-center gap-1.5 py-4 bg-white border-2 border-dashed border-violet-300 rounded-2xl cursor-pointer active:bg-violet-50 text-center">
                  <Camera className="w-5 h-5 text-violet-600" />
                  <span className="text-xs text-violet-700 font-semibold">Caméra</span>
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                  />
                </label>
                <label className="flex flex-col items-center gap-1.5 py-4 bg-white border-2 border-dashed border-blue-300 rounded-2xl cursor-pointer active:bg-blue-50 text-center">
                  <Upload className="w-5 h-5 text-blue-600" />
                  <span className="text-xs text-blue-700 font-semibold">Galerie</span>
                  <input
                    ref={galleryInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                  />
                </label>
                <label className="flex flex-col items-center gap-1.5 py-4 bg-white border-2 border-dashed border-fuchsia-300 rounded-2xl cursor-pointer active:bg-fuchsia-50 text-center">
                  <Paperclip className="w-5 h-5 text-fuchsia-600" />
                  <span className="text-xs text-fuchsia-700 font-semibold">PDF / Word / Excel</span>
                  <input
                    ref={documentInputRef}
                    type="file"
                    accept="application/pdf,.pdf,application/msword,.doc,application/vnd.openxmlformats-officedocument.wordprocessingml.document,.docx,application/vnd.ms-excel,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,.xlsx"
                    multiple
                    className="hidden"
                    onChange={e => { handleFiles(e.target.files); e.target.value = ''; }}
                  />
                </label>
              </div>
              <p className="text-[11px] text-gray-500 text-center -mt-1">
                {t('etabAdmin.ia.upload_help')}
              </p>

              {files.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-bold text-gray-600 uppercase tracking-wide">
                    {t(files.length > 1 ? 'etabAdmin.ia.files_selected_other' : 'etabAdmin.ia.files_selected_one', { count: files.length })}
                  </p>
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2"
                    >
                      <FileText className="w-4 h-4 text-violet-500 shrink-0" />
                      <span className="text-xs text-gray-700 flex-1 truncate">{f.name}</span>
                      <span className="text-[10px] text-gray-400 shrink-0">
                        {Math.round(f.size / 1024)} Ko
                      </span>
                      <button
                        onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                        className="p-1 rounded text-gray-400 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                onClick={submit}
                disabled={loading || files.length === 0}
                className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-600 disabled:opacity-50 text-white py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t('etabAdmin.ia.analyzing')}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {t('etabAdmin.ia.analyze_button')}
                  </>
                )}
              </button>
            </>
          )}

          {result && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm font-bold text-emerald-800 mb-2">
                  {t('etabAdmin.ia.success_title')}
                </p>
                <ul className="text-xs text-emerald-700 space-y-1">
                  <li>{t('etabAdmin.ia.success_blocs', { count: result.blocs_saved })}</li>
                  <li>{t('etabAdmin.ia.success_events', { count: result.events_saved })}</li>
                  <li>{t('etabAdmin.ia.success_annonces', { count: result.annonces_saved })}</li>
                  <li>{t('etabAdmin.ia.success_articles', { count: result.articles_saved })}</li>
                  {result.confidence != null && (
                    <li>{t('etabAdmin.ia.success_confidence', { percent: Math.round(result.confidence * 100) })}</li>
                  )}
                </ul>
                {result.notes && (
                  <p className="text-[11px] text-emerald-700 italic mt-2">{result.notes}</p>
                )}
              </div>
              <p className="text-xs text-gray-500 leading-relaxed">
                {t('etabAdmin.ia.success_help')}
              </p>
              <button
                onClick={onSuccess}
                className="w-full bg-emerald-600 text-white py-3 rounded-xl font-bold text-sm"
              >
                {t('etabAdmin.ia.view_result')}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => {
  const bg: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700',
    emerald: 'bg-emerald-50 text-emerald-700',
    amber: 'bg-amber-50 text-amber-700',
  };
  return (
    <div className={`${bg[color]} rounded-xl p-3 text-center`}>
      <p className="text-2xl font-bold">{value.toLocaleString('fr-FR')}</p>
      <p className="text-[10px] uppercase tracking-wide font-semibold mt-1">{label}</p>
    </div>
  );
};

// ============================================================================
// 3. Modal d'édition d'un bloc CMS (formulaire générique JSON)
// ============================================================================
const BLOC_FIELDS: Record<string, { key: string; label: string; type: 'text' | 'textarea' | 'number' | 'list' }[]> = {
  inscription: [
    { key: 'frais_inscription', label: 'Frais d\'inscription (FCFA)', type: 'number' },
    { key: 'frais_scolarite_annuel', label: 'Frais scolarité annuels (FCFA)', type: 'number' },
    { key: 'modalites_paiement', label: 'Modalités de paiement', type: 'textarea' },
    { key: 'documents_requis', label: 'Documents requis (un par ligne)', type: 'list' },
  ],
  transport: [
    { key: 'lignes', label: 'Lignes desservies (une par ligne)', type: 'list' },
    { key: 'tarif_trimestre', label: 'Tarif trimestre (FCFA)', type: 'number' },
    { key: 'tarif_annee', label: 'Tarif année (FCFA)', type: 'number' },
    { key: 'horaires', label: 'Horaires aller/retour', type: 'textarea' },
    { key: 'contact', label: 'Contact responsable transport', type: 'text' },
  ],
  cantine: [
    { key: 'tarif_forfait_mensuel', label: 'Forfait mensuel (FCFA)', type: 'number' },
    { key: 'tarif_ticket', label: 'Prix ticket repas (FCFA)', type: 'number' },
    { key: 'menu_semaine', label: 'Menu de la semaine (un par ligne)', type: 'list' },
    { key: 'regimes_speciaux', label: 'Régimes spéciaux disponibles', type: 'list' },
  ],
  perisco: [
    { key: 'activites', label: 'Activités proposées (une par ligne)', type: 'list' },
    { key: 'tarif_trimestre', label: 'Tarif trimestre (FCFA)', type: 'number' },
    { key: 'horaires', label: 'Jours et horaires', type: 'textarea' },
  ],
  internat: [
    { key: 'tarif_trimestre', label: 'Tarif trimestre (FCFA)', type: 'number' },
    { key: 'tarif_annee', label: 'Tarif année (FCFA)', type: 'number' },
    { key: 'reglement', label: 'Règlement spécifique', type: 'textarea' },
    { key: 'trousseau_requis', label: 'Trousseau requis (un par ligne)', type: 'list' },
  ],
  uniforme: [
    { key: 'description', label: 'Description', type: 'textarea' },
    { key: 'fournisseur', label: 'Fournisseur recommandé', type: 'text' },
    { key: 'tarif_indicatif', label: 'Tarif indicatif (FCFA)', type: 'number' },
  ],
  calendrier: [
    { key: 'note', label: 'Note (les événements sont gérés séparément)', type: 'textarea' },
  ],
  annonces: [
    { key: 'note', label: 'Note (les annonces sont gérées séparément)', type: 'textarea' },
  ],
  contacts: [
    { key: 'secretariat_telephone', label: 'Téléphone secrétariat', type: 'text' },
    { key: 'secretariat_email', label: 'Email secrétariat', type: 'text' },
    { key: 'directeur', label: 'Nom directeur/principal', type: 'text' },
    { key: 'directeur_telephone', label: 'Téléphone directeur', type: 'text' },
    { key: 'vie_scolaire', label: 'Téléphone vie scolaire', type: 'text' },
    { key: 'infirmerie', label: 'Téléphone infirmerie', type: 'text' },
  ],
  laureats: [
    { key: 'description', label: 'Description programme bourses', type: 'textarea' },
    { key: 'partenaires', label: 'Partenaires sponsors (un par ligne)', type: 'list' },
  ],
};

const BlocEditModal: React.FC<{
  etabId: string;
  typeBloc: string;
  existingBloc: BlocCMS | null;
  onClose: () => void;
  onSaved: () => void;
}> = ({ etabId, typeBloc, existingBloc, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fields = BLOC_FIELDS[typeBloc] || [];
  const [values, setValues] = useState<Record<string, any>>(() => {
    const init: Record<string, any> = {};
    const c = existingBloc?.contenu_json || {};
    for (const f of fields) {
      const v = c[f.key];
      if (f.type === 'list') init[f.key] = Array.isArray(v) ? v.join('\n') : '';
      else init[f.key] = v ?? '';
    }
    return init;
  });
  const [titre, setTitre] = useState(existingBloc?.titre || '');
  const [isActive, setIsActive] = useState(existingBloc?.is_active ?? true);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      const contenu_json: Record<string, any> = {};
      for (const f of fields) {
        const v = values[f.key];
        if (f.type === 'list') {
          const items = String(v || '')
            .split('\n')
            .map(s => s.trim())
            .filter(Boolean);
          if (items.length > 0) contenu_json[f.key] = items;
        } else if (f.type === 'number') {
          const n = Number(v);
          if (!isNaN(n) && n > 0) contenu_json[f.key] = n;
        } else {
          if (String(v).trim()) contenu_json[f.key] = String(v).trim();
        }
      }
      const res = await apiPut(
        `/api/v2/admin/etablissement/${etabId}/bloc/${typeBloc}`,
        {
          titre: titre.trim() || null,
          contenu_json,
          is_active: isActive,
        }
      );
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      toast({ title: 'Bloc enregistré' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <p className="font-bold text-gray-900 flex-1">
            {t(`bourse.infos.sections.${typeBloc}`)}
          </p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              Titre (optionnel)
            </label>
            <input
              value={titre}
              onChange={e => setTitre(e.target.value)}
              placeholder="Titre personnalisé"
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            />
          </div>

          {fields.map(f => (
            <div key={f.key}>
              <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                {f.label}
              </label>
              {f.type === 'textarea' || f.type === 'list' ? (
                <textarea
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              ) : (
                <input
                  type={f.type === 'number' ? 'number' : 'text'}
                  value={values[f.key]}
                  onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              )}
            </div>
          ))}

          <label className="flex items-center gap-2 cursor-pointer pt-2">
            <input
              type="checkbox"
              checked={isActive}
              onChange={e => setIsActive(e.target.checked)}
              className="w-4 h-4 accent-emerald-600"
            />
            <span className="text-sm text-gray-700">{t('etabAdmin.blocs.active_label')}</span>
          </label>
        </div>

        <div className="p-5 sticky bottom-0 bg-white border-t border-gray-100 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold"
          >
            {t('etabAdmin.blocs.cancel')}
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {t('etabAdmin.blocs.save')}
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 4. Modale de configuration de l'établissement
//    nom_etablissement, nom_abrege, pays, systeme_scolaire, cycles_offerts
// ============================================================================

const SYSTEMES: { id: SystemeScolaireDB; label: string; emoji: string }[] = [
  { id: 'francophone', label: 'Francophone',          emoji: '🇫🇷' },
  { id: 'anglophone',  label: 'Anglophone',           emoji: '🇬🇧' },
  { id: 'bilingue',    label: 'Bilingue (FR + EN)',   emoji: '🌍' },
];

const EtablissementConfigModal: React.FC<{
  etab: MyEtab;
  onClose: () => void;
  onSaved: () => void;
}> = ({ etab, onClose, onSaved }) => {
  const { toast } = useToast();
  const [nom, setNom] = useState(etab.nom_etablissement || '');
  const [nomAbrege, setNomAbrege] = useState(etab.nom_abrege || '');
  const [pays, setPays] = useState<PaysCode>((etab.pays || 'CM') as PaysCode);
  const [systeme, setSysteme] = useState<SystemeScolaireDB | null>(
    (etab.systeme_scolaire as SystemeScolaireDB) || null,
  );
  const [cycles, setCycles] = useState<Set<CycleId>>(
    new Set((etab.cycles_offerts || []) as CycleId[]),
  );
  const [ville, setVille] = useState(etab.ville || '');
  const [quartier, setQuartier] = useState(etab.quartier || '');
  const [saving, setSaving] = useState(false);

  const toggleCycle = (id: CycleId) => {
    setCycles(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const submit = async () => {
    if (!nom.trim()) {
      toast({ title: 'Nom requis', variant: 'destructive' });
      return;
    }
    if (!systeme) {
      toast({ title: 'Système scolaire requis', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const res = await apiPut(`/api/v2/admin/etablissement/${etab.id}/config`, {
        nom_etablissement: nom.trim(),
        nom_abrege: nomAbrege.trim() || null,
        pays,
        ville: ville.trim() || null,
        quartier: quartier.trim() || null,
        systeme_scolaire: systeme,
        cycles_offerts: Array.from(cycles),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      toast({ title: 'Configuration enregistrée' });
      onSaved();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <Settings className="w-5 h-5 text-emerald-600" />
          <p className="font-bold text-gray-900 flex-1">Configuration de l'établissement</p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Nom + Nom abrégé */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Nom complet *</label>
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Collège Bilingue La Gaieté"
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            />
          </div>
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Nom abrégé (sigle / forme courte populaire)
            </label>
            <input
              value={nomAbrege}
              onChange={e => setNomAbrege(e.target.value)}
              placeholder="CBLG, ENAM, Vogt, Sainte-Thérèse…"
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Permet aux parents de retrouver votre école par son sigle dans la recherche.
            </p>
          </div>

          {/* Pays */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Pays *</label>
            <select
              value={pays}
              onChange={e => setPays(e.target.value as PaysCode)}
              className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
            >
              {LISTE_PAYS_UNIQUES.map(p => (
                <option key={p.code} value={p.code}>{p.emoji} {p.label}</option>
              ))}
            </select>
          </div>

          {/* Ville + Quartier */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Ville</label>
              <input
                value={ville}
                onChange={e => setVille(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
            </div>
            <div>
              <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Quartier</label>
              <input
                value={quartier}
                onChange={e => setQuartier(e.target.value)}
                className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
              />
            </div>
          </div>

          {/* Système scolaire */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">Système scolaire *</label>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {SYSTEMES.map(s => (
                <button
                  key={s.id}
                  onClick={() => setSysteme(s.id)}
                  className={`py-3 px-2 rounded-xl text-xs font-semibold border-2 transition-colors ${
                    systeme === s.id
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-white text-gray-700'
                  }`}
                >
                  <div className="text-lg mb-1">{s.emoji}</div>
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cycles offerts */}
          <div>
            <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
              Cycles offerts *
            </label>
            <p className="mt-1 text-[11px] text-gray-500 mb-2">
              Sélectionnez tous les niveaux dispensés par votre établissement.
            </p>
            <div className="grid grid-cols-2 gap-2">
              {CYCLES.map(c => (
                <button
                  key={c.id}
                  onClick={() => toggleCycle(c.id)}
                  className={`py-2.5 px-3 rounded-xl text-xs font-semibold border-2 text-left ${
                    cycles.has(c.id)
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                      : 'border-gray-200 bg-white text-gray-600'
                  }`}
                >
                  {cycles.has(c.id) && <Check className="w-3 h-3 inline mr-1" />}
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 sticky bottom-0 bg-white border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">
            Annuler
          </button>
          <button
            onClick={submit}
            disabled={saving || !nom.trim() || !systeme || cycles.size === 0}
            className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
};

// ============================================================================
// 5. Section Équipe — invitations WhatsApp avec tracking
// ============================================================================

interface TeamInvitation {
  id: number;
  token: string;
  invitation_path: string;
  role: string | null;
  telephone: string | null;
  nom_affiche: string | null;
  status: 'pending' | 'opened' | 'accepted';
  opened_at: string | null;
  accepted_at: string | null;
  accepted_email: string | null;
  expires_at: string | null;
  created_at: string | null;
}

const ROLES_INVITATION: { id: 'manager' | 'editor' | 'viewer'; label: string; desc: string }[] = [
  { id: 'manager', label: 'Gestionnaire', desc: 'Tous les droits sauf inviter d\'autres gestionnaires' },
  { id: 'editor',  label: 'Éditeur de contenu', desc: 'Peut éditer les blocs et la liste scolaire' },
  { id: 'viewer',  label: 'Consultation',  desc: 'Voit les statistiques sans pouvoir modifier' },
];

const TeamSection: React.FC<{ etabId: string; etabNom: string }> = ({ etabId, etabNom }) => {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<TeamInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet(`/api/v2/admin/etablissement/${etabId}/team/invitations`);
      const d = await res.json().catch(() => ({}));
      setInvitations(Array.isArray(d?.invitations) ? d.invitations : []);
    } finally {
      setLoading(false);
    }
  }, [etabId]);

  useEffect(() => {
    reload();
  }, [reload]);

  const accepted = invitations.filter(i => i.status === 'accepted');
  const pending = invitations.filter(i => i.status !== 'accepted');

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
          Équipe ({accepted.length} membre{accepted.length > 1 ? 's' : ''})
        </p>
        <button
          onClick={() => setShowInvite(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          Inviter un membre
        </button>
      </div>

      {loading && <p className="text-xs text-gray-400 text-center py-3">Chargement…</p>}

      {!loading && invitations.length === 0 && (
        <p className="text-xs text-gray-500 leading-relaxed">
          Aucune invitation envoyée. Cliquez sur « Inviter un membre » pour partager
          un lien WhatsApp avec un collaborateur (gestionnaire, éditeur ou consultation).
        </p>
      )}

      {!loading && invitations.length > 0 && (
        <div className="space-y-2">
          {invitations.map(inv => {
            const link = `${window.location.origin}${inv.invitation_path}`;
            const roleLabel = ROLES_INVITATION.find(r => r.id === inv.role)?.label || inv.role || '—';
            const statusBadge =
              inv.status === 'accepted' ? { color: 'bg-emerald-100 text-emerald-800', text: '✓ Accepté' }
              : inv.status === 'opened' ? { color: 'bg-blue-100 text-blue-800', text: '👁 Ouvert' }
              : { color: 'bg-amber-100 text-amber-800', text: '⏳ En attente' };
            const removeMember = async () => {
              const isAccepted = inv.status === 'accepted';
              const who = inv.nom_affiche || inv.accepted_email || inv.telephone || 'ce membre';
              const msg = isAccepted
                ? `Retirer ${who} de l'équipe ?\n\nCet utilisateur perdra immédiatement l'accès à l'établissement.`
                : `Révoquer l'invitation pour ${who} ?\n\nLe lien WhatsApp partagé deviendra inutilisable.`;
              if (!window.confirm(msg)) return;
              try {
                const res = await apiDelete(`/api/v2/admin/etablissement/${etabId}/team/invitations/${inv.id}`);
                const d = await res.json().catch(() => ({}));
                if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
                toast({ title: isAccepted ? 'Membre retiré' : 'Invitation révoquée' });
                reload();
              } catch (e: any) {
                toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
              }
            };
            return (
              <div key={inv.id} className="flex items-start gap-2 bg-gray-50 rounded-xl p-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {inv.nom_affiche || inv.accepted_email || inv.telephone || 'Sans nom'}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${statusBadge.color}`}>
                      {statusBadge.text}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-500 mt-0.5">{roleLabel}</p>
                  {inv.status !== 'accepted' && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(link);
                        toast({ title: 'Lien copié' });
                      }}
                      className="mt-1 text-[11px] text-emerald-700 font-semibold underline truncate max-w-full text-left"
                    >
                      Copier le lien d'invitation
                    </button>
                  )}
                </div>
                <button
                  onClick={removeMember}
                  className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 shrink-0"
                  aria-label={inv.status === 'accepted' ? 'Retirer le membre' : 'Révoquer l\'invitation'}
                  title={inv.status === 'accepted' ? 'Retirer ce membre de l\'équipe' : 'Révoquer cette invitation'}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
          {pending.length > 0 && (
            <p className="text-[10px] text-gray-400 italic mt-1">
              Les liens en attente expirent au bout de 30 jours.
            </p>
          )}
        </div>
      )}

      {showInvite && (
        <InviteTeamMemberModal
          etabId={etabId}
          etabNom={etabNom}
          onClose={() => setShowInvite(false)}
          onCreated={() => { setShowInvite(false); reload(); }}
        />
      )}
    </div>
  );
};

const InviteTeamMemberModal: React.FC<{
  etabId: string;
  etabNom: string;
  onClose: () => void;
  onCreated: () => void;
}> = ({ etabId, etabNom: _etabNom, onClose, onCreated }) => {
  const { toast } = useToast();
  const [role, setRole] = useState<'manager' | 'editor' | 'viewer'>('editor');
  const [nom, setNom] = useState('');
  const [tel, setTel] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ whatsapp_url: string; invitation_path: string } | null>(null);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await apiPost(`/api/v2/admin/etablissement/${etabId}/team/invitations`, {
        role,
        nom_affiche: nom.trim() || null,
        telephone: tel.trim() || null,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.message || `HTTP ${res.status}`);
      setCreated({
        whatsapp_url: d.whatsapp_url || '',
        invitation_path: d.invitation_path || '',
      });
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg max-h-[92vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="p-5 sticky top-0 bg-white border-b border-gray-100 z-10 flex items-center gap-3">
          <Plus className="w-5 h-5 text-emerald-600" />
          <p className="font-bold text-gray-900 flex-1">Inviter un membre d'équipe</p>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!created && (
            <>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Nom affiché (optionnel)
                </label>
                <input
                  value={nom}
                  onChange={e => setNom(e.target.value)}
                  placeholder="Ex: Mme Mballa"
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Numéro WhatsApp (optionnel)
                </label>
                <input
                  type="tel"
                  value={tel}
                  onChange={e => setTel(e.target.value)}
                  placeholder="+237 6XX XX XX XX"
                  className="w-full mt-1 px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-sm"
                />
                <p className="mt-1 text-[11px] text-gray-500">
                  Sert à pré-remplir le message WhatsApp à envoyer.
                </p>
              </div>

              <div>
                <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wide">
                  Rôle *
                </label>
                <div className="mt-2 space-y-2">
                  {ROLES_INVITATION.map(r => (
                    <button
                      key={r.id}
                      onClick={() => setRole(r.id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-colors ${
                        role === r.id
                          ? 'border-emerald-500 bg-emerald-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {role === r.id && <Check className="w-3.5 h-3.5 text-emerald-700" />}
                        <p className="text-sm font-semibold text-gray-900">{r.label}</p>
                      </div>
                      <p className="text-[11px] text-gray-500 mt-0.5">{r.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {created && (
            <div className="space-y-3">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                <p className="text-sm font-bold text-emerald-800 mb-1">Invitation créée ✓</p>
                <p className="text-xs text-emerald-700 leading-relaxed">
                  Partagez le lien suivant via WhatsApp ou tout autre canal.
                  L'invité créera son compte (s'il n'en a pas) puis acceptera.
                </p>
              </div>
              <div className="bg-gray-50 rounded-xl p-3 break-all">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Lien d'invitation</p>
                <p className="text-xs text-gray-800 font-mono">
                  {window.location.origin}{created.invitation_path}
                </p>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}${created.invitation_path}`);
                  }}
                  className="mt-2 text-xs font-semibold text-emerald-700 underline"
                >
                  Copier le lien
                </button>
              </div>
              {created.whatsapp_url && (
                <a
                  href={created.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full block text-center py-3 bg-green-600 text-white rounded-xl font-bold text-sm"
                >
                  📱 Ouvrir WhatsApp avec le message pré-rempli
                </a>
              )}
            </div>
          )}
        </div>

        <div className="p-5 sticky bottom-0 bg-white border-t border-gray-100 flex gap-2">
          <button onClick={onClose} className="flex-1 py-3 border border-gray-200 rounded-xl text-sm font-semibold">
            {created ? 'Fermer' : 'Annuler'}
          </button>
          {!created && (
            <button
              onClick={submit}
              disabled={submitting}
              className="flex-1 py-3 bg-emerald-500 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Créer l'invitation
            </button>
          )}
          {created && (
            <button onClick={onCreated} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-sm font-bold">
              Terminé
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
