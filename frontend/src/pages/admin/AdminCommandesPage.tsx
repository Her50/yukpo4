// ============================================================================
// AdminCommandesPage — Liste admin des commandes mixtes Bourse du Livre
// ============================================================================
// Affiche toutes les commandes passées par les parents avec leur statut,
// montant, type d'articles, et un lien vers le détail. Source backend :
// GET /api/librairie-network/admin/commandes (admin/super_admin only).
// ============================================================================

import axios from 'axios';
import { ChevronLeft, ChevronRight, Package, RefreshCw } from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import RequireAdminPage from '@/components/security/RequireAdminPage';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface AdminCommande {
  id: string;
  reference_commande: string;
  user_id: number;
  user_email?: string | null;
  user_nom?: string | null;
  statut: string;
  budget_total: number;
  devise: string;
  commission_app?: number | null;
  montant_net_libraires?: number | null;
  mode_livraison?: string | null;
  adresse_livraison?: string | null;
  notes_client?: string | null;
  created_at: string;
  updated_at: string;
  livres_neufs_count: number;
  livres_occasion_count: number;
}

const STATUT_LABELS: Record<string, string> = {
  edition: 'Brouillon',
  validation_budget: 'Budget validé',
  envoyee_librairies: 'Envoyée librairies',
  envoyee_super_librairie: 'Super-librairie',
  en_validation: 'Validation',
  validee_partielle: 'Validée partielle',
  validee_complete: 'Validée complète',
  en_preparation: 'En préparation',
  en_livraison: 'En livraison',
  livree: 'Livrée',
  annulee: 'Annulée',
};

const STATUT_BADGE: Record<string, string> = {
  edition: 'bg-gray-500',
  validation_budget: 'bg-blue-500',
  envoyee_librairies: 'bg-indigo-500',
  envoyee_super_librairie: 'bg-indigo-600',
  en_validation: 'bg-amber-500',
  validee_partielle: 'bg-yellow-600',
  validee_complete: 'bg-green-600',
  en_preparation: 'bg-cyan-500',
  en_livraison: 'bg-purple-500',
  livree: 'bg-emerald-600',
  annulee: 'bg-red-500',
};

const PAGE_SIZE = 50;

const AdminCommandesPageImpl: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<AdminCommande[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statutFilter, setStatutFilter] = useState<string>('all');
  const [page, setPage] = useState(0);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const params = new URLSearchParams();
      params.append('limit', String(PAGE_SIZE));
      params.append('offset', String(page * PAGE_SIZE));
      if (statutFilter !== 'all') params.append('statut', statutFilter);
      const res = await axios.get<{ success: boolean; commandes: AdminCommande[] }>(
        `/api/librairie-network/admin/commandes?${params.toString()}`,
      );
      setItems(res.data.commandes || []);
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || 'Erreur de chargement');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, statutFilter]);

  const stats = useMemo(() => {
    const total = items.length;
    const totalAmount = items.reduce((s, c) => s + (c.budget_total || 0), 0);
    const byStatut = items.reduce<Record<string, number>>((acc, c) => {
      acc[c.statut] = (acc[c.statut] || 0) + 1;
      return acc;
    }, {});
    return { total, totalAmount, byStatut };
  }, [items]);

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commandes — Bourse du Livre</h1>
          <p className="text-sm text-gray-500 mt-1">
            Suivi des commandes mixtes (livres neufs + occasion) passées par les parents.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Rafraîchir
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Commandes (page)</CardDescription>
            <CardTitle className="text-2xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Montant total (page)</CardDescription>
            <CardTitle className="text-2xl tabular-nums">
              {stats.totalAmount.toLocaleString('fr-FR')} F
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Filtre statut</CardDescription>
            <CardContent className="p-0 mt-2">
              <Select value={statutFilter} onValueChange={(v) => { setPage(0); setStatutFilter(v); }}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  {Object.entries(STATUT_LABELS).map(([k, label]) => (
                    <SelectItem key={k} value={k}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {error && (
            <div className="p-4 bg-red-50 border-b border-red-200 text-sm text-red-800">
              {error}
            </div>
          )}
          {loading && (
            <div className="p-10 text-center text-gray-500 text-sm">Chargement…</div>
          )}
          {!loading && !error && items.length === 0 && (
            <div className="p-10 text-center">
              <Package className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">Aucune commande pour ce filtre.</p>
            </div>
          )}
          {!loading && items.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr className="text-left text-xs uppercase tracking-wider text-gray-500 border-b border-gray-200">
                    <th className="py-2 px-3 font-semibold">Référence</th>
                    <th className="py-2 px-3 font-semibold">Date</th>
                    <th className="py-2 px-3 font-semibold">Parent</th>
                    <th className="py-2 px-3 font-semibold">Statut</th>
                    <th className="py-2 px-3 font-semibold">Articles</th>
                    <th className="py-2 px-3 font-semibold text-right">Montant</th>
                    <th className="py-2 px-3 font-semibold text-right">Net libraires</th>
                    <th className="py-2 px-3 font-semibold text-right">Commission</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((c) => (
                    <tr
                      key={c.id}
                      className="border-b border-gray-100 hover:bg-amber-50/30 cursor-pointer"
                      onClick={() => navigate(`/mes-commandes/${c.id}`)}
                    >
                      <td className="py-2 px-3 font-mono text-xs text-gray-700">
                        {c.reference_commande || c.id.slice(0, 8)}
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-600 whitespace-nowrap">
                        {new Date(c.created_at).toLocaleDateString('fr-FR', {
                          day: 'numeric',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-xs text-gray-800 truncate max-w-[180px]">
                          {c.user_nom || c.user_email || `User #${c.user_id}`}
                        </div>
                        {c.user_email && c.user_nom && (
                          <div className="text-[10px] text-gray-400 truncate max-w-[180px]">
                            {c.user_email}
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <Badge className={`${STATUT_BADGE[c.statut] || 'bg-gray-400'} text-white text-[10px]`}>
                          {STATUT_LABELS[c.statut] || c.statut}
                        </Badge>
                      </td>
                      <td className="py-2 px-3 text-xs text-gray-700 whitespace-nowrap">
                        {c.livres_neufs_count > 0 && (
                          <span className="text-amber-700 font-semibold">
                            {c.livres_neufs_count} neuf{c.livres_neufs_count > 1 ? 's' : ''}
                          </span>
                        )}
                        {c.livres_neufs_count > 0 && c.livres_occasion_count > 0 && (
                          <span className="text-gray-400 mx-1">·</span>
                        )}
                        {c.livres_occasion_count > 0 && (
                          <span className="text-cyan-700 font-semibold">
                            {c.livres_occasion_count} occasion
                          </span>
                        )}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums font-semibold text-gray-900">
                        {(c.budget_total || 0).toLocaleString('fr-FR')} {c.devise || 'XAF'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-xs text-gray-600">
                        {c.montant_net_libraires != null
                          ? `${c.montant_net_libraires.toLocaleString('fr-FR')}`
                          : '—'}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums text-xs text-emerald-700 font-semibold">
                        {c.commission_app != null
                          ? `${c.commission_app.toLocaleString('fr-FR')}`
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between mt-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={page === 0 || loading}
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Précédent
        </Button>
        <span className="text-sm text-gray-500">
          Page {page + 1}
        </span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPage((p) => p + 1)}
          disabled={items.length < PAGE_SIZE || loading}
        >
          Suivant
          <ChevronRight className="w-4 h-4 ml-1" />
        </Button>
      </div>
    </div>
  );
};

const AdminCommandesPage: React.FC = () => (
  <RequireAdminPage>
    <AdminCommandesPageImpl />
  </RequireAdminPage>
);

export default AdminCommandesPage;
