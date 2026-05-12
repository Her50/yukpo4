// Service partenaire restaurant — port web du mobile/src/services/restaurantManagementService.ts
import { apiGet, apiPost, apiPatch, apiPut, apiDelete } from './apiService';
import { aiResolveHeaders, getLearnedAliases, needsAiFallback, normKey as normKeyAi } from './columnAi';

export interface RestaurantMenuItem {
  id: number;
  service_id?: number;
  nom: string;
  description?: string;
  prix: number;
  categorie?: string;
  is_disponible?: boolean;
  image_url?: string;
  video_url?: string;
  availability_days?: number[];
  sort_order?: number;
}

export interface RestaurantOrderItem {
  id: number;
  item_name: string;
  item_price: number;
  quantity: number;
  notes?: string;
}

export interface RestaurantOrder {
  id: number;
  order_type: string;
  status: string;
  total_amount: number;
  client_name?: string;
  client_phone?: string;
  notes?: string;
  table_id?: number;
  estimated_ready_at?: string;
  /** Heure d'arrivée souhaitée par le client (ISO 8601). NULL = "tout de suite". */
  requested_arrival_time?: string | null;
  /** Horodatage où le client a confirmé "Je suis en route". NULL = pas confirmé. */
  arrival_confirmed_at?: string | null;
  /** ID du client (pour distinguer commandes auth/anonymes). */
  client_user_id?: number | null;
  /** Compteur cumulé de no-shows du client (anti-fraude). */
  client_no_show_count?: number;
  created_at: string;
  items: RestaurantOrderItem[];
}

export interface RestaurantOpeningHour {
  id?: number;
  day_of_week: number;
  open_time?: string;
  close_time?: string;
  is_closed: boolean;
}

export interface RestaurantOverview {
  service_id: number;
  tables_count: number;
  reservations_pending: number;
  accepts_delivery: boolean;
  accepts_dine_in: boolean;
  default_prep_minutes?: number;
}

const ensureArray = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

const safeJson = async (res: Response): Promise<any> => {
  const txt = await res.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return {}; }
};

const qs = (params: Record<string, any>): string => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') u.set(k, String(v));
  });
  const s = u.toString();
  return s ? `?${s}` : '';
};

export const restaurantManagement = {
  // ─── Overview / Settings ─────────────────────────────────
  async getOverview(): Promise<RestaurantOverview | null> {
    try {
      const r = await apiGet('/api/restaurant/overview');
      const j = await safeJson(r);
      return (j?.data ?? j) as RestaurantOverview;
    } catch { return null; }
  },

  async patchSettings(data: { accepts_delivery?: boolean; accepts_dine_in?: boolean; default_prep_minutes?: number }) {
    return apiPatch('/api/restaurant/settings', data);
  },

  // ─── Menu items ──────────────────────────────────────────
  async getMenuItems(): Promise<RestaurantMenuItem[]> {
    try {
      const r = await apiGet('/api/restaurant/menu');
      const j = await safeJson(r);
      return ensureArray<RestaurantMenuItem>(j?.data?.items ?? j?.data?.menu ?? j?.items ?? j?.menu);
    } catch { return []; }
  },

  async createMenuItem(data: Partial<RestaurantMenuItem>) {
    return apiPost('/api/restaurant/menu', data);
  },

  async updateMenuItem(id: number, data: Partial<RestaurantMenuItem>) {
    return apiPatch(`/api/restaurant/menu/${id}`, data);
  },

  async deleteMenuItem(id: number) {
    return apiPatch(`/api/restaurant/menu/${id}`, { is_disponible: false });
  },

  // ─── Horaires d'ouverture ────────────────────────────────
  async getOpeningHours(): Promise<RestaurantOpeningHour[]> {
    try {
      const r = await apiGet('/api/restaurant/opening-hours');
      const j = await safeJson(r);
      return ensureArray<RestaurantOpeningHour>(j?.data?.hours ?? j?.hours);
    } catch { return []; }
  },

  async updateOpeningHours(hours: RestaurantOpeningHour[]) {
    return apiPut('/api/restaurant/opening-hours', { hours });
  },

  // ─── Commandes (partenaire) ──────────────────────────────
  async getOrders(status?: string): Promise<RestaurantOrder[]> {
    try {
      const r = await apiGet(`/api/restaurant/orders${status ? qs({ status }) : ''}`);
      const j = await safeJson(r);
      return ensureArray<RestaurantOrder>(j?.data?.orders ?? j?.orders);
    } catch { return []; }
  },

  async updateOrderStatus(orderId: number, status: string, estimated_ready_at?: string) {
    return apiPatch(`/api/restaurant/orders/${orderId}/status`, { status, estimated_ready_at });
  },

  // ─── Finances ────────────────────────────────────────────
  async getFinancialSummary(): Promise<any> {
    try {
      const r = await apiGet('/api/restaurant/financial-summary');
      const j = await safeJson(r);
      return j?.data ?? j;
    } catch { return null; }
  },

  // ─── Client : commandes & avis ───────────────────────────
  async clientOrderHistory(): Promise<RestaurantOrder[]> {
    try {
      const r = await apiGet('/api/restaurant/public/orders/history');
      const j = await safeJson(r);
      return ensureArray<RestaurantOrder>(j?.data?.orders ?? j?.orders);
    } catch { return []; }
  },

  async getOrderStatus(orderId: number): Promise<RestaurantOrder | null> {
    try {
      const r = await apiGet(`/api/restaurant/public/orders/${orderId}/status`);
      const j = await safeJson(r);
      return (j?.data?.order ?? j?.order) as RestaurantOrder;
    } catch { return null; }
  },

  async rateOrder(orderId: number, rating: number, comment?: string) {
    return apiPost(`/api/restaurant/public/orders/${orderId}/rate`, { rating, comment });
  },

  /** Phase A — Le client signale qu'il est en route. Idempotent. */
  async confirmArrival(orderId: number): Promise<boolean> {
    try {
      const r = await apiPost(`/api/restaurant/public/orders/${orderId}/confirm-arrival`, {});
      return r.ok;
    } catch { return false; }
  },

  /** Phase B — Le partenaire marque une commande no-show. */
  async markNoShow(orderId: number): Promise<boolean> {
    try {
      const r = await apiPost(`/api/restaurant/orders/${orderId}/mark-no-show`, {});
      return r.ok;
    } catch { return false; }
  },

  /**
   * Import en lot du menu côté client.
   * Pas d'endpoint bulk backend → on POST un par un par lots de `concurrency`.
   * Retourne un compteur progressif via `onProgress`.
   */
  async bulkImportMenu(
    items: BulkMenuRow[],
    opts: { concurrency?: number; onProgress?: (done: number, total: number) => void } = {},
  ): Promise<{ created: number; errors: string[] }> {
    const concurrency = Math.max(1, opts.concurrency ?? 4);
    let created = 0;
    const errors: string[] = [];
    let cursor = 0;
    const total = items.length;

    const worker = async () => {
      while (cursor < total) {
        const idx = cursor++;
        const it = items[idx];
        try {
          const r = await apiPost('/api/restaurant/menu', it);
          if (r.ok) created++; else errors.push(`Ligne ${idx + 1} (${it.nom}) : HTTP ${r.status}`);
        } catch (e: any) {
          errors.push(`Ligne ${idx + 1} (${it.nom}) : ${e?.message || 'erreur'}`);
        }
        opts.onProgress?.(idx + 1, total);
      }
    };

    await Promise.all(Array.from({ length: concurrency }, worker));
    return { created, errors };
  },
};

// ────────────────────────────────────────────────────────────
// Helpers de parsing menu — CSV/JSON/Excel
// ────────────────────────────────────────────────────────────

export interface BulkMenuRow {
  nom: string;
  prix: number;
  categorie?: string;
  description?: string;
  is_disponible?: boolean;
  image_url?: string;
  availability_days?: number[];
}

/**
 * Convertit une valeur de cellule "jours" hétérogène en `number[]` (0=Dim … 6=Sam).
 * Accepte :
 *   - tableau JS : [1,2,3]
 *   - chaîne CSV : "1,2,3" / "lun,mar,mer" / "L,M,M,J,V"
 *   - alias : "tous", "all", "everyday", "lun-ven", "weekdays", "week-end", "weekend"
 *   - vide / null → undefined (= dispo tous les jours)
 */
export const parseAvailabilityDays = (raw: any): number[] | undefined => {
  if (raw === null || raw === undefined || raw === '') return undefined;
  if (Array.isArray(raw)) {
    const nums = raw.map(Number).filter(n => Number.isInteger(n) && n >= 0 && n <= 6);
    return nums.length > 0 ? Array.from(new Set(nums)).sort((a, b) => a - b) : undefined;
  }
  const s = String(raw).trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!s) return undefined;

  // Alias spéciaux
  if (/^(tous|toujours|all|everyday|7\/7|7j\/7|7sur7)$/.test(s)) return [0, 1, 2, 3, 4, 5, 6];
  if (/^(lun.?ven|weekdays|semaine|jours.?ouvres|jours.?ouvrables)$/.test(s)) return [1, 2, 3, 4, 5];
  if (/^(weekend|week.?end|samdim|samedi.?dimanche)$/.test(s)) return [0, 6];

  // Mapping jour → index
  const dayMap: Record<string, number> = {
    'dim': 0, 'dimanche': 0, 'sun': 0, 'sunday': 0, 'd': 0,
    'lun': 1, 'lundi': 1, 'mon': 1, 'monday': 1, 'l': 1,
    'mar': 2, 'mardi': 2, 'tue': 2, 'tuesday': 2,
    'mer': 3, 'mercredi': 3, 'wed': 3, 'wednesday': 3,
    'jeu': 4, 'jeudi': 4, 'thu': 4, 'thursday': 4, 'j': 4,
    'ven': 5, 'vendredi': 5, 'fri': 5, 'friday': 5, 'v': 5,
    'sam': 6, 'samedi': 6, 'sat': 6, 'saturday': 6, 's': 6,
  };

  const tokens = s.split(/[,;\s|/+&-]+/).filter(Boolean);
  const out = new Set<number>();
  tokens.forEach(t => {
    // numérique direct ?
    const n = Number(t);
    if (Number.isInteger(n) && n >= 0 && n <= 6) { out.add(n); return; }
    // mapping nom ?
    if (t in dayMap) { out.add(dayMap[t]); return; }
    // préfixes (mardis → mardi)
    for (const k of Object.keys(dayMap)) {
      if (t.startsWith(k) && k.length >= 3) { out.add(dayMap[k]); break; }
    }
  });
  return out.size > 0 ? Array.from(out).sort((a, b) => a - b) : undefined;
};

const VALID_CATEGORIES = ['entree', 'plat', 'dessert', 'boisson', 'specialite'];

const normalizeCategorie = (raw: any): string | undefined => {
  if (!raw) return undefined;
  const s = String(raw).trim().toLowerCase();
  // matches : entree/entrée, plat/plats, dessert, boisson, specialite/spécialité
  if (s.startsWith('entr')) return 'entree';
  if (s.startsWith('plat')) return 'plat';
  if (s.startsWith('dess')) return 'dessert';
  if (s.startsWith('bois') || s.startsWith('drink')) return 'boisson';
  if (s.startsWith('spec') || s.startsWith('spéc')) return 'specialite';
  return VALID_CATEGORIES.includes(s) ? s : undefined;
};

// ─── Matching tolérant des en-têtes (case/accent/espace insensitive) ───
const normMenuKey = normKeyAi;

const MENU_ALIASES = {
  nom:               ['nom', 'nomproduit', 'name', 'productname', 'designation', 'libelle', 'plat', 'titre', 'item'],
  prix:              ['prix', 'price', 'pu', 'tarif', 'montant', 'cost', 'prixxaf', 'prixfcfa'],
  categorie:         ['categorie', 'category', 'famille', 'rayon', 'classe', 'type'],
  description:       ['description', 'desc', 'details', 'note', 'commentaire'],
  image_url:         ['imageurl', 'image', 'photo', 'urlimage', 'picture'],
  availability_days: ['availabilitydays', 'jours', 'joursdispo', 'joursdisponibles', 'jourdispo', 'days', 'availability', 'dispojours', 'serviedispo'],
};

const pickMenuField = (row: any, field: keyof typeof MENU_ALIASES): any => {
  const wanted = [
    ...MENU_ALIASES[field],
    ...(getLearnedAliases('restaurant')[field] || []),
  ];
  for (const k of Object.keys(row)) {
    if (wanted.includes(normMenuKey(k))) return row[k];
  }
  return undefined;
};

const RESTAURANT_FIELDS = ['nom', 'prix', 'categorie', 'description', 'image_url', 'availability_days'];

const objectToMenuRow = (row: any): BulkMenuRow | null => {
  const nom = String(pickMenuField(row, 'nom') ?? '').trim();
  if (!nom) return null;
  const prix = Number(pickMenuField(row, 'prix') ?? 0);
  if (!Number.isFinite(prix) || prix < 0) return null;
  return {
    nom,
    prix,
    categorie: normalizeCategorie(pickMenuField(row, 'categorie')) ?? 'plat',
    description: (pickMenuField(row, 'description') ?? undefined) || undefined,
    image_url: (pickMenuField(row, 'image_url') ?? undefined) || undefined,
    availability_days: parseAvailabilityDays(pickMenuField(row, 'availability_days')),
    is_disponible: true,
  };
};

/** Parse une chaîne (JSON ou CSV/TSV) → liste de plats. */
export const parseBulkMenuInput = (
  input: string,
): { parsed: BulkMenuRow[]; invalid: string[] } => {
  const parsed: BulkMenuRow[] = [];
  const invalid: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return { parsed, invalid };

  // JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed);
      const rows = Array.isArray(j) ? j : [j];
      rows.forEach((row: any, idx: number) => {
        const r = objectToMenuRow(row);
        if (!r) { invalid.push(`Ligne ${idx + 1} : nom ou prix invalide`); return; }
        parsed.push(r);
      });
    } catch (e: any) {
      invalid.push('JSON invalide : ' + (e?.message || ''));
    }
    return { parsed, invalid };
  }

  // CSV/TSV — séparateur auto-détecté + matching d'en-tête tolérant
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { parsed, invalid };

  const sep = ((line: string) => {
    const counts = { ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length, '\t': (line.match(/\t/g) || []).length };
    return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ',';
  })(lines[0]);

  const splitCsv = (line: string): string[] => {
    const out: string[] = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { inQuotes = !inQuotes; continue; }
      if (c === sep && !inQuotes) { out.push(cur.trim()); cur = ''; continue; }
      cur += c;
    }
    out.push(cur.trim());
    return out;
  };

  const headers = splitCsv(lines[0]);
  const headerHasMatch = headers.some(h =>
    Object.values(MENU_ALIASES).some(arr => arr.includes(normMenuKey(h))),
  );

  if (headerHasMatch) {
    lines.slice(1).forEach((line, idx) => {
      const cells = splitCsv(line);
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cells[i]; });
      const r = objectToMenuRow(obj);
      if (!r) { invalid.push(`Ligne ${idx + 1} : nom ou prix invalide`); return; }
      parsed.push(r);
    });
  } else {
    // Fallback positionnel : nom,prix,categorie,description,image_url
    lines.forEach((line, idx) => {
      const parts = splitCsv(line);
      const nom = (parts[0] || '').trim();
      if (!nom) { invalid.push(`Ligne ${idx + 1} : nom manquant`); return; }
      const prix = parseFloat((parts[1] || '0').replace(',', '.'));
      if (Number.isNaN(prix) || prix < 0) { invalid.push(`Ligne ${idx + 1} : prix invalide`); return; }
      parsed.push({
        nom, prix,
        categorie: normalizeCategorie(parts[2]) ?? 'plat',
        description: parts[3] || undefined,
        image_url: parts[4] || undefined,
        is_disponible: true,
      });
    });
  }

  return { parsed, invalid };
};

/** Parse un fichier (CSV/TSV/Excel) → BulkMenuRow[]. xlsx chargé en lazy. */
export const parseImportMenuFile = async (file: File): Promise<BulkMenuRow[]> => {
  const r = await parseImportMenuFileSmart(file, { useAi: false });
  return r.rows;
};

export interface SmartMenuParseResult {
  rows: BulkMenuRow[];
  invalid: string[];
  aiUsed: boolean;
  aiMapping: Record<string, string>;
  detectedHeaders: string[];
}

/**
 * Parse intelligent du fichier menu : déterministe d'abord, fallback LLM si colonnes inconnues.
 * Mémorise les nouveaux alias dans localStorage (évite l'appel LLM au prochain import).
 */
export const parseImportMenuFileSmart = async (
  file: File,
  opts: { useAi?: boolean } = { useAi: true },
): Promise<SmartMenuParseResult> => {
  const name = file.name.toLowerCase();
  let rawRows: any[] = [];
  let headers: string[] = [];

  if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
    const XLSX = await import('xlsx');
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: 'array' });
    const sheetName = wb.SheetNames[0];
    if (sheetName) {
      const ws = wb.Sheets[sheetName];
      rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (rawRows.length > 0) headers = Object.keys(rawRows[0]);
    }
  } else {
    const text = await file.text();
    const trimmed = text.trim();
    const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
    if (lines.length > 0) {
      const sep = ((line: string) => {
        const counts = { ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length, '\t': (line.match(/\t/g) || []).length };
        return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ',';
      })(lines[0]);
      const splitCsv = (line: string): string[] => {
        const out: string[] = []; let cur = ''; let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') { inQuotes = !inQuotes; continue; }
          if (c === sep && !inQuotes) { out.push(cur.trim()); cur = ''; continue; }
          cur += c;
        }
        out.push(cur.trim());
        return out;
      };
      headers = splitCsv(lines[0]);
      rawRows = lines.slice(1).map(line => {
        const cells = splitCsv(line);
        const obj: any = {};
        headers.forEach((h, i) => { obj[h] = cells[i]; });
        return obj;
      });
    }
  }

  let parsed: BulkMenuRow[] = rawRows
    .map(objectToMenuRow)
    .filter((r): r is BulkMenuRow => !!r && r.nom.length > 0 && r.prix > 0);

  let aiMapping: Record<string, string> = {};
  let aiUsed = false;

  if (opts.useAi && headers.length > 0 && needsAiFallback(parsed)) {
    const r = await aiResolveHeaders('restaurant', headers, rawRows.slice(0, 3), RESTAURANT_FIELDS);
    if (Object.keys(r.mapping).length > 0) {
      aiUsed = true;
      aiMapping = r.mapping;
      parsed = rawRows
        .map(objectToMenuRow)
        .filter((r): r is BulkMenuRow => !!r && r.nom.length > 0 && r.prix > 0);
    }
  }

  return { rows: parsed, invalid: [], aiUsed, aiMapping, detectedHeaders: headers };
};

/**
 * Récupère un menu depuis une URL externe (Google Sheet publié en CSV, JSON public, etc.).
 * Le fetch se fait côté client → l'URL doit être CORS-friendly.
 */
export const fetchExternalMenu = async (
  url: string,
  itemsPath?: string,
): Promise<BulkMenuRow[]> => {
  const r = await fetch(url, { method: 'GET' });
  if (!r.ok) throw new Error(`HTTP ${r.status} sur l'URL`);
  const ct = (r.headers.get('content-type') || '').toLowerCase();
  if (ct.includes('json')) {
    const j = await r.json();
    let arr: any = j;
    if (itemsPath) {
      itemsPath.split('.').forEach((p) => { arr = arr?.[p]; });
    }
    if (!Array.isArray(arr)) throw new Error('La réponse JSON ne contient pas de tableau d\'items');
    return parseBulkMenuInput(JSON.stringify(arr)).parsed;
  }
  const txt = await r.text();
  return parseBulkMenuInput(txt).parsed;
};
