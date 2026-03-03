import { useEffect, useState } from 'react';
import { apiGet } from '../services/api';

export interface PartnerData {
    id: number;
    name: string;
    address?: string;
    location_address?: string;
    contact_phone?: string;
    contact_email?: string;
    city?: string;
    country?: string;
    logo_url?: string;
    partner_type?: string;
    [key: string]: any;
}

/**
 * Hook pour charger automatiquement les données du partenaire connecté
 * @param userRole - Rôle de l'utilisateur
 * @param partnerType - Type de partenaire attendu (optionnel, pour validation)
 * @returns { partnerData, loading, error }
 */
export function usePartnerData(userRole?: string, partnerType?: string) {
    const [partnerData, setPartnerData] = useState<PartnerData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadPartnerData = async () => {
            if (userRole !== 'partenaire') {
                return;
            }

            setLoading(true);
            setError(null);

            try {
                const response = await apiGet<PartnerData>('/api/partners/me');
                if (response.success && response.data) {
                    const partner = response.data;
                    
                    // Validation optionnelle du type de partenaire
                    if (partnerType && partner.partner_type !== partnerType) {
                        console.warn(
                            `[usePartnerData] Partner type mismatch: expected ${partnerType}, got ${partner.partner_type}`
                        );
                    }

                    setPartnerData(partner);
                } else {
                    setError('Impossible de charger les données du partenaire');
                }
            } catch (err: any) {
                console.error('[usePartnerData] Error loading partner data:', err);
                setError(err.message || 'Erreur lors du chargement');
            } finally {
                setLoading(false);
            }
        };

        loadPartnerData();
    }, [userRole, partnerType]);

    return { partnerData, loading, error };
}
