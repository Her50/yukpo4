import { useState, useEffect } from 'react';
import { useUser } from './useUser';
import axios from 'axios';

export const useUserServices = () => {
  const { user, isLoading } = useUser();
  const [hasServices, setHasServices] = useState(false);
  const [loading, setLoading] = useState(true);

  const checkUserServices = async () => {
    console.log('[useUserServices] checkUserServices appelé');
    try {
      const token = localStorage.getItem('token');
      console.log('[useUserServices] Token présent:', !!token);
      
      if (!token) {
        console.log('[useUserServices] Pas de token, hasServices = false');
        setHasServices(false);
        setLoading(false);
        return;
      }

      console.log('[useUserServices] Appel API /api/prestataire/services...');
      const response = await axios.get('/api/prestataire/services', {
        headers: {
          Authorization: `Bearer ${token}`
        },
        timeout: 5000
      });

      console.log('[useUserServices] Réponse API:', response.status, 'Services count:', response.data?.length || 0);
      const hasServicesValue = response.data && response.data.length > 0;
      console.log('[useUserServices] hasServices =', hasServicesValue);
      setHasServices(hasServicesValue);
    } catch (error) {
      console.error('[useUserServices] Erreur lors de la vérification des services:', error);
      setHasServices(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    console.log('[useUserServices] useEffect - user:', !!user, 'isLoading:', isLoading);
    if (!user || isLoading) {
      console.log('[useUserServices] Pas d\'utilisateur ou en cours de chargement, hasServices = false');
      setHasServices(false);
      setLoading(false);
      return;
    }

    console.log('[useUserServices] Utilisateur connecté, vérification des services...');
    checkUserServices();
  }, [user, isLoading]);

  // Écouter les événements de création de service
  useEffect(() => {
    const handleServiceCreated = () => {
      console.log('[useUserServices] Service créé, mise à jour de l\'état...');
      checkUserServices();
    };

    const handleServiceDeleted = () => {
      console.log('[useUserServices] Service supprimé, mise à jour de l\'état...');
      checkUserServices();
    };

    window.addEventListener('service_created', handleServiceCreated);
    window.addEventListener('service_deleted', handleServiceDeleted);
    
    return () => {
      window.removeEventListener('service_created', handleServiceCreated);
      window.removeEventListener('service_deleted', handleServiceDeleted);
    };
  }, [user]);

  console.log('[useUserServices] Return - hasServices:', hasServices, 'loading:', loading);
  return { hasServices, loading, refreshServices: checkUserServices };
}; 