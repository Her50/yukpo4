// ============================================================================
// CommandeDetailPage — détail d'une commande mixte (parent)
// ============================================================================
// Affichage en lecture seule du contenu + statut + suivi d'une commande
// passée par le parent. Source : GET /api/librairie-network/commandes/{id}/details
// ============================================================================

import {
  ArrowLeft, BookOpen, Check, Clock, MapPin, Package, Repeat,
  Truck, XCircle,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface CommandeLivreNeuf {
  id: string;
  titre: string;
  auteur?: string | null;
  classe: string;
  matiere: string;
  prix_final: number;
  quantite: number;
  statut_validation?: string | null;
}
interface CommandeLivreOccasion {
  id: string;
  titre: string;
  auteur?: string | null;
  classe: string;
  matiere: string;
  etat_livre?: string | null;
  prix: number;
  quantite: number;
  statut?: string | null;
}
interface CommandeDetails {
  id: string;
  reference_commande: string;
  statut: string;
  budget_total: number;
  devise: string;
  commission_app?: number;
  montant_net_libraires?: number;
  mode_livraison?: string | null;
  adresse_livraison?: string | null;
  gps_livraison?: string | null;
  notes_client?: string | null;
  created_at: string;
  updated_at: string;
  livres_neufs?: CommandeLivreNeuf[];
  livres_occasion?: CommandeLivreOccasion[];
}

const STATUT_LABELS: Record<string, string> = {
  edition: 'Brouillon',
  validation_budget: 'Budget validé',
  envoyee_librairies: 'Envoyée aux librairies',
  envoyee_super_librairie: 'Super-librairie',
  en_validation: 'Validation en cours',
  validee_partielle: 'Partiellement validée',
  validee_complete: 'Validée',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUT_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  edition: Clock,
  validation_budget: Check,
  envoyee_librairies: Package,
  en_validation: Clock,
  validee_partielle: Check,
  validee_complete: Check,
  en_preparation: Package,
  en_livraison: Truck,
  livree: Check,
  annulee: XCircle,
};

const TIMELINE_STEPS: { key: string; label: string }[] = [
  { key: 'validation_budget', label: 'Budget validé' },
  { key: 'envoyee_librairies', label: 'Envoyée aux librairies' },
  { key: 'validee_complete', label: 'Validée' },
  { key: 'en_preparation', label: 'En préparation' },
  { key: 'en_livraison', label: 'En livraison' },
  { key: 'livree', label: 'Livrée' },
];

const STATUS_ORDER: Record<string, number> = {
  edition: 0,
  validation_budget: 1,
  envoyee_librairies: 2,
  envoyee_super_librairie: 2,
  en_validation: 2,
  validee_partielle: 3,
  validee_complete: 3,
  en_preparation: 4,
  en_livraison: 5,
  livree: 6,
  annulee: -1,
};

const CommandeDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [cmd, setCmd] = useState<CommandeDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiGet(`/api/librairie-network/commandes/${id}/details`);
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || data?.success === false) {
          throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
        }
        // ✅ FIX 2026-05-18 — Le backend retourne :
        //   { success, details: { commande, livres_neufs, livres_occasion }, parent_contact }
        // L'objet commande est sous data.details.commande, livres séparés.
        const details = data.details || data;
        const c: CommandeDetails | undefined = details.commande
          ? {
              ...details.commande,
              livres_neufs: details.livres_neufs,
              livres_occasion: details.livres_occasion,
            }
          : details;
        if (!c?.id) throw new Error('Réponse serveur incomplète');
        setCmd(c);
      } catch (e: any) {
        if (!cancelled) setError(e?.message || 'Erreur de chargement');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const currentStep = useMemo(() => {
    if (!cmd) return 0;
    return STATUS_ORDER[cmd.statut] ?? 0;
  }, [cmd]);
  const isCancelled = cmd?.statut === 'annulee';

  const Icon = cmd ? STATUT_ICON[cmd.statut] || Package : Package;

  return (
    <div className="min-h-screen bg-gray-50 pb-32">
      <div className="bg-amber-600 px-4 pt-10 pb-5 text-white">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-full bg-white/20 active:bg-white/30"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <h1 className="font-bold text-lg flex-1">Détail de la commande</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-4">
        {loading && (
          <div className="text-center py-10 text-sm text-gray-500">Chargement…</div>
        )}
        {error && !loading && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-800">
            {error}
          </div>
        )}

        {cmd && !loading && (
          <>
            {/* En-tête statut */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
              <div className="flex items-start gap-3">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  isCancelled ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-500">
                    {cmd.reference_commande}
                  </p>
                  <p className="text-base font-bold text-gray-900 mt-0.5">
                    {STATUT_LABELS[cmd.statut] || cmd.statut}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Créée le{' '}
                    {new Date(cmd.created_at).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'long',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400">Total</p>
                  <p className="text-lg font-bold text-amber-700 tabular-nums">
                    {(cmd.budget_total || 0).toLocaleString('fr-FR')}{' '}
                    <span className="text-xs font-semibold">{cmd.devise || 'XAF'}</span>
                  </p>
                </div>
              </div>
            </div>

            {/* Timeline de suivi */}
            {!isCancelled && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-3">
                  Suivi
                </p>
                <ol className="space-y-2">
                  {TIMELINE_STEPS.map(step => {
                    const stepOrder = STATUS_ORDER[step.key] ?? 0;
                    const done = currentStep >= stepOrder;
                    const active = currentStep === stepOrder;
                    return (
                      <li
                        key={step.key}
                        className={`flex items-center gap-2.5 text-sm ${
                          done ? 'text-gray-800' : 'text-gray-400'
                        }`}
                      >
                        <span
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                            done
                              ? 'bg-amber-500 text-white'
                              : active
                                ? 'bg-amber-100 text-amber-700 ring-2 ring-amber-300'
                                : 'bg-gray-100 text-gray-400'
                          }`}
                        >
                          {done ? '✓' : ''}
                        </span>
                        <span className={done ? 'font-semibold' : ''}>
                          {step.label}
                        </span>
                      </li>
                    );
                  })}
                </ol>
              </div>
            )}

            {/* Livraison */}
            {(cmd.adresse_livraison || cmd.mode_livraison) && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
                <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">
                  Livraison
                </p>
                {cmd.mode_livraison && (
                  <p className="text-xs text-gray-600 mb-1">
                    Mode :{' '}
                    <span className="font-semibold text-gray-800">{cmd.mode_livraison}</span>
                  </p>
                )}
                {cmd.adresse_livraison && (
                  <p className="text-sm text-gray-800 flex items-start gap-1.5">
                    <MapPin className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                    <span>{cmd.adresse_livraison}</span>
                  </p>
                )}
                {cmd.notes_client && (
                  <p className="text-xs text-gray-500 italic mt-2">
                    Note : {cmd.notes_client}
                  </p>
                )}
              </div>
            )}

            {/* Livres neufs */}
            {cmd.livres_neufs && cmd.livres_neufs.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <BookOpen className="w-4 h-4 text-amber-600" />
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500">
                    Livres neufs ({cmd.livres_neufs.length})
                  </p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {cmd.livres_neufs.map(l => (
                    <li key={l.id} className="py-2.5 flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                          {l.titre}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {l.matiere} · {l.classe}
                          {l.auteur ? ` · ${l.auteur}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">×{l.quantite}</p>
                        <p className="text-sm font-bold text-amber-700 tabular-nums">
                          {(l.prix_final * l.quantite).toLocaleString('fr-FR')} F
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Livres occasion */}
            {cmd.livres_occasion && cmd.livres_occasion.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <Repeat className="w-4 h-4 text-cyan-600" />
                  <p className="text-xs uppercase tracking-wider font-bold text-gray-500">
                    Livres d'occasion ({cmd.livres_occasion.length})
                  </p>
                </div>
                <ul className="divide-y divide-gray-100">
                  {cmd.livres_occasion.map(l => (
                    <li key={l.id} className="py-2.5 flex items-start gap-2.5">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900 leading-tight">
                          {l.titre}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          {l.matiere} · {l.classe}
                          {l.etat_livre ? ` · ${l.etat_livre}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-gray-500">×{l.quantite}</p>
                        <p className="text-sm font-bold text-cyan-700 tabular-nums">
                          {(l.prix * l.quantite).toLocaleString('fr-FR')} F
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Récap financier */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-3">
              <p className="text-xs uppercase tracking-wider font-bold text-gray-500 mb-2">
                Récap
              </p>
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Total commandé</span>
                  <span className="font-bold text-gray-900 tabular-nums">
                    {(cmd.budget_total || 0).toLocaleString('fr-FR')} {cmd.devise || 'XAF'}
                  </span>
                </div>
                {cmd.commission_app !== undefined && cmd.commission_app > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Commission Yukpo</span>
                    <span className="text-gray-500 tabular-nums">
                      {cmd.commission_app.toLocaleString('fr-FR')} {cmd.devise || 'XAF'}
                    </span>
                  </div>
                )}
                {cmd.montant_net_libraires !== undefined && cmd.montant_net_libraires > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-500">Net libraires</span>
                    <span className="text-gray-500 tabular-nums">
                      {cmd.montant_net_libraires.toLocaleString('fr-FR')} {cmd.devise || 'XAF'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default CommandeDetailPage;
