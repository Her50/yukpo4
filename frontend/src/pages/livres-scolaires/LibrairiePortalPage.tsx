import {
  ArrowLeft, BookOpen, Check, ChevronRight, ClipboardCheck, Clock, FileDown,
  Loader2, LogOut, MapPin, Megaphone, Package, Phone, Printer, RefreshCw,
  Route, Search, Send, ShoppingBag, Trash2, Truck, UserPlus, Users,
  Warehouse, X, XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import LanguageSwitcherBourse from '../../components/LanguageSwitcherBourse';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiGet, apiPost } from '../../services/apiService';
import { isGuestAccount } from '../../hooks/useGuestAuth';

/**
 * Yukpo Librairie — Portail libraire / super-libraire.
 *
 * Login obligatoire (pas de mode invité). Si l'utilisateur courant est invité
 * ou non connecté, on redirige vers /login avec un retour sur ce portail.
 *
 * Vues :
 *   - /librairie               → liste des commandes assignées
 *   - /librairie/commandes/:id → détails + validation lignes + export PDF
 */

type CommandeStatut =
  | 'edition' | 'validation_budget'
  | 'envoyee_super_librairie' | 'envoyee_librairies'
  | 'en_validation' | 'validee_partielle' | 'validee_complete'
  | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

interface CommandeListItem {
  id: string;
  reference_commande?: string;
  statut: CommandeStatut;
  validation_statut?: string;
  budget_total?: number;
  devise?: string;
  adresse_livraison?: string;
  gps_livraison?: string;
  nb_neufs?: number;
  nb_occasion?: number;
  secondes_restantes?: number;
  created_at?: string;
}

const STATUT_LABELS: Partial<Record<CommandeStatut, string>> = {
  edition: 'Édition',
  validation_budget: 'Validation budget',
  envoyee_super_librairie: 'Reçue – à valider',
  envoyee_librairies: 'Diffusée réseau',
  en_validation: 'En validation',
  validee_partielle: 'Partielle',
  validee_complete: 'Validée',
  en_preparation: 'Préparation',
  en_livraison: 'Livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUT_COLOR: Partial<Record<CommandeStatut, string>> = {
  envoyee_super_librairie: 'bg-amber-100 text-amber-800 border-amber-300',
  envoyee_librairies: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  en_validation: 'bg-amber-100 text-amber-700 border-amber-200',
  validee_partielle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  validee_complete: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  en_preparation: 'bg-purple-100 text-purple-700 border-purple-200',
  en_livraison: 'bg-orange-100 text-orange-700 border-orange-200',
  livree: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  annulee: 'bg-red-100 text-red-700 border-red-200',
};

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('fr-FR', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
    });
  } catch { return ''; }
};

/* ─── TEAM MODAL ─── */
interface TeamMember {
  id: number;
  user_id?: number;
  role: 'manager' | 'preparer' | 'cashier' | string;
  nom_affiche?: string;
  telephone?: string;
  is_active?: boolean;
  email?: string;
  user_nom?: string;
  created_at?: string;
}

const ROLE_LABELS: Record<string, string> = {
  manager: 'Gestionnaire',
  preparer: 'Préparateur',
  cashier: 'Caisse',
};

const ROLE_COLORS: Record<string, string> = {
  manager: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  preparer: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  cashier: 'bg-amber-100 text-amber-700 border-amber-200',
};

const TeamModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { toast } = useToast();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Form
  const [tel, setTel] = useState('');
  const [nom, setNom] = useState('');
  const [role, setRole] = useState<'manager' | 'preparer' | 'cashier'>('preparer');
  const [inviting, setInviting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiGet('/api/librairie-network/super-librairie/team');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      const list: TeamMember[] = d?.members || d?.data || [];
      setMembers(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger l\'équipe');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const invite = async () => {
    const cleaned = tel.replace(/\s/g, '');
    if (cleaned.length < 8) {
      toast({ title: 'Numéro invalide', description: '8 chiffres minimum', variant: 'destructive' });
      return;
    }
    setInviting(true);
    try {
      const res = await apiPost('/api/librairie-network/super-librairie/team/invite', {
        telephone: cleaned,
        role,
        nom: nom.trim() || null,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      toast({ title: 'Membre ajouté', description: `${ROLE_LABELS[role]} invité avec succès` });
      setTel(''); setNom('');
      load();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Réessayez', variant: 'destructive' });
    } finally { setInviting(false); }
  };

  const remove = async (memberId: number) => {
    if (!window.confirm('Retirer ce membre de l\'équipe ?')) return;
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`/api/librairie-network/super-librairie/team/${memberId}`, {
        method: 'DELETE',
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      }
      toast({ title: 'Membre retiré' });
      load();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Réessayez', variant: 'destructive' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div
        className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg p-5 max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Users className="w-5 h-5 text-indigo-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">Équipe Yukpo Librairie</h3>
            <p className="text-[11px] text-gray-500">Ajoutez des collègues qui ont déjà un compte Yukpo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {/* Formulaire d'invitation */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-3 mb-4">
          <p className="text-xs font-bold text-indigo-800 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <UserPlus className="w-3.5 h-3.5" /> Ajouter un membre
          </p>
          <div className="space-y-2">
            <input
              value={tel}
              onChange={e => setTel(e.target.value)}
              placeholder="Téléphone (ex: +237 6XX XXX XXX)"
              type="tel"
              inputMode="tel"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
            />
            <input
              value={nom}
              onChange={e => setNom(e.target.value)}
              placeholder="Nom affiché (optionnel)"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400"
            />
            <div className="flex gap-1.5">
              {(['manager', 'preparer', 'cashier'] as const).map(r => (
                <button
                  key={r}
                  onClick={() => setRole(r)}
                  className={`flex-1 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
                    role === r ? ROLE_COLORS[r] : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {ROLE_LABELS[r]}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={invite}
                disabled={inviting || !tel.trim()}
                className="bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                title="Ajouter directement si compte Yukpo existant"
              >
                {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                Ajouter direct
              </button>
              <button
                onClick={async () => {
                  try {
                    const res = await apiPost('/api/librairie-network/super-librairie/team/invitations', {
                      role,
                      telephone: tel.trim() ? tel.replace(/\s/g, '') : null,
                      nom_affiche: nom.trim() || null,
                    });
                    const d = await res.json().catch(() => ({}));
                    if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
                    if (d.whatsapp_url) {
                      window.open(d.whatsapp_url, '_blank', 'noopener,noreferrer');
                    } else {
                      navigator.clipboard?.writeText(`https://bourse.yukpomnang.com${d.invitation_path}`);
                      toast({ title: 'Lien copié', description: 'Partagez-le avec le futur membre' });
                    }
                    setTel(''); setNom('');
                    load();
                    window.dispatchEvent(new CustomEvent('libraire:invitation-changed'));
                  } catch (e: any) {
                    toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
                  }
                }}
                className="bg-emerald-600 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5"
                title="Générer un lien d'invitation et le partager via WhatsApp"
              >
                <Send className="w-4 h-4" />
                Inviter par WhatsApp
              </button>
            </div>
            <p className="text-[10px] text-indigo-700/80">
              <b>Ajouter direct</b> : si la personne a déjà un compte Yukpo. <b>Inviter par WhatsApp</b> : génère un lien d'inscription que le futur membre cliquera pour créer son compte et rejoindre l'équipe.
            </p>
          </div>
        </div>

        {/* Tableau des invitations en cours / acceptées */}
        <InvitationsTable />

        {/* Liste des membres */}
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide mb-2">
            Membres actifs ({members.filter(m => m.is_active !== false).length})
          </p>
          {loading && (
            <div className="flex justify-center py-6"><Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /></div>
          )}
          {error && !loading && (
            <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>
          )}
          {!loading && !error && members.length === 0 && (
            <p className="text-xs text-gray-400 text-center py-4">Aucun membre pour l'instant.</p>
          )}
          {!loading && members.map(m => (
            <div key={m.id} className="flex items-center gap-2 py-2 border-b border-gray-100 last:border-b-0">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${ROLE_COLORS[m.role] || 'bg-gray-100 text-gray-600'}`}>
                {(m.nom_affiche || m.user_nom || m.email || '?').slice(0, 1).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">
                  {m.nom_affiche || m.user_nom || m.email || `User ${m.user_id}`}
                </p>
                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                  <span className={`px-1.5 py-0.5 rounded font-bold border ${ROLE_COLORS[m.role] || 'bg-gray-100'}`}>
                    {ROLE_LABELS[m.role] || m.role}
                  </span>
                  {m.telephone && <span className="truncate">{m.telephone}</span>}
                </div>
              </div>
              <button
                onClick={() => remove(m.id)}
                className="p-1.5 rounded-lg text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Retirer"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ─── TABLEAU DES INVITATIONS WHATSAPP (avec traçage) ─── */
interface InvitationRow {
  id: number;
  token: string;
  invitation_path: string;
  role: string;
  telephone?: string | null;
  nom_affiche?: string | null;
  status: 'pending' | 'opened' | 'accepted';
  opened_at?: string | null;
  accepted_at?: string | null;
  accepted_email?: string | null;
  accepted_nom?: string | null;
  expires_at?: string | null;
  created_at?: string | null;
}

const InvitationsTable: React.FC = () => {
  const { toast } = useToast();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiGet('/api/librairie-network/super-librairie/team/invitations');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      setInvitations(Array.isArray(d?.invitations) ? d.invitations : []);
    } catch {
      // silencieux : peut être absent si pas encore d'invitation créée
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const handler = () => load();
    window.addEventListener('libraire:invitation-changed', handler);
    const interval = setInterval(load, 30000); // refresh 30s
    return () => {
      window.removeEventListener('libraire:invitation-changed', handler);
      clearInterval(interval);
    };
  }, [load]);

  if (loading && invitations.length === 0) return null;
  if (invitations.length === 0) return null;

  const statusLabel = (s: string) =>
    s === 'accepted' ? '✅ Acceptée' : s === 'opened' ? '👁 Lien ouvert' : '⏳ En attente';
  const statusColor = (s: string) =>
    s === 'accepted' ? 'bg-emerald-100 text-emerald-700'
    : s === 'opened' ? 'bg-blue-100 text-blue-700'
    : 'bg-gray-100 text-gray-600';

  return (
    <div className="mb-4 bg-white border border-gray-100 rounded-2xl overflow-hidden">
      <div className="bg-emerald-50 border-b border-emerald-100 px-3 py-2">
        <p className="text-xs font-bold text-emerald-800 uppercase tracking-wide flex items-center gap-1.5">
          <Send className="w-3.5 h-3.5" /> Invitations WhatsApp ({invitations.length})
        </p>
      </div>
      <div className="divide-y divide-gray-100">
        {invitations.map(inv => {
          const fullUrl = `${window.location.origin}${inv.invitation_path}`;
          const removeMember = async () => {
            const isAccepted = inv.status === 'accepted';
            const who = inv.nom_affiche || inv.accepted_nom || inv.accepted_email || inv.telephone || 'ce membre';
            const msg = isAccepted
              ? `Retirer ${who} de l'équipe ?\n\nL'utilisateur perdra immédiatement l'accès à Yukpo Librairie.`
              : `Révoquer l'invitation pour ${who} ?\n\nLe lien WhatsApp partagé deviendra inutilisable.`;
            if (!window.confirm(msg)) return;
            try {
              const res = await fetch(`/api/librairie-network/super-librairie/team/invitations/${inv.id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
              });
              const d = await res.json().catch(() => ({}));
              if (!res.ok) throw new Error(d?.message || d?.error || `HTTP ${res.status}`);
              toast({ title: isAccepted ? 'Membre retiré' : 'Invitation révoquée' });
              window.dispatchEvent(new CustomEvent('libraire:invitation-changed'));
            } catch (e: any) {
              toast({ title: 'Erreur', description: e?.message, variant: 'destructive' });
            }
          };
          return (
            <div key={inv.id} className="p-2.5">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs font-semibold text-gray-900 truncate flex-1 min-w-0">
                  {inv.nom_affiche || inv.accepted_nom || inv.telephone || 'Anonyme'}
                  {' '}
                  <span className="text-[10px] font-bold text-indigo-700 uppercase">{ROLE_LABELS[inv.role] || inv.role}</span>
                </p>
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${statusColor(inv.status)} shrink-0`}>
                  {statusLabel(inv.status)}
                </span>
                <button
                  onClick={removeMember}
                  className="p-1 rounded text-red-500 hover:bg-red-50 shrink-0"
                  title={inv.status === 'accepted' ? 'Retirer ce membre' : "Révoquer l'invitation"}
                  aria-label="Supprimer"
                >
                  ×
                </button>
              </div>
              {inv.accepted_email && (
                <p className="text-[10px] text-emerald-700">→ {inv.accepted_email}</p>
              )}
              {inv.status !== 'accepted' && (
                <div className="flex items-center gap-1.5 mt-1.5">
                  <button
                    onClick={() => {
                      navigator.clipboard?.writeText(fullUrl);
                      toast({ title: 'Lien copié' });
                    }}
                    className="text-[10px] px-2 py-1 bg-gray-100 text-gray-700 rounded font-semibold"
                  >
                    Copier le lien
                  </button>
                  {inv.telephone && (
                    <a
                      href={`https://wa.me/${inv.telephone.replace(/[^\d]/g, '')}?text=${encodeURIComponent(
                        `Rejoignez l'équipe Yukpo Librairie : ${fullUrl}`
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] px-2 py-1 bg-emerald-600 text-white rounded font-semibold"
                    >
                      Renvoyer WhatsApp
                    </a>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── CONTACTS PARENTS + CAMPAGNE WHATSAPP ─── */
interface ParentContactRow {
  user_id: number;
  nom?: string | null;
  prenom?: string | null;
  email?: string | null;
  phone?: string | null;
  nb_commandes: number;
  derniere_commande?: string | null;
  derniere_adresse?: string | null;
  dernier_gps?: string | null;
  budget_cumule?: number | null;
}

const ContactsPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<ParentContactRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [villeFilter, setVilleFilter] = useState('');
  const [quartierFilter, setQuartierFilter] = useState('');
  const [showCampaign, setShowCampaign] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (villeFilter) params.set('ville', villeFilter);
      if (quartierFilter) params.set('quartier', quartierFilter);
      const q = params.toString() ? `?${params.toString()}` : '';
      const res = await apiGet(`/api/librairie-network/super-librairie/parents-contacts${q}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      setRows(d?.parents || []);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger le carnet');
    } finally { setLoading(false); }
  }, [search, villeFilter, quartierFilter]);

  useEffect(() => { load(); }, [load]);

  const submitSearch = (e?: React.FormEvent) => {
    e?.preventDefault();
    setSearch(searchInput.trim());
  };

  // Extraction des villes/quartiers uniques depuis les adresses (pour les chips)
  const { villesUniques, quartiersUniques } = (() => {
    const villes = new Set<string>();
    const quartiers = new Set<string>();
    for (const p of rows) {
      if (!p.derniere_adresse) continue;
      // Heuristique : "Quartier, Ville" ou "Adresse — Quartier — Ville"
      const parts = p.derniere_adresse.split(/[,—\-]/).map(s => s.trim()).filter(Boolean);
      if (parts.length >= 1) quartiers.add(parts[0]);
      if (parts.length >= 2) villes.add(parts[parts.length - 1]);
    }
    return {
      villesUniques: Array.from(villes).sort(),
      quartiersUniques: Array.from(quartiers).sort(),
    };
  })();

  return (
    <div className="fixed inset-0 bg-gray-50 z-40 overflow-y-auto">
      {showCampaign && <CampaignModal onClose={() => setShowCampaign(false)} totalReachHint={rows.length} />}

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 pt-10 pb-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full bg-white/20"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider uppercase">Yukpo Librairie</span>
            <h1 className="font-bold text-lg leading-tight mt-1">Carnet d'adresses parents</h1>
            <p className="text-indigo-100 text-xs">Tous les parents ayant commandé · WhatsApp + adresse</p>
          </div>
          <button
            onClick={() => setShowCampaign(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white text-indigo-700 text-xs font-bold hover:bg-indigo-50"
            title="Diffuser une campagne WhatsApp"
          >
            <Megaphone className="w-4 h-4" />
            Campagne
          </button>
        </div>

        {/* Search */}
        <form onSubmit={submitSearch} className="max-w-3xl mx-auto mt-3 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/70" />
          <input
            value={searchInput}
            onChange={e => setSearchInput(e.target.value)}
            placeholder="Rechercher : nom, téléphone, adresse…"
            className="w-full text-sm bg-white/15 border border-white/30 rounded-xl pl-9 pr-3 py-2 outline-none placeholder-white/60 text-white"
          />
        </form>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-3">
        {/* Filtres ville + quartier */}
        {(villesUniques.length > 0 || quartiersUniques.length > 0) && (
          <div className="bg-white border border-gray-100 rounded-2xl p-3 mb-3 space-y-2">
            {villesUniques.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Ville</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setVilleFilter('')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      villeFilter === '' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >Toutes</button>
                  {villesUniques.map(v => (
                    <button
                      key={v}
                      onClick={() => setVilleFilter(villeFilter === v ? '' : v)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        villeFilter === v ? 'bg-indigo-600 text-white' : 'bg-indigo-50 text-indigo-700'
                      }`}
                    >{v}</button>
                  ))}
                </div>
              </div>
            )}
            {quartiersUniques.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-wide mb-1.5">Quartier</p>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => setQuartierFilter('')}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                      quartierFilter === '' ? 'bg-amber-600 text-white' : 'bg-gray-100 text-gray-600'
                    }`}
                  >Tous</button>
                  {quartiersUniques.map(q => (
                    <button
                      key={q}
                      onClick={() => setQuartierFilter(quartierFilter === q ? '' : q)}
                      className={`px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                        quartierFilter === q ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800'
                      }`}
                    >{q}</button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <p className="text-xs text-gray-500 mb-2">{rows.length} parent{rows.length > 1 ? 's' : ''}</p>

        {loading && (
          <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /></div>
        )}
        {error && !loading && (
          <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2 mb-2">{error}</p>
        )}

        {!loading && !error && rows.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <Users className="w-12 h-12 text-indigo-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">
              {(search || villeFilter || quartierFilter) ? 'Aucun résultat' : 'Aucune commande passée'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {(search || villeFilter || quartierFilter)
                ? 'Aucun parent ne correspond à ce filtre.'
                : 'Le carnet d\'adresses se remplit automatiquement dès qu\'un parent passe sa première commande.'}
            </p>
          </div>
        )}

        {!loading && rows.length > 0 && (
          <div className="space-y-2">
            {rows.map(p => {
              const fullName = [p.nom, p.prenom].filter(Boolean).join(' ').trim() || p.email || 'Parent';
              return (
                <div key={p.user_id} className="bg-white rounded-2xl border border-gray-100 p-3 flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-sm font-bold shrink-0">
                    {fullName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 leading-tight truncate">{fullName}</p>
                    <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
                      {p.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{p.phone}</span>}
                      <span className="text-indigo-700 font-bold">
                        {p.nb_commandes} cmd
                      </span>
                    </div>
                    {p.derniere_adresse && (
                      <p className="text-[11px] text-gray-500 mt-0.5 flex items-start gap-1">
                        <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />
                        <span className="truncate">{p.derniere_adresse}</span>
                      </p>
                    )}
                  </div>
                  {p.phone && (
                    <a
                      href={buildWhatsAppUrl(p.phone, `Bonjour ${fullName}, Yukpo Librairie —`)}
                      target="_blank" rel="noopener noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-emerald-600 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                      title="WhatsApp"
                    >
                      <Send className="w-3 h-3" /> WhatsApp
                    </a>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const CampaignModal: React.FC<{ onClose: () => void; totalReachHint: number }> = ({ onClose, totalReachHint }) => {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const [search, setSearch] = useState('');
  const [lastDays, setLastDays] = useState<number | ''>('');
  const [estimating, setEstimating] = useState(false);
  const [estimate, setEstimate] = useState<number | null>(null);
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ wa: number; failed: number; notif: number; total: number } | null>(null);

  const segment = useMemo(() => ({
    search: search.trim() || undefined,
    last_days: typeof lastDays === 'number' ? lastDays : undefined,
  }), [search, lastDays]);

  const dryRun = async () => {
    setEstimating(true); setEstimate(null);
    try {
      const res = await apiPost('/api/librairie-network/super-librairie/campaigns', {
        message: message || 'estimation',
        segment,
        dry_run: true,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      setEstimate(d?.total_recipients ?? 0);
    } catch (e: any) {
      toast({ title: 'Erreur estimation', description: e?.message || 'Réessayez', variant: 'destructive' });
    } finally { setEstimating(false); }
  };

  const send = async () => {
    if (message.trim().length < 10) {
      toast({ title: 'Message trop court', description: '10 caractères minimum', variant: 'destructive' });
      return;
    }
    if (!window.confirm(`Envoyer ce message à ${estimate ?? '?'} parent(s) ?`)) return;
    setSending(true);
    try {
      const res = await apiPost('/api/librairie-network/super-librairie/campaigns', {
        message,
        segment,
        dry_run: false,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      setResult({
        wa: d?.whatsapp_sent || 0,
        failed: d?.whatsapp_failed || 0,
        notif: d?.notifications_sent || 0,
        total: d?.total_recipients || 0,
      });
      toast({ title: 'Campagne envoyée', description: `${d?.whatsapp_sent || 0}/${d?.total_recipients || 0} WhatsApp réussis` });
    } catch (e: any) {
      toast({ title: 'Erreur envoi', description: e?.message || 'Réessayez', variant: 'destructive' });
    } finally { setSending(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4" onClick={onClose}>
      <div className="bg-white sm:rounded-3xl rounded-t-3xl w-full sm:max-w-lg p-5 max-h-[95vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center shrink-0">
            <Megaphone className="w-5 h-5 text-indigo-700" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-900 text-base leading-tight">Campagne WhatsApp</h3>
            <p className="text-[11px] text-gray-500">Diffusion à tous les parents Yukpo</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        {!result ? (
          <>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Message</label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={5}
              placeholder="Bonjour ! La rentrée scolaire approche, Yukpo Librairie vous propose…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 outline-none focus:border-indigo-400 resize-none mb-2"
              maxLength={4000}
            />
            <p className="text-[10px] text-gray-400 mb-3 text-right">{message.length}/4000</p>

            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Filtres (optionnel)</p>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Filtrer par nom, ville…"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-2 outline-none focus:border-indigo-400"
            />
            <input
              type="number"
              value={lastDays}
              onChange={e => setLastDays(e.target.value ? parseInt(e.target.value, 10) : '')}
              placeholder="Commande dans les N derniers jours"
              className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2 mb-3 outline-none focus:border-indigo-400"
              min={1}
              max={365}
            />

            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={dryRun}
                disabled={estimating}
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-1.5"
              >
                {estimating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Estimer la portée
              </button>
              {estimate !== null && (
                <span className="text-xs font-bold text-indigo-700">→ {estimate} destinataire{estimate > 1 ? 's' : ''}</span>
              )}
            </div>

            <button
              onClick={send}
              disabled={sending || message.trim().length < 10}
              className="w-full bg-indigo-600 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3 rounded-xl text-sm flex items-center justify-center gap-2"
            >
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Diffuser maintenant ({totalReachHint} max)
            </button>
            <p className="text-[10px] text-gray-400 mt-2 text-center">
              ⚠️ L'envoi WhatsApp passe par Twilio. Si non configuré, seules les notifications in-app sont envoyées.
            </p>
          </>
        ) : (
          <div>
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 mb-3">
              <p className="text-sm font-bold text-emerald-800 mb-2">Campagne diffusée ✅</p>
              <ul className="text-xs text-emerald-900 space-y-1">
                <li>• Destinataires : <span className="font-bold">{result.total}</span></li>
                <li>• WhatsApp réussis : <span className="font-bold">{result.wa}</span></li>
                <li>• WhatsApp échoués : <span className="font-bold">{result.failed}</span></li>
                <li>• Notifications in-app : <span className="font-bold">{result.notif}</span></li>
              </ul>
            </div>
            <button onClick={onClose} className="w-full bg-indigo-600 text-white font-bold py-2.5 rounded-xl text-sm">
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── TOURNÉES DE LIVRAISON ─── */
interface RouteParent {
  package_ref: string;
  commande_id: string;
  reference_commande: string;
  statut?: string;
  adresse?: string;
  gps?: string;
  nom: string;
  phone?: string;
  email?: string;
  nb_neufs?: number;
  nb_occasion?: number;
  total_articles?: number;
  classes?: string[];
}
interface DeliveryRoute {
  city: string;
  cluster_ref: string;
  package_count: number;
  centre_gps?: string;
  parents: RouteParent[];
}

const DeliveryRoutesPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { toast } = useToast();
  const [routes, setRoutes] = useState<DeliveryRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [bucketKm, setBucketKm] = useState<number>(2);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiGet(`/api/librairie-network/super-librairie/delivery-routes?bucket_km=${bucketKm}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      setRoutes(d?.routes || []);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger les tournées');
    } finally { setLoading(false); }
  }, [bucketKm]);

  useEffect(() => { load(); }, [load]);

  const totalPackages = routes.reduce((s, r) => s + r.package_count, 0);

  return (
    <div className="fixed inset-0 bg-gray-50 z-40 overflow-y-auto">
      <style>{`@media print { body { background: white !important; } .no-print { display: none !important; } }`}</style>
      <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 pt-10 pb-4 sticky top-0 z-10 no-print">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full bg-white/20"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider uppercase">Yukpo Librairie</span>
            <h1 className="font-bold text-lg leading-tight mt-1">Tournées de livraison</h1>
            <p className="text-orange-100 text-xs">{totalPackages} paquet{totalPackages > 1 ? 's' : ''} · {routes.length} cluster{routes.length > 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 flex items-center gap-1.5 text-xs font-semibold"
            title="Imprimer / PDF"
          >
            <Printer className="w-4 h-4" />
            PDF
          </button>
        </div>
        <div className="max-w-3xl mx-auto mt-2 flex items-center gap-2">
          <label className="text-xs text-white/90">Rayon cluster :</label>
          {[1, 2, 5, 10].map(k => (
            <button key={k} onClick={() => setBucketKm(k)}
              className={`px-2.5 py-1 rounded-full text-xs font-bold ${bucketKm === k ? 'bg-white text-orange-600' : 'bg-white/20 text-white'}`}>
              {k} km
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-4 print-area">
        <div className="hidden print:block mb-4">
          <h1 className="font-bold text-xl">Yukpo Librairie — Tournées de livraison</h1>
          <p className="text-xs text-gray-500">Généré le {new Date().toLocaleString('fr-FR')} · Rayon cluster : {bucketKm} km</p>
        </div>

        {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-orange-600 animate-spin" /></div>}
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>}

        {!loading && routes.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <Truck className="w-12 h-12 text-orange-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">Aucune commande en livraison</p>
            <p className="text-xs text-gray-500">Les commandes apparaissent ici dès leur passage en préparation.</p>
          </div>
        )}

        {!loading && routes.map((r, i) => (
          <div key={`${r.city}-${i}`} className="bg-white rounded-2xl border border-orange-200 mb-3 overflow-hidden">
            <div className="bg-orange-50 px-3 py-2 flex items-center gap-2 border-b border-orange-200">
              <Route className="w-4 h-4 text-orange-700" />
              <p className="text-sm font-bold text-orange-900 flex-1 truncate">{r.city}</p>
              <span className="text-[10px] font-bold uppercase bg-white text-orange-700 px-2 py-0.5 rounded border border-orange-300">
                {r.cluster_ref}
              </span>
              <span className="text-[11px] font-bold text-orange-700">{r.package_count} pkg</span>
            </div>
            <div className="divide-y divide-gray-100">
              {r.parents.map(p => (
                <div key={p.package_ref} className="px-3 py-2 flex items-start gap-2">
                  <span className="text-[10px] font-bold uppercase bg-orange-600 text-white px-1.5 py-0.5 rounded shrink-0 leading-none mt-0.5">
                    {p.package_ref.split('#').pop()}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-gray-900 leading-tight">
                      {p.nom} <span className="text-gray-400 font-normal">· {p.reference_commande}</span>
                    </p>
                    {p.adresse && <p className="text-[11px] text-gray-600 truncate">{p.adresse}</p>}
                    <div className="flex items-center gap-2 text-[10px] text-gray-500 mt-0.5">
                      {p.phone && <span>{p.phone}</span>}
                      {p.classes && p.classes.length > 0 && (
                        <span className="text-orange-700 font-semibold">{p.classes.join(' · ')}</span>
                      )}
                      {(p.total_articles ?? 0) > 0 && <span>{p.total_articles} articles</span>}
                    </div>
                  </div>
                  {p.phone && (
                    <a
                      href={buildWhatsAppUrl(p.phone, `Bonjour ${p.nom}, livraison Yukpo en route — paquet ${p.package_ref}`)}
                      target="_blank" rel="noopener noreferrer"
                      className="no-print px-2 py-1 rounded bg-emerald-600 text-white text-[10px] font-bold flex items-center gap-1 shrink-0"
                    >
                      <Send className="w-3 h-3" />
                      WA
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ─── BON DE COMMANDE GROSSISTE ─── */
interface WholesaleArticle {
  titre: string;
  auteur?: string;
  editeur?: string;
  isbn?: string;
  matiere?: string;
  category?: 'manuel' | 'cahier' | 'fourniture';
  classes?: string[];
  quantite_totale: number;
  nb_commandes: number;
  prix_moyen?: number | null;
  valeur_estimee?: number | null;
}

/** Construit un message WhatsApp formaté pour l'envoi à un grossiste.
 *  Limite à ~3500 caractères (au-delà certains clients tronquent l'URL).
 *  Si la section dépasse, on coupe avec un "+ N autres" en pied. */
const buildWholesaleWhatsAppMessage = (
  title: string,
  emoji: string,
  section: { lignes: WholesaleArticle[]; total_articles: number; total_valeur_estimee: number; nb_lignes: number },
): string => {
  const lines: string[] = [];
  lines.push(`*YUKPO LIBRAIRIE* — Bon de commande grossiste`);
  lines.push(`${emoji} *${title}*`);
  lines.push(`${section.total_articles.toLocaleString('fr-FR')} articles · ${section.nb_lignes} référence${section.nb_lignes > 1 ? 's' : ''}`);
  if (section.total_valeur_estimee > 0) {
    lines.push(`Valeur estimée : ${Math.round(section.total_valeur_estimee).toLocaleString('fr-FR')} F`);
  }
  lines.push('');

  const MAX_CHARS = 3500;
  let truncatedAt = -1;
  for (let i = 0; i < section.lignes.length; i++) {
    const a = section.lignes[i];
    const meta = [a.auteur, a.editeur].filter(Boolean).join(' · ');
    const cls = (a.classes && a.classes.length > 0) ? ` [${a.classes.join(', ')}]` : '';
    const block = [
      `${i + 1}. *${a.titre}*${meta ? ` — _${meta}_` : ''}`,
      `   Qté : *${a.quantite_totale}*${cls}${a.isbn ? ` · ISBN ${a.isbn}` : ''}`,
    ].join('\n');
    const next = lines.join('\n') + '\n' + block;
    if (next.length > MAX_CHARS) {
      truncatedAt = i;
      break;
    }
    lines.push(block);
  }
  if (truncatedAt >= 0) {
    lines.push('');
    lines.push(`_…et ${section.lignes.length - truncatedAt} autre${section.lignes.length - truncatedAt > 1 ? 's' : ''} référence${section.lignes.length - truncatedAt > 1 ? 's' : ''} (PDF complet sur demande)_`);
  }
  lines.push('');
  lines.push(`Merci de me confirmer disponibilité + délai de livraison 🙏`);
  return lines.join('\n');
};

/** Message WhatsApp consolidé "tous les blocs" — résumé de chaque section + grand total. */
const buildWholesaleAllSectionsMessage = (
  sections: { manuels: any; cahiers: any; fournitures: any },
): string => {
  const lines: string[] = [];
  lines.push(`*YUKPO LIBRAIRIE* — Bon de commande grossiste (synthèse)`);
  lines.push('');

  const blocks = [
    { emoji: '📚', label: 'Manuels scolaires', s: sections.manuels },
    { emoji: '📓', label: 'Cahiers', s: sections.cahiers },
    { emoji: '✏️', label: 'Fournitures & accessoires', s: sections.fournitures },
  ].filter(b => b.s.nb_lignes > 0);

  let grandTotal = 0;
  let grandValue = 0;
  for (const b of blocks) {
    lines.push(`${b.emoji} *${b.label}*`);
    lines.push(`  ${b.s.total_articles.toLocaleString('fr-FR')} articles · ${b.s.nb_lignes} référence${b.s.nb_lignes > 1 ? 's' : ''}`);
    if (b.s.total_valeur_estimee > 0) {
      lines.push(`  ≈ ${Math.round(b.s.total_valeur_estimee).toLocaleString('fr-FR')} F`);
    }
    lines.push('');
    grandTotal += b.s.total_articles;
    grandValue += b.s.total_valeur_estimee;
  }

  lines.push(`*TOTAL : ${grandTotal.toLocaleString('fr-FR')} articles*`);
  if (grandValue > 0) {
    lines.push(`Valeur estimée : ${Math.round(grandValue).toLocaleString('fr-FR')} F`);
  }
  lines.push('');
  lines.push('Le détail complet par référence est disponible en PDF — je peux vous le transmettre. 🙏');

  return lines.join('\n');
};
interface WholesaleSection {
  lignes: WholesaleArticle[];
  total_articles: number;
  total_valeur_estimee: number;
  nb_lignes: number;
}
interface WholesaleSections {
  manuels: WholesaleSection;
  cahiers: WholesaleSection;
  fournitures: WholesaleSection;
}

const WholesalePanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [sections, setSections] = useState<WholesaleSections | null>(null);
  const [totals, setTotals] = useState<{ lignes: number; articles: number; valeur: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [generatedAt, setGeneratedAt] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await apiGet('/api/librairie-network/super-librairie/wholesale-order');
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      setSections(d?.sections || null);
      setTotals({
        lignes: d?.total_lignes || 0,
        articles: d?.total_articles || 0,
        valeur: d?.total_valeur_estimee || 0,
      });
      setGeneratedAt(d?.generated_at || new Date().toISOString());
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger le bon');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="fixed inset-0 bg-gray-50 z-40 overflow-y-auto">
      <style>{`@media print { body { background: white !important; } .no-print { display: none !important; } table { font-size: 10px; } }`}</style>
      <div className="bg-gradient-to-r from-purple-600 to-purple-700 text-white px-4 pt-10 pb-4 sticky top-0 z-10 no-print">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button onClick={onClose} className="p-2 rounded-full bg-white/20"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider uppercase">Yukpo Librairie</span>
            <h1 className="font-bold text-lg leading-tight mt-1">Bon de commande grossiste</h1>
            <p className="text-purple-100 text-xs">Articles agrégés toutes commandes confondues</p>
          </div>
          {sections && (
            <button
              onClick={() => {
                const msg = buildWholesaleAllSectionsMessage(sections);
                window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
              }}
              className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white flex items-center gap-1.5 text-xs font-bold"
              title="Partager la synthèse via WhatsApp"
            >
              <Send className="w-4 h-4" />
              WhatsApp
            </button>
          )}
          <button
            onClick={() => window.print()}
            className="px-3 py-2 rounded-xl bg-white text-purple-700 flex items-center gap-1.5 text-xs font-bold"
            title="Imprimer / PDF"
          >
            <Printer className="w-4 h-4" />
            Exporter PDF
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-4 print-area">
        {/* En-tête PDF */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 mb-3">
          <div className="flex items-start justify-between flex-wrap gap-2">
            <div>
              <h2 className="font-bold text-gray-900 text-base">YUKPO LIBRAIRIE</h2>
              <p className="text-xs text-gray-600">Bon de commande grossiste</p>
              <p className="text-[11px] text-gray-500 mt-1">Généré le {new Date(generatedAt || Date.now()).toLocaleString('fr-FR')}</p>
            </div>
            {totals && (
              <div className="text-right">
                <p className="text-[10px] text-gray-500 uppercase font-bold">Total</p>
                <p className="text-lg font-bold text-purple-700">{totals.articles.toLocaleString('fr-FR')} articles</p>
                <p className="text-xs text-gray-600">{totals.lignes} référence{totals.lignes > 1 ? 's' : ''}</p>
                {totals.valeur > 0 && (
                  <p className="text-xs text-purple-600 font-semibold mt-0.5">≈ {Math.round(totals.valeur).toLocaleString('fr-FR')} XAF</p>
                )}
              </div>
            )}
          </div>
        </div>

        {loading && <div className="flex justify-center py-10"><Loader2 className="w-6 h-6 text-purple-600 animate-spin" /></div>}
        {error && <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-xl p-2">{error}</p>}

        {!loading && (!sections || (sections.manuels.nb_lignes + sections.cahiers.nb_lignes + sections.fournitures.nb_lignes === 0)) && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <Warehouse className="w-12 h-12 text-purple-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700">Aucun article à commander</p>
            <p className="text-xs text-gray-500">Validez d'abord les commandes (statut "préparation").</p>
          </div>
        )}

        {!loading && sections && (() => {
          // 3 sections distinctes : Manuels (livres), Cahiers, Fournitures &
          // accessoires. Chaque grossiste reçoit son propre bloc — souvent
          // l'éditeur de manuels ≠ papetier/grossiste de fournitures.
          const blocks: Array<{
            key: 'manuels' | 'cahiers' | 'fournitures';
            title: string;
            subtitle: string;
            color: { bg: string; text: string; border: string; accent: string };
            section: WholesaleSection;
          }> = [
            {
              key: 'manuels',
              title: '📚 Manuels scolaires',
              subtitle: 'Livres / éditeurs : NMI, NATHAN, CLE, CIAM, HATIER…',
              color: { bg: 'bg-blue-50', text: 'text-blue-900', border: 'border-blue-200', accent: 'text-blue-700' },
              section: sections.manuels,
            },
            {
              key: 'cahiers',
              title: '📓 Cahiers',
              subtitle: 'Papeterie scolaire : pages réglées, Seyès, carreaux, TP…',
              color: { bg: 'bg-emerald-50', text: 'text-emerald-900', border: 'border-emerald-200', accent: 'text-emerald-700' },
              section: sections.cahiers,
            },
            {
              key: 'fournitures',
              title: '✏️ Fournitures & accessoires',
              subtitle: 'Stylos, crayons, calculatrices, blouses, géométrie…',
              color: { bg: 'bg-amber-50', text: 'text-amber-900', border: 'border-amber-200', accent: 'text-amber-700' },
              section: sections.fournitures,
            },
          ].filter(b => b.section.nb_lignes > 0);

          return blocks.map(b => {
            // Emoji extrait du titre pour l'utiliser dans le message WhatsApp
            const emoji = (b.title.match(/^\p{Extended_Pictographic}/u) || ['📦'])[0];
            const cleanTitle = b.title.replace(/^\p{Extended_Pictographic}\s*/u, '').trim();
            return (
            <div key={b.key} className="bg-white rounded-2xl border border-gray-200 overflow-hidden mb-4 break-inside-avoid">
              <div className={`px-4 py-2.5 ${b.color.bg} border-b ${b.color.border} flex items-center justify-between gap-2`}>
                <div className="flex-1 min-w-0">
                  <p className={`font-bold text-sm ${b.color.text}`}>{b.title}</p>
                  <p className="text-[11px] text-gray-600">{b.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-base font-bold ${b.color.accent} tabular-nums`}>
                    {b.section.total_articles.toLocaleString('fr-FR')} articles
                  </p>
                  <p className="text-[11px] text-gray-500">
                    {b.section.nb_lignes} référence{b.section.nb_lignes > 1 ? 's' : ''}
                    {b.section.total_valeur_estimee > 0 && (
                      <> · ≈ {Math.round(b.section.total_valeur_estimee).toLocaleString('fr-FR')} F</>
                    )}
                  </p>
                </div>
                <button
                  onClick={() => {
                    const msg = buildWholesaleWhatsAppMessage(cleanTitle, emoji, b.section);
                    window.open(`https://wa.me/?text=${encodeURIComponent(msg)}`, '_blank', 'noopener,noreferrer');
                  }}
                  className="no-print px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shrink-0"
                  title={`Partager ${cleanTitle} via WhatsApp`}
                >
                  <Send className="w-3 h-3" />
                  WhatsApp
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className={b.color.bg}>
                    <tr className={`text-left ${b.color.text}`}>
                      <th className="px-2 py-1.5 font-bold w-8">#</th>
                      <th className="px-2 py-1.5 font-bold">Article</th>
                      <th className="px-2 py-1.5 font-bold">Auteur · Éditeur</th>
                      <th className="px-2 py-1.5 font-bold text-center">Classes</th>
                      <th className="px-2 py-1.5 font-bold text-right">Qté</th>
                      <th className="px-2 py-1.5 font-bold text-right">Prix moy.</th>
                      <th className="px-2 py-1.5 font-bold text-right">Valeur</th>
                    </tr>
                  </thead>
                  <tbody>
                    {b.section.lignes.map((a, i) => (
                      <tr key={i} className="border-t border-gray-100">
                        <td className="px-2 py-1.5 text-gray-400 tabular-nums">{i + 1}</td>
                        <td className="px-2 py-1.5">
                          <p className="font-bold text-gray-900 leading-tight">{a.titre}</p>
                          {a.isbn && <p className="text-[10px] text-gray-500 leading-tight">ISBN {a.isbn}</p>}
                        </td>
                        <td className="px-2 py-1.5 text-gray-600">
                          {[a.auteur, a.editeur].filter(Boolean).join(' · ') || '—'}
                        </td>
                        <td className={`px-2 py-1.5 text-center font-semibold ${b.color.accent}`}>
                          {a.classes && a.classes.length > 0 ? a.classes.join(', ') : '—'}
                        </td>
                        <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${b.color.accent}`}>
                          {a.quantite_totale}
                        </td>
                        <td className="px-2 py-1.5 text-right tabular-nums text-gray-700">
                          {a.prix_moyen ? Math.round(a.prix_moyen).toLocaleString('fr-FR') + ' F' : '—'}
                        </td>
                        <td className={`px-2 py-1.5 text-right tabular-nums font-bold ${b.color.accent}`}>
                          {a.valeur_estimee ? Math.round(a.valeur_estimee).toLocaleString('fr-FR') + ' F' : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className={`${b.color.bg} border-t-2 ${b.color.border}`}>
                      <td colSpan={4} className={`px-2 py-1.5 font-bold ${b.color.text} text-right`}>Sous-total {b.title.split(' ').slice(1).join(' ')} :</td>
                      <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${b.color.text}`}>{b.section.total_articles.toLocaleString('fr-FR')}</td>
                      <td className="px-2 py-1.5"></td>
                      <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${b.color.text}`}>
                        {b.section.total_valeur_estimee > 0 ? Math.round(b.section.total_valeur_estimee).toLocaleString('fr-FR') + ' F' : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
            );
          });
        })()}

        <p className="text-[10px] text-gray-400 text-center mt-4 print:block hidden">
          Yukpo Librairie · Document généré automatiquement
        </p>
      </div>
    </div>
  );
};

/* ─── DASHBOARD ─── */
export const LibrairieDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const logout = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('yukpo_guest_account');
      window.dispatchEvent(new Event('tokens_updated'));
    } catch { /* nothing */ }
  };

  const [commandes, setCommandes] = useState<CommandeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [filter, setFilter] = useState<'all' | 'pending' | 'done'>('pending');
  const [showTeam, setShowTeam] = useState(false);
  const [showContacts, setShowContacts] = useState(false);
  const [showRoutes, setShowRoutes] = useState(false);
  const [showWholesale, setShowWholesale] = useState(false);

  // Garde anti-invité — la plateforme librairie nécessite un compte authentifié.
  useEffect(() => {
    if (!user || isGuestAccount()) {
      navigate('/login?source=shared_service&redirect=' + encodeURIComponent('/librairie'), { replace: true });
    }
  }, [user, navigate]);

  const [needsReauth, setNeedsReauth] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setNeedsReauth(false);
    try {
      const res = await apiGet('/api/librairie-network/super-librairie/commandes?limit=100');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          // JWT obsolète (rôle changé en base après le login) ou pas autorisé.
          // On propose une reconnexion immédiate pour rafraîchir le token.
          setNeedsReauth(true);
          throw new Error(t('librairie.session_expired'));
        }
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      const list: CommandeListItem[] = data?.commandes || [];
      setCommandes(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || t('librairie.error') + ' (commandes)');
    } finally {
      setLoading(false);
    }
  }, []);

  const reauth = () => {
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('yukpo_guest_account');
    } catch { /* */ }
    navigate('/login?source=shared_service&redirect=' + encodeURIComponent('/librairie'));
  };

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 30000); // Polling 30s pour suivi temps quasi-réel
    return () => clearInterval(t);
  }, [load]);

  const filtered = useMemo(() => {
    if (filter === 'pending') {
      return commandes.filter(c =>
        ['envoyee_super_librairie', 'envoyee_librairies', 'en_validation', 'validee_partielle'].includes(c.statut)
      );
    }
    if (filter === 'done') {
      return commandes.filter(c =>
        ['validee_complete', 'en_preparation', 'en_livraison', 'livree', 'annulee'].includes(c.statut)
      );
    }
    return commandes;
  }, [commandes, filter]);

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      {showTeam && <TeamModal onClose={() => setShowTeam(false)} />}
      {showContacts && <ContactsPanel onClose={() => setShowContacts(false)} />}
      {showRoutes && <DeliveryRoutesPanel onClose={() => setShowRoutes(false)} />}
      {showWholesale && <WholesalePanel onClose={() => setShowWholesale(false)} />}
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 pt-10 pb-5">
        <div className="max-w-3xl mx-auto">
          {/* Ligne 1 : retour + titre + déconnexion (toujours visible) */}
          <div className="flex items-center gap-3 mb-2.5">
            <button onClick={() => navigate('/')} className="p-2 rounded-full bg-white/20 shrink-0" aria-label={t('etabAdmin.dashboard.back')}>
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider uppercase">
                {t('librairie.title')}
              </span>
              <h1 className="font-bold text-lg leading-tight mt-1 truncate">{t('librairie.mes_commandes')}</h1>
              <p className="text-indigo-100 text-xs hidden sm:block">{t('librairie.validate_help')}</p>
            </div>
            <LanguageSwitcherBourse tone="white" />
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 shrink-0"
              title={t('librairie.logout')}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

          {/* Ligne 2 : actions (scroll horizontal sur mobile) */}
          <div className="flex items-center gap-2 mb-3 overflow-x-auto -mx-1 px-1 pb-1 scrollbar-none">
            <button
              onClick={() => setShowRoutes(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Truck className="w-3.5 h-3.5" />
              {t('librairie.tournees')}
            </button>
            <button
              onClick={() => setShowWholesale(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Warehouse className="w-3.5 h-3.5" />
              {t('librairie.grossiste')}
            </button>
            <button
              onClick={() => setShowContacts(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Megaphone className="w-3.5 h-3.5" />
              {t('librairie.parents')}
            </button>
            <button
              onClick={() => setShowTeam(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 hover:bg-white/25 text-xs font-semibold whitespace-nowrap shrink-0"
            >
              <Users className="w-3.5 h-3.5" />
              {t('librairie.equipe')}
            </button>
          </div>

          {/* Filtres */}
          <div className="inline-flex bg-white/15 backdrop-blur-sm rounded-full p-0.5 gap-0.5">
            {[
              { v: 'pending', label: t('librairie.tabs.pending'), n: commandes.filter(c => ['envoyee_super_librairie', 'envoyee_librairies', 'en_validation', 'validee_partielle'].includes(c.statut)).length },
              { v: 'done', label: t('librairie.tabs.done'), n: commandes.filter(c => ['validee_complete', 'en_preparation', 'en_livraison', 'livree', 'annulee'].includes(c.statut)).length },
              { v: 'all', label: t('librairie.tabs.all'), n: commandes.length },
            ].map(f => (
              <button
                key={f.v}
                onClick={() => setFilter(f.v as any)}
                className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                  filter === f.v ? 'bg-white text-indigo-700' : 'text-white/90'
                }`}
              >
                {f.label} <span className="opacity-70">({f.n})</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Refresh */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-gray-500">
            {t(filtered.length > 1 ? 'librairie.orders_count_other' : 'librairie.orders_count', { count: filtered.length })} · {t('librairie.auto_refresh')}
          </p>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            {t('librairie.refresh')}
          </button>
        </div>

        {loading && commandes.length === 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
            <p className="text-sm text-gray-500">{t('common.loading')}</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
            <p className="text-sm font-semibold text-red-800 mb-1">
              {needsReauth ? t('librairie.session_to_refresh') : t('librairie.error')}
            </p>
            <p className="text-xs text-red-700 mb-2">{error}</p>
            {needsReauth ? (
              <button
                onClick={reauth}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-xs font-bold"
              >
                {t('librairie.reauth_button')}
              </button>
            ) : (
              <button onClick={load} className="text-xs underline text-red-700 font-semibold">
                {t('librairie.retry')}
              </button>
            )}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <ShoppingBag className="w-12 h-12 text-indigo-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 mb-1">{t('librairie.nothing_to_show', 'Rien à afficher')}</p>
            <p className="text-xs text-gray-500">{t('librairie.no_orders')}</p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-2">
            {filtered.map(cmd => {
              const urgent = (cmd.secondes_restantes ?? 99999) < 600 && cmd.statut === 'envoyee_super_librairie';
              const ref = cmd.reference_commande || `#${cmd.id.slice(0, 8)}`;
              return (
                <button
                  key={cmd.id}
                  onClick={() => navigate(`/librairie/commandes/${cmd.id}`)}
                  className={`w-full text-left bg-white rounded-2xl border p-3 hover:shadow-md transition-shadow ${
                    urgent ? 'border-amber-400 ring-1 ring-amber-300' : 'border-gray-100'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 leading-tight">{ref}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold border ${STATUT_COLOR[cmd.statut] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                          {STATUT_LABELS[cmd.statut] || cmd.statut}
                        </span>
                        {urgent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold bg-red-500 text-white animate-pulse">
                            <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                            {Math.round((cmd.secondes_restantes ?? 0) / 60)} min
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-1">{formatDate(cmd.created_at)}</p>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-600">
                        {(cmd.nb_neufs ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {cmd.nb_neufs} neuf{(cmd.nb_neufs ?? 0) > 1 ? 's' : ''}
                          </span>
                        )}
                        {(cmd.nb_occasion ?? 0) > 0 && (
                          <span className="flex items-center gap-1">
                            <ShoppingBag className="w-3 h-3" />
                            {cmd.nb_occasion} occasion
                          </span>
                        )}
                      </div>
                      {cmd.adresse_livraison && (
                        <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{cmd.adresse_livraison}</span>
                        </p>
                      )}
                      <p className="text-sm font-bold text-indigo-700 mt-1.5">
                        {(cmd.budget_total || 0).toLocaleString('fr-FR')} {cmd.devise || 'XAF'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 mt-2 shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

/* ─── DETAIL ─── */
interface LigneNeuf {
  id: string;
  titre: string;
  auteur?: string;
  editeur?: string;
  classe?: string;
  matiere?: string;
  niveau?: string;
  prix_officiel?: number;
  prix_final?: number;
  quantite: number;
  statut?: 'en_attente' | 'valide' | 'indisponible';
}
interface LigneOccasion {
  id: string;
  titre?: string;
  livre_scolaire_id: number;
  prix?: number;
  quantite: number;
  statut?: 'en_attente' | 'valide' | 'indisponible';
}
interface CommandeDetail {
  id: string;
  reference_commande?: string;
  statut: CommandeStatut;
  budget_total?: number;
  devise?: string;
  adresse_livraison?: string;
  gps_livraison?: string;
  notes_client?: string;
  user_email?: string;
  created_at?: string;
  livres_neufs?: LigneNeuf[];
  livres_occasion?: LigneOccasion[];
}

interface ParentContact {
  phone?: string | null;
  email?: string | null;
  nom?: string | null;
}

/** Construit l'URL wa.me — accepte format local cameroun (6XX...) ou +237XXX. */
const buildWhatsAppUrl = (phone: string, message?: string): string => {
  let digits = phone.replace(/\D/g, '');
  // Si pas d'indicatif explicite, on suppose Cameroun (237) — la plupart des
  // numéros stockés sont locaux 9 chiffres "6XX XXX XXX".
  if (digits.length === 9 && digits.startsWith('6')) digits = '237' + digits;
  if (digits.length === 9 && digits.startsWith('2')) digits = '237' + digits;
  const base = `https://wa.me/${digits}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
};

/**
 * Construit le 1er message WhatsApp à envoyer au parent : salutation +
 * référence + récap des articles regroupés par classe (lecture rapide).
 * On utilise les emojis + sauts de ligne — wa.me les supporte parfaitement.
 */
const buildFirstWhatsAppMessage = (
  data: CommandeDetail,
  parentName?: string | null,
): string => {
  const lines: string[] = [];
  lines.push(`Bonjour ${parentName || ''}`.trim() + ' 👋');
  lines.push('');
  lines.push(`📦 *Yukpo Librairie* — votre commande ${data.reference_commande || `#${data.id.slice(0, 8)}`}`);
  if (data.created_at) {
    try {
      lines.push(`🗓 Reçue le ${new Date(data.created_at).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' })}`);
    } catch { /* ignore */ }
  }
  lines.push('');

  // Regroupement par classe (livres neufs + occasion confondus pour la vue parent)
  const byClasse = new Map<string, Array<{ titre: string; qty: number; type: 'neuf' | 'occasion' }>>();
  for (const l of data.livres_neufs || []) {
    const c = l.classe || 'Non précisée';
    if (!byClasse.has(c)) byClasse.set(c, []);
    byClasse.get(c)!.push({ titre: l.titre, qty: l.quantite, type: 'neuf' });
  }
  for (const l of data.livres_occasion || []) {
    const c = (l as any).classe || 'Occasion';
    if (!byClasse.has(c)) byClasse.set(c, []);
    byClasse.get(c)!.push({ titre: (l as any).titre || `Livre #${l.livre_scolaire_id}`, qty: l.quantite, type: 'occasion' });
  }

  if (byClasse.size === 0) {
    lines.push('_Aucun article dans cette commande._');
  } else {
    lines.push('🎒 *Récapitulatif par classe :*');
    for (const [classe, items] of byClasse.entries()) {
      lines.push('');
      lines.push(`📘 *${classe}* (${items.length} article${items.length > 1 ? 's' : ''})`);
      for (const it of items) {
        const tag = it.type === 'occasion' ? ' (occasion)' : '';
        lines.push(`  • ${it.qty} × ${it.titre}${tag}`);
      }
    }
  }

  if (data.budget_total && data.budget_total > 1) {
    lines.push('');
    lines.push(`💰 Budget : *${(data.budget_total).toLocaleString('fr-FR')} ${data.devise || 'XAF'}*`);
  }
  if (data.adresse_livraison) {
    lines.push(`📍 Livraison : ${data.adresse_livraison}`);
  }

  lines.push('');
  lines.push('Je suis votre libraire référent. Comment puis-je vous aider ? 😊');

  return lines.join('\n');
};

export const LibrairieCommandeDetailPage: React.FC = () => {
  const { commandeId } = useParams<{ commandeId: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const printRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<CommandeDetail | null>(null);
  const [parentContact, setParentContact] = useState<ParentContact | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedValid, setSelectedValid] = useState<Set<string>>(new Set());
  const [selectedIndispo, setSelectedIndispo] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!user || isGuestAccount()) {
      navigate('/login?source=shared_service&redirect=' + encodeURIComponent('/librairie'), { replace: true });
    }
  }, [user, navigate]);

  const load = useCallback(async () => {
    if (!commandeId) return;
    setLoading(true);
    setError('');
    try {
      const res = await apiGet(`/api/librairie-network/commandes/${commandeId}/details`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      // Backend renvoie { details: { commande, livres_neufs, livres_occasion },
      // parent_contact?: { phone, email, nom } }
      const dt = d?.details || d?.commande || d;
      // Aplatit pour l'UI : on fusionne les champs commande + lignes
      const flat: CommandeDetail = dt?.commande
        ? {
            ...dt.commande,
            livres_neufs: dt.livres_neufs || [],
            livres_occasion: dt.livres_occasion || [],
          }
        : dt;
      setData(flat);
      setParentContact(d?.parent_contact || null);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger la commande');
    } finally {
      setLoading(false);
    }
  }, [commandeId]);

  useEffect(() => { load(); }, [load]);

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void, id: string, otherSet?: Set<string>, setOther?: (s: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSet(next);
    if (otherSet?.has(id) && setOther) {
      const o = new Set(otherSet); o.delete(id); setOther(o);
    }
  };

  const submitValidation = async (notes?: string) => {
    if (!commandeId) return;
    if (selectedValid.size === 0 && selectedIndispo.size === 0) {
      toast({ title: 'Sélectionnez au moins une ligne', variant: 'destructive' });
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiPost('/api/librairie-network/validation/valider', {
        commande_id: commandeId,
        livres_valides: Array.from(selectedValid),
        livres_indisponibles: Array.from(selectedIndispo),
        notes_validation: notes || null,
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(d?.error || d?.message || `HTTP ${res.status}`);
      toast({ title: 'Validation enregistrée', description: 'Le client est notifié.' });
      setSelectedValid(new Set()); setSelectedIndispo(new Set());
      load();
    } catch (e: any) {
      toast({ title: 'Erreur', description: e?.message || 'Réessayez', variant: 'destructive' });
    } finally {
      setSubmitting(false);
    }
  };

  // Export PDF via window.print() — l'iframe d'impression utilise les styles
  // print: ci-dessous pour ne montrer que le contenu de la fiche.
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-10">
      <style>{`
        @media print {
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; }
        }
      `}</style>

      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white px-4 pt-10 pb-5 no-print">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/librairie')} className="p-2 rounded-full bg-white/20">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider uppercase">Yukpo Librairie</span>
            <h1 className="font-bold text-lg leading-tight mt-1">
              {data?.reference_commande || `Commande #${commandeId?.slice(0, 8) || ''}`}
            </h1>
          </div>
          <button
            onClick={handlePrint}
            disabled={!data}
            className="px-3 py-2 rounded-xl bg-white/15 hover:bg-white/25 flex items-center gap-1.5 text-xs font-semibold disabled:opacity-50"
            title="Imprimer / Export PDF"
          >
            <Printer className="w-4 h-4" />
            PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center">
            <Loader2 className="w-6 h-6 text-indigo-600 animate-spin mb-2" />
            <p className="text-sm text-gray-500">Chargement…</p>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
            <p className="text-sm font-semibold text-red-800 mb-1">Erreur</p>
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        {data && (
          <div ref={printRef} className="print-area bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
            {/* Infos */}
            <div className="border-b border-gray-100 pb-3 mb-3">
              <h2 className="font-bold text-gray-900 text-base">Yukpo Librairie</h2>
              <p className="text-xs text-gray-500">Bon de commande</p>
              <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-500">Référence : </span>
                  <span className="font-bold">{data.reference_commande || data.id}</span>
                </div>
                <div>
                  <span className="text-gray-500">Date : </span>
                  <span>{formatDate(data.created_at)}</span>
                </div>
                <div>
                  <span className="text-gray-500">Budget : </span>
                  <span className="font-bold text-indigo-700">
                    {(data.budget_total || 0).toLocaleString('fr-FR')} {data.devise || 'XAF'}
                  </span>
                </div>
                <div>
                  <span className="text-gray-500">Statut : </span>
                  <span className="font-semibold">{STATUT_LABELS[data.statut] || data.statut}</span>
                </div>
              </div>
              {data.adresse_livraison && (
                <p className="text-xs text-gray-700 mt-2 flex items-start gap-1">
                  <MapPin className="w-3 h-3 mt-0.5 shrink-0 text-amber-600" />
                  <span>{data.adresse_livraison}</span>
                </p>
              )}
              {data.notes_client && (
                <p className="text-xs text-gray-500 mt-1 italic">« {data.notes_client} »</p>
              )}

              {/* Contact parent — visible uniquement aux libraires (pas à l'owner).
                  Premier WhatsApp = récap complet par classe ; ensuite, message
                  court de relance. Le marqueur est stocké en localStorage par
                  commande (clé partagée entre membres de l'équipe sur le même
                  appareil). Cas non-imprimé pour ne pas exposer le tel sur le PDF. */}
              {parentContact?.phone && (
                <div className="no-print mt-3 bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-bold text-emerald-800 uppercase tracking-wide">Contact client</p>
                    <p className="text-xs text-emerald-900 font-semibold truncate">
                      {parentContact.nom || 'Parent'}
                      <span className="ml-1.5 font-normal text-emerald-700">{parentContact.phone}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const flagKey = `yukpo_libwa_sent_${data.id}`;
                      const alreadySent = !!localStorage.getItem(flagKey);
                      const message = alreadySent
                        ? `Bonjour ${parentContact.nom || ''}, ${data.reference_commande ? `à propos de votre commande ${data.reference_commande}` : 'concernant votre commande'} —`.trim()
                        : buildFirstWhatsAppMessage(data, parentContact.nom);
                      const url = buildWhatsAppUrl(parentContact.phone!, message);
                      // On marque "envoyé" dès l'ouverture du chat (le libraire
                      // peut envoyer ou pas, mais il a vu le récap pré-rempli).
                      try { localStorage.setItem(flagKey, new Date().toISOString()); } catch { /* nothing */ }
                      window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shrink-0"
                    title="Ouvrir WhatsApp avec un message pré-rempli"
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 fill-current" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.768.967-.941 1.164-.173.198-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z"/>
                    </svg>
                    WhatsApp
                  </button>
                </div>
              )}
            </div>

            {/* Livres neufs */}
            {data.livres_neufs && data.livres_neufs.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide mb-2">
                  Livres neufs ({data.livres_neufs.length})
                </h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-left py-1.5 pr-2 font-semibold no-print">Choix</th>
                      <th className="text-left py-1.5 pr-2 font-semibold">Titre</th>
                      <th className="text-left py-1.5 pr-2 font-semibold">Classe</th>
                      <th className="text-right py-1.5 pr-2 font-semibold">Qté</th>
                      <th className="text-right py-1.5 font-semibold">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.livres_neufs.map(l => {
                      const isV = selectedValid.has(l.id);
                      const isI = selectedIndispo.has(l.id);
                      const prix = l.prix_final ?? l.prix_officiel ?? 0;
                      return (
                        <tr key={l.id} className={`border-b border-gray-100 ${l.statut === 'valide' ? 'bg-emerald-50' : l.statut === 'indisponible' ? 'bg-red-50 line-through' : ''}`}>
                          <td className="py-1.5 pr-2 no-print">
                            <div className="flex gap-1">
                              <button
                                onClick={() => toggle(selectedValid, setSelectedValid, l.id, selectedIndispo, setSelectedIndispo)}
                                className={`w-6 h-6 rounded border flex items-center justify-center ${isV ? 'bg-emerald-500 border-emerald-500 text-white' : 'border-gray-300 text-gray-400 hover:border-emerald-400'}`}
                                title="Disponible"
                              >
                                <Check className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => toggle(selectedIndispo, setSelectedIndispo, l.id, selectedValid, setSelectedValid)}
                                className={`w-6 h-6 rounded border flex items-center justify-center ${isI ? 'bg-red-500 border-red-500 text-white' : 'border-gray-300 text-gray-400 hover:border-red-400'}`}
                                title="Indisponible"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="py-1.5 pr-2">
                            <p className="font-semibold text-gray-900 leading-tight">{l.titre}</p>
                            {(l.auteur || l.editeur) && (
                              <p className="text-[10px] text-gray-500 leading-tight">
                                {[l.auteur, l.editeur].filter(Boolean).join(' · ')}
                              </p>
                            )}
                          </td>
                          <td className="py-1.5 pr-2 text-gray-600">{l.classe}</td>
                          <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">{l.quantite}</td>
                          <td className="py-1.5 text-right font-semibold tabular-nums text-indigo-700">
                            {prix > 0 ? `${prix.toLocaleString('fr-FR')} F` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {/* Livres occasion */}
            {data.livres_occasion && data.livres_occasion.length > 0 && (
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase text-gray-700 tracking-wide mb-2">
                  Livres d'occasion ({data.livres_occasion.length})
                </h3>
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-600">
                      <th className="text-left py-1.5 pr-2 font-semibold">Titre</th>
                      <th className="text-right py-1.5 pr-2 font-semibold">Qté</th>
                      <th className="text-right py-1.5 font-semibold">Prix</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.livres_occasion.map(l => (
                      <tr key={l.id} className="border-b border-gray-100">
                        <td className="py-1.5 pr-2 font-semibold">{l.titre || `#${l.livre_scolaire_id}`}</td>
                        <td className="py-1.5 pr-2 text-right tabular-nums">{l.quantite}</td>
                        <td className="py-1.5 text-right tabular-nums text-orange-700 font-semibold">
                          {l.prix ? `${l.prix.toLocaleString('fr-FR')} F` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Footer print */}
            <p className="text-[10px] text-gray-400 text-center mt-4 print:block hidden">
              Bon généré par Yukpo Librairie · {new Date().toLocaleString('fr-FR')}
            </p>
          </div>
        )}

        {/* Actions */}
        {data && (selectedValid.size > 0 || selectedIndispo.size > 0) && (
          <div className="no-print fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-3 z-40">
            <div className="max-w-3xl mx-auto flex items-center gap-2">
              <p className="text-xs text-gray-600 flex-1">
                <span className="font-bold text-emerald-700">{selectedValid.size}</span> dispo · {' '}
                <span className="font-bold text-red-700">{selectedIndispo.size}</span> indispo
              </p>
              <button
                onClick={() => { setSelectedValid(new Set()); setSelectedIndispo(new Set()); }}
                className="px-3 py-2 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600"
              >
                Annuler
              </button>
              <button
                onClick={() => submitValidation()}
                disabled={submitting}
                className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold flex items-center gap-1.5"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <ClipboardCheck className="w-4 h-4" />}
                Soumettre
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LibrairieDashboardPage;
