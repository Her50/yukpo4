// Dashboard partenaire restaurant — port web du mobile RestaurantDashboardScreen.
// 5 tabs : overview / menu / orders / hours / finances. Responsive (md+ tabs en haut, mobile scrollable).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  RefreshCw, Plus, Edit2, Trash2, Clock, ClipboardList, BarChart3,
  Utensils, Check, X, ChevronRight, Save, Upload,
  FileText, FileUp, Link as LinkIcon, AlertCircle, Bike, Package,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/contexts/AuthContext';
import {
  restaurantManagement, RestaurantMenuItem, RestaurantOrder,
  RestaurantOpeningHour, RestaurantOverview,
  BulkMenuRow, parseBulkMenuInput, parseImportMenuFileSmart, fetchExternalMenu,
} from '@/services/restaurantManagement';
// Note : pas de YukpoCostBadge côté restaurateur partenaire — outils internes gratuits
// (la marge plateforme se fait sur le client final, pas sur le partenaire métier).

type TabKey = 'overview' | 'menu' | 'orders' | 'hours' | 'finances';

const TABS: Array<{ key: TabKey; labelKey: string; icon: any }> = [
  { key: 'overview',  labelKey: 'restoPartner.tab.overview', icon: BarChart3 },
  { key: 'menu',      labelKey: 'restoPartner.tab.menu',     icon: Utensils },
  { key: 'orders',    labelKey: 'restoPartner.tab.orders',   icon: ClipboardList },
  { key: 'hours',     labelKey: 'restoPartner.tab.hours',    icon: Clock },
  { key: 'finances',  labelKey: 'restoPartner.tab.finances', icon: BarChart3 },
];

// Map statut → meta : la `label` est résolue à la volée via t('clientOrders.status.{key}').
const STATUS_FLOW: Record<string, { labelKey: string; next: string; color: string }> = {
  pending:   { labelKey: 'clientOrders.status.pending',   next: 'accepted',  color: 'bg-amber-100 text-amber-800' },
  accepted:  { labelKey: 'clientOrders.status.accepted',  next: 'preparing', color: 'bg-blue-100 text-blue-800' },
  preparing: { labelKey: 'clientOrders.status.preparing', next: 'ready',     color: 'bg-violet-100 text-violet-800' },
  ready:     { labelKey: 'clientOrders.status.ready',     next: 'completed', color: 'bg-emerald-100 text-emerald-800' },
  completed: { labelKey: 'clientOrders.status.completed', next: '',          color: 'bg-gray-100 text-gray-700' },
  cancelled: { labelKey: 'clientOrders.status.cancelled', next: '',          color: 'bg-red-100 text-red-700' },
};

const JOURS = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

/** Indices jours pour les raccourcis du sélecteur. `labelKey` résolu via t(). */
const PRESET_DAYS: Array<{ key: string; labelKey: string; days: number[] }> = [
  { key: 'all',     labelKey: 'restoPartner.menu.edit.presetAll',      days: [0, 1, 2, 3, 4, 5, 6] },
  { key: 'week',    labelKey: 'restoPartner.menu.edit.presetWeekdays', days: [1, 2, 3, 4, 5] },
  { key: 'weekend', labelKey: 'restoPartner.menu.edit.presetWeekend',  days: [0, 6] },
];

/** "Tous les jours" / "Lun-Ven" / "Mar, Jeu, Sam" / "Aujourd'hui ✓ + Sam". */
const formatAvailabilityDays = (days?: number[] | null): string => {
  if (!days || days.length === 0 || days.length === 7) return 'Tous les jours';
  if (days.length === 5 && [1, 2, 3, 4, 5].every(d => days.includes(d))) return 'Lun-Ven';
  if (days.length === 2 && [0, 6].every(d => days.includes(d))) return 'Week-end';
  return days.slice().sort((a, b) => a - b).map(d => JOURS[d]).join(', ');
};

const isAvailableToday = (days?: number[] | null): boolean => {
  if (!days || days.length === 0) return true; // dispo tous les jours par défaut
  return days.includes(new Date().getDay());
};

const CATEGORIES = [
  { key: 'entree',     labelKey: 'restoPartner.menu.categories.entree' },
  { key: 'plat',       labelKey: 'restoPartner.menu.categories.plat' },
  { key: 'dessert',    labelKey: 'restoPartner.menu.categories.dessert' },
  { key: 'boisson',    labelKey: 'restoPartner.menu.categories.boisson' },
  { key: 'specialite', labelKey: 'restoPartner.menu.categories.specialite' },
];

const RestaurantDashboardPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { isPartner, partnerType, isLoading } = useAuth();

  const tab: TabKey = ((params.get('tab') as TabKey) || 'overview');

  const [refreshing, setRefreshing] = useState(false);
  const [menuItems, setMenuItems] = useState<RestaurantMenuItem[]>([]);
  const [orders, setOrders] = useState<RestaurantOrder[]>([]);
  const [hours, setHours] = useState<RestaurantOpeningHour[]>([]);
  const [overview, setOverview] = useState<RestaurantOverview | null>(null);
  const [finances, setFinances] = useState<any>(null);

  const [editItem, setEditItem] = useState<Partial<RestaurantMenuItem> | null>(null);
  const [editHour, setEditHour] = useState<RestaurantOpeningHour | null>(null);

  // Filtre + tri commandes
  const [orderModeFilter, setOrderModeFilter] = useState<'all' | 'dine_in' | 'takeaway' | 'delivery'>('all');

  // Wizard import menu
  const [showImport, setShowImport] = useState(false);
  const [importSource, setImportSource] = useState<'paste' | 'file' | 'external'>('paste');
  const [importStep, setImportStep] = useState<1 | 2>(1);
  const [importText, setImportText] = useState('');
  const [importPreview, setImportPreview] = useState<BulkMenuRow[]>([]);
  const [importInvalid, setImportInvalid] = useState<string[]>([]);
  const [importLoading, setImportLoading] = useState(false);
  const [importProgress, setImportProgress] = useState({ done: 0, total: 0 });
  const [aiAnalyzing, setAiAnalyzing] = useState(false);
  const [aiMapping, setAiMapping] = useState<Record<string, string>>({});
  const [extUrl, setExtUrl] = useState('');
  const [extItemsPath, setExtItemsPath] = useState('');

  // Garde d'accès : si pas partenaire restaurant, redirige
  useEffect(() => {
    if (isLoading) return;
    if (!isPartner) { navigate('/login?redirect=/dashboard'); return; }
    if (partnerType && partnerType !== 'restaurant') { navigate('/'); return; }
  }, [isPartner, partnerType, isLoading, navigate]);

  const reload = useCallback(async () => {
    setRefreshing(true);
    const [m, o, h, ov] = await Promise.all([
      restaurantManagement.getMenuItems(),
      restaurantManagement.getOrders(),
      restaurantManagement.getOpeningHours(),
      restaurantManagement.getOverview(),
    ]);
    setMenuItems(m);
    setOrders(o);
    setHours(h);
    setOverview(ov);
    setRefreshing(false);
  }, []);

  useEffect(() => { reload(); }, [reload]);

  useEffect(() => {
    if (tab === 'finances' && !finances) {
      restaurantManagement.getFinancialSummary().then(setFinances);
    }
  }, [tab, finances]);

  const stats = useMemo(() => ({
    totalPlats: menuItems.length,
    disponibles: menuItems.filter(m => m.is_disponible !== false).length,
    cmdJour: orders.filter(o => new Date(o.created_at).toDateString() === new Date().toDateString()).length,
    cmdEnAttente: orders.filter(o => o.status === 'pending').length,
    chiffreJour: orders
      .filter(o => new Date(o.created_at).toDateString() === new Date().toDateString() && o.status !== 'cancelled')
      .reduce((s, o) => s + Number(o.total_amount || 0), 0),
  }), [menuItems, orders]);

  // ─── Commandes : filtre mode + tri par urgence ───
  // Tri : "préparer maintenant" en haut, puis par requested_arrival_time ASC,
  // puis les sans-arrivée par created_at DESC (les plus récentes en haut).
  const sortedFilteredOrders = useMemo(() => {
    const filtered = orderModeFilter === 'all'
      ? orders
      : orders.filter(o => (o.order_type || 'dine_in') === orderModeFilter);

    return filtered.slice().sort((a, b) => {
      const aT = a.requested_arrival_time ? new Date(a.requested_arrival_time).getTime() : Infinity;
      const bT = b.requested_arrival_time ? new Date(b.requested_arrival_time).getTime() : Infinity;
      if (aT !== bT) return aT - bT;
      // Tie-break : plus récent d'abord
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
  }, [orders, orderModeFilter]);

  // Compteurs par mode pour les chips
  const modeCounts = useMemo(() => ({
    all: orders.filter(o => !['completed', 'cancelled'].includes(o.status)).length,
    dine_in: orders.filter(o => (o.order_type || 'dine_in') === 'dine_in' && !['completed', 'cancelled'].includes(o.status)).length,
    takeaway: orders.filter(o => o.order_type === 'takeaway' && !['completed', 'cancelled'].includes(o.status)).length,
    delivery: orders.filter(o => o.order_type === 'delivery' && !['completed', 'cancelled'].includes(o.status)).length,
  }), [orders]);

  // Compteur "à préparer maintenant"
  const prepNowCount = useMemo(() => {
    const now = Date.now();
    return orders.filter(o => {
      if (!o.requested_arrival_time) return false;
      if (['ready', 'completed', 'cancelled'].includes(o.status)) return false;
      const ms = new Date(o.requested_arrival_time).getTime() - now;
      const min = ms / 60000;
      return min > 0 && min <= (overview?.default_prep_minutes ?? 20);
    }).length;
  }, [orders, overview]);

  // ─── Handlers menu ──────────────────────────────
  const handleSaveItem = async () => {
    if (!editItem || !editItem.nom || !editItem.prix) return;
    if (editItem.id) {
      await restaurantManagement.updateMenuItem(editItem.id, editItem);
    } else {
      await restaurantManagement.createMenuItem(editItem as any);
    }
    setEditItem(null);
    reload();
  };

  const handleDeleteItem = async (id: number) => {
    if (!confirm(t('restoPartner.menu.dish.deleteConfirm'))) return;
    await restaurantManagement.deleteMenuItem(id);
    reload();
  };

  const handleToggleAvailable = async (item: RestaurantMenuItem) => {
    await restaurantManagement.updateMenuItem(item.id, { is_disponible: !item.is_disponible });
    reload();
  };

  // ─── Handlers commandes ─────────────────────────
  const handleAdvanceOrder = async (o: RestaurantOrder) => {
    const next = STATUS_FLOW[o.status]?.next;
    if (!next) return;
    await restaurantManagement.updateOrderStatus(o.id, next);
    reload();
  };

  const handleCancelOrder = async (o: RestaurantOrder) => {
    if (!confirm(t('restoPartner.orders.cancelConfirm'))) return;
    await restaurantManagement.updateOrderStatus(o.id, 'cancelled');
    reload();
  };

  // ─── Handlers horaires ──────────────────────────
  const handleSaveHours = async () => {
    if (!editHour) return;
    const updated = hours.some(h => h.day_of_week === editHour.day_of_week)
      ? hours.map(h => h.day_of_week === editHour.day_of_week ? editHour : h)
      : [...hours, editHour];
    await restaurantManagement.updateOpeningHours(updated);
    setEditHour(null);
    reload();
  };

  const setActiveTab = (k: TabKey) => setParams({ tab: k });

  // ─── Alerte "Préparer maintenant" basée sur requested_arrival_time ───
  // On notifie X min avant l'arrivée (X = default_prep_minutes ou 20 par défaut).
  const PREP_LEAD_MINUTES = overview?.default_prep_minutes ?? 20;
  const [alertedOrderIds, setAlertedOrderIds] = useState<Set<number>>(new Set());

  // Polling toutes les 30 s pour détecter les commandes qui entrent dans la fenêtre de prép.
  useEffect(() => {
    if (orders.length === 0) return;
    const tick = () => {
      const now = Date.now();
      const newAlerts: number[] = [];
      orders.forEach(o => {
        if (!o.requested_arrival_time) return;
        if (alertedOrderIds.has(o.id)) return;
        if (['ready', 'completed', 'cancelled', 'preparing'].includes(o.status)) return;
        const arrivalMs = new Date(o.requested_arrival_time).getTime();
        if (isNaN(arrivalMs)) return;
        const minutesUntilArrival = (arrivalMs - now) / 60000;
        // Alerte si on entre dans la fenêtre [0 ; PREP_LEAD_MINUTES] avant l'arrivée
        if (minutesUntilArrival > 0 && minutesUntilArrival <= PREP_LEAD_MINUTES) {
          newAlerts.push(o.id);
        }
      });
      if (newAlerts.length > 0) {
        // Beep simple via AudioContext (pas de dépendance ni de fichier audio)
        try {
          const AC = (window.AudioContext || (window as any).webkitAudioContext) as typeof AudioContext;
          const ctx = new AC();
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 880;
          o.type = 'sine';
          g.gain.setValueAtTime(0.001, ctx.currentTime);
          g.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.05);
          g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
          o.connect(g); g.connect(ctx.destination);
          o.start(); o.stop(ctx.currentTime + 0.5);
        } catch { /* silencieux si AudioContext non dispo (ex: tab pas encore interagie) */ }
        // Notification browser (si permission)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('🍳 Yukpo Restaurant', {
            body: `${newAlerts.length} commande(s) à préparer maintenant`,
            tag: 'restaurant-prep-alert',
          });
        }
        setAlertedOrderIds(prev => {
          const next = new Set(prev);
          newAlerts.forEach(id => next.add(id));
          return next;
        });
      }
    };
    tick(); // run immediately
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [orders, alertedOrderIds, PREP_LEAD_MINUTES]);

  // Demande la permission notification au premier rendu (silencieux si refusé)
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // ne demande qu'au moment où le user est sur le dashboard partenaire
      if (isPartner && partnerType === 'restaurant') {
        Notification.requestPermission().catch(() => {});
      }
    }
  }, [isPartner, partnerType]);

  // ─── Wizard import menu ─────────────────────────
  const resetImport = () => {
    setImportSource('paste'); setImportStep(1);
    setImportText(''); setImportPreview([]); setImportInvalid([]);
    setImportProgress({ done: 0, total: 0 });
    setExtUrl(''); setExtItemsPath('');
    setAiAnalyzing(false); setAiMapping({});
  };

  const handleFileSelected = async (file: File) => {
    setAiAnalyzing(true);
    setAiMapping({});
    try {
      const r = await parseImportMenuFileSmart(file, { useAi: true });
      if (r.rows.length === 0) {
        alert('Aucune ligne détectée. Vérifiez les colonnes (nom, prix, catégorie, description).');
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
    const { parsed, invalid } = parseBulkMenuInput(importText);
    setImportPreview(parsed);
    setImportInvalid(invalid);
    if (parsed.length === 0) {
      alert('Aucune ligne valide. Format : CSV (nom,prix,categorie,description) ou JSON.');
      return;
    }
    setImportStep(2);
  };

  const handleFetchExternal = async () => {
    if (!extUrl.trim()) { alert('URL externe requise'); return; }
    setImportLoading(true);
    try {
      const rows = await fetchExternalMenu(extUrl.trim(), extItemsPath.trim() || undefined);
      if (rows.length === 0) { alert('Aucun plat trouvé à cette URL.'); return; }
      setImportPreview(rows);
      setImportInvalid([]);
      setImportStep(2);
    } catch (e: any) {
      alert('Téléchargement impossible : ' + (e?.message || 'erreur réseau (CORS ?)'));
    } finally {
      setImportLoading(false);
    }
  };

  const handleConfirmImport = async () => {
    if (importPreview.length === 0) return;
    setImportLoading(true);
    setImportProgress({ done: 0, total: importPreview.length });
    const result = await restaurantManagement.bulkImportMenu(importPreview, {
      concurrency: 4,
      onProgress: (done, total) => setImportProgress({ done, total }),
    });
    setImportLoading(false);
    setShowImport(false);
    resetImport();
    reload();
    const errMsg = result.errors.length ? `\n${result.errors.slice(0, 3).join('\n')}` : '';
    alert(`Import terminé.\nCréés : ${result.created}/${importPreview.length}${errMsg}`);
  };

  if (isLoading) return <div className="p-8 text-center text-gray-500">Chargement…</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-4 py-5 shadow">
        <div className="max-w-screen-md mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{t('restoPartner.headerTitle')}</h1>
            <p className="text-red-100 text-sm">{t('restoPartner.headerSubtitle')}</p>
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

      {/* Tabs scrollables horizontalement */}
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
                  active ? 'text-red-600 border-red-600' : 'text-gray-500 border-transparent hover:text-gray-800'
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
        {tab === 'overview' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label={t('restoPartner.stat.totalDishes')} value={stats.totalPlats} sub={t('restoPartner.stat.available', { count: stats.disponibles })} accent="text-red-600" />
              <StatCard label={t('restoPartner.stat.ordersToday')} value={stats.cmdJour} sub={t('restoPartner.stat.pendingOrders', { count: stats.cmdEnAttente })} accent="text-blue-600" />
              <StatCard label={t('restoPartner.stat.revenueToday')} value={`${stats.chiffreJour.toLocaleString()} ${t('common.xaf')}`} accent="text-emerald-600" />
              <StatCard label={t('restoPartner.stat.tables')} value={overview?.tables_count ?? '—'} sub={t('restoPartner.stat.reservationsCount', { count: overview?.reservations_pending ?? 0 })} accent="text-violet-600" />
            </div>

            <div className="bg-white rounded-xl shadow-sm p-4">
              <h3 className="font-semibold mb-3">{t('restoPartner.overview.pendingOrdersTitle')}</h3>
              {orders.filter(o => o.status === 'pending').length === 0 ? (
                <p className="text-sm text-gray-500">{t('restoPartner.overview.noPending')}</p>
              ) : (
                <div className="space-y-2">
                  {orders.filter(o => o.status === 'pending').slice(0, 5).map(o => (
                    <button
                      key={o.id}
                      onClick={() => setActiveTab('orders')}
                      className="w-full text-left p-3 rounded-lg border border-gray-200 hover:bg-gray-50 flex justify-between items-center"
                    >
                      <div>
                        <div className="font-medium text-sm">{o.client_name || t('restoPartner.overview.client')}</div>
                        <div className="text-xs text-gray-500">{o.items?.length ?? 0} · {Number(o.total_amount).toLocaleString()} {t('common.xaf')}</div>
                      </div>
                      <ChevronRight size={18} className="text-gray-400" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <button
              onClick={() => { setEditItem({ nom: '', prix: 0, is_disponible: true, categorie: 'plat' }); setActiveTab('menu'); }}
              className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700"
            >
              <Plus size={18} className="inline-block mr-1" /> {t('restoPartner.overview.addDish')}
            </button>
          </div>
        )}

        {tab === 'menu' && (
          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                onClick={() => { resetImport(); setShowImport(true); }}
                className="flex-1 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
              >
                <Upload size={18} /> {t('restoPartner.menu.importBtn')}
              </button>
              <button
                onClick={() => setEditItem({ nom: '', prix: 0, is_disponible: true, categorie: 'plat' })}
                className="px-4 py-3 rounded-lg border border-red-300 text-red-700 font-semibold hover:bg-red-50 flex items-center justify-center gap-1"
                aria-label={t('restoPartner.menu.newDish')}
              >
                <Plus size={18} />
              </button>
            </div>

            {menuItems.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <Utensils size={32} className="mx-auto mb-2 text-gray-300" />
                {t('restoPartner.menu.empty')}
              </div>
            ) : (
              <div className="space-y-2">
                {menuItems.map(item => {
                  const todayOk = isAvailableToday(item.availability_days);
                  const daysLabel = formatAvailabilityDays(item.availability_days);
                  return (
                    <div key={item.id} className="bg-white rounded-xl shadow-sm p-3 flex items-center gap-3">
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="w-14 h-14 rounded-lg object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold truncate">{item.nom}</div>
                        <div className="text-sm text-gray-500">
                          {Number(item.prix).toLocaleString()} XAF · {item.categorie || '—'}
                        </div>
                        {/* Badge jours dispo : visible seulement si pas "tous les jours" */}
                        {daysLabel !== 'Tous les jours' && (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              todayOk ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {todayOk ? '✓ Aujourd\'hui' : '○ Pas aujourd\'hui'}
                            </span>
                            <span className="text-[10px] text-gray-500">{daysLabel}</span>
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleToggleAvailable(item)}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          item.is_disponible !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {item.is_disponible !== false ? t('restoPartner.menu.dish.available') : t('restoPartner.menu.dish.unavailable')}
                      </button>
                      <button onClick={() => setEditItem(item)} className="p-2 text-gray-500 hover:text-blue-600" aria-label="Éditer">
                        <Edit2 size={18} />
                      </button>
                      <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-gray-500 hover:text-red-600" aria-label="Supprimer">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === 'orders' && (
          <div className="space-y-3">
            {/* Bandeau "À préparer maintenant" */}
            {prepNowCount > 0 && (
              <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-3 shadow-md flex items-center gap-3">
                <span className="text-2xl">🔔</span>
                <div className="flex-1">
                  <div className="font-bold text-sm">{t('restoPartner.orders.prepareNowBanner', { count: prepNowCount })}</div>
                  <div className="text-[11px] text-white/90">{t('restoPartner.orders.prepareNowSub')}</div>
                </div>
              </div>
            )}

            {/* Chips filtre par mode (scrollables sur mobile) */}
            <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 pb-1 no-scrollbar">
              {([
                { v: 'all',      labelKey: 'restoPartner.orders.filter.all',      icon: null,    color: 'red' },
                { v: 'dine_in',  labelKey: 'restoPartner.orders.filter.dineIn',   icon: Utensils,color: 'red' },
                { v: 'takeaway', labelKey: 'restoPartner.orders.filter.takeaway', icon: Package, color: 'amber' },
                { v: 'delivery', labelKey: 'restoPartner.orders.filter.delivery', icon: Bike,    color: 'cyan' },
              ] as const).map(o => {
                const Icon = o.icon;
                const active = orderModeFilter === o.v;
                const count = modeCounts[o.v];
                return (
                  <button
                    key={o.v}
                    onClick={() => setOrderModeFilter(o.v)}
                    className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                      active
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    {Icon && <Icon size={13} />}
                    {t(o.labelKey)}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-bold ${
                      active ? 'bg-white/30 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>

            {sortedFilteredOrders.length === 0 ? (
              <div className="bg-white rounded-xl p-8 text-center text-gray-500">
                <ClipboardList size={32} className="mx-auto mb-2 text-gray-300" />
                {orders.length === 0
                  ? t('restoPartner.orders.empty')
                  : t('restoPartner.orders.emptyFiltered', {
                      mode: orderModeFilter === 'all' ? ''
                        : orderModeFilter === 'dine_in' ? t('restoPartner.orders.emptyDineIn')
                        : orderModeFilter === 'takeaway' ? t('restoPartner.orders.emptyTakeaway')
                        : t('restoPartner.orders.emptyDelivery')
                    })}
              </div>
            ) : (
              sortedFilteredOrders.map(o => {
                // Source de vérité : champ structuré `requested_arrival_time` (depuis migration 20260508).
                // Fallback : ancien préfixe textuel `[Arrivée HH:MM]` dans `notes` (commandes pré-migration).
                let arrivalLabel: string | null = null;
                let cleanNotes = o.notes || '';
                if (o.requested_arrival_time) {
                  const d = new Date(o.requested_arrival_time);
                  if (!isNaN(d.getTime())) {
                    arrivalLabel = `${String(d.getHours()).padStart(2, '0')}h${String(d.getMinutes()).padStart(2, '0')}`;
                  }
                } else {
                  const m = cleanNotes.match(/^\[Arriv(?:é|e)e?\s+(\d{1,2})[h:](\d{2})\]/i);
                  if (m) arrivalLabel = `${m[1].padStart(2, '0')}h${m[2]}`;
                  else if (/^\[Maintenant\]/.test(cleanNotes)) arrivalLabel = 'Maintenant';
                  cleanNotes = cleanNotes.replace(/^\[(Arriv[ée]e?\s+\d{1,2}[h:]\d{2}|Maintenant)\]\s*/i, '').trim();
                }
                const modeIcon = o.order_type === 'delivery' ? '🚴' : o.order_type === 'takeaway' ? '🥡' : '🍽️';
                const modeLabel = ((): string => {
                  if (o.order_type === 'delivery') return t('restoPartner.orders.modeLabel.delivery');
                  if (o.order_type === 'takeaway') return t('restoPartner.orders.modeLabel.takeaway');
                  return t('restoPartner.orders.modeLabel.dineIn');
                })();

                // Calcul "préparer maintenant" : on est dans la fenêtre de préparation avant arrivée
                let prepNow = false;
                let minutesLeft: number | null = null;
                if (o.requested_arrival_time && !['ready', 'completed', 'cancelled'].includes(o.status)) {
                  const ms = new Date(o.requested_arrival_time).getTime() - Date.now();
                  minutesLeft = Math.round(ms / 60000);
                  prepNow = minutesLeft > 0 && minutesLeft <= PREP_LEAD_MINUTES;
                }

                return (
                <div key={o.id} className={`bg-white rounded-xl shadow-sm p-4 ${prepNow ? 'ring-2 ring-amber-500 animate-pulse-once' : ''}`}>
                  {prepNow && (
                    <div className="-mx-4 -mt-4 mb-3 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-t-xl flex items-center gap-2">
                      {t('restoPartner.orders.prepareNowAlert', { minutes: minutesLeft })}
                    </div>
                  )}
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold flex items-center gap-1.5 flex-wrap">
                        <span>{modeIcon}</span>
                        {o.client_name || t('restoPartner.orders.client')}
                        <span className="text-xs text-gray-500">#{o.id}</span>
                        {/* Phase B — Badge "Client à risque" si historique de no-shows */}
                        {(o.client_no_show_count ?? 0) >= 2 && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-700" title={`${o.client_no_show_count} no-shows`}>
                            {t('restoPartner.orders.clientAtRisk', { count: o.client_no_show_count })}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500">{o.client_phone || ''} · {modeLabel}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {arrivalLabel && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 text-xs font-semibold">
                            ⏰ {arrivalLabel}
                          </span>
                        )}
                        {/* Phase A — Badge confirmation arrivée */}
                        {o.arrival_confirmed_at ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-xs font-bold">
                            {t('restoPartner.orders.clientOnRoute')}
                          </span>
                        ) : (
                          o.requested_arrival_time && !['ready', 'completed', 'cancelled'].includes(o.status) && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-xs">
                              {t('restoPartner.orders.clientNotConfirmed')}
                            </span>
                          )
                        )}
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_FLOW[o.status]?.color || 'bg-gray-100 text-gray-700'}`}>
                      {STATUS_FLOW[o.status] ? t(STATUS_FLOW[o.status].labelKey) : o.status}
                    </span>
                  </div>
                  <div className="text-sm text-gray-700 mb-1">
                    {o.items?.map(it => `${it.quantity}× ${it.item_name}`).join(', ')}
                  </div>
                  {cleanNotes && (
                    <div className="text-xs text-gray-500 italic mb-2">📝 {cleanNotes}</div>
                  )}
                  <div className="flex justify-between items-center">
                    <div className="font-bold text-red-600">{Number(o.total_amount).toLocaleString()} XAF</div>
                    <div className="flex gap-2">
                      {STATUS_FLOW[o.status]?.next && (
                        <button
                          onClick={() => handleAdvanceOrder(o)}
                          className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 flex items-center gap-1"
                        >
                          <Check size={14} /> {STATUS_FLOW[STATUS_FLOW[o.status].next] ? t(STATUS_FLOW[STATUS_FLOW[o.status].next].labelKey) : t('restoPartner.orders.advance')}
                        </button>
                      )}
                      {!['completed', 'cancelled'].includes(o.status) && (
                        <>
                          <button
                            onClick={() => handleCancelOrder(o)}
                            className="px-3 py-1.5 rounded-lg border border-red-300 text-red-700 text-xs font-semibold hover:bg-red-50 flex items-center gap-1"
                          >
                            <X size={14} /> {t('restoPartner.orders.cancel')}
                          </button>
                          {/* Phase B — Bouton "No-show" : visible si arrivée prévue dépassée et pas confirmée */}
                          {(() => {
                            if (!o.requested_arrival_time) return null;
                            const minPast = (Date.now() - new Date(o.requested_arrival_time).getTime()) / 60000;
                            // Visible 10 min après l'heure d'arrivée prévue, si pas confirmée
                            if (minPast < 10 || o.arrival_confirmed_at) return null;
                            return (
                              <button
                                onClick={async () => {
                                  if (!confirm(t('restoPartner.orders.noShowConfirm', { id: o.id }))) return;
                                  const ok = await restaurantManagement.markNoShow(o.id);
                                  if (ok) reload();
                                }}
                                className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 text-xs font-bold hover:bg-orange-200 flex items-center gap-1"
                                title={t('restoPartner.orders.noShowTooltip')}
                              >
                                {t('restoPartner.orders.noShow')}
                              </button>
                            );
                          })()}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
              })
            )}
          </div>
        )}

        {tab === 'hours' && (
          <div className="bg-white rounded-xl shadow-sm divide-y divide-gray-100">
            {JOURS.map((j, idx) => {
              const h = hours.find(x => x.day_of_week === idx);
              return (
                <button
                  key={idx}
                  onClick={() => setEditHour(h || { day_of_week: idx, open_time: '08:00', close_time: '22:00', is_closed: false })}
                  className="w-full p-4 flex justify-between items-center hover:bg-gray-50 text-left"
                >
                  <span className="font-medium">{j}</span>
                  <span className="text-sm text-gray-600">
                    {!h || h.is_closed ? <span className="text-red-600 font-medium">Fermé</span> : `${h.open_time} – ${h.close_time}`}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {tab === 'finances' && (
          <div className="space-y-3">
            <StatCard label="Chiffre d'affaires (mois)" value={`${(finances?.revenue_month ?? 0).toLocaleString()} XAF`} accent="text-emerald-600" />
            <StatCard label="Commandes (mois)" value={finances?.orders_month ?? 0} accent="text-blue-600" />
            <StatCard label="Ticket moyen" value={`${(finances?.avg_ticket ?? 0).toLocaleString()} XAF`} accent="text-violet-600" />
            <p className="text-xs text-gray-500 text-center mt-4">
              {t('restoPartner.finances.withdrawalNote')}
            </p>
          </div>
        )}
      </div>

      {/* Modal édition plat */}
      {editItem && (
        <Modal onClose={() => setEditItem(null)} title={editItem.id ? t('restoPartner.menu.edit.editTitle') : t('restoPartner.menu.edit.newTitle')}>
          <div className="space-y-3">
            <Input label={t('restoPartner.menu.edit.name')} value={editItem.nom || ''} onChange={(v) => setEditItem({ ...editItem, nom: v })} />
            <Input label={t('restoPartner.menu.edit.price')} type="number" value={String(editItem.prix ?? '')} onChange={(v) => setEditItem({ ...editItem, prix: Number(v) })} />
            <div>
              <label className="text-sm font-medium text-gray-700">{t('restoPartner.menu.edit.category')}</label>
              <select
                value={editItem.categorie || 'plat'}
                onChange={(e) => setEditItem({ ...editItem, categorie: e.target.value })}
                className="mt-1 w-full p-2.5 rounded-lg border border-gray-300"
              >
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{t(c.labelKey)}</option>)}
              </select>
            </div>
            <Input label={t('restoPartner.menu.edit.description')} value={editItem.description || ''} onChange={(v) => setEditItem({ ...editItem, description: v })} />

            {/* Jours de disponibilité */}
            <div>
              <label className="text-sm font-medium text-gray-700 block mb-1">{t('restoPartner.menu.edit.availabilityDays')}</label>
              <p className="text-xs text-gray-500 mb-2">{t('restoPartner.menu.edit.availabilityHelp')}</p>
              <div className="flex gap-1 mb-2 flex-wrap">
                {PRESET_DAYS.map(p => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setEditItem({ ...editItem, availability_days: p.days })}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                  >
                    {t(p.labelKey)}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setEditItem({ ...editItem, availability_days: [] })}
                  className="px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  {t('restoPartner.menu.edit.presetNone')}
                </button>
              </div>
              <div className="flex gap-1">
                {JOURS.map((j, idx) => {
                  const days = editItem.availability_days || [];
                  const active = days.includes(idx);
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        const next = active ? days.filter(d => d !== idx) : [...days, idx].sort((a, b) => a - b);
                        setEditItem({ ...editItem, availability_days: next });
                      }}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold transition ${
                        active ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                    >
                      {j}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-1.5">
                → <span className="font-medium">{formatAvailabilityDays(editItem.availability_days)}</span>
              </p>
            </div>

            <button
              onClick={handleSaveItem}
              disabled={!editItem.nom || !editItem.prix}
              className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save size={18} /> {t('common.save')}
            </button>
          </div>
        </Modal>
      )}

      {/* Wizard import menu */}
      {showImport && (
        <Modal onClose={() => { setShowImport(false); resetImport(); }} title={importStep === 1 ? t('restoPartner.import.title') : t('restoPartner.import.previewTitle')}>
          {importStep === 1 ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <SourceTab active={importSource === 'paste'}    label={t('restoPartner.import.src.paste')}    icon={FileText} onClick={() => setImportSource('paste')} />
                <SourceTab active={importSource === 'file'}     label={t('restoPartner.import.src.file')}     icon={FileUp}   onClick={() => setImportSource('file')} />
                <SourceTab active={importSource === 'external'} label={t('restoPartner.import.src.external')} icon={LinkIcon} onClick={() => setImportSource('external')} />
              </div>

              {importSource === 'paste' && (
                <>
                  <p className="text-xs text-gray-500">{t('restoPartner.import.pasteFormat')}</p>
                  <textarea
                    value={importText}
                    onChange={e => setImportText(e.target.value)}
                    rows={8}
                    placeholder={`Ndolé,3500,plat,Plat traditionnel\nPoulet DG,4500,plat,\nBissap,1000,boisson,Jus naturel`}
                    className="w-full p-3 rounded-lg border border-gray-300 font-mono text-xs focus:outline-none focus:ring-2 focus:ring-red-500"
                  />
                </>
              )}

              {importSource === 'file' && (
                <div className="space-y-2">
                  <p className="text-xs text-gray-500">{t('restoPartner.import.filesFormat')}</p>
                  <label className={`block w-full p-6 border-2 border-dashed rounded-lg text-center cursor-pointer transition ${aiAnalyzing ? 'border-red-400 bg-red-50' : 'border-gray-300 hover:bg-gray-50'}`}>
                    {aiAnalyzing ? (
                      <>
                        <div className="animate-spin mx-auto mb-2 w-8 h-8 border-2 border-red-600 border-t-transparent rounded-full" />
                        <span className="text-sm font-medium text-red-700">{t('restoPartner.import.filesAnalyzing')}</span>
                      </>
                    ) : (
                      <>
                        <FileUp size={32} className="mx-auto text-red-600 mb-2" />
                        <span className="text-sm font-medium text-gray-700">{t('restoPartner.import.filesPick')}</span>
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
                  <p className="text-xs text-gray-500">{t('restoPartner.import.extFormat')}</p>
                  <Input label={t('restoPartner.import.extUrl')} value={extUrl} onChange={setExtUrl} />
                  <Input label={t('restoPartner.import.extPath')} value={extItemsPath} onChange={setExtItemsPath} />
                  <button
                    onClick={handleFetchExternal}
                    disabled={importLoading || !extUrl.trim()}
                    className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    <Upload size={18} /> {importLoading ? t('restoPartner.import.extFetching') : t('restoPartner.import.extFetch')}
                  </button>
                </>
              )}

              {importSource !== 'external' && (
                <button
                  onClick={handlePreviewPaste}
                  className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
                >
                  <Check size={18} /> {t('restoPartner.import.preview')}
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-sm">
                {t('restoPartner.import.ready', { count: importPreview.length })}
                {importInvalid.length > 0 && <span className="ml-2 text-amber-700">{t('restoPartner.import.ignored', { count: importInvalid.length })}</span>}
              </div>

              {/* Badge Yukpo : colonnes reconnues automatiquement */}
              {Object.keys(aiMapping).length > 0 && (
                <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-blue-800">
                    {t('restoPartner.import.aiBadge')}
                  </div>
                  <ul className="text-blue-900 space-y-0.5">
                    {Object.entries(aiMapping).map(([h, c]) => (
                      <li key={h}><code className="bg-white px-1 rounded">{h}</code> → <code className="bg-white px-1 rounded">{c}</code></li>
                    ))}
                  </ul>
                </div>
              )}

              {importInvalid.length > 0 && (
                <div className="p-3 rounded-lg bg-amber-50 text-amber-800 text-xs space-y-1 max-h-24 overflow-y-auto">
                  <div className="flex items-center gap-1 font-semibold"><AlertCircle size={14} /> {t('restoPartner.import.ignoredHeading')}</div>
                  {importInvalid.slice(0, 5).map((m, i) => <div key={i}>• {m}</div>)}
                </div>
              )}

              <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
                {importPreview.slice(0, 20).map((p, i) => (
                  <div key={i} className="p-2 text-xs flex justify-between gap-2">
                    <span className="font-medium truncate">{p.nom}</span>
                    <span className="text-gray-500 whitespace-nowrap">{p.prix.toLocaleString()} {t('common.xaf')} · {p.categorie}</span>
                  </div>
                ))}
                {importPreview.length > 20 && (
                  <div className="p-2 text-xs text-center text-gray-500">{t('restoPartner.import.moreItems', { count: importPreview.length - 20 })}</div>
                )}
              </div>

              {importLoading && importProgress.total > 0 && (
                <div className="space-y-1">
                  <div className="text-xs text-gray-600 text-center">
                    {t('restoPartner.import.progress', { done: importProgress.done, total: importProgress.total })}
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-2 bg-red-600 transition-all"
                      style={{ width: `${(importProgress.done / importProgress.total) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button onClick={() => setImportStep(1)} disabled={importLoading} className="flex-1 py-3 rounded-lg border border-gray-300 font-semibold hover:bg-gray-50 disabled:opacity-50">
                  {t('common.back')}
                </button>
                <button
                  onClick={handleConfirmImport}
                  disabled={importLoading || importPreview.length === 0}
                  className="flex-1 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  <Upload size={18} /> {importLoading ? t('restoPartner.import.importing') : t('restoPartner.import.doImport')}
                </button>
              </div>
            </div>
          )}
        </Modal>
      )}

      {/* Modal édition horaires */}
      {editHour && (
        <Modal onClose={() => setEditHour(null)} title={t('restoPartner.hours.modal.title', { day: JOURS[editHour.day_of_week] })}>
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={editHour.is_closed}
                onChange={(e) => setEditHour({ ...editHour, is_closed: e.target.checked })}
              />
              <span>{t('restoPartner.hours.modal.closedToday')}</span>
            </label>
            {!editHour.is_closed && (
              <>
                <Input type="time" label={t('restoPartner.hours.modal.openTime')} value={editHour.open_time || '08:00'} onChange={(v) => setEditHour({ ...editHour, open_time: v })} />
                <Input type="time" label={t('restoPartner.hours.modal.closeTime')} value={editHour.close_time || '22:00'} onChange={(v) => setEditHour({ ...editHour, close_time: v })} />
              </>
            )}
            <button
              onClick={handleSaveHours}
              className="w-full py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 flex items-center justify-center gap-2"
            >
              <Save size={18} /> {t('common.save')}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: number | string; sub?: string; accent?: string }> = ({ label, value, sub, accent = 'text-gray-900' }) => (
  <div className="bg-white rounded-xl shadow-sm p-3">
    <div className="text-xs text-gray-500 mb-1">{label}</div>
    <div className={`text-lg font-bold ${accent}`}>{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-0.5">{sub}</div>}
  </div>
);

const Input: React.FC<{ label: string; value: string; onChange: (v: string) => void; type?: string }> = ({ label, value, onChange, type = 'text' }) => (
  <div>
    <label className="text-sm font-medium text-gray-700">{label}</label>
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="mt-1 w-full p-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-red-500"
    />
  </div>
);

const SourceTab: React.FC<{ active: boolean; label: string; icon: any; onClick: () => void }> = ({ active, label, icon: Icon, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-1 p-3 rounded-lg border text-xs font-medium transition ${
      active ? 'border-red-600 bg-red-50 text-red-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
    }`}
  >
    <Icon size={18} />
    {label}
  </button>
);

const Modal: React.FC<{ onClose: () => void; title: string; children: React.ReactNode }> = ({ onClose, title, children }) => (
  <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center justify-center p-4" onClick={onClose}>
    <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

export default RestaurantDashboardPage;
