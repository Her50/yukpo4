// ✅ Service API pour Pharmacies - Nouvelles fonctionnalités IA
import { apiGet, apiPatch, apiPost } from './api';

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
                product_id?: number;
                medication_name: string;
                quantity: number;
            }>;
            delivery_method: 'pickup' | 'delivery';
            delivery_address?: string;
            delivery_fee_cents?: number;
            reservation_id?: string;
            idempotency_key?: string;
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

            // ✅ CORRIGÉ 2026-03-05: Extraction correcte des données IA imbriquées
            // apiPost wrappe: response.data = backend JSON complet
            const backendData = (response?.data || response) as any;
            const innerData = backendData?.data || backendData;
            if (response.success) {
                return {
                    success: true,
                    data: {
                        interaction: innerData?.interaction || backendData?.interaction || innerData as any
                    }
                };
            } else {
                return {
                    success: false,
                    error: backendData?.message || response.error || 'L\'IA de vérification d\'interactions n\'est pas encore opérationnelle.'
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

    // ✅ Partenaire : liste les commandes reçues pour sa pharmacie
    getPartnerOrders: async (
        pharmacyId: number,
        params?: { status?: string; page?: number; limit?: number }
    ) => {
        return apiGet<{ success: boolean; orders: PharmacyOrder[]; page: number; limit: number }>(
            `/api/pharmacies/${pharmacyId}/partner-orders`,
            { params }
        );
    },

    // ✅ Partenaire : mettre à jour le statut d'une commande
    updateOrderStatus: async (
        orderId: string,
        status: 'confirmed' | 'processing' | 'ready' | 'delivered' | 'cancelled',
        note?: string
    ) => {
        return apiPatch<{ success: boolean; order_id: string; status: string; message: string }>(
            `/api/pharmacies/orders/${orderId}/status`,
            { status, note }
        );
    },

    // ✅ Ordonnance IA: extraire médicaments d'une image
    extractOrdonnance: async (imageBase64: string): Promise<{
        success: boolean;
        medications?: Array<{ name: string; dosage?: string; quantity?: number; posologie?: string }>;
        error?: string;
    }> => {
        try {
            const response = await apiPost<any>('/api/pharmacies/ai/extract-ordonnance', {
                image_base64: imageBase64,
            });
            if (response.success) {
                return { success: true, medications: response.medications || [] };
            }
            return { success: false, error: response.error || 'Extraction échouée' };
        } catch (error: any) {
            return { success: false, error: error.message || 'Erreur lors de l\'extraction' };
        }
    },

    // ✅ Rechercher les pharmacies qui ont les médicaments de l'ordonnance
    searchByMedications: async (
        medications: Array<{ name: string; quantity?: number }>,
        lat?: number,
        lng?: number,
        radiusKm?: number
    ): Promise<{
        success: boolean;
        pharmacies?: Array<{
            id: number;
            service_id: number;
            nom: string;
            ville?: string;
            quartier?: string;
            telephone?: string;
            is_on_duty_now: boolean;
            is_available_now: boolean;
            distance_km?: number;
            available_count: number;
            total_requested: number;
            matching_score: number;
            matching_label: string;
        }>;
        total_medications_requested?: number;
        error?: string;
    }> => {
        try {
            const response = await apiPost<any>('/api/pharmacies/search-by-medications', {
                medications,
                lat,
                lng,
                radius_km: radiusKm,
            });
            if (response.success) {
                return {
                    success: true,
                    pharmacies: response.pharmacies || [],
                    total_medications_requested: response.total_medications_requested,
                };
            }
            return { success: false, error: response.error || 'Recherche échouée' };
        } catch (error: any) {
            return { success: false, error: error.message || 'Erreur lors de la recherche' };
        }
    },

    // ✅ Récupérer les QR codes d'une commande (patient voit ses QR, pharmacie voit les QR à scanner)
    getOrderQRCodes: async (orderId: string): Promise<{
        success: boolean;
        order_id?: string;
        delivery_method?: string;
        order_status?: string;
        pharmacy_nom?: string;
        pharmacy_tel?: string;
        total_amount?: string;
        reversed?: boolean;
        qr_pickup?: { qr_code: string; qr_code_url?: string; status: string; expires_at: string } | null;
        qr_delivery?: { qr_code: string; qr_code_url?: string; status: string; expires_at: string } | null;
        error?: string;
    }> => {
        try {
            const response = await apiGet<any>(`/api/pharmacies/orders/${orderId}/qr`);
            if (response.success) return response;
            return { success: false, error: response.error || 'Erreur récupération QR' };
        } catch (error: any) {
            return { success: false, error: error.message || 'Erreur réseau' };
        }
    },

    // ✅ Valider un QR code pharmacie (pharmacie valide pickup, coursier valide delivery)
    validateOrderQR: async (qrCode: string): Promise<{
        success: boolean;
        validated?: boolean;
        qr_type?: string;
        new_order_status?: string;
        message?: string;
        error?: string;
    }> => {
        try {
            const response = await apiPost<any>('/api/pharmacies/orders/qr/validate', { qr_code: qrCode });
            if (response.success) return response;
            return { success: false, error: response.error || 'Validation échouée' };
        } catch (error: any) {
            return { success: false, error: error.message || 'Erreur réseau' };
        }
    },

    // ✅ Détail complet commande (côté pharmacie partenaire)
    getOrderDetail: async (orderId: string): Promise<{ success: boolean; order?: any; error?: string }> => {
        try {
            const response = await apiGet<any>(`/api/pharmacies/orders/${orderId}/detail`);
            if (response.success) return response;
            return { success: false, error: response.error || 'Erreur récupération détail' };
        } catch (error: any) {
            return { success: false, error: error.message || 'Erreur réseau' };
        }
    },

    getFinancialMovements: async (limit: number = 50) => {
        return apiGet<any>('/api/pharmacies/me/financial-movements', {
            params: { limit },
        });
    },

    requestWithdrawal: async (payload: { amount_cents: number; method?: string; phone?: string }) => {
        return apiPost<any>('/api/pharmacies/me/withdrawals', payload);
    },
};

