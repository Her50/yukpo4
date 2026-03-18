// ✅ Service API pour Don de Sang - Matching Donneur/Receveur
import { apiGet, apiPost } from './api';

export interface BloodDonationRequest {
    id: number;
    banque_sang_id: number;
    blood_group_needed: string;
    units_needed: number;
    urgency_level: 'normal' | 'urgent' | 'critical';
    description?: string;
    status: 'active' | 'fulfilled' | 'expired';
    created_at: string;
    banque_nom?: string;
    banque_adresse?: string;
}

export interface BloodDonorMatch {
    id: number;
    request_id: number;
    donor_user_id: number;
    donor_name?: string;
    donor_blood_group: string;
    status: 'pending' | 'accepted' | 'rejected' | 'completed';
    compatibility_score?: number;
}

export interface BloodGroupInfo {
    blood_group: string;
    last_donation_date?: string;
    can_donate: boolean;
    next_eligible_date?: string;
}

export interface BloodCompatibility {
    donor_group: string;
    recipient_group: string;
    compatible: boolean;
    compatibility_type?: string;
}

export const bloodDonationService = {
    // === PROFIL DONNEUR ===

    // Récupérer les groupes sanguins de l'utilisateur
    getMyBloodGroups: async () => {
        return await apiGet<{ success: boolean; data: BloodGroupInfo[] }>(
            '/api/blood-donation/donor/blood-groups'
        );
    },

    // Créer ou mettre à jour le groupe sanguin
    createOrUpdateBloodGroup: async (bloodGroup: string) => {
        return await apiPost<{ success: boolean; data: any }>(
            '/api/blood-donation/donor/blood-group',
      // ✅ Backend attend `groupe_sanguin`
      { groupe_sanguin: bloodGroup }
        );
    },

    // Mettre à jour la date de dernière donation
    updateLastDonation: async (donationDate: string) => {
        return await apiPost<{ success: boolean }>(
            '/api/blood-donation/donor/update-last-donation',
            { last_donation_date: donationDate }
        );
    },

    // === DEMANDES DE DON ===

    // Créer une demande de don de sang
    createDonationRequest: async (params: {
        banque_sang_id: number;
        blood_group_needed: string;
        units_needed: number;
        urgency_level: 'normal' | 'urgent' | 'critical';
        description?: string;
    }) => {
        return await apiPost<{ success: boolean; data: BloodDonationRequest }>(
            '/api/blood-donation/requests',
            params
        );
    },

    // Lister les demandes actives
    listActiveRequests: async () => {
        return await apiGet<{ success: boolean; data: BloodDonationRequest[] }>(
            '/api/blood-donation/requests'
        );
    },

    // === MATCHING ===

    // Lister les matches pour une demande
    listMatchesForRequest: async (requestId: number) => {
        return await apiGet<{ success: boolean; data: BloodDonorMatch[] }>(
            `/api/blood-donation/requests/${requestId}/matches`
        );
    },

    // Notifier les donneurs pour une demande
    notifyDonorsForRequest: async (requestId: number) => {
        return await apiPost<{ success: boolean; notified_count: number }>(
            '/api/blood-donation/requests/notify',
            { request_id: requestId }
        );
    },

    // Mettre à jour le statut d'un match
    updateMatchStatus: async (matchId: number, status: 'accepted' | 'rejected' | 'completed') => {
        return await apiPost<{ success: boolean }>(
            '/api/blood-donation/matches/update-status',
            { match_id: matchId, status }
        );
    },

    // === COMPATIBILITÉ ===

    // Compatibilité pour un groupe sanguin
    getBloodGroupCompatibility: async (group: string) => {
        return await apiGet<{ success: boolean; data: BloodCompatibility[] }>(
            `/api/blood-donation/compatibility/${encodeURIComponent(group)}`
        );
    },

    // Toutes les compatibilités
    getAllCompatibilities: async () => {
        return await apiGet<{ success: boolean; data: BloodCompatibility[] }>(
            '/api/blood-donation/compatibility'
        );
    },

    // === STATISTIQUES ===

    // Statistiques d'une banque de sang
    getBanqueStatistics: async (banqueId: number) => {
        return await apiGet<{ success: boolean; data: any }>(
            `/api/banques-sang/${banqueId}/statistics`
        );
    },
};
