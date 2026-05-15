// Dashboard partenaire pharmacie — port web allégé du mobile (PharmacyPartnerOrders + Analytics + QR + Financial).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw, ClipboardList, BarChart3, QrCode, Wallet, Package,
  Check, X, Plus, Edit2, Trash2, Upload, Save, Search, FileText, Link as LinkIcon, FileUp, AlertCircle,
  Bell,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  pharmacyPartner, PharmacyOrder, PharmacyAnalytics, PharmacyProduct,
  BulkImportRow, parseBulkImportInput, parseImportFileSmart,
} from '@/services/pharmacyPartner';
import PharmacyAlertsTab from './PharmacyAlertsTab';
import PharmacyArchivesTab from './PharmacyArchivesTab';
import PharmacyAnalyticsTab from './PharmacyAnalyticsTab';
// Note : pas de YukpoCostBadge côté pharmacien partenaire — outils internes gratuits
// (la marge plateforme se fait sur le client patient final, pas sur le partenaire métier).

type TabKey = 'alertes' | 'commandes' | 'archives' | 'produits' | 'stats' | 'qr' | 'finances';

const TABS: Array<{ key: TabKey; labelKey: string; icon: any }> = [
  // Tab "Alertes" en premier : workflow RFQ — demandes en temps réel des
  // patients dans le rayon de la pharmacie, validation manuelle (pas de
  // catalogue partagé). C'est l'action quotidienne principale du pharmacien.
  { key: 'alertes',   labelKey: 'pharmaPartner.tab.alerts',    icon: Bell },
  { key: 'commandes', labelKey: 'pharmaPartner.tab.orders',    icon: ClipboardList },
  // Archives : ordonnances scannées par le pharmacien lors de la dispensation,
  // recherchables par nom patient (en cas de retour, effet indésirable, etc.).
  { key: 'archives',  labelKey: 'pharmaPartner.tab.archives',  icon: FileText },
  { key: 'produits',  labelKey: 'pharmaPartner.tab.products',  icon: Package },
  { key: 'stats',     labelKey: 'pharmaPartner.tab.stats',     icon: BarChart3 },
  { key: 'qr',        labelKey: 'pharmaPartner.tab.qr',        icon: QrCode },
  { key: 'finances',  labelKey: 'pharmaPartner.tab.finances',  icon: Wallet },
];

// Map statut → meta : `label` résolue via t('pharmaPartner.orders.status.{key}').
const STATUS_LABELS: Record<string, { labelKey: string; color: string }> = {
  pending:     { labelKey: 'pharmaPartner.orders.status.pending',     color: 'bg-amber-100 text-amber-800' },
  confirmed:   { labelKey: 'pharmaPartner.orders.status.confirmed',   color: 'bg-blue-100 text-blue-800' },
  processing:  { labelKey: 'pharmaPartner.orders.status.processing',  color: 'bg-violet-100 text-violet-800' },
  ready:       { labelKey: 'pharmaPartner.orders.status.ready',       color: 'bg-emerald-100 text-emerald-800' },
  in_delivery: { labelKey: 'pharmaPartner.orders.status.in_delivery', color: 'bg-cyan-100 text-cyan-800' },
  delivered:   { labelKey: 'pharmaPartner.orders.status.delivered',   color: 'bg-emerald-200 text-emerald-900' },
  cancelled:   { labelKey: 'pharmaPartner.orders.status.cancelled',   color: 'bg-red-100 text-red-700' },
};

const FILTERS: Array<{ key: string | null; labelKey: string }> = [
  { key: null,          labelKey: 'pharmaPartner.orders.filter.all' },
  { key: 'pending',     labelKey: 'pharmaPartner.orders.filter.pending' },
  { key: 'confirmed',   labelKey: 'pharmaPartner.orders.filter.confirmed' },
  { key: 'ready',       labelKey: 'pharmaPartner.orders.filter.ready' },
  { key: 'delivered',   labelKey: 'pharmaPartner.orders.filter.delivered' },
];

const PharmacieDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isPartner, partnerType, isLoading } = useAuth();

  // Détection du tab depuis URL : /dashboard, /dashboard/commandes, /dashboard/stats, etc.
  const pathTab = useMemo<TabKey>(() => {
    const seg = window.location.pathname.split('/').pop();
    if (seg && ['alertes', 'commandes', 'archives', 'produits', 'stats', 'qr', 'finances'].includes(seg)) return seg as TabKey;
    return (params.get('tab') as TabKey) || 'commandes';
  }, [params]);

  const [tab, setTab] = useState<TabKey>(pathTab);
  useEffect(() => { setTab(pathTab); }, [pathTab]);

  const [refreshing, setRefreshing] = useState(false);
  const [pharmacyId, setPharmacyId] = useState<number | null>(null);
  const [pharmacyName, setPharmacyName] = useState<string>('');
  const [orders, setOrders] = useState<PharmacyOrder[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<PharmacyAnalytics | null>(null);
  const [movements, setMovements] = useState<any[]>([]);
  const [qrInput, setQrInput] = useState('');
  const [qrResult, setQrResult] = useState<{ ok: boolean; message?: string } | null>(null);

  // Produits + import
  const [products, setProducts] = useState<PharmacyProduct[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [editProduct, setEditProduct] = useState<Partial<PharmacyProduct> | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importSource, setImportSource] = useState<'paste' | 'file' | 'external'>('paste');
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<BulkImportRow[]>([]);
  const [importInvalid, setImportInvalid] = useState<string[]>([]);
  const [importOverwrite, setImportOverwrite] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importStep, setImportStep] = useState<1 | 2>(1); // 1=saisie, 2=preview
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiMapping, setAiMapping] = useState<Record<string, string>>({});
  // Source externe (Google Sheet publié, API tierce)
  const [extUrl, setExtUrl] = useState('');
  const [extItemsPath, setExtItemsPath] = useState('items');
  const [extToken, setExtToken] = useState('');

  // Garde d'accès
  useEffect(() => {
    if (isLoading) return;
    if (!isPartner) { navigate('/login?redirect=/dashboard'); return; }
    if (partnerType && partnerType !== 'pharmacie') { navigate('/'); return; }
  }, [isPartner, partnerType, isLoading, navigate]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    let pid = pharmacyId;
    if (pid === null) {
      const me = await pharmacyPartner.getMyPharmacy();
      if (me) { pid = me.id; setPharmacyId(me.id); setPharmacyName(me.name); }
    }
    if (pid !== null) {
      const [ord, an, prods] = await Promise.all([
        pharmacyPartner.getPartnerOrders(pid, { status: statusFilter || undefined, limit: 30 }),
        pharmacyPartner.getAnalytics(pid),
        pharmacyPartner.getProducts(pid),
      ]);
      setOrders(ord.orders);
      setAnalytics(an);
      setProducts(prods);
    }
    setRefreshing(false);
  }, [pharmacyId, statusFilter]);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (tab === 'finances' && movements.length === 0) {
      pharmacyPartner.getFinancialMovements(50).then(setMovements);
    }
  }, [tab, movements.length]);

  const handleAdvance = async (o: PharmacyOrder, next: string) => {
    const ok = await pharmacyPartner.updateOrderStatus(o.id, next);
    if (ok) reload();
  };

  const handleScanQr = async () => {
    if (!qrInput.trim()) return;
    const r = await pharmacyPartner.validateOrderQr(qrInput.trim());
    setQrResult({ ok: r.ok, message: r.message || (r.ok ? `Commande validée : ${r.order_id}` : 'Code invalide') });
    if (r.ok) { setQrInput(''); reload(); }
  };

  const setActiveTab = (k: TabKey) => {
    setTab(k);
    // garde l'URL propre — utilise query param, plus simple
    setParams({ tab: k });
  };

  // ─── Produits — handlers ────────────────────────
  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter(p =>
      p.nom_produit.toLowerCase().includes(q) ||
      (p.categorie || '').toLowerCase().includes(q) ||
      (p.code_barre || '').includes(q),
    );
  }, [products, productSearch]);

  const productStats = useMemo(() => ({
    total: products.length,
    enStock: products.filter(p => p.stock > 0).length,
    rupture: products.filter(p => p.stock === 0).length,
    valeurStock: products.reduce((s, p) => s + p.prix * p.stock, 0),
  }), [products]);

  const handleSaveProduct = async () => {
    if (!editProduct?.nom_produit || pharmacyId === null) return;
    if (editProduct.id) {
      await pharmacyPartner.updateProduct(editProduct.id, editProduct);
    } else {
      await pharmacyPartner.createProduct({ ...editProduct, pharmacy_service_id: pharmacyId, nom_produit: editProduct.nom_produit });
    }
    setEditProduct(null);
    reload();
  };

  const handleDeleteProduct = async (p: PharmacyProduct) => {
    if (!confirm(`Supprimer "${p.nom_produit}" du catalogue ?`)) return;
    const ok = await pharmacyPartner.deleteProduct(p.id);
    if (ok) reload();
  };

  // ─── Import wizard ──────────────────────────────
  const resetImport = () => {
    setImportText(''); setImportPreview([]); setImportInvalid([]);
    setImportSource('paste'); setImportStep(1);
    setExtUrl(''); setExtItemsPath('items'); setExtToken('');
    setAiAnalyzing(false); setAiMapping({});
  };

  const handleFileSelected = async (file: File) => {
    setAiAnalyzing(true);
    setAiMapping({});
    try {
      const r = await parseImportFileSmart(file, { useAi: true });
      if (r.rows.length === 0) {
        alert('Aucune ligne détectée. Vérifiez les colonnes (nom, prix, stock) — ou réessayez avec un autre format.');
        return;
      }
      setImportPreview(r.rows);
      setImportInvalid([]);
      setImportText(JSON.stringify(r.rows, null, 2));
      setAiMapping(r.aiUsed ? r.aiMapping : {});
      setImportStep(2);
    } catch (e: any) {
      alert('Lecture impossible : ' + (e?.message || ''));
    } finally {
      setAiAnalyzing(false);
    }
  };

  const handlePreviewPaste = () => {
    const { parsed, invalid } = parseBulkImportInput(importText);
    setImportPreview(parsed);
    setImportInvalid(invalid);
    if (parsed.length === 0) {
      alert('Aucune ligne valide. Format attendu : CSV (nom,prix,stock,unite,code_barre,categorie) ou JSON.');
      return;
    }
    setImportStep(2);
  };

  const handleConfirmImport = async () => {
    if (pharmacyId === null) return;
    setImportLoading(true);
    let result;
    if (importSource === 'external') {
      if (!extUrl.trim()) { alert('URL externe requise'); setImportLoading(false); return; }
      result = await pharmacyPartner.syncExternal({
        pharmacyServiceId: pharmacyId,
        apiUrl: extUrl.trim(),
        overwriteExisting: importOverwrite,
        itemsPath: extItemsPath.trim() || 'items',
        authBearerToken: extToken.trim() || undefined,
      });
    } else {
      result = await pharmacyPartner.bulkImport(pharmacyId, importPreview, importOverwrite);
    }
    setImportLoading(false);
    setShowImport(false);
    resetImport();
    reload();
    const errMsg = result.errors?.length ? `\n${result.errors.slice(0, 3).join('\n')}` : '';
    alert(`Import terminé.\nCréés : ${result.created} · Mis à jour : ${result.updated}${errMsg}`);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('pharmaPartner.headerTitle')}</h1>
            <p className="text-emerald-100 text-sm">{pharmacyName || t('pharmaPartner.headerSubtitleDefault')}</p>
          </div>
          <button
            onClick={reload}
            disabled={refreshing}
            className="p-2 rounded-full bg-white/20 hover:bg-white/30 transition"
            aria-label="Rafraîchir"
          >
            <RefreshCw size={20} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-screen-md mx-auto flex overflow-x-auto no-scrollbar">
          {TABS.map(tabDef => {
            const Icon = tabDef.icon;
            const active = tab === tabDef.key;
            return (
              <button
                key={tabDef.key}
                onClick={() => setActiveTab(tabDef.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition ${
                  active ? 'text-emerald-600 border-emerald-600' : 'text-gray-500 border-transparent hover:text-gray-800'
                }`}
              >
                <Icon size={16} />
                {t(tabDef.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-screen-md mx-auto px-4 py-4">
        {tab === 'alertes' && <PharmacyAlertsTab />}

        {tab === 'archives' && pharmacyId !== null && (
          <PharmacyArchivesTab pharmacies={[{ id: pharmacyId, nom: pharmacyName || 'Ma pharmacie' }]} />
        )}

        {tab === 'commandes' && (
          <>
            {/* Filtres */}
            <div className="flex gap-2 overflow-x-auto pb-3 mb-1 no-scrollbar">
              {FILTERS.map(f => {
                const active = statusFilter === f.key;
                return (
                  <button
                    key={String(f.key)}
                    onClick={() => setStatusFilter(f.key)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                      active ? 'bg-emerald-600 text-white' : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {t(f.labelKey)}
                  </button>
                );
              })}
            </div>

            {orders.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
                {t('pharmaPartner.orders.empty')}
              </div>
            ) : (
              <div className="space-y-2">
                {orders.map(o => {
                  const meta = STATUS_LABELS[o.status || ''];
                  const stLabel = meta ? t(meta.labelKey) : (o.status || '—');
                  const stColor = meta?.color ?? 'bg-gray-100 text-gray-700';
                  const methodLabel = o.delivery_method === 'delivery'
                    ? t('pharmaPartner.orders.method.delivery')
                    : t('pharmaPartner.orders.method.pickup');
                  return (
                    <div key={o.id} className="bg-white rounded-xl shadow-sm p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-sm">{o.client_name || t('pharmaPartner.orders.client')} <span className="text-xs text-gray-500">#{o.id.slice(0, 8)}</span></div>
                          <div className="text-xs text-gray-500">{o.client_phone || ''} · {methodLabel}</div>
                        </div>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${stColor}`}>{stLabel}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="font-bold text-emerald-700">{Number(o.total_amount || 0).toLocaleString()} {t('common.xaf')}</div>
                        <div className="flex gap-2">
                          {o.status === 'pending' && (
                            <button onClick={() => handleAdvance(o, 'confirmed')} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1">
                              <Check size={14} /> {t('pharmaPartner.orders.btn.confirm')}
                            </button>
                          )}
                          {o.status === 'confirmed' && (
                            <button onClick={() => handleAdvance(o, 'ready')} className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 flex items-center gap-1">
                              <Check size={14} /> {t('pharmaPartner.orders.btn.ready')}
                            </button>
                          )}
                          {o.status === 'ready' && o.delivery_method === 'delivery' && (
                            <button onClick={() => handleAdvance(o, 'in_delivery')} className="px-3 py-1.5 rounded-lg bg-cyan-600 text-white text-xs font-semibold hover:bg-cyan-700 flex items-center gap-1">
                              <Check size={14} /> {t('pharmaPartner.orders.btn.deliver')}
                            </button>
                          )}
                          {!['delivered', 'cancelled'].includes(o.status || '') && (
                            <button onClick={() => handleAdvance(o, 'cancelled')} className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 flex items-center gap-1">
                              <X size={14} /> {t('pharmaPartner.orders.btn.cancel')}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {tab === 'produits' && (
          <div className="space-y-3">
            {/* Stats catalogue */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <StatCard label="Produits" value={productStats.total} accent="text-emerald-600" />
              <StatCard label="En stock" value={productStats.enStock} accent="text-blue-600" />
              <StatCard label="Rupture" value={productStats.rupture} accent="text-red-600" />
              <StatCard label="Valeur stock" value={`${productStats.valeurStock.toLocaleString()} XAF`} accent="text-violet-600" />
            </div>

            {/* Actions principales */}
            <div className="flex gap-2">
              <button
                onClick={() => { resetImport(); setShowImport(true); }}
                className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 flex items-center justify-center gap-2"
              >
                <Upload size={18} /> Importer un fichier
              </button>
              <button
                onClick={() => setEditProduct({ nom_produit: '', prix: 0, stock: 0, unite: 'unité', is_disponible: true })}
                className="px-4 py-3 rounded-lg border border-emerald-300 text-emerald-700 font-semibold hover:bg-emerald-50 flex items-center justify-center gap-1"
              >
                <Plus size={18} />
              </button>
            </div>

            {/* Recherche */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="search"
                value={productSearch}
                onChange={e => setProductSearch(e.target.value)}
                placeholder="Rechercher un produit, code-barres, catégorie…"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Liste */}
            {filteredProducts.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <Package size={32} className="mx-auto mb-2 text-gray-300" />
                {products.length === 0 ? 'Aucun produit. Importez votre catalogue ou ajoutez-en un.' : 'Aucun résultat.'}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredProducts.map(p => (
                  <div key={p.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{p.nom_produit}</div>
                      <div className="text-xs text-gray-500">
                        {Number(p.prix).toLocaleString()} XAF · stock <span className={p.stock === 0 ? 'text-red-600 font-bold' : 'text-gray-700'}>{p.stock}</span> {p.unite || ''}
                        {p.categorie && <> · {p.categorie}</>}
                      </div>
                      {p.code_barre && <div className="text-[10px] text-gray-400 font-mono">{p.code_barre}</div>}
                    </div>
                    <button onClick={() => setEditProduct(p)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="Éditer">
                      <Edit2 size={18} />
                    </button>
                    <button onClick={() => handleDeleteProduct(p)} className="p-2 text-gray-500 hover:text-red-600" aria-label="Supprimer">
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'stats' && (
          <div className="space-y-5">
            {/* KPIs commandes (existant) — gardés en haut pour cohérence */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Total commandes" value={analytics?.total_orders ?? '—'} accent="text-emerald-600" />
              <StatCard label="7 derniers jours" value={analytics?.orders_7d ?? '—'} accent="text-blue-600" />
              <StatCard label="30 derniers jours" value={analytics?.orders_30d ?? '—'} accent="text-violet-600" />
              <StatCard label="CA total" value={`${Number(analytics?.total_revenue ?? 0).toLocaleString()} XAF`} accent="text-emerald-700" />
              <div className="col-span-2">
                <StatCard label="Panier moyen" value={`${Number(analytics?.avg_order_value ?? 0).toLocaleString()} XAF`} accent="text-amber-600" />
              </div>
            </div>

            {/* Dashboard analytics RFQ : taux de réponse, top médic, ruptures,
                top hôpitaux/médecins. Période configurable 7/30/90 jours. */}
            <PharmacyAnalyticsTab />
          </div>
        )}

        {tab === 'qr' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 text-center">
              <QrCode size={48} className="mx-auto text-emerald-600 mb-3" />
              <h3 className="font-semibold mb-1">Valider un retrait</h3>
              <p className="text-sm text-gray-500 mb-4">Saisissez ou collez le code QR fourni par le client.</p>
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="Code QR…"
                className="w-full p-3 rounded-lg border border-gray-300 mb-3 text-center font-mono"
              />
              <button
                onClick={handleScanQr}
                disabled={!qrInput.trim()}
                className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                Valider
              </button>
              {qrResult && (
                <div className={`mt-3 p-3 rounded-lg text-sm ${qrResult.ok ? 'bg-emerald-50 text-emerald-800' : 'bg-red-50 text-red-700'}`}>
                  {qrResult.message}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center">
              💡 Pour scanner avec la caméra, utilisez l'application mobile.
            </p>
          </div>
        )}

        {tab === 'finances' && (
          <div className="space-y-3">
            <StatCard label="CA total" value={`${Number(analytics?.total_revenue ?? 0).toLocaleString()} XAF`} accent="text-emerald-700" />
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-100 font-semibold">Mouvements récents</div>
              {movements.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">Aucun mouvement.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {movements.map((m, i) => (
                    <li key={i} className="p-3 flex justify-between items-center text-sm">
                      <div>
                        <div className="font-medium">{m.label || m.type || 'Mouvement'}</div>
                        <div className="text-xs text-gray-500">{m.created_at ? new Date(m.created_at).toLocaleString() : ''}</div>
                      </div>
                      <div className={`font-bold ${Number(m.amount) >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                        {Number(m.amount || 0) >= 0 ? '+' : ''}{Number(m.amount || 0).toLocaleString()} XAF
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="text-xs text-gray-500 text-center">Les retraits se font depuis l'application mobile.</p>
          </div>
        )}
      </div>

      {/* Modal édition / création produit */}
      {editProduct && (
        <Modal onClose={() => setEditProduct(null)} title={editProduct.id ? t('pharmaPartner.products.edit.editTitle') : t('pharmaPartner.products.edit.newTitle')}>
          <div className="space-y-3">
            <Input label={t('pharmaPartner.products.edit.name')} value={editProduct.nom_produit || ''} onChange={v => setEditProduct({ ...editProduct, nom_produit: v })} />
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('pharmaPartner.products.edit.price')} type="number" value={String(editProduct.prix ?? '')} onChange={v => setEditProduct({ ...editProduct, prix: Number(v) })} />
              <Input label={t('pharmaPartner.products.edit.stock')} type="number" value={String(editProduct.stock ?? '')} onChange={v => setEditProduct({ ...editProduct, stock: Number(v) })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input label={t('pharmaPartner.products.edit.unit')} value={editProduct.unite || 'unité'} onChange={v => setEditProduct({ ...editProduct, unite: v })} />
              <Input label={t('pharmaPartner.products.edit.category')} value={editProduct.categorie || ''} onChange={v => setEditProduct({ ...editProduct, categorie: v })} />
            </div>
            <Input label={t('pharmaPartner.products.edit.barcode')} value={editProduct.code_barre || ''} onChange={v => setEditProduct({ ...editProduct, code_barre: v })} />
            <Input label={t('pharmaPartner.products.edit.description')} value={editProduct.description || ''} onChange={v => setEditProduct({ ...editProduct, description: v })} />
            <button
              onClick={handleSaveProduct}
              disabled={!editProduct.nom_produit}
              className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={18} /> {t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {/* Wizard import catalogue */}
      {showImport && (
        <Modal onClose={() => { setShowImport(false); resetImport(); }} title={importStep === 1 ? t('pharmaPartner.products.import.title') : t('pharmaPartner.products.import.previewTitle')}>
          {importStep === 1 ? (
            <div className="space-y-3">
              {/* Sélecteur source */}
              <div className="flex gap-2">
                <SourceTab active={importSource === 'paste'}    label={t('restoPartner.import.src.paste')}    icon={FileText} onClick={() => setImportSource('paste')} />
                <SourceTab active={importSource === 'file'}     label={t('restoPartner.import.src.file')}     icon={FileUp}   onClick={() => setImportSource('file')} />
                <SourceTab active={importSource === 'external'} label={t('restoPartner.import.src.external')} icon={LinkIcon} onClick={() => setImportSource('external')} />
              </div>

              {importSource === 'paste' && (
                <>
                  <p className="text-xs text-gray-500">{t('pharmaPartner.products.import.pasteFormat')}</p>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    rows={8}
                    placeholder={`Doliprane 500mg,1500,200,boîte,3401597405128,Antalgique\nParacétamol 1g,2000,150,boîte,,Antalgique`}
                    className="w-full p-3 rounded-lg border border-gray-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </>
              )}

              {importSource === 'file' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{t('pharmaPartner.products.import.filesFormat')}</p>
                  <label className={`block w-full p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${aiAnalyzing ? 'border-emerald-400 bg-emerald-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                    {aiAnalyzing ? (
                      <>
                        <div className="animate-spin mx-auto mb-2 w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full" />
                        <span className="text-sm font-medium text-emerald-700">{t('pharmaPartner.products.import.filesAnalyzing')}</span>
                      </>
                    ) : (
                      <>
                        <FileUp size={32} className="mx-auto text-emerald-600 mb-2" />
                        <span className="text-sm font-medium text-gray-700">{t('pharmaPartner.products.import.filesPick')}</span>
                      </>
                    )}
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,.xlsx,.xls,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                      disabled={aiAnalyzing}
                      onChange={e => { const f = e.target.files?.[0]; if (f) handleFileSelected(f); }}
                      className="hidden"
                    />
                  </label>
                </div>
              )}

              {importSource === 'external' && (
                <>
                  <p className="text-xs text-gray-500">{t('pharmaPartner.products.import.extFormat')}</p>
                  <Input label={t('pharmaPartner.products.import.extUrl')} value={extUrl} onChange={setExtUrl} />
                  <Input label={t('pharmaPartner.products.import.extPath')} value={extItemsPath} onChange={setExtItemsPath} />
                  <Input label={t('pharmaPartner.products.import.extToken')} value={extToken} onChange={setExtToken} />
                </>
              )}

              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={importOverwrite} onChange={e => setImportOverwrite(e.target.checked)} />
                {t('pharmaPartner.products.import.overwrite')}
              </label>

              <button
                onClick={importSource === 'external' ? handleConfirmImport : handlePreviewPaste}
                disabled={importLoading}
                className="w-full py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {importSource === 'external' ? <Upload size={18} /> : <Check size={18} />}
                {importSource === 'external'
                  ? (importLoading ? t('pharmaPartner.products.import.syncing') : t('pharmaPartner.products.import.sync'))
                  : t('pharmaPartner.products.import.preview')}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                {t('pharmaPartner.products.import.ready', { count: importPreview.length })}
                {importInvalid.length > 0 && <span className="ml-2 text-red-600">{t('restoPartner.import.ignored', { count: importInvalid.length })}</span>}
              </div>

              {/* Badge Yukpo : colonnes détectées automatiquement */}
              {Object.keys(aiMapping).length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-blue-800">
                    {t('pharmaPartner.products.import.aiBadge')}
                  </div>
                  <ul className="text-blue-900 space-y-0.5">
                    {Object.entries(aiMapping).map(([h, c]) => (
                      <li key={h}><code className="bg-white px-1 rounded">{h}</code> → <code className="bg-white px-1 rounded">{c}</code></li>
                    ))}
                  </ul>
                </div>
              )}

              {importInvalid.length > 0 && (
                <div className="p-3 rounded-lg bg-red-50 text-red-700 text-xs space-y-1 max-h-24 overflow-y-auto">
                  <div className="flex items-center gap-1 font-semibold"><AlertCircle size={14} /> {t('pharmaPartner.products.import.ignoredHeading')}</div>
                  {importInvalid.slice(0, 5).map((m, i) => <div key={i}>• {m}</div>)}
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {importPreview.slice(0, 20).map((p, i) => (
                  <div key={i} className="p-2 text-xs flex justify-between">
                    <span className="font-medium truncate">{p.nom_produit}</span>
                    <span className="text-gray-500">{p.prix} {t('common.xaf')} · {p.stock} {p.unite}</span>
                  </div>
                ))}
                {importPreview.length > 20 && (
                  <div className="p-2 text-xs text-center text-gray-500">{t('restoPartner.import.moreItems', { count: importPreview.length - 20 })}</div>
                )}
              </div>

              <div className="flex gap-2">
                <button onClick={() => setImportStep(1)} className="flex-1 py-3 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50">
                  {t('pharmaPartner.products.import.back')}
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importLoading || importPreview.length === 0}
                  className="flex-1 py-3 rounded-lg bg-emerald-600 text-white font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={18} /> {importLoading ? t('pharmaPartner.products.import.importing') : t('pharmaPartner.products.import.doImport')}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; accent?: string }> = ({ label, value, accent = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl shadow-sm p-3">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`text-lg font-bold ${accent}`}>{value}</div>
  </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      className="mt-1 w-full p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  </div>
);

const SourceTab: React.FC<{ active: boolean; label: string; icon: any; onClick: () => void }> = ({ active, label, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition ${
      active ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
    }`}
  >
    <Icon size={18} />
    {label}
  </button>
);

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">{title}</h3>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-700">
          <X size={20} />
        </button>
      </div>
      {children}
    </div>
  </div>
);

export default PharmacieDashboardPage;
