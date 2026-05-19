// =============================================================================
// BookDeliveryFlowPage.tsx — Écran coursier pour le flow Bourse du Livre
//
// Reproduit en web la logique de mobile/BookCourierSubDashboard.tsx
// (référence : src/components/delivery/BookCourierSubDashboard.tsx).
//
// Coursier voit ses paquets assignés (manuellement par Yukpo Librairie via
// l'admin dashboard), peut transitionner les statuts (constitue → en_route →
// livre → confirme) et refuser un livre occasion/troc trop dégradé à la
// collecte (POST /packages/cancel-book — crédite auto le wallet du
// destinataire si applicable).
// =============================================================================

import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, BookOpen, AlertTriangle, CheckCircle2, Loader2, MapPin, Phone, RefreshCcw } from 'lucide-react';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import formatCurrency from '@/utils/formatCurrency';
import {
  listCourierPackages,
  coursierRefuseBook,
  updatePackageStatus,
  type BookDeliveryPackage,
  type BookDeliveryItem,
  type PackageStatut,
} from '@/services/bourseDeliveryApi';

const STATUT_LABELS: Record<string, { label: string; color: string }> = {
  en_construction: { label: 'En construction', color: 'bg-gray-200 text-gray-700' },
  constitue:       { label: 'Constitué',       color: 'bg-blue-100 text-blue-800' },
  en_route:        { label: 'En route',        color: 'bg-purple-100 text-purple-800' },
  livre:           { label: 'Livré',           color: 'bg-emerald-100 text-emerald-800' },
  confirme:        { label: 'Confirmé',        color: 'bg-emerald-200 text-emerald-900' },
  annule:          { label: 'Annulé',          color: 'bg-red-100 text-red-700' },
};

const NEXT_STATUT: Record<string, PackageStatut | null> = {
  en_construction: 'constitue',
  constitue: 'en_route',
  en_route: 'livre',
  livre: 'confirme',
  confirme: null,
  annule: null,
};

const NEXT_LABEL: Record<string, string> = {
  en_construction: 'Marquer constitué',
  constitue: 'Démarrer livraison',
  en_route: 'Arrivé chez le parent',
  livre: 'Confirmer paiement',
};

/** Tri par état logique de progression. */
function sortPackages(pkgs: BookDeliveryPackage[]): BookDeliveryPackage[] {
  const order: Record<string, number> = {
    en_route: 0, constitue: 1, en_construction: 2, livre: 3, confirme: 4, annule: 5,
  };
  return [...pkgs].sort((a, b) => (order[a.statut] ?? 9) - (order[b.statut] ?? 9));
}

const BookDeliveryFlowPage: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [packages, setPackages] = useState<BookDeliveryPackage[]>([]);
  /** Empêche le double-clic sur transitions/refus (anti-doublon UI). */
  const [busyAction, setBusyAction] = useState<string | null>(null);
  /** Modal refus livre */
  const [refusModal, setRefusModal] = useState<{
    packageId: number;
    livreId: number;
    titre: string;
  } | null>(null);
  const [refusRaison, setRefusRaison] = useState<string>('trop_degrade');

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const pkgs = await listCourierPackages();
      setPackages(sortPackages(pkgs));
    } catch (err: any) {
      console.error('[BookDeliveryFlowPage] Erreur chargement:', err);
      toast.error('Impossible de charger les paquets Bourse du Livre');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ---------------------------------------------------------------------------
  // Actions
  // ---------------------------------------------------------------------------

  /** Transition statut paquet vers le suivant. Anti-doublon via busyAction. */
  const handleNextStatut = async (pkg: BookDeliveryPackage) => {
    const next = NEXT_STATUT[pkg.statut];
    if (!next) return;
    const key = `statut:${pkg.id}`;
    if (busyAction === key) return; // déjà en cours
    setBusyAction(key);
    try {
      const r = await updatePackageStatus(pkg.id, next);
      if (r.success) {
        toast.success(`Statut → ${STATUT_LABELS[next]?.label ?? next}`);
        await loadData();
      } else {
        toast.error('Échec du changement de statut');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur transition statut');
    } finally {
      setBusyAction(null);
    }
  };

  /** Ouverture modal refus livre. */
  const openRefusModal = (packageId: number, livreId: number, titre: string) => {
    setRefusRaison('trop_degrade');
    setRefusModal({ packageId, livreId, titre });
  };

  /** Confirmation refus livre — anti-doublon via busyAction. */
  const confirmerRefus = async () => {
    if (!refusModal) return;
    const key = `refus:${refusModal.packageId}:${refusModal.livreId}`;
    if (busyAction === key) return;
    setBusyAction(key);
    try {
      const r = await coursierRefuseBook({
        package_id: refusModal.packageId,
        livre_id: refusModal.livreId,
        raison: refusRaison,
      });
      if (r.success) {
        const credit = r.data?.credit_amount ?? 0;
        toast.success(
          credit > 0
            ? `Livre retiré. ${formatCurrency(credit, 'XAF')} crédités au destinataire.`
            : 'Livre retiré du paquet.',
        );
        setRefusModal(null);
        await loadData();
      } else {
        toast.error('Échec du refus du livre');
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Erreur lors du refus');
    } finally {
      setBusyAction(null);
    }
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[60vh] text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Chargement des paquets…
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 space-y-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-md"
            aria-label="Retour"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <BookOpen className="w-6 h-6 text-emerald-600" />
          <h1 className="text-xl font-bold flex-1">Mes livraisons Bourse du Livre</h1>
          <button
            onClick={loadData}
            className="p-2 hover:bg-gray-100 rounded-md"
            title="Rafraîchir"
            aria-label="Rafraîchir"
          >
            <RefreshCcw className="w-5 h-5" />
          </button>
        </div>

        {packages.length === 0 && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center text-amber-900">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
            <p className="font-medium">Aucun paquet assigné pour le moment.</p>
            <p className="text-sm mt-1">
              Yukpo Librairie vous assigne manuellement les paquets à livrer. Rafraîchissez plus tard.
            </p>
          </div>
        )}

        {packages.map((pkg) => {
          const statutInfo = STATUT_LABELS[pkg.statut] ?? { label: pkg.statut, color: 'bg-gray-100' };
          const nextStatut = NEXT_STATUT[pkg.statut];
          const totalEnAttente = formatCurrency(pkg.montant_a_encaisser ?? 0, pkg.devise ?? 'XAF');

          return (
            <div key={pkg.id} className="bg-white border border-gray-200 rounded-xl shadow-sm p-4 space-y-3">
              {/* Header paquet */}
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={statutInfo.color}>{statutInfo.label}</Badge>
                    <span className="text-xs text-gray-500">#{pkg.id}</span>
                    {pkg.reference && (
                      <span className="text-xs text-gray-400">{pkg.reference}</span>
                    )}
                  </div>
                  <div className="text-sm font-semibold text-gray-900">
                    Destinataire : {pkg.destinataire_nom ?? `User ${pkg.destinataire_id}`}
                  </div>
                  {pkg.destinataire_telephone && (
                    <a
                      href={`tel:${pkg.destinataire_telephone}`}
                      className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                    >
                      <Phone className="w-3 h-3" />
                      {pkg.destinataire_telephone}
                    </a>
                  )}
                  {pkg.destinataire_adresse && (
                    <div className="text-xs text-gray-600 mt-0.5 inline-flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {pkg.destinataire_adresse}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-500">À encaisser</div>
                  <div className="font-bold text-lg text-emerald-700">{totalEnAttente}</div>
                </div>
              </div>

              {/* Liste livres */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                {pkg.livres.length === 0 && (
                  <p className="text-sm text-gray-500 italic">Aucun livre dans ce paquet.</p>
                )}
                {pkg.livres.map((item: BookDeliveryItem, idx) => {
                  const refusable = pkg.statut === 'en_construction' || pkg.statut === 'constitue';
                  const refusKey = `refus:${pkg.id}:${item.livre_id}`;
                  const isRefusing = busyAction === refusKey;
                  return (
                    <div key={`${pkg.id}-${idx}`} className="flex items-start justify-between gap-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-gray-900 truncate">{item.titre}</div>
                        <div className="text-xs text-gray-500 flex flex-wrap gap-x-2">
                          {item.classe && <span>{item.classe}</span>}
                          {item.matiere && <span>· {item.matiere}</span>}
                          {item.mode && <span>· {item.mode}</span>}
                          {item.etat_livre && <span>· état {item.etat_livre}</span>}
                          {item.vendeur_nom && (
                            <span>· chez {item.vendeur_nom}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {item.prix !== undefined && item.prix !== null && (
                          <span className="text-xs text-gray-700">
                            {formatCurrency(item.prix, 'XAF')}
                          </span>
                        )}
                        {refusable && item.livre_id && (item.mode === 'occasion' || item.mode === 'troc') && (
                          <button
                            disabled={isRefusing}
                            onClick={() => openRefusModal(pkg.id, item.livre_id!, item.titre)}
                            className="text-[11px] px-2 py-0.5 rounded bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
                            title="Refuser ce livre (trop dégradé / introuvable)"
                          >
                            {isRefusing ? <Loader2 className="w-3 h-3 animate-spin" /> : <AlertTriangle className="w-3 h-3" />}
                            Refuser
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Action transition statut */}
              {nextStatut && (
                <div className="border-t border-gray-100 pt-3">
                  <Button
                    onClick={() => handleNextStatut(pkg)}
                    disabled={busyAction === `statut:${pkg.id}`}
                    className="w-full"
                  >
                    {busyAction === `statut:${pkg.id}` ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Mise à jour…</>
                    ) : (
                      <><CheckCircle2 className="w-4 h-4 mr-2" /> {NEXT_LABEL[pkg.statut]}</>
                    )}
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Modal refus livre */}
      {refusModal && (
        <div
          className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-xl max-w-md w-full p-5 space-y-3">
            <h3 className="font-bold text-lg flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Refuser un livre
            </h3>
            <p className="text-sm text-gray-600">
              Refus de <strong>{refusModal.titre}</strong>. Le livre sera retiré du paquet,
              le destinataire crédité automatiquement si applicable, et le total à
              encaisser recalculé.
            </p>
            <label className="block text-sm">
              <span className="text-gray-700 font-medium">Motif</span>
              <select
                value={refusRaison}
                onChange={(e) => setRefusRaison(e.target.value)}
                className="mt-1 w-full border border-gray-300 rounded-md p-2 text-sm"
              >
                <option value="trop_degrade">Livre trop dégradé</option>
                <option value="introuvable">Livre introuvable</option>
                <option value="vendeur_absent">Vendeur absent</option>
                <option value="autre">Autre</option>
              </select>
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="ghost"
                onClick={() => setRefusModal(null)}
                disabled={busyAction !== null}
              >
                Annuler
              </Button>
              <Button
                onClick={confirmerRefus}
                disabled={busyAction !== null}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {busyAction ? (
                  <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Confirmation…</>
                ) : (
                  'Confirmer le refus'
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
};

export default BookDeliveryFlowPage;
