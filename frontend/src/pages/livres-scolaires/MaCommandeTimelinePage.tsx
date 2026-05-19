// =============================================================================
// MaCommandeTimelinePage.tsx — 2026-05-19 MVP3
// -----------------------------------------------------------------------------
// Vue parent du suivi commande Bourse du Livre :
//   - Timeline événements (statut commande → wireframe ARCHITECTURE §7)
//   - Liste articles avec statut par livre
//   - Bouton "Refuser à la réception" sur les livres `valide` quand le paquet
//     est `en_route`/`livre` (cf. ARCHITECTURE §5 source C)
//
// Backend wrappers : src/services/parentCommandesApi.ts
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Truck,
  Package as PackageIcon,
  MapPin,
  X,
  Loader2,
  ChevronLeft,
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import {
  getMaCommandeDetail,
  listMesPaquetsRecevoir,
  parentRefuseArticle,
  type MaCommandeDetail,
  type MaCommandeLivreNeuf,
} from '@/services/parentCommandesApi';
import type { BookDeliveryPackage } from '@/services/bourseDeliveryApi';
import formatCurrency from '@/utils/formatCurrency';

const STATUT_LIVRE_LABEL: Record<string, string> = {
  en_attente: 'En attente validation',
  valide: 'Validé',
  refuse: 'Refusé librairie',
  rupture_grossiste: 'Rupture grossiste',
  libere_libraires: 'Libéré libraires_proches',
  annule_rupture: 'Annulé (rupture)',
  refuse_coursier: 'Refusé (coursier)',
  refuse_parent: 'Refusé par moi',
};

const STATUT_LIVRE_COLOR: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  valide: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-rose-100 text-rose-700',
  rupture_grossiste: 'bg-orange-100 text-orange-700',
  libere_libraires: 'bg-blue-100 text-blue-700',
  annule_rupture: 'bg-slate-200 text-slate-700',
  refuse_coursier: 'bg-rose-100 text-rose-700',
  refuse_parent: 'bg-purple-100 text-purple-700',
};

const STATUT_COMMANDE_FLOW: { key: string; label: string; icon: any }[] = [
  { key: 'edition', label: 'Commande créée', icon: PackageIcon },
  { key: 'validation_budget', label: 'Budget validé', icon: CheckCircle2 },
  { key: 'envoyee_super_librairie', label: 'Reçue par Yukpo Librairie', icon: Clock },
  { key: 'envoyee_librairies', label: 'Diffusée aux libraires', icon: Clock },
  { key: 'validee_partielle', label: 'Validation partielle', icon: CheckCircle2 },
  { key: 'validee_complete', label: 'Validée complète', icon: CheckCircle2 },
  { key: 'en_preparation', label: 'En préparation', icon: PackageIcon },
  { key: 'en_livraison', label: 'En livraison', icon: Truck },
  { key: 'livree', label: 'Livrée', icon: CheckCircle2 },
];

const MaCommandeTimelinePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [detail, setDetail] = useState<MaCommandeDetail | null>(null);
  const [packages, setPackages] = useState<BookDeliveryPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [refusingId, setRefusingId] = useState<string | null>(null);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [d, pkgs] = await Promise.all([
        getMaCommandeDetail(id),
        listMesPaquetsRecevoir().catch(() => [] as BookDeliveryPackage[]),
      ]);
      setDetail(d);
      setPackages(pkgs);
    } catch (e: any) {
      toast.error(`Erreur chargement : ${e?.message ?? 'inconnu'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Reconstruit le paquet contenant un livre neuf à partir du livres JSONB.
  const packageForLivre = useMemo(() => {
    const map = new Map<string, BookDeliveryPackage>();
    for (const pkg of packages) {
      const livres: any[] = (pkg as any).livres ?? [];
      for (const item of livres) {
        const livreId = item?.commande_livre_neuf_id;
        if (livreId && !map.has(livreId)) {
          map.set(livreId, pkg);
        }
      }
    }
    return map;
  }, [packages]);

  const handleRefuse = async (livre: MaCommandeLivreNeuf) => {
    const pkg = packageForLivre.get(livre.id);
    if (!pkg) {
      toast.error('Aucun paquet trouvé pour ce livre — il n\'est peut-être pas encore en livraison.');
      return;
    }
    const ok = window.confirm(
      `Refuser "${livre.titre}" à la livraison ?\n\nLe coursier reprendra l'article et ton total sera réduit de ${formatCurrency(
        livre.prix_final ?? 0,
        'XAF',
      )}.`,
    );
    if (!ok) return;

    setRefusingId(livre.id);
    try {
      const res = await parentRefuseArticle(pkg.id, {
        commande_livre_neuf_id: livre.id,
        motif: 'ne_correspond_pas',
      });
      toast.success(
        `Refusé. Nouveau total -${formatCurrency(res.montant_deduit, 'XAF')}. Reste ${res.nouveau_nombre_livres} livre(s).`,
      );
      await load();
    } catch (e: any) {
      toast.error(`Erreur refus : ${e?.message ?? 'inconnu'}`);
    } finally {
      setRefusingId(null);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-slate-600">Chargement de la commande…</p>
        </div>
      </AppLayout>
    );
  }

  if (!detail) {
    return (
      <AppLayout>
        <div className="mx-auto max-w-4xl px-4 py-16 text-center text-slate-600">
          <p>Commande introuvable.</p>
          <Link to="/mes-commandes" className="text-primary mt-3 inline-block">
            ← Mes commandes
          </Link>
        </div>
      </AppLayout>
    );
  }

  const cmd = detail.commande;
  const livresNeufs = detail.livres_neufs ?? [];
  const livresOccasion = detail.livres_occasion ?? [];

  const currentStatutIdx = STATUT_COMMANDE_FLOW.findIndex((s) => s.key === cmd.statut);

  // Un livre est éligible au refus parent si :
  //   1. statut_validation = 'valide' (donc destiné à être livré)
  //   2. ET la commande est en cours de livraison ou livrée (sinon pas encore au point de réception)
  const refusEligible = (l: MaCommandeLivreNeuf) =>
    l.statut_validation === 'valide' &&
    ['en_preparation', 'en_livraison', 'livree'].includes(cmd.statut || '');

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl px-4 py-8">
        <Link
          to="/mes-commandes"
          className="text-sm text-slate-600 hover:text-primary flex items-center gap-1 mb-4"
        >
          <ChevronLeft className="w-4 h-4" /> Mes commandes
        </Link>

        <header className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-1">
            {cmd.reference_commande || `Commande ${cmd.id.slice(0, 8)}`}
          </h1>
          <p className="text-slate-600 text-sm">
            {livresNeufs.length} livres neufs · {livresOccasion.length} livres occasion ·{' '}
            <strong>{formatCurrency(cmd.budget_total ?? 0, cmd.devise ?? 'XAF')}</strong>
          </p>
          {cmd.adresse_livraison && (
            <p className="text-slate-500 text-xs mt-1 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {cmd.adresse_livraison}
            </p>
          )}
        </header>

        {/* Timeline */}
        <section className="mb-10">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Avancement</h2>
          <ol className="space-y-3">
            {STATUT_COMMANDE_FLOW.map((step, idx) => {
              const reached = idx <= currentStatutIdx;
              const isCurrent = idx === currentStatutIdx;
              const Icon = step.icon;
              return (
                <li key={step.key} className="flex items-start gap-3">
                  <span
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                      reached
                        ? isCurrent
                          ? 'bg-primary text-white'
                          : 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                  </span>
                  <div className="flex-1">
                    <p
                      className={`text-sm ${
                        reached ? 'text-slate-900 font-medium' : 'text-slate-400'
                      }`}
                    >
                      {step.label}
                    </p>
                    {isCurrent && (
                      <p className="text-xs text-primary mt-0.5">Étape actuelle</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        {/* Articles neufs */}
        <section className="mb-8">
          <h2 className="text-lg font-semibold text-slate-900 mb-3">
            Livres neufs ({livresNeufs.length})
          </h2>
          {livresNeufs.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun livre neuf dans cette commande.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Titre</th>
                    <th className="text-left px-3 py-2">Classe</th>
                    <th className="text-right px-3 py-2">Prix</th>
                    <th className="text-left px-3 py-2">Statut</th>
                    <th className="text-right px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {livresNeufs.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{l.titre}</p>
                        {l.auteur && <p className="text-xs text-slate-500">{l.auteur}</p>}
                      </td>
                      <td className="px-3 py-2 text-slate-600">
                        {l.classe ?? '—'}
                        {l.matiere && <span className="text-xs text-slate-400 block">{l.matiere}</span>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-900">
                        {formatCurrency(l.prix_final ?? 0, cmd.devise ?? 'XAF')}
                      </td>
                      <td className="px-3 py-2">
                        <Badge
                          className={
                            STATUT_LIVRE_COLOR[l.statut_validation || ''] ||
                            'bg-slate-100 text-slate-700'
                          }
                        >
                          {STATUT_LIVRE_LABEL[l.statut_validation || ''] ?? l.statut_validation}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">
                        {refusEligible(l) && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRefuse(l)}
                            disabled={refusingId !== null}
                          >
                            {refusingId === l.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <>
                                <X className="w-3 h-3 mr-1" /> Refuser
                              </>
                            )}
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Articles occasion (read-only pour MVP3) */}
        {livresOccasion.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold text-slate-900 mb-3">
              Livres occasion ({livresOccasion.length})
            </h2>
            <p className="text-xs text-slate-500 mb-2">
              Le refus livraison parent-side est pour l'instant limité aux livres neufs (MVP3).
              Pour un livre occasion endommagé, contacte le support.
            </p>
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2">Titre</th>
                    <th className="text-right px-3 py-2">Prix</th>
                    <th className="text-left px-3 py-2">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {livresOccasion.map((l) => (
                    <tr key={l.id} className="border-t border-slate-100">
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-900">{l.titre}</p>
                        {l.auteur && <p className="text-xs text-slate-500">{l.auteur}</p>}
                      </td>
                      <td className="px-3 py-2 text-right text-slate-900">
                        {formatCurrency(l.prix ?? 0, cmd.devise ?? 'XAF')}
                      </td>
                      <td className="px-3 py-2">
                        <Badge className="bg-slate-100 text-slate-700">{l.statut ?? '—'}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Rappel si rupture */}
        {livresNeufs.some((l) =>
          ['rupture_grossiste', 'libere_libraires', 'annule_rupture'].includes(
            l.statut_validation || '',
          ),
        ) && (
          <section className="mt-6 rounded-lg border-l-4 border-orange-400 bg-orange-50 p-4">
            <p className="text-sm text-orange-900 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              Certains articles sont en rupture grossiste. Yukpo Librairie les a libérés
              auprès des libraires_proches (délai 48h). Tu seras notifié dès qu'un
              libraire les valide, ou si l'article est annulé.
            </p>
          </section>
        )}
      </div>
    </AppLayout>
  );
};

export default MaCommandeTimelinePage;
