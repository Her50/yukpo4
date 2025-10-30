// ✅ Matching local intelligent basé sur les mots-clés des catégories produits
// Pas besoin d'IA externe : on utilise les keywords déjà définis dans PRODUCT_TYPES
import { PRODUCT_TYPES } from '../components/ProductManagerMobile';

export interface SuggestedCategory {
    value: string;
    label: string;
    icon: string;
    confidence: number; // Score de pertinence (0-1)
    reason?: string; // Pourquoi cette catégorie est suggérée
}

/**
 * Matching local intelligent : analyse le titre, description et catégorie du service
 * et compare avec les keywords de chaque catégorie produit
 */
export const getSuggestedProductCategories = (
    titreService?: string,
    descriptionService?: string,
    categoryService?: string,
    generalInfo?: any // ✅ Données IA: bloc "information générale"
): SuggestedCategory[] => {
    try {
        const productTypesArray = PRODUCT_TYPES as readonly any[];
        if (!productTypesArray || productTypesArray.length === 0) {
            console.log('[SuggestCategories] Pas de catégories produits disponibles');
            return [];
        }

        if (!titreService && !descriptionService && !categoryService) {
            console.log('[SuggestCategories] Pas de données pour suggestion');
            return [];
        }

        // Combiner tout le texte à analyser
        // ✅ Agréger les informations du bloc IA général si fourni
        const iaPieces: string[] = [];
        if (generalInfo && typeof generalInfo === 'object') {
            const pick = (k: string) => {
                const v = (generalInfo as any)[k];
                if (v == null) return '';
                if (typeof v === 'string') return v;
                if (Array.isArray(v)) return v.filter(Boolean).join(' ');
                if (typeof v === 'object') return Object.values(v).filter(Boolean).join(' ');
                return String(v);
            };
            // Champs usuels issus de l'IA (tolérant aux variantes)
            iaPieces.push(
                pick('mots_cles'), pick('keywords'), pick('tags'), pick('secteur'), pick('type_service'),
                pick('objectifs'), pick('besoins'), pick('audience'), pick('pays'), pick('ville'), pick('quartier'),
                pick('produits'), pick('produit_principal'), pick('categorie'), pick('sous_categorie')
            );
        }

        const textToAnalyze = [
            titreService || '',
            descriptionService || '',
            categoryService || '',
            iaPieces.join(' ')
        ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, ''); // Normaliser les accents

        if (textToAnalyze.trim().length === 0) {
            return [];
        }

        console.log('[SuggestCategories] Analyse texte:', textToAnalyze.substring(0, 100));

        // Calculer le score pour chaque catégorie
        const scoredCategories: Array<SuggestedCategory & { matchCount: number; totalKeywords: number }> = [];

        for (const productType of productTypesArray) {
            const keywords = (productType.keywords || []) as string[];

            if (keywords.length === 0) {
                continue; // Ignorer les catégories sans keywords
            }

            // Compter les matches (mots-clés trouvés dans le texte)
            let matchCount = 0;
            const matchedKeywords: string[] = [];

            for (const keyword of keywords) {
                const keywordNormalized = keyword
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '');

                // Recherche exacte ou partielle
                if (
                    textToAnalyze.includes(keywordNormalized) ||
                    textToAnalyze.split(/\s+/).some(word =>
                        word.includes(keywordNormalized) || keywordNormalized.includes(word)
                    )
                ) {
                    matchCount++;
                    if (matchedKeywords.length < 3) {
                        matchedKeywords.push(keyword);
                    }
                }
            }

            if (matchCount === 0) {
                continue; // Pas de match, on ignore
            }

            // Calculer le score de confiance (0-1)
            // Plus de matches = score plus élevé
            // Ratio matches / total keywords aussi pris en compte
            const matchRatio = matchCount / keywords.length;
            const baseScore = Math.min(matchCount / 10, 1); // Normaliser (max 1 pour 10+ matches)
            const ratioBonus = matchRatio * 0.3; // Bonus si ratio élevé
            // ✅ Bonus si présence dans les données IA générales
            const iaBonus = iaPieces.length > 0 && matchedKeywords.length > 0 ? 0.15 : 0;
            const confidence = Math.min(baseScore + ratioBonus + iaBonus, 0.98);

            // Bonus spécial si le nom de la catégorie est dans le texte
            const categoryNameInText = textToAnalyze.includes(
                productType.label
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
            ) || textToAnalyze.includes(
                productType.value
                    .toLowerCase()
                    .normalize('NFD')
                    .replace(/[\u0300-\u036f]/g, '')
            );

            const finalConfidence = categoryNameInText
                ? Math.min(confidence + 0.15, 0.98)
                : confidence;

            scoredCategories.push({
                value: productType.value as string,
                label: productType.label as string,
                icon: productType.icon as string,
                confidence: finalConfidence,
                reason: matchedKeywords.length > 0
                    ? `Mots-clés correspondants: ${matchedKeywords.join(', ')}...`
                    : `${matchCount} correspondance(s) trouvée(s)`,
                matchCount,
                totalKeywords: keywords.length
            });
        }

        // Trier par score décroissant
        scoredCategories.sort((a, b) => b.confidence - a.confidence);

        // Prendre les 3 meilleures (les plus pertinentes)
        const top3 = scoredCategories.slice(0, 3).map(({ matchCount, totalKeywords, ...rest }) => rest);

        console.log(`[SuggestCategories] ✅ ${top3.length} catégories suggérées (matching local)`);

        return top3;
    } catch (error) {
        console.error('[SuggestCategories] ❌ Erreur matching local:', error);
        return [];
    }
};

/**
 * Mappe les catégories suggérées avec les catégories réelles de PRODUCT_TYPES
 * (Conservé pour compatibilité, mais plus vraiment nécessaire maintenant)
 */
export const mapSuggestedToProductTypes = (
    suggested: SuggestedCategory[],
    allProductTypes: Array<{ value: string; label: string; icon: string }>
): Array<{ value: string; label: string; icon: string; confidence: number; reason?: string }> => {
    return suggested
        .map(suggestion => {
            const matched = allProductTypes.find(pt => pt.value === suggestion.value);
            if (matched) {
                return {
                    ...matched,
                    confidence: suggestion.confidence,
                    reason: suggestion.reason
                };
            }
            return null;
        })
        .filter(Boolean) as Array<{ value: string; label: string; icon: string; confidence: number; reason?: string }>;
};
