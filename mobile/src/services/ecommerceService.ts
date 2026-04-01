// ✅ 2026-04-01: Service E-Commerce Universel — Yukpo
// Permet l'intégration de TOUTES les boutiques/plateformes e-commerce dans Yukpo :
// Supermarchés, Mode, Électronique, Pharmacie, Beauté, Sport, Maison, Librairie, etc.
// Plateformes supportées: WooCommerce, Shopify, PrestaShop, Jumia, CSV, API REST générique, etc.

import { apiGet, apiPost, apiDelete, apiPut } from './api';
import { supermarketService } from './supermarketService';

// ═══════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════

export type StoreCategory =
    | 'supermarche'
    | 'alimentation'
    | 'pharmacie'
    | 'mode'
    | 'electronique'
    | 'beaute'
    | 'sport'
    | 'maison'
    | 'librairie'
    | 'autre';

export type PlatformSlug =
    | 'woocommerce'
    | 'shopify'
    | 'prestashop'
    | 'magento'
    | 'opencart'
    | 'jumia'
    | 'cdiscount'
    | 'supermarche_custom'
    | 'mode_custom'
    | 'csv_import'
    | 'generic_rest';

export type AuthType = 'api_key' | 'bearer_token' | 'basic_auth' | 'oauth2' | 'none';
export type SyncSchedule = 'manual' | 'hourly' | 'daily' | 'weekly';
export type IntegrationStatus = 'active' | 'paused' | 'error' | 'pending_test';

export interface EcommercePlatform {
    slug: PlatformSlug | string;
    name: string;
    store_category: StoreCategory;
    logo_url?: string;
    auth_type: AuthType;
    default_products_endpoint?: string;
    default_items_path?: string;
    default_field_mapping: Record<string, string>;
    supports_webhook: boolean;
    supports_pagination: boolean;
}

export interface EcommerceStore {
    service_id: number;
    name: string;
    logo_url?: string;
    address?: string;
    gps?: string;
    platform_slug: PlatformSlug | string;
    platform_name?: string;
    platform_logo?: string;
    store_category: StoreCategory;
    last_sync_at?: string;
    products_count: number;
    distance_km?: number;
}

export interface EcommerceProduct {
    id: string | number;
    service_id: string | number;
    product_index?: number;
    name: string;
    description?: string;
    price: number;
    original_price?: number;
    currency: string;
    image_url?: string;
    images?: Array<{ url: string } | string>;
    category?: string;
    brand?: string;
    unit?: string;
    stock?: number;
    is_promotion: boolean;
    promotion_percentage?: number;
    store_category?: StoreCategory;
    store_name?: string;
    platform_slug?: string;
    platform_name?: string;
    external_product_id?: string;
    // Compatibilité supermarché
    supermarket_id?: string | number;
    supermarket_name?: string;
    stock_status?: 'in_stock' | 'low_stock' | 'out_of_stock';
}

export interface PartnerIntegration {
    id: number;
    service_id: number;
    platform_slug: PlatformSlug | string;
    platform_name?: string;
    platform_logo?: string;
    store_category?: StoreCategory;
    api_url: string;
    auth_type: AuthType;
    store_name?: string;
    store_logo_url?: string;
    sync_schedule: SyncSchedule;
    sync_hour: number;
    status: IntegrationStatus;
    last_sync_at?: string;
    last_sync_status?: 'success' | 'partial' | 'error';
    last_sync_products_count: number;
    last_sync_error?: string;
    webhook_url?: string;
    supports_webhook?: boolean;
    overwrite_on_sync: boolean;
    created_at: string;
}

export interface CreateIntegrationPayload {
    service_id: number;
    platform_slug: PlatformSlug | string;
    api_url: string;
    auth_type?: AuthType;
    api_key?: string;
    api_secret?: string;
    bearer_token?: string;
    basic_auth_user?: string;
    basic_auth_pass?: string;
    extra_headers?: Record<string, string>;
    items_path?: string;
    field_mapping?: Record<string, string>;
    category_filter?: string;
    sync_schedule?: SyncSchedule;
    sync_hour?: number;
    store_name?: string;
    store_logo_url?: string;
    overwrite_on_sync?: boolean;
}

export interface TestConnectionPayload {
    platform_slug: PlatformSlug | string;
    api_url: string;
    auth_type?: AuthType;
    api_key?: string;
    api_secret?: string;
    bearer_token?: string;
    basic_auth_user?: string;
    basic_auth_pass?: string;
    extra_headers?: Record<string, string>;
    items_path?: string;
    field_mapping?: Record<string, string>;
}

export interface TestConnectionResult {
    success: boolean;
    reachable: boolean;
    http_status?: number;
    products_found?: number;
    sample_fields?: string[];
    error?: string;
    message?: string;
}

export interface SyncResult {
    success: boolean;
    log_id: number;
    products_fetched: number;
    products_created: number;
    products_updated: number;
    products_errors: number;
    duration_ms: number;
    dry_run: boolean;
    message: string;
}

export interface SyncLog {
    id: number;
    started_at: string;
    finished_at?: string;
    trigger_type: 'manual' | 'scheduled' | 'webhook';
    status: 'running' | 'success' | 'partial' | 'error';
    products_fetched: number;
    products_created: number;
    products_updated: number;
    products_errors: number;
    duration_ms?: number;
    error_details: any[];
}

export interface UniversalSearchFilters {
    query: string;
    store_category?: StoreCategory;
    platform_slug?: string;
    min_price?: number;
    max_price?: number;
    on_promotion?: boolean;
    in_stock?: boolean;
    latitude?: number;
    longitude?: number;
    radius_km?: number;
    page?: number;
    limit?: number;
}

// ═══════════════════════════════════════════════════════════════
// LABELS AFFICHAGE PAR CATÉGORIE
// ═══════════════════════════════════════════════════════════════

export const STORE_CATEGORY_LABELS: Record<StoreCategory, string> = {
    supermarche: 'Supermarché',
    alimentation: 'Alimentation',
    pharmacie: 'Pharmacie',
    mode: 'Mode & Vêtements',
    electronique: 'Électronique',
    beaute: 'Beauté & Cosmétiques',
    sport: 'Sport & Loisirs',
    maison: 'Maison & Déco',
    librairie: 'Librairie & Papeterie',
    autre: 'Autre',
};

export const STORE_CATEGORY_ICONS: Record<StoreCategory, string> = {
    supermarche: '🛒',
    alimentation: '🥦',
    pharmacie: '💊',
    mode: '👗',
    electronique: '📱',
    beaute: '💄',
    sport: '⚽',
    maison: '🏠',
    librairie: '📚',
    autre: '🏪',
};

export const ALL_STORE_CATEGORIES: StoreCategory[] = [
    'supermarche', 'alimentation', 'pharmacie', 'mode',
    'electronique', 'beaute', 'sport', 'maison', 'librairie', 'autre',
];

// ═══════════════════════════════════════════════════════════════
// SERVICE PRINCIPAL
// ═══════════════════════════════════════════════════════════════

export const ecommerceService = {

    // ─────────────────────────────────────────────────────────
    // PLATEFORMES SUPPORTÉES
    // ─────────────────────────────────────────────────────────

    /** Liste des types de plateformes supportées par Yukpo */
    listPlatforms: async (): Promise<{ platforms: EcommercePlatform[]; total: number }> => {
        const response = await apiGet<{ success: boolean; platforms: EcommercePlatform[]; total: number }>(
            '/api/ecommerce/platforms'
        );
        return {
            platforms: (response.data as any)?.platforms || [],
            total: (response.data as any)?.total || 0,
        };
    },

    /** Plateformes filtrées par catégorie de boutique */
    listPlatformsForCategory: async (storeCategory: StoreCategory): Promise<EcommercePlatform[]> => {
        const { platforms } = await ecommerceService.listPlatforms();
        return platforms.filter(p => p.store_category === storeCategory || p.store_category === 'autre');
    },

    // ─────────────────────────────────────────────────────────
    // BOUTIQUES INTÉGRÉES (côté client)
    // ─────────────────────────────────────────────────────────

    /** Liste les boutiques intégrées dans Yukpo, avec filtre par catégorie */
    listStores: async (params: {
        store_category?: StoreCategory;
        latitude?: number;
        longitude?: number;
        radius_km?: number;
        page?: number;
        limit?: number;
    } = {}): Promise<{ stores: EcommerceStore[]; total: number }> => {
        const response = await apiGet<{ success: boolean; stores: EcommerceStore[]; total: number }>(
            '/api/ecommerce/stores',
            { params }
        );
        return {
            stores: (response.data as any)?.stores || [],
            total: (response.data as any)?.total || 0,
        };
    },

    /** Recherche universelle de produits dans TOUTES les boutiques intégrées */
    searchProducts: async (filters: UniversalSearchFilters): Promise<{
        products: EcommerceProduct[];
        total: number;
        query: string;
    }> => {
        const response = await apiGet<{
            success: boolean;
            products: EcommerceProduct[];
            total: number;
            query: string;
        }>('/api/ecommerce/products/search', { params: filters });

        return {
            products: (response.data as any)?.products || [],
            total: (response.data as any)?.total || 0,
            query: (response.data as any)?.query || filters.query,
        };
    },

    // ─────────────────────────────────────────────────────────
    // RÉTROCOMPATIBILITÉ SUPERMARCHÉS
    // (délègue vers supermarketService pour les supermarchés)
    // ─────────────────────────────────────────────────────────

    /** Supermarchés à proximité — délègue vers supermarketService */
    listSupermarkets: supermarketService.listSupermarkets,

    /** Produits d'un supermarché — délègue vers supermarketService */
    getSupermarketProducts: supermarketService.getSupermarketProducts,

    /** Comparaison de prix — délègue vers supermarketService */
    compareProductPrices: supermarketService.compareProductPrices,

    /** Promotions d'un supermarché — délègue vers supermarketService */
    getSupermarketPromotions: supermarketService.getSupermarketPromotions,

    /** Promotions à proximité — délègue vers supermarketService */
    getNearbyPromotions: supermarketService.getNearbyPromotions,

    /** Produits tendances — délègue vers supermarketService */
    getTrendingProducts: supermarketService.getTrendingProducts,

    // ─────────────────────────────────────────────────────────
    // GESTION INTÉGRATIONS (côté partenaire)
    // ─────────────────────────────────────────────────────────

    /** Tester une connexion avant de créer l'intégration */
    testConnection: async (payload: TestConnectionPayload): Promise<TestConnectionResult> => {
        const response = await apiPost<{ success: boolean } & TestConnectionResult>(
            '/api/ecommerce/integrations/test-connection',
            payload
        );
        return (response.data as any) || { success: false, reachable: false };
    },

    /** Créer une intégration de boutique */
    createIntegration: async (payload: CreateIntegrationPayload): Promise<{
        integration_id: number;
        webhook_url: string;
        webhook_secret: string;
        message: string;
    }> => {
        const response = await apiPost<any>(
            '/api/ecommerce/integrations',
            payload
        );
        return response.data as any;
    },

    /** Lister mes intégrations */
    listMyIntegrations: async (): Promise<{ integrations: PartnerIntegration[]; total: number }> => {
        const response = await apiGet<{ success: boolean; integrations: PartnerIntegration[]; total: number }>(
            '/api/ecommerce/integrations'
        );
        return {
            integrations: (response.data as any)?.integrations || [],
            total: (response.data as any)?.total || 0,
        };
    },

    /** Supprimer une intégration */
    deleteIntegration: async (integrationId: number): Promise<void> => {
        await apiDelete(`/api/ecommerce/integrations/${integrationId}`);
    },

    /** Lancer une synchronisation manuelle */
    syncIntegration: async (
        integrationId: number,
        opts: { force_full?: boolean; dry_run?: boolean; max_products?: number } = {}
    ): Promise<SyncResult> => {
        const response = await apiPost<SyncResult>(
            `/api/ecommerce/integrations/${integrationId}/sync`,
            opts
        );
        return response.data as SyncResult;
    },

    /** Récupérer les logs de synchronisation */
    getSyncLogs: async (
        integrationId: number,
        params: { page?: number; limit?: number } = {}
    ): Promise<{ logs: SyncLog[]; total: number }> => {
        const response = await apiGet<{ success: boolean; logs: SyncLog[]; total: number }>(
            `/api/ecommerce/integrations/${integrationId}/logs`,
            { params }
        );
        return {
            logs: (response.data as any)?.logs || [],
            total: (response.data as any)?.total || 0,
        };
    },

    // ─────────────────────────────────────────────────────────
    // UTILITAIRES
    // ─────────────────────────────────────────────────────────

    /** Normaliser un produit de n'importe quelle source en EcommerceProduct unifié */
    normalizeProduct: (raw: any, storeCategory?: StoreCategory): EcommerceProduct => {
        const imageUrl = raw.image_url
            || raw.thumbnail_url
            || (Array.isArray(raw.images) && raw.images.length > 0
                ? (typeof raw.images[0] === 'string' ? raw.images[0] : raw.images[0]?.url)
                : undefined);

        const stock = raw.stock ?? raw.stock_quantity ?? raw.quantite_disponible;
        const stockStatus: EcommerceProduct['stock_status'] =
            stock === undefined ? 'in_stock' :
            stock <= 0 ? 'out_of_stock' :
            stock <= 3 ? 'low_stock' : 'in_stock';

        return {
            id: raw.id || raw.product_index || Math.random().toString(36).slice(2),
            service_id: raw.service_id || raw.supermarket_id || 0,
            product_index: raw.product_index,
            name: raw.name || raw.nom || raw.title || 'Produit',
            description: raw.description,
            price: parseFloat(raw.price ?? raw.prix ?? 0),
            original_price: raw.original_price ?? raw.prix_original,
            currency: raw.currency || raw.devise || 'XAF',
            image_url: imageUrl,
            images: raw.images,
            category: raw.category || raw.categorie,
            brand: raw.brand || raw.marque,
            unit: raw.unit || raw.unite,
            stock,
            stock_status: stockStatus,
            is_promotion: raw.is_promotion ?? raw.en_promotion ?? false,
            promotion_percentage: raw.promotion_percentage ?? raw.pourcentage_remise,
            store_category: storeCategory || raw.store_category,
            store_name: raw.store_name || raw.supermarket_name,
            platform_slug: raw.platform_slug,
            platform_name: raw.platform_name,
            external_product_id: raw.external_product_id,
            supermarket_id: raw.service_id || raw.supermarket_id,
            supermarket_name: raw.store_name || raw.supermarket_name,
        };
    },

    /** Calculer le pourcentage de promotion */
    getPromotionPercentage: (price: number, originalPrice?: number): number | undefined => {
        if (!originalPrice || originalPrice <= price) return undefined;
        return Math.round((1 - price / originalPrice) * 100);
    },

    /** Formater le prix avec devise */
    formatPrice: (price: number, currency: string = 'XAF'): string => {
        if (currency === 'XAF' || currency === 'FCFA') {
            return `${Math.round(price).toLocaleString('fr-FR')} FCFA`;
        }
        try {
            return new Intl.NumberFormat('fr-FR', { style: 'currency', currency }).format(price);
        } catch {
            return `${price} ${currency}`;
        }
    },
};

export default ecommerceService;
