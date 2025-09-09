import { useState, useEffect, useCallback } from 'react';

export interface PrestataireInfo {
  id: number;
  nom_complet?: string;
  email: string;
  is_provider: boolean;
  gps?: string;
  photo_profil?: string;
  avatar_url?: string;
  created_at: string;
}

interface UsePrestataireInfoReturn {
  prestataires: Map<number, PrestataireInfo>;
  loading: boolean;
  error: string | null;
  fetchPrestataire: (id: number) => Promise<void>;
  fetchPrestatairesBatch: (ids: number[]) => Promise<void>;
  clearError: () => void;
}

export const usePrestataireInfo = (): UsePrestataireInfoReturn => {
  const [prestataires, setPrestataires] = useState<Map<number, PrestataireInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const fetchPrestataire = useCallback(async (id: number) => {
    // Vérifier si on a déjà les informations
    if (prestataires.has(id)) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/prestataires/${id}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const prestataire: PrestataireInfo = await response.json();
      
      setPrestataires(prev => new Map(prev).set(id, prestataire));
    } catch (err) {
      console.error('Erreur récupération prestataire:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [prestataires]);

  const fetchPrestatairesBatch = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;

    // Filtrer les IDs déjà présents
    const missingIds = ids.filter(id => !prestataires.has(id));
    if (missingIds.length === 0) return;

    console.log('🔍 [usePrestataireInfo] Chargement batch prestataires:', {
      totalIds: ids.length,
      missingIds,
      existingPrestataires: prestataires.size
    });

    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/prestataires/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ user_ids: missingIds }),
      });

      if (!response.ok) {
        throw new Error(`Erreur ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      const newPrestataires = data.prestataires as PrestataireInfo[];
      
      console.log('✅ [usePrestataireInfo] Prestataires reçus:', {
        count: newPrestataires.length,
        prestataires: newPrestataires.map(p => ({
          id: p.id,
          nom: p.nom_complet,
          gps: p.gps,
          hasGps: !!p.gps,
          gpsType: typeof p.gps,
          gpsLength: p.gps?.length
        }))
      });
      
      setPrestataires(prev => {
        const updated = new Map(prev);
        newPrestataires.forEach(prestataire => {
          updated.set(prestataire.id, prestataire);
        });
        console.log('🗺️ [usePrestataireInfo] Map mise à jour:', {
          newSize: updated.size,
          prestataireWithGps: Array.from(updated.values()).filter(p => p.gps).length
        });
        return updated;
      });
    } catch (err) {
      console.error('❌ [usePrestataireInfo] Erreur récupération batch prestataires:', err);
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  }, [prestataires]);

  return {
    prestataires,
    loading,
    error,
    fetchPrestataire,
    fetchPrestatairesBatch,
    clearError,
  };
}; 