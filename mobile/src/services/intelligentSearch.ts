import { iaApi, servicesApi } from './api';

export interface IntelligentSearchResult {
  service_id: string;
  data: any;
  score: number;                    // ← total_score du backend
  semantic_score: number;           // ← fulltext_score du backend  
  interaction_score: number;        // ← recency_score du backend
  trigram_score?: number;           // ← trigram_score du backend (nouveau)
  category_score?: number;          // ← category_score du backend (nouveau)
  search_method?: string;           // ← search_method du backend (nouveau)
  matched_fields?: string[];        // ← matched_fields du backend (nouveau)
  gps?: string;
  distance?: number;
  ai_confidence?: number;
  ai_suggestions?: string[];
}

export interface SearchContext {
  user_id?: string;
  location?: {
    latitude: number;
    longitude: number;
  };
  previous_searches?: string[];
  user_preferences?: any;
}

export class IntelligentSearchService {
  /**
   * Recherche intelligente combinant recherche native PostgreSQL et IA
   */
  static async intelligentSearch(
    query: string,
    context: SearchContext = {}
  ): Promise<IntelligentSearchResult[]> {
    console.log('[IntelligentSearch] \uD83E\uDDE0 Démarrage recherche intelligente');
    console.log('[IntelligentSearch] \uD83D\uDCDD Query:', query);
    console.log('[IntelligentSearch] \uD83C\uDFAF Context:', context);

    try {
      // 1. Recherche native PostgreSQL (rapide et fiable)
      const nativeResults = await this.nativeSearch(query, context);
      console.log('[IntelligentSearch] \uD83D\uDDC4️ Résultats natifs:', nativeResults.length);

      // 2. Si pas assez de résultats, enrichir avec IA
      if (nativeResults.length < 5) {
        console.log('[IntelligentSearch] \uD83E\uDD16 Enrichissement IA...');
        const aiEnhancedResults = await this.enhanceWithAI(query, nativeResults, context);
        console.log('[IntelligentSearch] ✨ Résultats enrichis:', aiEnhancedResults.length);
        return aiEnhancedResults;
      }

      return nativeResults;
    } catch (error) {
      console.error('[IntelligentSearch] ❌ Erreur:', error);
      // Fallback vers recherche native uniquement
      return this.nativeSearch(query, context);
    }
  }

  /**
   * Recherche native PostgreSQL (rapide)
   */
  private static async nativeSearch(
    query: string,
    context: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    const searchData = {
      texte: query,
      gps_mobile: context.location
        ? `${context.location.latitude},${context.location.longitude}`
        : null,
      user_id: context.user_id || null
    };

    const response = await servicesApi.searchDirect(searchData);

    if (response.success && response.data) {
      const results = (response.data as any).resultats || [];
      return results.map((result: any) => ({
        service_id: result.service_id?.toString() || '',
        data: result.data,
        score: result.score || 0,                    // total_score du backend
        semantic_score: result.semantic_score || 0,  // fulltext_score du backend
        interaction_score: result.interaction_score || 0, // recency_score du backend
        trigram_score: result.trigram_score || 0,    // ← NOUVEAU
        category_score: result.category_score || 0,  // ← NOUVEAU
        search_method: result.search_method || 'native', // ← NOUVEAU
        matched_fields: result.matched_fields || [], // ← NOUVEAU
        gps: result.gps,
        distance: result.distance
      }));
    }

    return [];
  }

  /**
   * Enrichissement avec IA pour améliorer les résultats
   */
  private static async enhanceWithAI(
    query: string,
    nativeResults: IntelligentSearchResult[],
    context: SearchContext
  ): Promise<IntelligentSearchResult[]> {
    try {
      // 1. Analyser le texte avec IA pour extraire des mots-clés
      const textAnalysis = await (iaApi as any).analyzeText(query);
      console.log('[IntelligentSearch] \uD83D\uDD0D Analyse IA:', textAnalysis);

      // 2. Générer des suggestions de recherche alternatives
      const suggestions = await (iaApi as any).generateSuggestions(query);
      console.log('[IntelligentSearch] \uD83D\uDCA1 Suggestions IA:', suggestions);

      // 3. Recherches supplémentaires avec les suggestions
      const additionalResults: IntelligentSearchResult[] = [];

      for (const suggestion of suggestions.slice(0, 2)) { // Limiter à 2 suggestions
        try {
          const additionalSearch = await this.nativeSearch(suggestion, context);
          additionalResults.push(...additionalSearch.slice(0, 3)); // Max 3 par suggestion
        } catch (error) {
          console.warn('[IntelligentSearch] ⚠️ Erreur suggestion:', suggestion, error);
        }
      }

      // 4. Combiner et dédupliquer les résultats
      const allResults = [...nativeResults, ...additionalResults];
      const uniqueResults = this.deduplicateResults(allResults);

      // 5. Enrichir avec les métadonnées IA
      return uniqueResults.map(result => ({
        ...result,
        ai_confidence: textAnalysis?.confidence || 0.8,
        ai_suggestions: suggestions.slice(0, 3)
      }));

    } catch (error) {
      console.error('[IntelligentSearch] ❌ Erreur enrichissement IA:', error);
      return nativeResults; // Retourner les résultats natifs en cas d'erreur
    }
  }

  /**
   * Dédupliquer les résultats par service_id
   */
  private static deduplicateResults(results: IntelligentSearchResult[]): IntelligentSearchResult[] {
    const seen = new Set<string>();
    return results.filter(result => {
      if (seen.has(result.service_id)) {
        return false;
      }
      seen.add(result.service_id);
      return true;
    });
  }

  /**
   * Recherche avec suggestions en temps réel
   */
  static async getSearchSuggestions(partialQuery: string): Promise<string[]> {
    if (partialQuery.length < 3) return [];

    try {
      const response = await iaApi.suggestKeywords(partialQuery);
      return (response.data as any)?.keywords || [];
    } catch (error) {
      console.error('[IntelligentSearch] ❌ Erreur suggestions:', error);
      return [];
    }
  }

  /**
   * Recherche par géolocalisation intelligente
   */
  static async searchNearby(
    query: string,
    location: { latitude: number; longitude: number },
    radiusKm: number = 10
  ): Promise<IntelligentSearchResult[]> {
    return this.intelligentSearch(query, {
      location,
      user_preferences: { nearby_only: true, max_distance: radiusKm }
    });
  }

  /**
   * Recherche native PostgreSQL pure (sans IA)
   */
  static async nativePostgreSQLSearch(
    query: string,
    context: SearchContext = {}
  ): Promise<IntelligentSearchResult[]> {
    console.log('[IntelligentSearch] \uD83D\uDDC4️ Recherche PostgreSQL native pure');
    return this.nativeSearch(query, context);
  }

  /**
   * Analyse des résultats pour comprendre la méthode de recherche utilisée
   */
  static analyzeSearchResults(results: IntelligentSearchResult[]): {
    methods: string[];
    avgScores: {
      fulltext: number;
      trigram: number;
      category: number;
      recency: number;
    };
    gpsEnabled: boolean;
  } {
    const methods = [...new Set(results.map(r => r.search_method || 'unknown'))];
    const avgScores = {
      fulltext: results.reduce((sum, r) => sum + r.semantic_score, 0) / results.length || 0,
      trigram: results.reduce((sum, r) => sum + (r.trigram_score || 0), 0) / results.length || 0,
      category: results.reduce((sum, r) => sum + (r.category_score || 0), 0) / results.length || 0,
      recency: results.reduce((sum, r) => sum + r.interaction_score, 0) / results.length || 0,
    };
    const gpsEnabled = results.some(r => r.gps && r.distance !== undefined);

    return { methods, avgScores, gpsEnabled };
  }
}
