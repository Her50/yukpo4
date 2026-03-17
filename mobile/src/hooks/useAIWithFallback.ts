// ✅ Hook partagé pour appels IA avec fallback 3 niveaux
// Niveau 1: Appel IA backend spécialisé
// Niveau 2: Appel /api/ai/chat (endpoint centralisé)
// Niveau 3: Réponses locales pré-calculées
import { useCallback, useState } from 'react';
import { useLanguageSafe } from '../contexts/LanguageContext';
import { apiPost } from '../services/api';

export interface AIFallbackResult<T = any> {
    success: boolean;
    source: 'primary' | 'chat' | 'local';
    data: T | null;
    error?: string;
}

// Données locales pré-calculées pour le Cameroun
const LOCAL_PHARMACY_DATA: Record<string, string> = {
    'paracetamol': 'Le Paracétamol (Doliprane, Efferalgan) est un antalgique et antipyrétique. Posologie adulte: 500mg à 1g, 3 fois/jour, max 3g/jour. Ne pas dépasser 5 jours sans avis médical.',
    'amoxicilline': 'L\'Amoxicilline est un antibiotique. Posologie adulte: 500mg à 1g, 2 à 3 fois/jour pendant 5-7 jours. Nécessite une ordonnance médicale.',
    'ibuprofene': 'L\'Ibuprofène (Advil, Nurofen) est un anti-inflammatoire. Posologie adulte: 200-400mg, 3 fois/jour avec les repas. Contre-indiqué en cas d\'ulcère gastrique.',
    'default': 'Consultez votre pharmacien pour des conseils personnalisés sur ce médicament. Respectez toujours la posologie indiquée sur la notice.',
};

const LOCAL_SALARY_DATA: Record<string, { junior: number; confirme: number; senior: number }> = {
    'technologie': { junior: 250000, confirme: 500000, senior: 900000 },
    'informatique': { junior: 250000, confirme: 500000, senior: 900000 },
    'finance': { junior: 200000, confirme: 450000, senior: 800000 },
    'banque': { junior: 200000, confirme: 450000, senior: 800000 },
    'sante': { junior: 180000, confirme: 400000, senior: 700000 },
    'commerce': { junior: 150000, confirme: 350000, senior: 600000 },
    'marketing': { junior: 180000, confirme: 400000, senior: 650000 },
    'education': { junior: 120000, confirme: 250000, senior: 450000 },
    'btp': { junior: 150000, confirme: 350000, senior: 600000 },
    'default': { junior: 150000, confirme: 350000, senior: 600000 },
};

const LOCAL_PRICE_PER_M2: Record<string, number> = {
    'douala': 150000, 'yaoundé': 120000, 'yaounde': 120000,
    'bafoussam': 80000, 'bamenda': 70000, 'kribi': 100000,
    'limbe': 90000, 'buea': 85000, 'garoua': 60000,
    'maroua': 55000, 'bertoua': 50000, 'ebolowa': 55000,
    'default': 80000,
};

const STANDING_MULTIPLIERS: Record<string, number> = {
    'luxe': 2.5, 'luxe / prestige': 2.5,
    'haut standing': 1.8,
    'bon standing': 1.3,
    'standard': 1.0,
    'économique': 0.7, 'economique': 0.7,
};

const PATHOLOGY_DATA: Record<string, { specialites: string[]; examens: string[]; urgence: string }> = {
    'mal de tête': { specialites: ['Neurologue', 'Médecin généraliste'], examens: ['Scanner cérébral', 'IRM'], urgence: 'moderate' },
    'douleur thoracique': { specialites: ['Cardiologue', 'Urgentiste'], examens: ['ECG', 'Troponine', 'Radio thorax'], urgence: 'high' },
    'fièvre': { specialites: ['Médecin généraliste', 'Infectiologue'], examens: ['NFS', 'Goutte épaisse', 'CRP'], urgence: 'moderate' },
    'douleur abdominale': { specialites: ['Gastro-entérologue', 'Chirurgien'], examens: ['Échographie abdominale', 'NFS'], urgence: 'moderate' },
    'toux': { specialites: ['Pneumologue', 'Médecin généraliste'], examens: ['Radio thorax', 'Spirométrie'], urgence: 'low' },
    'douleur articulaire': { specialites: ['Rhumatologue', 'Orthopédiste'], examens: ['Radio', 'VS', 'CRP'], urgence: 'low' },
    'problème de vue': { specialites: ['Ophtalmologue'], examens: ['Fond d\'œil', 'Tonométrie'], urgence: 'moderate' },
    'douleur dentaire': { specialites: ['Dentiste', 'Stomatologue'], examens: ['Panoramique dentaire'], urgence: 'moderate' },
    'grossesse': { specialites: ['Gynécologue-obstétricien', 'Sage-femme'], examens: ['Échographie', 'Bilan sanguin'], urgence: 'low' },
    'peau': { specialites: ['Dermatologue'], examens: ['Biopsie cutanée', 'Examen mycologique'], urgence: 'low' },
};

export const useAIWithFallback = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { language } = useLanguageSafe();

    /**
     * Appel IA générique avec fallback 3 niveaux
     */
    const callWithFallback = useCallback(async <T>(
        primaryCall: () => Promise<T | null>,
        chatContext: string,
        chatPrompt: string,
        localFallback: () => T
    ): Promise<AIFallbackResult<T>> => {
        setLoading(true);
        setError(null);

        // Niveau 1: Appel IA backend spécialisé
        try {
            const result = await primaryCall();
            if (result !== null && result !== undefined) {
                setLoading(false);
                return { success: true, source: 'primary', data: result };
            }
        } catch (err: any) {
            console.warn(`[useAIWithFallback] Niveau 1 échoué (${chatContext}):`, err?.message || err);
        }

        // Niveau 2: Appel /api/ai/chat centralisé
        try {
            const chatResult = await apiPost<any>('/api/ai/chat', {
                message: chatPrompt,
                context: chatContext,
                fallback: true,
                language,
            });
            if (chatResult?.success && chatResult?.data) {
                setLoading(false);
                return { success: true, source: 'chat', data: chatResult.data as T };
            }
        } catch (err: any) {
            console.warn(`[useAIWithFallback] Niveau 2 échoué (${chatContext}):`, err?.message || err);
        }

        // Niveau 3: Données locales
        try {
            const localResult = localFallback();
            setLoading(false);
            return { success: true, source: 'local', data: localResult };
        } catch (err: any) {
            console.error(`[useAIWithFallback] Niveau 3 échoué (${chatContext}):`, err?.message || err);
            setLoading(false);
            setError('Service IA temporairement indisponible');
            return { success: false, source: 'local', data: null, error: 'Tous les niveaux ont échoué' };
        }
    }, []);

    // =====================================================
    // PHARMACIE
    // =====================================================

    const askPharmacyQuestion = useCallback(async (question: string, medications?: string[]) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/ai/chat', {
                    message: question,
                    context: { category: 'pharmacie', medications },
                    type: 'question',
                    language,
                });
                if (response?.success && response?.data?.message) {
                    return { message: response.data.message, suggestions: response.data.suggestions || [] };
                }
                return null;
            },
            'pharmacie',
            question,
            () => {
                const lowerQ = question.toLowerCase();
                for (const [key, value] of Object.entries(LOCAL_PHARMACY_DATA)) {
                    if (lowerQ.includes(key)) {
                        return { message: value, suggestions: ['Consultez votre pharmacien', 'Voir la notice'] };
                    }
                }
                return { message: LOCAL_PHARMACY_DATA.default, suggestions: ['Consultez votre pharmacien'] };
            }
        );
    }, [callWithFallback]);

    const checkDrugInteractions = useCallback(async (medications: string[], age?: number) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/pharmacies/ai/interactions', {
                    medications, age,
                });
                if (response?.success) {
                    return response.interaction || response.data?.interaction || response.data;
                }
                return null;
            },
            'pharmacie_interactions',
            `Vérifier les interactions entre: ${medications.join(', ')}`,
            () => ({
                severity: 'unknown' as const,
                description: 'Impossible de vérifier les interactions automatiquement. Veuillez consulter votre pharmacien pour vérifier la compatibilité de ces médicaments.',
                recommendation: 'Consultez votre pharmacien ou médecin avant de prendre ces médicaments ensemble.',
                alternative_suggestions: [],
            })
        );
    }, [callWithFallback]);

    const getDosageRecommendation = useCallback(async (
        medicationName: string, age?: number, weight?: number, condition?: string
    ) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/pharmacies/ai/dosage', {
                    medication_name: medicationName,
                    patient_age: age,
                    patient_weight: weight,
                    condition,
                });
                if (response?.success) {
                    return response.dosage || response.data?.dosage || response.data;
                }
                return null;
            },
            'pharmacie_posologie',
            `Posologie pour ${medicationName}, patient ${age || '?'} ans, ${weight || '?'} kg`,
            () => {
                const lowerMed = medicationName.toLowerCase();
                const info = LOCAL_PHARMACY_DATA[lowerMed] || LOCAL_PHARMACY_DATA.default;
                return {
                    dosage: 'Consultez la notice du médicament',
                    frequency: 'Selon prescription médicale',
                    duration: 'Selon prescription médicale',
                    precautions: [info],
                    warnings: ['Consultez votre médecin ou pharmacien pour une posologie personnalisée'],
                };
            }
        );
    }, [callWithFallback]);

    // =====================================================
    // HÔPITAL
    // =====================================================

    const searchPathology = useCallback(async (
        query: string, location?: { lat: number; lng: number }
    ) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/hopitaux/ai/search-pathology', {
                    query, lat: location?.lat, lng: location?.lng,
                });
                if (response?.success) {
                    const results = response.results || response.data?.results || response.data || [];
                    if (Array.isArray(results) && results.length > 0) return results;
                }
                return null;
            },
            'medical_pathology',
            `Quels spécialistes et examens pour: ${query}`,
            () => {
                const lowerQuery = query.toLowerCase();
                for (const [key, value] of Object.entries(PATHOLOGY_DATA)) {
                    if (lowerQuery.includes(key)) {
                        return [{
                            pathology_name: query,
                            description: `Symptôme: ${query}`,
                            symptoms: [query],
                            recommended_examinations: value.examens,
                            recommended_services: value.specialites,
                            urgency_level: value.urgence,
                            recommendations: [`Consultez un ${value.specialites[0]}`, 'Ne tardez pas si les symptômes persistent'],
                        }];
                    }
                }
                return [{
                    pathology_name: query,
                    description: `Recherche: ${query}`,
                    symptoms: [query],
                    recommended_examinations: ['Bilan sanguin complet', 'Consultation générale'],
                    recommended_services: ['Médecin généraliste'],
                    urgency_level: 'moderate',
                    recommendations: ['Consultez un médecin généraliste pour un diagnostic précis'],
                }];
            }
        );
    }, [callWithFallback]);

    // =====================================================
    // IMMOBILIER
    // =====================================================

    const estimatePropertyPrice = useCallback(async (
        typeBien: string, superficieM2: number, nbChambres: number,
        standing: string, quartier: string, ville: string
    ) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/immobilier/ai/price-estimate', {
                    type_bien: typeBien, superficie_m2: superficieM2,
                    nb_chambres: nbChambres, standing, quartier, ville,
                });
                if (response?.success && response?.estimate) return response.estimate;
                return null;
            },
            'immobilier_estimation',
            `Estimer le prix: ${typeBien} ${superficieM2}m² ${nbChambres}ch ${standing} à ${quartier}, ${ville}`,
            () => {
                const basePricePerM2 = LOCAL_PRICE_PER_M2[ville.toLowerCase()] || LOCAL_PRICE_PER_M2.default;
                const standingMult = STANDING_MULTIPLIERS[standing.toLowerCase()] || 1.0;
                const pricePerM2 = Math.round(basePricePerM2 * standingMult);
                const estimatedPrice = Math.round(pricePerM2 * superficieM2);
                return {
                    estimated_price: estimatedPrice,
                    price_per_m2: pricePerM2,
                    price_range_min: Math.round(estimatedPrice * 0.8),
                    price_range_max: Math.round(estimatedPrice * 1.2),
                    confidence_level: 0.6,
                    reasoning: `Estimation basée sur les prix moyens à ${ville} (${basePricePerM2.toLocaleString()} FCFA/m²) ajustés au standing ${standing}.`,
                    market_analysis: `Le marché immobilier à ${ville} affiche un prix moyen de ${basePricePerM2.toLocaleString()} FCFA/m² pour du ${standing}.`,
                    factors: [`Ville: ${ville}`, `Standing: ${standing}`, `Surface: ${superficieM2}m²`, `Chambres: ${nbChambres}`],
                };
            }
        );
    }, [callWithFallback]);

    const getPropertyRecommendations = useCallback(async (
        budgetMax: number, typeBien?: string, ville?: string
    ) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/immobilier/ai/recommendations', {
                    budget_max: budgetMax, type_bien: typeBien, ville,
                });
                if (response?.success && response?.recommendation) return response.recommendation;
                return null;
            },
            'immobilier_recommandations',
            `Recommandations immobilier: budget ${budgetMax} FCFA, ${typeBien || 'tout type'} à ${ville || 'toute ville'}`,
            () => ({
                property_ids: [],
                recommendations: `Avec un budget de ${budgetMax.toLocaleString()} FCFA, vous pouvez explorer des biens de type ${typeBien || 'divers'} à ${ville || 'plusieurs villes'}. Utilisez les filtres pour affiner votre recherche.`,
                budget_analysis: `Votre budget est ${budgetMax > 50000000 ? 'confortable' : budgetMax > 20000000 ? 'moyen' : 'serré'} pour le marché actuel.`,
                location_analysis: `${ville || 'Le Cameroun'} offre des opportunités variées selon les quartiers.`,
            })
        );
    }, [callWithFallback]);

    // =====================================================
    // EMPLOI
    // =====================================================

    const analyzeCV = useCallback(async (cvUrl: string, offreId?: number) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/offres-emploi/ai/analyze-cv', {
                    cv_url: cvUrl, offre_id: offreId,
                });
                if (response?.success && response?.analysis) return response.analysis;
                return null;
            },
            'emploi_cv_analysis',
            `Analyser le CV: ${cvUrl}`,
            () => ({
                score_global: 65,
                points_forts: ['CV soumis pour analyse', 'Démarche proactive'],
                points_faibles: ['L\'analyse IA n\'est pas disponible actuellement'],
                suggestions_amelioration: [
                    'Ajoutez des mots-clés du secteur visé',
                    'Quantifiez vos réalisations avec des chiffres',
                    'Adaptez votre CV à chaque offre',
                    'Ajoutez une section compétences techniques',
                ],
                competences_identifiees: [],
                competences_manquantes: [],
                recommandations: ['Complétez votre profil candidat pour un meilleur matching'],
            })
        );
    }, [callWithFallback]);

    const predictSalary = useCallback(async (
        titrePoste: string, secteur: string, experience: number, competences: string[], ville?: string
    ) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/offres-emploi/ai/salary-prediction', {
                    titre_poste: titrePoste, secteur, experience_annees: experience,
                    competences, ville, niveau_etude: 'Non spécifié',
                });
                if (response?.success && response?.prediction) return response.prediction;
                return null;
            },
            'emploi_salary',
            `Prédire salaire: ${titrePoste} dans ${secteur}, ${experience} ans d'expérience à ${ville || 'Cameroun'}`,
            () => {
                const grid = LOCAL_SALARY_DATA[secteur.toLowerCase()] || LOCAL_SALARY_DATA.default;
                const level = experience < 3 ? 'junior' : experience < 7 ? 'confirme' : 'senior';
                const base = grid[level];
                const cityMultiplier = (ville?.toLowerCase() === 'douala' || ville?.toLowerCase() === 'yaoundé') ? 1.15 : 1.0;
                const estimated = Math.round(base * cityMultiplier);
                return {
                    salaire_estime_min: Math.round(estimated * 0.8),
                    salaire_estime_max: Math.round(estimated * 1.3),
                    salaire_estime_median: estimated,
                    devise: 'FCFA',
                    facteurs_influence: [`Secteur: ${secteur}`, `Expérience: ${experience} ans`, `Ville: ${ville || 'Cameroun'}`, `Niveau: ${level}`],
                    comparaison_marche: `Pour un poste de ${titrePoste} dans le secteur ${secteur} au Cameroun, le salaire médian estimé est de ${estimated.toLocaleString()} FCFA/mois.`,
                    confidence: 0.55,
                };
            }
        );
    }, [callWithFallback]);

    const suggestFormations = useCallback(async (competencesManquantes: string[], objectif?: string) => {
        return callWithFallback(
            async () => {
                const response = await apiPost<any>('/api/offres-emploi/ai/suggest-formations', {
                    competences_manquantes: competencesManquantes, objectif_carriere: objectif,
                });
                if (response?.success && response?.suggestions) return response.suggestions;
                return null;
            },
            'emploi_formations',
            `Formations pour: ${competencesManquantes.join(', ')}. Objectif: ${objectif || 'évolution'}`,
            () => competencesManquantes.map(comp => ({
                formation: `Formation en ${comp}`,
                raison: `Compétence manquante identifiée: ${comp}`,
                urgence: 'medium' as const,
                duree_estimee: '2-4 semaines',
            }))
        );
    }, [callWithFallback]);

    return {
        loading,
        error,
        // Pharmacie
        askPharmacyQuestion,
        checkDrugInteractions,
        getDosageRecommendation,
        // Hôpital
        searchPathology,
        // Immobilier
        estimatePropertyPrice,
        getPropertyRecommendations,
        // Emploi
        analyzeCV,
        predictSalary,
        suggestFormations,
        // Générique
        callWithFallback,
    };
};
