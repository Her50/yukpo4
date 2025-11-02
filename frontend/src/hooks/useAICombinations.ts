// Hook pour gérer les combinaisons autocomplete générées par l'IA
import { useState, useEffect } from 'react';

interface AICombination {
  id: number;
  product_vector: string[];
  location_vector: string[];
  full_vector: string[];
  is_ai_preferred: boolean;
  ai_confidence: number;
  usage_count: number;
  session_id?: string;
  variant_dimension?: string;
  variant_value?: string;
  prix?: number;
  devise?: string;
  stock?: number;
}

interface UseAICombinationsResult {
  combinations: AICombination[];
  preferredCombination: AICombination | null;
  preferredVector: string | null; // Vecteur produit de la combinaison préférée (pour placeholder)
  loading: boolean;
  error: string | null;
  saveCombinations: (aiResponse: any) => Promise<void>;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const useAICombinations = (sessionId?: string): UseAICombinationsResult => {
  const [combinations, setCombinations] = useState<AICombination[]>([]);
  const [preferredCombination, setPreferredCombination] = useState<AICombination | null>(null);
  const [preferredVector, setPreferredVector] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Charger les combinaisons depuis la session IA
  useEffect(() => {
    if (sessionId) {
      loadCombinations(sessionId);
    }
  }, [sessionId]);

  const loadCombinations = async (sessionId: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/autocomplete/combinations/session/${sessionId}`
      );

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success && data.data) {
        setCombinations(data.data);
        
        // Trouver la combinaison préférée
        const preferred = data.data.find((c: AICombination) => c.is_ai_preferred);
        if (preferred) {
          setPreferredCombination(preferred);
          setPreferredVector(preferred.product_vector.join(','));
          console.log('[useAICombinations] ⭐ Combinaison préférée:', preferred.product_vector.join(','));
        }
        
        console.log('[useAICombinations] ✅ Combinaisons chargées:', data.data.length);
      }
    } catch (err: any) {
      console.error('[useAICombinations] ❌ Erreur:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Sauvegarder les combinaisons générées par l'IA (en arrière-plan)
  const saveCombinations = async (aiResponse: any) => {
    if (!sessionId) {
      console.warn('[useAICombinations] ⚠️ Pas de session_id, sauvegarde ignorée');
      return;
    }

    try {
      console.log('[useAICombinations] 💾 Sauvegarde des combinaisons en arrière-plan...');

      const response = await fetch(`${API_BASE_URL}/api/autocomplete/save-ai-combinations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session_id: sessionId,
          combinations: [aiResponse], // Envoyer la réponse IA complète
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[useAICombinations] ✅ Combinaisons sauvegardées:', data.saved_count);
        
        // Recharger les combinaisons
        await loadCombinations(sessionId);
      } else {
        console.warn('[useAICombinations] ⚠️ Erreur sauvegarde:', response.statusText);
      }
    } catch (err) {
      console.error('[useAICombinations] ❌ Erreur sauvegarde:', err);
    }
  };

  return {
    combinations,
    preferredCombination,
    preferredVector,
    loading,
    error,
    saveCombinations,
  };
};

export default useAICombinations;

