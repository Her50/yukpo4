// src/hooks/useServiceVariation.ts
import { useState, useEffect } from 'react';

export interface ServiceVariation {
  price: number;
  availability: boolean;
  new?: boolean;
}

export const useServiceVariation = (serviceId: number): { data: ServiceVariation } | null => {
  const [variation, setVariation] = useState<{ data: ServiceVariation } | null>(null);

  useEffect(() => {
    const fetchVariation = async () => {
      try {
        const response = await fetch(`/api/services/${serviceId}/variation`);
        if (!response.ok) throw new Error('Erreur API');
        const data: ServiceVariation = await response.json();
        setVariation({ data });
      } catch (error) {
        console.error('Erreur récupération variation :', error);
        setVariation(null);
      }
    };

    fetchVariation();
  }, [serviceId]);

  return variation;
};
