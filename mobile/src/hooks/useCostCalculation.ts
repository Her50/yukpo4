// @ts-nocheck
import { useCallback, useEffect, useState } from 'react';
import { userApi } from '../services/api';

interface CostCalculationResult {
    estimatedCost: number;
    userBalance: number;
    canAfford: boolean;
    loading: boolean;
    error: string | null;
    calculateCost: (formData: any) => Promise<number>;
    checkBalance: () => Promise<void>;
}

export const useCostCalculation = (): CostCalculationResult => {
    const [estimatedCost, setEstimatedCost] = useState(0);
    const [userBalance, setUserBalance] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Calculer le coût estimé basé sur les données du formulaire
    const calculateCost = useCallback(async (formData: any): Promise<number> => {
        try {
            setLoading(true);
            setError(null);

            let cost = 0;

            // Coût de base pour la création de service
            cost += 10;

            // Coût basé sur la complexité du titre
            if (formData.titre) {
                cost += Math.ceil(formData.titre.length / 20) * 2;
            }

            // Coût basé sur la longueur de la description
            if (formData.description) {
                cost += Math.ceil(formData.description.length / 50) * 3;
            }

            // Coût pour les médias
            if (formData.media) {
                const mediaCount = Object.values(formData.media).reduce((total: number, mediaArray: any) => {
                    return total + (Array.isArray(mediaArray) ? mediaArray.length : 0);
                }, 0);
                cost += mediaCount * 5;
            }

            // Coût pour les produits
            if (formData.produits && Array.isArray(formData.produits)) {
                cost += formData.produits.length * 3;
            }

            // Coût pour les promotions
            if (formData.promotions && Array.isArray(formData.promotions)) {
                cost += formData.promotions.length * 2;
            }

            // Coût pour les champs dynamiques complexes
            if (formData.composants && Array.isArray(formData.composants)) {
                cost += formData.composants.length * 1;
            }

            // Coût pour la géolocalisation
            if (formData.gps || formData.localisation) {
                cost += 5;
            }

            setEstimatedCost(cost);
            return cost;
        } catch (error) {
            console.error('Erreur lors du calcul du coût:', error);
            setError('Erreur lors du calcul du coût');
            return 0;
        } finally {
            setLoading(false);
        }
    }, []);

    // Vérifier le solde de l'utilisateur
    const checkBalance = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            const response = await userApi.getTokensBalance() as any;

            if (response.success && response.data) {
                setUserBalance(response.data.remaining || 0);
            } else {
                throw new Error(response.error || 'Erreur lors de la récupération du solde');
            }
        } catch (error) {
            console.error('Erreur lors de la vérification du solde:', error);
            setError('Erreur lors de la vérification du solde');
            setUserBalance(0);
        } finally {
            setLoading(false);
        }
    }, []);

    // Vérifier si l'utilisateur peut se permettre le coût
    const canAfford = userBalance >= estimatedCost;

    // Charger le solde au montage du composant
    useEffect(() => {
        checkBalance();
    }, [checkBalance]);

    return {
        estimatedCost,
        userBalance,
        canAfford,
        loading,
        error,
        calculateCost,
        checkBalance
    };
};


