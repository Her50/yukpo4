// Service partenaire pharmacie — port web du mobile/src/services/pharmacyService.ts
import { apiGet, apiPost, apiPatch, apiDelete } from './apiService';
import { aiResolveHeaders, getLearnedAliases, needsAiFallback, normKey as normKeyAi } from './columnAi';

export interface PharmacyOrder {
  id: string;
  pharmacy_id: number;
  pharmacy_name: string | null;
  status: string | null;
  total_amount: string | null;
  delivery_method: string | null;
  delivery_address: string | null;
  created_at: string;
  client_name?: string | null;
  client_phone?: string | null;
}

export interface PharmacyAnalytics {
  total_orders: number;
  orders_7d: number;
  orders_30d: number;
  total_revenue: string | null;
  avg_order_value: string | null;
}

export interface PharmacyProduct {
  id: number;
  pharmacy_service_id?: number;
  nom_produit: string;
  description?: string | null;
  prix: number;
  stock: number;
  unite?: string;
  code_barre?: string | null;
  categorie?: string | null;
  is_disponible?: boolean;
}

export interface BulkImportRow {
  nom_produit: string;
  prix: number;
  stock: number;
  unite?: string;
  code_barre?: string;
  categorie?: string;
  description?: string;
}

export interface BulkImportResult {
  created: number;
  updated: number;
  errors?: string[];
}

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

export const pharmacyPartner = {
  /** Récupère l'id de la pharmacie associée à l'utilisateur connecté */
  async getMyPharmacy(): Promise<{ id: number; name: string } | null> {
    try {
      const r = await apiGet('/api/pharmacies/me');
      const j = await safeJson(r);
      const data = j?.data ?? j;
      if (!data?.id) return null;
      return { id: data.id, name: data.name ?? data.nom ?? 'Ma pharmacie' };
    } catch { return null; }
  },

  async getAnalytics(pharmacyId: number): Promise<PharmacyAnalytics | null> {
    try {
      const r = await apiGet(`/api/pharmacies/${pharmacyId}/analytics`);
      const j = await safeJson(r);
      return (j?.data ?? j) as PharmacyAnalytics;
    } catch { return null; }
  },

  async getPartnerOrders(
    pharmacyId: number,
    opts: { status?: string; page?: number; limit?: number } = {},
  ): Promise<{ orders: PharmacyOrder[]; hasMore: boolean }> {
    const params = { status: opts.status, page: opts.page ?? 1, limit: opts.limit ?? 20 };
    try {
      const r = await apiGet(`/api/pharmacies/${pharmacyId}/partner-orders${qs(params)}`);
      const j = await safeJson(r);
      const orders = (j?.data?.orders ?? j?.orders ?? []) as PharmacyOrder[];
      return { orders, hasMore: orders.length === (params.limit as number) };
    } catch { return { orders: [], hasMore: false }; }
  },

  async updateOrderStatus(orderId: string, status: string): Promise<boolean> {
    try {
      const r = await apiPatch(`/api/pharmacies/orders/${orderId}/status`, { status });
      return r.ok;
    } catch { return false; }
  },

  async getOrderQr(orderId: string): Promise<{ qr_code?: string; data?: string } | null> {
    try {
      const r = await apiGet(`/api/pharmacies/orders/${orderId}/qr`);
      const j = await safeJson(r);
      return j?.data ?? j;
    } catch { return null; }
  },

  async validateOrderQr(qrCode: string): Promise<{ ok: boolean; order_id?: string; message?: string }> {
    try {
      const r = await apiPost('/api/pharmacies/orders/qr/validate', { qr_code: qrCode });
      const j = await safeJson(r);
      return { ok: r.ok, order_id: j?.data?.order_id ?? j?.order_id, message: j?.message };
    } catch { return { ok: false, message: 'Erreur réseau' }; }
  },

  // ─── Client : mes commandes ─────────────────────────────
  async getMyOrders(page = 1, limit = 20): Promise<{ orders: PharmacyOrder[]; hasMore: boolean }> {
    try {
      const r = await apiGet(`/api/pharmacies/my-orders${qs({ page, limit })}`);
      const j = await safeJson(r);
      const orders = (j?.data?.orders ?? j?.orders ?? []) as PharmacyOrder[];
      return { orders, hasMore: orders.length === limit };
    } catch { return { orders: [], hasMore: false }; }
  },

  async getOrderQrForClient(orderId: string): Promise<{ qr_code?: string } | null> {
    try {
      const r = await apiGet(`/api/pharmacies/orders/${orderId}/qr`);
      const j = await safeJson(r);
      return j?.data ?? j;
    } catch { return null; }
  },

  async getFinancialMovements(limit = 50): Promise<any[]> {
    try {
      const r = await apiGet(`/api/pharmacies/me/financial-movements${qs({ limit })}`);
      const j = await safeJson(r);
      return j?.data?.movements ?? j?.movements ?? [];
    } catch { return []; }
  },

  // ─── Produits / catalogue ──────────────────────────────
  async getProducts(pharmacyId: number): Promise<PharmacyProduct[]> {
    try {
      const r = await apiGet(`/api/pharmacies/${pharmacyId}/products`);
      const j = await safeJson(r);
      const items = j?.data ?? j?.products ?? j;
      return Array.isArray(items) ? (items as PharmacyProduct[]) : [];
    } catch { return []; }
  },

  async createProduct(data: Partial<PharmacyProduct> & { pharmacy_service_id: number; nom_produit: string }) {
    return apiPost('/api/pharmacies/products', data);
  },

  async updateProduct(id: number, data: Partial<PharmacyProduct>) {
    return apiPatch(`/api/pharmacies/products/${id}`, data);
  },

  async deleteProduct(id: number): Promise<boolean> {
    try {
      const r = await apiDelete(`/api/pharmacies/products/${id}`);
      return r.ok;
    } catch { return false; }
  },

  /** Bulk import (paste / CSV / Excel parsé en JSON côté client). */
  async bulkImport(
    pharmacyServiceId: number,
    products: BulkImportRow[],
    overwriteExisting = false,
  ): Promise<BulkImportResult> {
    try {
      const r = await apiPost('/api/pharmacies/products/bulk-import', {
        pharmacy_service_id: pharmacyServiceId,
        products,
        overwrite_existing: overwriteExisting,
      });
      const j = await safeJson(r);
      const data = j?.data ?? j;
      return { created: data?.created ?? 0, updated: data?.updated ?? 0, errors: data?.errors };
    } catch (e: any) {
      return { created: 0, updated: 0, errors: [e?.message || 'Erreur réseau'] };
    }
  },

  /** Sync depuis une URL externe (Google Sheet publié, API tierce, etc.). */
  async syncExternal(payload: {
    pharmacyServiceId: number;
    apiUrl: string;
    overwriteExisting?: boolean;
    itemsPath?: string;
    authBearerToken?: string;
  }): Promise<BulkImportResult> {
    try {
      const r = await apiPost('/api/pharmacies/products/sync-external', {
        pharmacy_service_id: payload.pharmacyServiceId,
        api_url: payload.apiUrl,
        overwrite_existing: payload.overwriteExisting ?? false,
        items_path: payload.itemsPath || 'items',
        auth_bearer_token: payload.authBearerToken || undefined,
      });
      const j = await safeJson(r);
      const data = j?.data ?? j;
      return { created: data?.created ?? 0, updated: data?.updated ?? 0, errors: data?.errors };
    } catch (e: any) {
      return { created: 0, updated: 0, errors: [e?.message || 'Erreur sync externe'] };
    }
  },
};

// ────────────────────────────────────────────────────────────
// Helpers de parsing — réutilisables côté UI
// ────────────────────────────────────────────────────────────

// Le normaliseur est centralisé dans columnAi.ts (aussi utilisé pour les alias appris).
const normKey = normKeyAi;

/** Synonymes acceptés pour chaque champ canonique (clés déjà normalisées). */
const ALIASES: Record<keyof BulkImportRow, string[]> = {
  nom_produit: ['nomproduit', 'nom', 'name', 'productname', 'designation', 'libelle', 'produit', 'article', 'medicament'],
  prix:        ['prix', 'price', 'pu', 'prixunitaire', 'prixvente', 'tarif', 'montant', 'cost', 'prixxaf', 'prixfcfa'],
  stock:       ['stock', 'quantity', 'qte', 'quantite', 'qty', 'inventaire', 'enstock', 'nbstock', 'disponible'],
  unite:       ['unite', 'unit', 'unites', 'units', 'conditionnement', 'measure', 'uom'],
  code_barre:  ['codebarre', 'codebarres', 'barcode', 'ean', 'ean13', 'gtin', 'sku', 'reference', 'ref'],
  categorie:   ['categorie', 'categorie', 'category', 'categories', 'famille', 'rayon', 'classe', 'type', 'group'],
  description: ['description', 'desc', 'details', 'note', 'notes', 'commentaire', 'remarque'],
};

/**
 * Trouve la valeur d'un champ canonique dans une ligne d'objet (tolérant aux variantes).
 * Combine les alias statiques + les alias appris (via LLM, persistés en localStorage).
 */
const pick = (row: any, field: keyof BulkImportRow): any => {
  const wanted = [
    ...ALIASES[field],
    ...(getLearnedAliases('pharmacie')[field] || []),
  ];
  for (const k of Object.keys(row)) {
    if (wanted.includes(normKey(k))) return row[k];
  }
  return undefined;
};

const PHARMACY_FIELDS: (keyof BulkImportRow)[] = ['nom_produit', 'prix', 'stock', 'unite', 'code_barre', 'categorie', 'description'];

/** Convertit une ligne objet hétérogène en BulkImportRow normalisée. */
const objectToRow = (row: any): BulkImportRow | null => {
  const nom = String(pick(row, 'nom_produit') ?? '').trim();
  if (!nom) return null;
  const prix = Number(pick(row, 'prix') ?? 0);
  const stock = Number(pick(row, 'stock') ?? 0);
  return {
    nom_produit: nom,
    prix: Number.isFinite(prix) ? prix : 0,
    stock: Number.isFinite(stock) ? stock : 0,
    unite: String(pick(row, 'unite') ?? 'unité'),
    code_barre: (pick(row, 'code_barre') ?? undefined) || undefined,
    categorie: (pick(row, 'categorie') ?? undefined) || undefined,
    description: (pick(row, 'description') ?? undefined) || undefined,
  };
};

/** Parse une chaîne (JSON ou CSV/TSV) → liste de lignes valides + erreurs. */
export const parseBulkImportInput = (
  input: string,
): { parsed: BulkImportRow[]; invalid: string[] } => {
  const parsed: BulkImportRow[] = [];
  const invalid: string[] = [];
  const trimmed = input.trim();
  if (!trimmed) return { parsed, invalid };

  // JSON
  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const j = JSON.parse(trimmed);
      const rows = Array.isArray(j) ? j : [j];
      rows.forEach((row: any, idx: number) => {
        const r = objectToRow(row);
        if (!r) { invalid.push(`Ligne ${idx + 1} : nom de produit manquant`); return; }
        parsed.push(r);
      });
    } catch (e: any) {
      invalid.push('JSON invalide : ' + (e?.message || ''));
    }
    return { parsed, invalid };
  }

  // CSV/TSV — détection auto du séparateur (,;\t)
  const lines = trimmed.split(/\r?\n/).filter(l => l.trim());
  if (lines.length === 0) return { parsed, invalid };

  const sep = detectSeparator(lines[0]);
  const headers = splitCsv(lines[0], sep);
  const headerKeys = headers.map(normKey);

  // Si aucun header ne matche un alias connu → on passe en mode positionnel (legacy)
  const headerHasMatch = headerKeys.some(k =>
    Object.values(ALIASES).some(arr => arr.includes(k)),
  );

  if (headerHasMatch) {
    // Mode tolérant header : on construit un objet par ligne avec les vrais headers,
    // puis on passe par objectToRow (qui gère synonymes + accents).
    lines.slice(1).forEach((line, idx) => {
      const cells = splitCsv(line, sep);
      const obj: any = {};
      headers.forEach((h, i) => { obj[h] = cells[i]; });
      const r = objectToRow(obj);
      if (!r) { invalid.push(`Ligne ${idx + 1} : nom manquant`); return; }
      if (Number.isNaN(r.prix) || r.prix < 0) { invalid.push(`Ligne ${idx + 1} : prix invalide`); return; }
      if (Number.isNaN(r.stock) || r.stock < 0) { invalid.push(`Ligne ${idx + 1} : stock invalide`); return; }
      parsed.push(r);
    });
  } else {
    // Mode positionnel (CSV brut sans header reconnu)
    const data = lines; // toutes les lignes (pas de header à skipper)
    data.forEach((line, idx) => {
      const parts = splitCsv(line, sep);
      const nom = (parts[0] || '').trim();
      if (!nom) { invalid.push(`Ligne ${idx + 1} : nom manquant`); return; }
      const prix = parseFloat((parts[1] || '0').replace(',', '.'));
      const stock = parseInt(parts[2] || '0');
      if (Number.isNaN(prix) || prix < 0) { invalid.push(`Ligne ${idx + 1} : prix invalide`); return; }
      if (Number.isNaN(stock) || stock < 0) { invalid.push(`Ligne ${idx + 1} : stock invalide`); return; }
      parsed.push({
        nom_produit: nom,
        prix, stock,
        unite: parts[3] || 'unité',
        code_barre: parts[4] || undefined,
        categorie: parts[5] || undefined,
        description: parts[6] || undefined,
      });
    });
  }

  return { parsed, invalid };
};

/** Détecte le séparateur d'une ligne CSV (',', ';', '\t'). */
const detectSeparator = (line: string): string => {
  const counts = { ',': (line.match(/,/g) || []).length, ';': (line.match(/;/g) || []).length, '\t': (line.match(/\t/g) || []).length };
  return (Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]) || ',';
};

/** Split CSV avec gestion basique des champs entre guillemets. */
const splitCsv = (line: string, sep: string): string[] => {
  const out: string[] = [];
  let cur = ''; let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') { inQuotes = !inQuotes; continue; }
    if (c === sep && !inQuotes) { out.push(cur.trim()); cur = ''; continue; }
    cur += c;
  }
  out.push(cur.trim());
  return out;
};

/** Parse un fichier (CSV/TSV/Excel) → BulkImportRow[]. xlsx chargé en lazy. */
export const parseImportFile = async (file: File): Promise<BulkImportRow[]> => {
  const r = await parseImportFileSmart(file, { useAi: false });
  return r.rows;
};

export interface SmartParseResult {
  rows: BulkImportRow[];
  invalid: string[];
  /** Vrai si le LLM a été sollicité (colonnes inconnues détectées). */
  aiUsed: boolean;
  /** Mapping inféré par le LLM ({ "Stock Restant": "stock", ... }) — vide si non utilisé. */
  aiMapping: Record<string, string>;
  /** En-têtes brutes telles que lues du fichier. */
  detectedHeaders: string[];
}

/**
 * Parse intelligent : tente d'abord en pure déterministe (alias statiques + appris),
 * puis sollicite le LLM en fallback si les colonnes obligatoires ne sont pas couvertes.
 * Les nouveaux alias détectés sont mémorisés (localStorage) pour la prochaine fois.
 */
export const parseImportFileSmart = async (
  file: File,
  opts: { useAi?: boolean } = { useAi: true },
): Promise<SmartParseResult> => {
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
    // CSV / TSV : on extrait headers + objets via la même logique que parseBulkImportInput
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

  // Tentative déterministe
  let parsed: BulkImportRow[] = rawRows
    .map(objectToRow)
    .filter((r): r is BulkImportRow => !!r);

  let aiMapping: Record<string, string> = {};
  let aiUsed = false;

  // Si vide ou nom_produit/prix manquants → fallback LLM
  if (opts.useAi && headers.length > 0 && needsAiFallback(parsed)) {
    const r = await aiResolveHeaders('pharmacie', headers, rawRows.slice(0, 3), PHARMACY_FIELDS);
    if (Object.keys(r.mapping).length > 0) {
      aiUsed = true;
      aiMapping = r.mapping;
      // Re-parse : le pick() lit maintenant les nouveaux alias appris (déjà persistés)
      parsed = rawRows
        .map(objectToRow)
        .filter((r): r is BulkImportRow => !!r);
    }
  }

  return {
    rows: parsed,
    invalid: [],
    aiUsed,
    aiMapping,
    detectedHeaders: headers,
  };
};
