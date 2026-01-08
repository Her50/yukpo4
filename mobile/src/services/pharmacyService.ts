// ✅ Service API pour Pharmacies - Nouvelles fonctionnalités IA
import { apiGet, apiPost } from './api';

// Types pour les réponses
export interface MedicationInteraction {
    severity: 'contraindicated' | 'major' | 'moderate' | 'minor' | 'none';
    description: string;
    recommendation: string;
    alternative_suggestions: string[];
}

export interface DosageRecommendation {
    dosage: string;
    frequency: string;
    duration: string;
    precautions: string[];
    warnings: string[];
}

export interface MedicationAvailability {
    available: boolean;
    medication: {
        name: string;
        dci: string | null;
        stock_quantity: number;
        price: number | null;
        requires_prescription: boolean;
    };
    requested_quantity: number;
}

export interface PharmacyOrder {
    id: string;
    pharmacy_id: number;
    pharmacy_name: string | null;
    status: string | null;
    total_amount: string | null;
    delivery_method: string | null;
    delivery_address: string | null;
    created_at: string;
}

export interface PharmacyAnalytics {
    total_orders: number;
    orders_7d: number;
    orders_30d: number;
    total_revenue: string | null;
    avg_order_value: string | null;
}

export const pharmacyService = {
    // ✅ Vérifier disponibilité médicament
    checkAvailability: async (pharmacyId: number, medicationName: string, quantity?: number) => {
        const response = await apiPost<MedicationAvailability>(
            `/api/pharmacies/${pharmacyId}/check-availability`,
            {
                medication_name: medicationName,
                quantity,
            }
        );
        return response;
    },

    // ✅ Réserver un médicament
    reserveMedication: async (
        pharmacyId: number,
        medicationName: string,
        quantity: number,
        expiryHours?: number
    ) => {
        const response = await apiPost<{ reservation_id: string; expiry_time: string; message: string }>(
            `/api/pharmacies/${pharmacyId}/reserve-medication`,
            {
                medication_name: medicationName,
                quantity,
                expiry_hours: expiryHours,
            }
        );
        return response;
    },

    // ✅ Créer une commande
    createOrder: async (
        pharmacyId: number,
        orderData: {
            medications: Array<{
                medication_name: string;
                quantity: number;
                price: number;
            }>;
            delivery_method: 'pickup' | 'delivery';
            delivery_address?: string;
        }
    ) => {
        const response = await apiPost<{
            order_id: string;
            total_amount: string;
            status: string;
            message: string;
        }>(`/api/pharmacies/${pharmacyId}/order`, orderData);
        return response;
    },

    // ✅ Vérifier interactions médicamenteuses (IA)
    checkInteractions: async (
        medications: string[],
        age?: number,
        medicalConditions?: string[]
    ) => {
        try {
            const response = await apiPost<{ success: boolean; interaction?: MedicationInteraction; data?: { interaction?: MedicationInteraction } }>(
                '/api/pharmacies/ai/interactions',
                {
                    medications,
                    age,
                    medical_conditions: medicalConditions,
                }
            );
            
            // Normaliser la réponse
            if (response.success) {
                return {
                    success: true,
                    data: {
                        interaction: response.interaction || response.data?.interaction || response.data as any
                    }
                };
            } else {
                return {
                    success: false,
                    error: response.message || response.error || 'L\'IA de vérification d\'interactions n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[pharmacyService] Erreur vérification interactions:', error);
            return {
                success: false,
                error: error.message || error.error || 'Erreur lors de la vérification. L\'IA de vérification d\'interactions n\'est peut-être pas encore opérationnelle.'
            };
        }
    },

    // ✅ Suggérer posologie (IA)
    suggestDosage: async (
        medicationName: string,
        age?: number,
        weight?: number,
        medicalCondition?: string
    ) => {
        try {
            const response = await apiPost<{ success: boolean; dosage?: DosageRecommendation; data?: { dosage?: DosageRecommendation } }>(
                '/api/pharmacies/ai/dosage',
                {
                    medication_name: medicationName,
                    patient_age: age,
                    patient_weight: weight,
                    condition: medicalCondition,
                }
            );
            
            // Normaliser la réponse
            if (response.success) {
                return {
                    success: true,
                    data: {
                        dosage: response.dosage || response.data?.dosage || response.data as any
                    }
                };
            } else {
                return {
                    success: false,
                    error: response.message || response.error || 'L\'IA de posologie n\'est pas encore opérationnelle.'
                };
            }
        } catch (error: any) {
            console.error('[pharmacyService] Erreur posologie:', error);
            return {
                success: false,
                error: error.message || error.error || 'Erreur lors de la récupération de la posologie. L\'IA de posologie n\'est peut-être pas encore opérationnelle.'
            };
        }
    },

    // ✅ Mes commandes (client)
    getMyOrders: async (page: number = 1, limit: number = 20) => {
        const response = await apiGet<{ orders: PharmacyOrder[]; page: number; limit: number }>(
            '/api/pharmacies/my-orders',
            {
                params: { page, limit },
            }
        );
        return response;
    },

    // ✅ Analytics prestataire
    getAnalytics: async (pharmacyId: number) => {
        const response = await apiGet<{ analytics: PharmacyAnalytics }>(
            `/api/pharmacies/${pharmacyId}/analytics`
        );
        return response;
    },

    // ✅ Détails pharmacie (pour vérification propriétaire)
    getPharmacyDetails: async (pharmacyId: number) => {
        const response = await apiGet<{
            id: number;
            user_id: number;
            nom: string;
            [key: string]: any;
        }>(`/api/pharmacies/${pharmacyId}`);
        return response;
    },
};

