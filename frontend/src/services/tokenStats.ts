// Service de récupération des statistiques de consommation Yukpo (tokens IA).
// Backend : GET /api/tokens/stats?days=N → totaux + breakdown par intention/source.
import { apiGet } from './apiService';

export interface TokenStatsByIntention {
  /** Nom de l'intention (ex: "creation_service", "recherche_besoin", "pharmacy_ai", "restaurant_resto"). */
  [intention: string]: {
    count: number;
    tokens: number;
    cost_xaf: number;
  };
}

export interface TokenStatsBySource {
  [source: string]: {
    count: number;
    tokens: number;
  };
}

export interface TokenStatsResponse {
  total_tokens_consumed: number;
  total_cost_xaf: number;
  total_requests: number;
  avg_tokens_per_request: number;
  by_intention: TokenStatsByIntention;
  by_source?: TokenStatsBySource;
  /** Période demandée (jours) */
  period_days?: number;
}

const safeJson = async (res: Response): Promise<any> => {
  const txt = await res.text();
  if (!txt) return {};
  try { return JSON.parse(txt); } catch { return {}; }
};

export const tokenStatsService = {
  /**
   * Récupère les stats de consommation Yukpo sur les N derniers jours.
   * @param days 1-365, défaut 30
   */
  async getStats(days = 30): Promise<TokenStatsResponse | null> {
    try {
      const r = await apiGet(`/api/tokens/stats?days=${days}`);
      const j = await safeJson(r);
      // Backend renvoie l'objet directement (TokenStatsResponse), pas wrappé en { data: ... }
      return {
        total_tokens_consumed: j.total_tokens_consumed ?? 0,
        total_cost_xaf: j.total_cost_xaf ?? 0,
        total_requests: j.total_requests ?? 0,
        avg_tokens_per_request: j.avg_tokens_per_request ?? 0,
        by_intention: j.by_intention ?? {},
        by_source: j.by_source ?? {},
        period_days: days,
      };
    } catch {
      return null;
    }
  },
};

/** Libellés humains des intentions techniques (pour l'UI Wallet). */
export const intentionLabels: Record<string, string> = {
  creation_service: 'Créer un service',
  recherche_besoin: 'Recherche besoin',
  pharmacy_ai: 'Pharmacie · Yukpo',
  restaurant_ai: 'Restaurant · Yukpo',
  column_mapping: 'Reconnaissance colonnes',
  ordonnance: 'Analyse ordonnance',
  interactions: 'Interactions médicaments',
  dosage: 'Posologie',
  whisper: 'Transcription audio',
  vision: 'Analyse image',
  chat: 'Chat Yukpo',
  bourse_livre: 'Bourse du livre',
  unknown: 'Autre',
};

export const formatIntention = (key: string): string => {
  return intentionLabels[key] || key.replace(/_/g, ' ');
};
