// ✅ Portail Admin Établissement (CMS)
// Date : 2026-05-07
//
// Login obligatoire. Le gérant peut éditer les 10 blocs CMS de la page de
// son établissement, publier/dépublier, gérer annonces et événements,
// consulter les statistiques d'audience.

import {
  ArrowLeft, BarChart3, Bus, Calendar, Check, ChevronRight, Coffee, Copy, Edit2, ExternalLink,
  FileText, GraduationCap, Home as HomeIcon, Info, Loader2, LogOut, Megaphone,
  Phone, Plus, Save, School, Shirt, ShoppingCart, Trophy, X,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { isGuestAccount } from '../../hooks/useGuestAuth';
import { apiGet, apiPost, apiPut } from '../../services/apiService';

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
  slug: string | null;
  type_etablissement: string | null;
  ville: string | null;
  quartier: string | null;
  logo_url: string | null;
  banniere_url: string | null;
  page_status: string;
  page_published_at: string | null;
  qr_code_url: string | null;
  stats_views_30d: number;
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
            <p className="text-sm text-gray-500 mb-6">{t('etabAdmin.portal.claim_help')}</p>
            <button
              onClick={createDemo}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white text-sm font-semibold rounded-full"
            >
              <Plus className="w-4 h-4" />
              Créer un établissement de démo (admin)
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
              👉 <b>Cliquez sur votre établissement</b> ci-dessous pour configurer
              les 10 blocs (inscription, transport, cantine, activités, calendrier,
              annonces, contacts, etc.) et publier votre page officielle.
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
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                    e.page_status === 'published'
                      ? 'bg-emerald-100 text-emerald-700'
                      : 'bg-amber-100 text-amber-700'
                  }`}
                >
                  {e.page_status === 'published' ? t('etabAdmin.dashboard.published') : t('etabAdmin.dashboard.draft')}
                </span>
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

        {etabs.length > 0 && (
          <button
            onClick={createDemo}
            className="w-full mt-2 inline-flex items-center justify-center gap-2 px-5 py-2.5 border border-emerald-300 text-emerald-700 text-sm font-semibold rounded-full"
          >
            <Plus className="w-4 h-4" />
            Nouvel établissement de démo
          </button>
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
  const { t } = useTranslation();
  const { toast } = useToast();
  const [etab, setEtab] = useState<MyEtab | null>(null);
  const [blocs, setBlocs] = useState<BlocCMS[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editingType, setEditingType] = useState<string | null>(null);

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
        <p className="text-sm text-gray-500">Établissement introuvable.</p>
        <button onClick={() => navigate('/etablissement-portal')} className="mt-4 px-4 py-2 bg-emerald-500 text-white rounded-full text-sm">
          Retour
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
            <span className="text-sm text-gray-700">Bloc actif (visible publiquement)</span>
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
