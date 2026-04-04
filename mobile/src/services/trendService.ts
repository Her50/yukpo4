// TrendService — Yukpo TrendPulse
// Accès aux endpoints backend :
//   GET /api/trends/pulse        → trends globales (public)
//   GET /api/trends/for-me       → trends personnalisées (authentifié)
//   GET /api/user/context        → profil commercial complet (authentifié)

import { apiGet } from './api';
import type { TrendItemData } from '../components/TrendCard';

// ─── Types réponse backend ────────────────────────────────────────────────────

export interface PersonalityTrend {
  name: string;
  mentions: number;
  domain: string;
  momentum_pct: number;
  sources: string[];
}

export interface SectorTrend {
  sector: string;
  growth_pct: number;
  top_topic: string;
  regions: string[];
}

export interface TrendPulseResponse {
  region: string;
  period: string;
  generated_at: string;
  trends: TrendItemData[];
  top_personalities: PersonalityTrend[];
  top_sectors: SectorTrend[];
}

export interface TrendForMeResponse extends TrendPulseResponse {
  user_profile: {
    is_provider: boolean;
    sectors: string[];
    cities: string[];
    total_products: number;
    total_promos: number;
    has_social_accounts: boolean;
    has_meta_ads: boolean;
  };
  personalized_trends: TrendItemData[];
  high_opportunity_count: number;
}

export interface UserProductPreview {
  id: number;
  name: string;
  price: number;
  sale_price?: number;
  category: string;
  is_promo: boolean;
}

export interface UserServiceContext {
  id: number;
  name: string;
  sector: string;
  city: string;
  specialized_type?: string;
  product_count: number;
  promo_count: number;
  products_preview: UserProductPreview[];
}

export interface AdSignalContext {
  campaign_id: number;
  name: string;
  status: string;
  roas?: number;
  impressions: number;
  clicks: number;
}

export interface ChatbotSignalContext {
  service_id: number;
  questions_this_week: number;
  escalations_this_week: number;
  top_keywords: string[];
}

export interface UserCommercialContextResponse {
  user_id: number;
  is_provider: boolean;
  sectors: string[];
  cities: string[];
  product_categories: string[];
  total_products: number;
  total_promos: number;
  has_social_accounts: boolean;
  has_meta_ads: boolean;
  services: UserServiceContext[];
  ad_signals: AdSignalContext[];
  chatbot_signals: ChatbotSignalContext[];
}

// ─── Service ──────────────────────────────────────────────────────────────────

/** Durée du cache en mémoire (ms) */
const CACHE_TTL_TRENDS = 60 * 60 * 1000;   // 1 heure pour les trends
const CACHE_TTL_CONTEXT = 5 * 60 * 1000;   // 5 minutes pour le contexte utilisateur

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T, ttl: number): void {
  cache.set(key, { data, expiresAt: Date.now() + ttl });
}

export const trendService = {
  /**
   * Trends globales pour une région.
   * Cache 1h — données "froides" suffisantes pour le dashboard.
   */
  async getGlobalTrends(
    region = 'CM',
    period = '24h',
    limit = 20,
  ): Promise<TrendPulseResponse | null> {
    const cacheKey = `trends_global_${region}_${period}`;
    const cached = getCached<TrendPulseResponse>(cacheKey);
    if (cached) return cached;

    try {
      const res = await apiGet<TrendPulseResponse>(
        `/api/trends/pulse?region=${region}&period=${period}&limit=${limit}`,
      );
      if (res.data) {
        setCached(cacheKey, res.data, CACHE_TTL_TRENDS);
        return res.data;
      }
    } catch {
      // Silencieux : les trends ne sont pas critiques pour le fonctionnement de l'app
    }
    return null;
  },

  /**
   * Trends personnalisées pour l'utilisateur connecté.
   * Croise les tendances externes avec son catalogue produits réel.
   * Cache court (5 min) car dépend des données de l'utilisateur.
   */
  async getTrendsForMe(
    region = 'CM',
    period = '24h',
  ): Promise<TrendForMeResponse | null> {
    const cacheKey = `trends_for_me_${region}_${period}`;
    const cached = getCached<TrendForMeResponse>(cacheKey);
    if (cached) return cached;

    try {
      const res = await apiGet<TrendForMeResponse>(
        `/api/trends/for-me?region=${region}&period=${period}`,
      );
      if (res.data) {
        setCached(cacheKey, res.data, CACHE_TTL_CONTEXT);
        return res.data;
      }
    } catch {
      // Silencieux
    }
    return null;
  },

  /**
   * Profil commercial complet de l'utilisateur connecté.
   * Utilisé par intelligentChatService pour enrichir le contexte YukpoIA.
   * Cache 5 min.
   */
  async getUserContext(): Promise<UserCommercialContextResponse | null> {
    const cacheKey = 'user_commercial_context';
    const cached = getCached<UserCommercialContextResponse>(cacheKey);
    if (cached) return cached;

    try {
      const res = await apiGet<UserCommercialContextResponse>('/api/user/context');
      if (res.data) {
        setCached(cacheKey, res.data, CACHE_TTL_CONTEXT);
        return res.data;
      }
    } catch {
      // Silencieux : l'utilisateur peut être un simple consommateur sans services
    }
    return null;
  },

  /**
   * Nombre de trends haute opportunité pour l'utilisateur.
   * Utilisé par IntelligentChatFab pour afficher le badge.
   */
  async getHighOpportunityCount(region = 'CM'): Promise<number> {
    try {
      const result = await this.getTrendsForMe(region);
      return result?.high_opportunity_count ?? 0;
    } catch {
      return 0;
    }
  },

  /** Vide le cache (ex: après une action utilisateur comme lancer une campagne) */
  clearCache(): void {
    cache.clear();
  },

  /** Construit un résumé textuel du profil commercial pour injecter dans le contexte YukpoIA */
  buildContextSummary(ctx: UserCommercialContextResponse): string {
    if (!ctx.is_provider) {
      return 'Utilisateur sans service actif (consommateur).';
    }

    const lines: string[] = [
      `Prestataire Yukpo avec ${ctx.total_products} produits actifs`,
    ];

    if (ctx.sectors.length > 0) {
      lines.push(`Secteurs : ${ctx.sectors.join(', ')}`);
    }
    if (ctx.cities.length > 0) {
      lines.push(`Villes : ${ctx.cities.join(', ')}`);
    }

    for (const svc of ctx.services.slice(0, 3)) {
      const prods = svc.products_preview
        .slice(0, 4)
        .map(p => `${p.name} (${p.price.toLocaleString()} FCFA${p.is_promo ? ' ⬇PROMO' : ''})`)
        .join(', ');
      lines.push(`• ${svc.name} [${svc.sector}/${svc.city}] : ${prods}`);
    }

    if (ctx.ad_signals.length > 0) {
      const activeAds = ctx.ad_signals.filter(a => a.status === 'active');
      if (activeAds.length > 0) {
        const avgRoas =
          activeAds
            .filter(a => a.roas)
            .reduce((sum, a) => sum + (a.roas ?? 0), 0) /
          Math.max(activeAds.filter(a => a.roas).length, 1);
        lines.push(`Campagnes Meta Ads actives : ${activeAds.length} (ROAS moyen ${avgRoas.toFixed(1)}x)`);
      }
    }

    const totalChatbotQuestions = ctx.chatbot_signals.reduce(
      (sum, s) => sum + s.questions_this_week, 0,
    );
    if (totalChatbotQuestions > 0) {
      const allKeywords = ctx.chatbot_signals
        .flatMap(s => s.top_keywords)
        .slice(0, 6)
        .join(', ');
      lines.push(
        `Chatbot clients : ${totalChatbotQuestions} questions cette semaine. Sujets : ${allKeywords}`,
      );
    }

    if (ctx.total_promos > 0) {
      lines.push(`Promotions actives : ${ctx.total_promos}`);
    }

    return lines.join('\n');
  },
};
