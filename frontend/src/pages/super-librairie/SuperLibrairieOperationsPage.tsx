// =============================================================================
// SuperLibrairieOperationsPage.tsx — 2026-05-19 MVP2
// -----------------------------------------------------------------------------
// Dashboard opérationnel pour Yukpo Librairie : gérer les ruptures grossiste
// (marquage batch + libération vers libraires_proches) et assigner les
// coursiers aux paquets `constitue`.
//
// Backend wrappers : src/services/superLibrairieOpsApi.ts
// Architecture     : ARCHITECTURE_WORKFLOW_YUKPO_LIBRAIRIE.md §5 + §10
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'react-hot-toast';
import {
  AlertTriangle,
  Send,
  Loader2,
  RefreshCw,
  CheckCircle2,
  Clock,
  Package,
  User,
  X,
} from 'lucide-react';
import {
  listCommandesSuperLib,
  getCommandeDetails,
  marquerRuptureArticles,
  libererArticles,
  listAvailableCouriers,
  assignCourierToPackage,
  type CommandeSuperLib,
  type LivreNeufDetail,
  type CourierAvailable,
} from '@/services/superLibrairieOpsApi';
import formatCurrency from '@/utils/formatCurrency';

type Tab = 'ruptures' | 'coursiers';

const STATUT_LABEL: Record<string, string> = {
  en_attente: 'En attente',
  valide: 'Validé',
  refuse: 'Refusé',
  rupture_grossiste: 'Rupture grossiste',
  libere_libraires: 'Libéré (libraires_proches)',
  annule_rupture: 'Annulé (rupture)',
  refuse_coursier: 'Refusé (coursier)',
  refuse_parent: 'Refusé (parent)',
};

const STATUT_COLOR: Record<string, string> = {
  en_attente: 'bg-amber-100 text-amber-700',
  valide: 'bg-emerald-100 text-emerald-700',
  refuse: 'bg-rose-100 text-rose-700',
  rupture_grossiste: 'bg-orange-100 text-orange-700',
  libere_libraires: 'bg-blue-100 text-blue-700',
  annule_rupture: 'bg-slate-200 text-slate-700',
  refuse_coursier: 'bg-rose-100 text-rose-700',
  refuse_parent: 'bg-rose-100 text-rose-700',
};

const SuperLibrairieOperationsPage: React.FC = () => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('ruptures');

  return (
    <AppLayout>
      <div className="mx-auto max-w-7xl px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">
            {t('yukpoLib.ops.title', 'Yukpo Librairie — Opérations')}
          </h1>
          <p className="text-slate-600 text-sm">
            {t(
              'yukpoLib.ops.subtitle',
              'Cascade rupture grossiste + libération libraires_proches + assignation coursier',
            )}
          </p>
        </header>

        <nav className="flex gap-2 mb-6 border-b border-slate-200">
          <TabButton current={tab} value="ruptures" onClick={() => setTab('ruptures')}>
            <AlertTriangle className="w-4 h-4" /> {t('yukpoLib.ops.tabRuptures', 'Ruptures')}
          </TabButton>
          <TabButton current={tab} value="coursiers" onClick={() => setTab('coursiers')}>
            <User className="w-4 h-4" /> {t('yukpoLib.ops.tabCoursiers', 'Assigner coursier')}
          </TabButton>
        </nav>

        {tab === 'ruptures' && <RupturesTab />}
        {tab === 'coursiers' && <CoursiersTab />}
      </div>
    </AppLayout>
  );
};

// -----------------------------------------------------------------------------
// Tab button
// -----------------------------------------------------------------------------

const TabButton: React.FC<{
  current: Tab;
  value: Tab;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ current, value, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    className={`px-4 py-2 -mb-px border-b-2 text-sm font-medium flex items-center gap-2 ${
      current === value
        ? 'border-primary text-primary'
        : 'border-transparent text-slate-600 hover:text-slate-900'
    }`}
  >
    {children}
  </button>
);

// =============================================================================
// TAB 1 — Ruptures grossiste
// =============================================================================

const RupturesTab: React.FC = () => {
  const [commandes, setCommandes] = useState<CommandeSuperLib[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [selected, setSelected] = useState<CommandeSuperLib | null>(null);

  const loadCommandes = async () => {
    setLoadingList(true);
    try {
      const items = await listCommandesSuperLib(100);
      setCommandes(items);
    } catch (e: any) {
      toast.error(`Erreur chargement commandes : ${e?.message ?? 'inconnu'}`);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadCommandes();
  }, []);

  const filtered = useMemo(() => {
    // Pour MVP2 : on liste tout, mais on met en évidence celles qui ont
    // potentiellement des livres à marquer en rupture.
    return commandes;
  }, [commandes]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* Liste */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-slate-900">{t('yukpoLib.ops.commandes', 'Commandes')}</h2>
          <Button variant="outline" size="sm" onClick={loadCommandes}>
            <RefreshCw className="w-4 h-4 mr-1" /> Refresh
          </Button>
        </div>
        {loadingList ? (
          <div className="text-slate-500 text-sm py-6">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
            Chargement…
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-slate-500 text-sm py-6">Aucune commande.</p>
        ) : (
          <ul className="space-y-2 max-h-[70vh] overflow-y-auto pr-2">
            {filtered.map((cmd) => (
              <li
                key={cmd.id}
                onClick={() => setSelected(cmd)}
                className={`p-3 rounded-lg border cursor-pointer transition ${
                  selected?.id === cmd.id
                    ? 'border-primary bg-primary/5'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 text-sm truncate">
                      {cmd.reference_commande ?? cmd.id.slice(0, 8)}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {cmd.livres_neufs_count ?? 0} neufs · {cmd.livres_occasion_count ?? 0} occasion
                    </p>
                  </div>
                  <Badge className="shrink-0 bg-slate-100 text-slate-700 text-[10px]">
                    {cmd.statut ?? 'n/a'}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Détail / actions */}
      <div className="lg:col-span-3">
        {selected ? (
          <RupturesDetail commande={selected} onChanged={loadCommandes} />
        ) : (
          <div className="rounded-lg border border-dashed border-slate-300 p-12 text-center text-slate-500">
            Sélectionne une commande à gauche pour voir ses articles et déclencher rupture / libération.
          </div>
        )}
      </div>
    </div>
  );
};

const RupturesDetail: React.FC<{
  commande: CommandeSuperLib;
  onChanged: () => void;
}> = ({ commande, onChanged }) => {
  const [livres, setLivres] = useState<LivreNeufDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [motif, setMotif] = useState('rupture_grossiste');
  const [busy, setBusy] = useState<'rupture' | 'liberer' | null>(null);

  const load = async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const data = await getCommandeDetails(commande.id);
      setLivres(data.livres_neufs ?? []);
    } catch (e: any) {
      toast.error(`Erreur détails : ${e?.message ?? 'inconnu'}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commande.id]);

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const livresValide = livres.filter((l) => l.statut_validation === 'valide');
  const livresRupture = livres.filter((l) => l.statut_validation === 'rupture_grossiste');
  const livresLibere = livres.filter((l) => l.statut_validation === 'libere_libraires');
  const livresAnnule = livres.filter((l) =>
    ['annule_rupture', 'refuse_coursier', 'refuse_parent'].includes(l.statut_validation || ''),
  );

  const handleMarquerRupture = async () => {
    if (selectedIds.size === 0) {
      toast.error('Aucun livre sélectionné');
      return;
    }
    setBusy('rupture');
    try {
      const res = await marquerRuptureArticles(
        Array.from(selectedIds).map((id) => ({
          commande_id: commande.id,
          livre_neuf_id: id,
          motif,
        })),
      );
      toast.success(`${res.marked} marqué(s) en rupture · ${res.skipped} skipped`);
      await load();
      onChanged();
    } catch (e: any) {
      toast.error(`Erreur rupture : ${e?.message ?? 'inconnu'}`);
    } finally {
      setBusy(null);
    }
  };

  const handleLiberer = async () => {
    const ids = livresRupture.map((l) => l.id);
    if (ids.length === 0) {
      toast.error('Aucun livre en rupture à libérer');
      return;
    }
    setBusy('liberer');
    try {
      const res = await libererArticles(ids);
      toast.success(
        `${res.libere_count} libéré(s) · ${res.libraires_notifies} libraire(s) notifiés (48h)`,
      );
      await load();
      onChanged();
    } catch (e: any) {
      toast.error(`Erreur libération : ${e?.message ?? 'inconnu'}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-500 text-sm py-6">
        <Loader2 className="w-4 h-4 animate-spin inline mr-2" />
        Chargement détails…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-lg border border-slate-200 p-4">
        <h3 className="font-semibold text-slate-900">{commande.reference_commande}</h3>
        <p className="text-sm text-slate-600 mt-1">
          {formatCurrency(commande.budget_total ?? 0, commande.devise ?? 'XAF')} · statut {commande.statut}
        </p>
        {commande.adresse_livraison && (
          <p className="text-xs text-slate-500 mt-1">{commande.adresse_livraison}</p>
        )}
      </header>

      {/* Section 1: valide → cocher pour rupture */}
      <section>
        <div className="flex items-center justify-between mb-2">
          <h4 className="font-medium text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            Livres validés ({livresValide.length})
          </h4>
          <div className="flex items-center gap-2">
            <select
              value={motif}
              onChange={(e) => setMotif(e.target.value)}
              className="text-xs border border-slate-300 rounded px-2 py-1"
            >
              <option value="rupture_grossiste">rupture_grossiste</option>
              <option value="prix_indispo">prix indispo</option>
              <option value="autre">autre</option>
            </select>
            <Button
              size="sm"
              variant="primary"
              onClick={handleMarquerRupture}
              disabled={busy !== null || selectedIds.size === 0}
            >
              {busy === 'rupture' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <AlertTriangle className="w-4 h-4 mr-1" />
              )}
              Marquer rupture ({selectedIds.size})
            </Button>
          </div>
        </div>
        {livresValide.length === 0 ? (
          <p className="text-xs text-slate-500 py-2">Aucun livre validé sur cette commande.</p>
        ) : (
          <LivresTable
            livres={livresValide}
            selectable
            selectedIds={selectedIds}
            onToggle={toggle}
          />
        )}
      </section>

      {/* Section 2: rupture_grossiste → bouton libérer */}
      {livresRupture.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-orange-600" />
              En rupture grossiste ({livresRupture.length})
            </h4>
            <Button
              size="sm"
              variant="primary"
              onClick={handleLiberer}
              disabled={busy !== null}
            >
              {busy === 'liberer' ? (
                <Loader2 className="w-4 h-4 mr-1 animate-spin" />
              ) : (
                <Send className="w-4 h-4 mr-1" />
              )}
              Libérer aux libraires_proches (48h)
            </Button>
          </div>
          <LivresTable livres={livresRupture} />
        </section>
      )}

      {/* Section 3: libere_libraires → countdown */}
      {livresLibere.length > 0 && (
        <section>
          <h4 className="font-medium text-slate-900 flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-blue-600" />
            Libérés en attente preneur ({livresLibere.length})
          </h4>
          <p className="text-xs text-slate-500 mb-2">
            Le worker `expirer-libraires-proches` bascule en `annule_rupture` après 48h sans preneur.
          </p>
          <LivresTable livres={livresLibere} />
        </section>
      )}

      {/* Section 4: annulés (info-only) */}
      {livresAnnule.length > 0 && (
        <section>
          <h4 className="font-medium text-slate-900 flex items-center gap-2 mb-2">
            <X className="w-4 h-4 text-rose-600" />
            Annulés ({livresAnnule.length})
          </h4>
          <LivresTable livres={livresAnnule} />
        </section>
      )}
    </div>
  );
};

const LivresTable: React.FC<{
  livres: LivreNeufDetail[];
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggle?: (id: string) => void;
}> = ({ livres, selectable = false, selectedIds, onToggle }) => (
  <div className="overflow-x-auto rounded-lg border border-slate-200">
    <table className="w-full text-sm">
      <thead className="bg-slate-50 text-xs uppercase text-slate-600">
        <tr>
          {selectable && <th className="w-8 px-2 py-2"></th>}
          <th className="text-left px-3 py-2">Titre</th>
          <th className="text-left px-3 py-2">Classe / Matière</th>
          <th className="text-right px-3 py-2">Prix</th>
          <th className="text-left px-3 py-2">Statut</th>
        </tr>
      </thead>
      <tbody>
        {livres.map((l) => (
          <tr key={l.id} className="border-t border-slate-100">
            {selectable && (
              <td className="px-2 py-2">
                <input
                  type="checkbox"
                  checked={selectedIds?.has(l.id) ?? false}
                  onChange={() => onToggle?.(l.id)}
                  className="rounded"
                />
              </td>
            )}
            <td className="px-3 py-2">
              <p className="font-medium text-slate-900">{l.titre}</p>
              {l.auteur && <p className="text-xs text-slate-500">{l.auteur}</p>}
            </td>
            <td className="px-3 py-2 text-slate-600">
              {l.classe ?? '—'} {l.matiere ? `· ${l.matiere}` : ''}
            </td>
            <td className="px-3 py-2 text-right text-slate-900">
              {formatCurrency(l.prix_final ?? 0, 'XAF')}
            </td>
            <td className="px-3 py-2">
              <Badge
                className={
                  STATUT_COLOR[l.statut_validation || ''] ?? 'bg-slate-100 text-slate-700'
                }
              >
                {STATUT_LABEL[l.statut_validation || ''] ?? l.statut_validation}
              </Badge>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// =============================================================================
// TAB 2 — Assigner coursier
// =============================================================================

const CoursiersTab: React.FC = () => {
  const [packageIdInput, setPackageIdInput] = useState('');
  const [pickupLat, setPickupLat] = useState('');
  const [pickupLng, setPickupLng] = useState('');
  const [maxKm, setMaxKm] = useState('10');
  const [couriers, setCouriers] = useState<CourierAvailable[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState<number | null>(null);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const handleSearch = async () => {
    setLoading(true);
    try {
      const params: any = { max_distance_km: parseFloat(maxKm) || 10 };
      if (pickupLat) params.pickup_latitude = parseFloat(pickupLat);
      if (pickupLng) params.pickup_longitude = parseFloat(pickupLng);
      const list = await listAvailableCouriers(params);
      setCouriers(list);
      if (list.length === 0) {
        toast(`Aucun coursier dans ${maxKm} km`, { icon: 'ℹ️' });
      }
    } catch (e: any) {
      toast.error(`Erreur recherche : ${e?.message ?? 'inconnu'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async (coursierUserId: number) => {
    const pkgId = parseInt(packageIdInput, 10);
    if (!Number.isFinite(pkgId)) {
      toast.error('Saisis un ID de paquet valide');
      return;
    }
    setAssigning(coursierUserId);
    try {
      const res = await assignCourierToPackage(pkgId, coursierUserId);
      if (res.success) {
        toast.success(`Coursier ${coursierUserId} assigné au paquet ${pkgId}`);
        setLastResult(`Paquet ${pkgId} → coursier ${coursierUserId} (${res.package?.reference})`);
      } else {
        toast.error('Assignation refusée');
      }
    } catch (e: any) {
      toast.error(`Erreur : ${e?.message ?? 'inconnu'}`);
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-slate-200 p-4 space-y-3">
        <h3 className="font-semibold text-slate-900 flex items-center gap-2">
          <Package className="w-4 h-4" /> Cible — Paquet à assigner
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end">
          <label className="block">
            <span className="text-xs text-slate-600">ID paquet</span>
            <input
              type="number"
              value={packageIdInput}
              onChange={(e) => setPackageIdInput(e.target.value)}
              placeholder="ex. 42"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Lat pickup</span>
            <input
              type="number"
              step="0.00001"
              value={pickupLat}
              onChange={(e) => setPickupLat(e.target.value)}
              placeholder="4.0511"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Lng pickup</span>
            <input
              type="number"
              step="0.00001"
              value={pickupLng}
              onChange={(e) => setPickupLng(e.target.value)}
              placeholder="9.7679"
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="text-xs text-slate-600">Rayon (km)</span>
            <input
              type="number"
              value={maxKm}
              onChange={(e) => setMaxKm(e.target.value)}
              className="mt-1 w-full border border-slate-300 rounded px-3 py-2 text-sm"
            />
          </label>
        </div>
        <Button onClick={handleSearch} disabled={loading}>
          {loading ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
          Rechercher coursiers disponibles
        </Button>
        {lastResult && (
          <p className="text-xs text-emerald-700 bg-emerald-50 p-2 rounded">
            ✅ {lastResult}
          </p>
        )}
      </section>

      <section>
        <h3 className="font-semibold text-slate-900 mb-2">
          Coursiers disponibles ({couriers.length})
        </h3>
        {couriers.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">
            Lance une recherche avec les coordonnées pickup pour voir les coursiers.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2">Coursier</th>
                  <th className="text-left px-3 py-2">Engin</th>
                  <th className="text-right px-3 py-2">Distance</th>
                  <th className="text-right px-3 py-2">Rating</th>
                  <th className="text-right px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {couriers.map((c) => (
                  <tr key={c.id} className="border-t border-slate-100">
                    <td className="px-3 py-2">
                      <p className="font-medium text-slate-900">
                        {c.nom_complet ?? c.email ?? `user ${c.user_id}`}
                      </p>
                      <p className="text-xs text-slate-500">#{c.user_id}</p>
                    </td>
                    <td className="px-3 py-2 text-slate-600">{c.engine_type ?? '—'}</td>
                    <td className="px-3 py-2 text-right text-slate-900">
                      {c.distance_to_pickup_meters !== undefined
                        ? `${(c.distance_to_pickup_meters / 1000).toFixed(1)} km`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right text-slate-900">
                      {c.rating_average !== undefined
                        ? `${Number(c.rating_average).toFixed(1)} (${c.rating_count ?? 0})`
                        : '—'}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Button
                        size="sm"
                        variant="primary"
                        onClick={() => handleAssign(c.user_id)}
                        disabled={assigning !== null || !packageIdInput}
                      >
                        {assigning === c.user_id ? (
                          <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                        ) : null}
                        Assigner
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default SuperLibrairieOperationsPage;
