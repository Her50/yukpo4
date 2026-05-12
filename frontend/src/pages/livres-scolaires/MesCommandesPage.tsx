import {
  ArrowLeft, BookOpen, CheckCircle, ChevronRight, Clock, Loader2,
  MapPin, Package, Repeat, ShoppingBag, Truck, XCircle,
} from 'lucide-react';
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';

/**
 * Page de suivi des commandes mixtes (livres neufs + occasion).
 *
 * Statuts attendus côté backend (commandes_mixtes.statut) :
 *   edition · validation_budget · envoyee_super_librairie · envoyee_librairies
 *   · en_validation · validee_partielle · validee_complete · en_preparation
 *   · en_livraison · livree · annulee
 */

type CommandeStatut =
  | 'edition' | 'validation_budget'
  | 'envoyee_super_librairie' | 'envoyee_librairies'
  | 'en_validation' | 'validee_partielle' | 'validee_complete'
  | 'en_preparation' | 'en_livraison' | 'livree' | 'annulee';

interface CommandeMixte {
  id: string;
  statut: CommandeStatut;
  budget_total: number;
  devise?: string;
  adresse_livraison?: string;
  super_librairie_timeout_at?: string;
  super_librairie_fallback_at?: string;
  created_at: string;
  livres_neufs_count?: number;
  livres_occasion_count?: number;
}

const STATUT_LABELS: Record<CommandeStatut, string> = {
  edition: 'En édition',
  validation_budget: 'Validation du budget',
  envoyee_super_librairie: 'Envoyée à YukpoLibrairie',
  envoyee_librairies: 'Envoyée aux librairies du réseau',
  en_validation: 'En validation par un libraire',
  validee_partielle: 'Partiellement validée',
  validee_complete: 'Entièrement validée',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUT_ICON: Record<CommandeStatut, React.FC<any>> = {
  edition: Package,
  validation_budget: Clock,
  envoyee_super_librairie: ShoppingBag,
  envoyee_librairies: Repeat,
  en_validation: Clock,
  validee_partielle: CheckCircle,
  validee_complete: CheckCircle,
  en_preparation: Package,
  en_livraison: Truck,
  livree: CheckCircle,
  annulee: XCircle,
};

const STATUT_COLOR: Record<CommandeStatut, string> = {
  edition: 'bg-gray-100 text-gray-700',
  validation_budget: 'bg-amber-100 text-amber-700',
  envoyee_super_librairie: 'bg-blue-100 text-blue-700',
  envoyee_librairies: 'bg-indigo-100 text-indigo-700',
  en_validation: 'bg-amber-100 text-amber-700',
  validee_partielle: 'bg-emerald-50 text-emerald-700',
  validee_complete: 'bg-emerald-100 text-emerald-700',
  en_preparation: 'bg-purple-100 text-purple-700',
  en_livraison: 'bg-orange-100 text-orange-700',
  livree: 'bg-emerald-100 text-emerald-700',
  annulee: 'bg-red-100 text-red-700',
};

const MesCommandesPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const focusId = searchParams.get('focus');

  const [commandes, setCommandes] = useState<CommandeMixte[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await apiGet('/api/librairie-network/mes-commandes');
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
      }
      const list: CommandeMixte[] =
        data?.commandes || data?.data?.commandes || data?.data || [];
      setCommandes(Array.isArray(list) ? list : []);
    } catch (e: any) {
      setError(e?.message || 'Impossible de charger les commandes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Re-fetch toutes les 30s pour suivre les statuts en temps quasi-réel
  useEffect(() => {
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, [load]);

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Header */}
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button onClick={() => navigate('/')} className="p-2 rounded-full bg-white/20" aria-label="Retour">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-bold bg-white/20 px-2 py-0.5 rounded-full tracking-wider">YUKPO</span>
            <h1 className="font-bold text-lg leading-tight mt-0.5">Mes commandes</h1>
            <p className="text-amber-100 text-xs">Suivi en temps réel des libraires</p>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {loading && (
          <div className="bg-white rounded-2xl border border-gray-100 p-8 flex flex-col items-center">
            <Loader2 className="w-6 h-6 text-amber-600 animate-spin mb-2" />
            <p className="text-sm text-gray-500">Chargement…</p>
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-3">
            <p className="text-sm font-semibold text-red-800 mb-1">Impossible de charger</p>
            <p className="text-xs text-red-700">{error}</p>
            <button onClick={load} className="mt-2 text-xs underline text-red-700 font-semibold">
              Réessayer
            </button>
          </div>
        )}

        {!loading && !error && commandes.length === 0 && (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-8 text-center">
            <ShoppingBag className="w-12 h-12 text-amber-300 mx-auto mb-2" />
            <p className="text-sm font-semibold text-gray-700 mb-1">Aucune commande</p>
            <p className="text-xs text-gray-500 mb-4">Scannez la liste de votre enfant pour passer commande.</p>
            <button
              onClick={() => navigate('/scan-programme')}
              className="bg-amber-500 text-white font-bold px-5 py-2.5 rounded-2xl text-sm"
            >
              Scanner une liste
            </button>
          </div>
        )}

        {!loading && !error && commandes.length > 0 && (
          <div className="space-y-2.5">
            {commandes.map(cmd => {
              const Icon = STATUT_ICON[cmd.statut] || Package;
              const isFocused = focusId && cmd.id === focusId;
              return (
                <div
                  key={cmd.id}
                  className={`bg-white rounded-2xl border p-3 ${isFocused ? 'border-amber-400 shadow-lg' : 'border-gray-100'}`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${STATUT_COLOR[cmd.statut] || 'bg-gray-100 text-gray-600'}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                          Commande #{cmd.id.slice(0, 8)}
                        </p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${STATUT_COLOR[cmd.statut]}`}>
                          {STATUT_LABELS[cmd.statut] || cmd.statut}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {new Date(cmd.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                        })}
                      </p>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-600">
                        {cmd.livres_neufs_count !== undefined && (
                          <span className="flex items-center gap-1">
                            <BookOpen className="w-3 h-3" />
                            {cmd.livres_neufs_count} neuf{cmd.livres_neufs_count > 1 ? 's' : ''}
                          </span>
                        )}
                        {cmd.livres_occasion_count !== undefined && cmd.livres_occasion_count > 0 && (
                          <span className="flex items-center gap-1">
                            <Repeat className="w-3 h-3" />
                            {cmd.livres_occasion_count} occasion
                          </span>
                        )}
                      </div>
                      {cmd.adresse_livraison && (
                        <p className="text-[11px] text-gray-500 mt-1 flex items-center gap-1 truncate">
                          <MapPin className="w-3 h-3 shrink-0" />
                          <span className="truncate">{cmd.adresse_livraison}</span>
                        </p>
                      )}
                      <p className="text-sm font-bold text-amber-700 mt-1.5">
                        {(cmd.budget_total || 0).toLocaleString('fr-FR')} {cmd.devise || 'XAF'}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-gray-400 mt-2 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <p className="text-center text-[11px] text-gray-400 mt-6">
          Mise à jour automatique toutes les 30 secondes
        </p>
      </div>
    </div>
  );
};

export default MesCommandesPage;
