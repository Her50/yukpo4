// ✅ Service API pour Immobilier (Vente/Location)
import { apiDelete, apiGet, apiPost } from './api';

// Types pour les réponses
export interface RealEstateProperty {
    id: number;
    service_id: number;
    titre: string;
    description?: string;
    type_bien: string;
    statut: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    superficie_m2?: number;
    nb_chambres?: number;
    nb_salles_bain?: number;
    standing?: string;
    prix_vente?: number;
    prix_location_mensuel?: number;
    photos?: string[];
    is_available_now?: boolean;
    distance_km?: number;
    average_rating?: number;
    total_ratings?: number;
}

export interface PropertySearchFilters {
    ville?: string;
    quartier?: string | string[]; // Support multiple quartiers
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    search_zone?: string; // Zone polygonale: "lat1,lng1|lat2,lng2|..."
    type_bien?: string;
    statut?: string;
    prix_min?: number;
    prix_max?: number;
    superficie_min?: number;
    superficie_max?: number;
    nb_chambres_min?: number;
    standing?: string;
    page?: number;
    limit?: number;
}

export interface PriceEstimate {
    estimated_price: number;
    price_per_m2: number;
    price_range_min: number;
    price_range_max: number;
    confidence_level: number;
    reasoning: string;
    market_analysis: string;
    factors: string[];
}

export interface PropertyRecommendation {
    property_ids: number[];
    recommendations: string;
    budget_analysis: string;
    location_analysis: string;
    investment_potential?: string;
}

export interface LoanSimulation {
    property_price: number;
    down_payment: number;
    loan_amount: number;
    interest_rate: number;
    loan_duration_years: number;
    monthly_payment: number;
    total_interest: number;
    total_cost: number;
    affordability_analysis: string;
    recommendations: string;
}

export const immobilierService = {
    // ✅ Recherche de biens immobiliers
    searchProperties: async (filters: PropertySearchFilters) => {
        const response = await apiGet<{ success: boolean; data: RealEstateProperty[] }>(
            '/api/immobilier/biens',
            { params: filters }
        );
        return response;
    },

    // ✅ Détails d'un bien
    getPropertyDetails: async (id: number) => {
        const response = await apiGet<{ success: boolean; data: RealEstateProperty }>(
            `/api/immobilier/biens/${id}`
        );
        return response;
    },

    // ✅ Réserver une visite
    bookVisit: async (propertyId: number, date: string, heure: string, typeVisite: string) => {
        const response = await apiPost<{ success: boolean; data: { id: number } }>(
            `/api/immobilier/biens/${propertyId}/book-visit`,
            {
                date_visite: date,
                heure_visite: heure,
                type_visite: typeVisite,
            }
        );
        return response;
    },

    // ✅ Simuler un prêt immobilier
    simulateLoan: async (
        propertyId: number,
        downPaymentPercent: number,
        loanDurationYears: number,
        monthlyIncome?: number
    ) => {
        const response = await apiPost<{ success: boolean; simulation: LoanSimulation }>(
            `/api/immobilier/biens/${propertyId}/simulate-loan`,
            {
                down_payment_percent: downPaymentPercent,
                loan_duration_years: loanDurationYears,
                monthly_income: monthlyIncome,
            }
        );
        return response;
    },

    // ✅ Mes visites
    getMyVisits: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>('/api/immobilier/my-visits');
        return response;
    },

    // ✅ Recommandations IA
    getAIRecommendations: async (
        budgetMax: number,
        typeBien?: string,
        nbChambresMin?: number,
        quartier?: string,
        ville: string = '',
        preferences?: any
    ) => {
        const response = await apiPost<{ success: boolean; recommendation: PropertyRecommendation }>(
            '/api/immobilier/ai/recommendations',
            {
                budget_max: budgetMax,
                type_bien: typeBien,
                nb_chambres_min: nbChambresMin,
                quartier,
                ville,
                preferences,
            }
        );
        return response;
    },

    // ✅ Estimation prix IA
    estimatePrice: async (
        typeBien: string,
        superficieM2: number,
        nbChambres: number,
        standing: string,
        quartier: string,
        ville: string,
        equipements?: any
    ) => {
        const response = await apiPost<{ success: boolean; estimate: PriceEstimate }>(
            '/api/immobilier/ai/price-estimate',
            {
                type_bien: typeBien,
                superficie_m2: superficieM2,
                nb_chambres: nbChambres,
                standing,
                quartier,
                ville,
                equipements,
            }
        );
        return response;
    },

    // ✅ Analytics propriétaire
    getAnalytics: async (propertyId: number) => {
        const response = await apiGet<{ success: boolean; analytics: any }>(
            `/api/immobilier/analytics?property_id=${propertyId}`
        );
        return response;
    },

    // ============================================================================
    // FONCTIONNALITÉS AVANCÉES IMMOBILIER
    // ============================================================================

    // ✅ Favoris
    addToFavorites: async (propertyId: number) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            `/api/immobilier/biens/${propertyId}/favorite`,
            {}
        );
        return response;
    },

    removeFromFavorites: async (propertyId: number) => {
        const response = await apiDelete<{ success: boolean; message: string }>(
            `/api/immobilier/biens/${propertyId}/unfavorite`
        );
        return response;
    },

    getMyFavorites: async () => {
        const response = await apiGet<{ success: boolean; data: RealEstateProperty[] }>(
            '/api/immobilier/my-favorites'
        );
        return response;
    },

    // ✅ Comparaison
    compareProperties: async (propertyIds: number[], comparisonName?: string) => {
        const response = await apiPost<{
            success: boolean;
            comparison_id: number;
            properties: RealEstateProperty[];
        }>('/api/immobilier/compare', {
            property_ids: propertyIds,
            comparison_name: comparisonName,
        });
        return response;
    },

    // ✅ Alertes prix
    createPriceAlert: async (
        propertyId?: number,
        searchCriteria?: any,
        targetPriceMax?: number,
        alertType: string = 'price_drop'
    ) => {
        const response = await apiPost<{ success: boolean; alert_id: number }>(
            '/api/immobilier/alerts',
            {
                property_id: propertyId,
                search_criteria: searchCriteria,
                target_price_max: targetPriceMax,
                alert_type: alertType,
            }
        );
        return response;
    },

    getMyPriceAlerts: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/immobilier/my-alerts'
        );
        return response;
    },

    // ✅ Tracking et Partage
    trackPropertyView: async (
        propertyId: number,
        viewDurationSeconds?: number,
        viewedSections?: string[],
        source?: string,
        sessionId?: string
    ) => {
        const response = await apiPost<{ success: boolean }>(
            `/api/immobilier/biens/${propertyId}/track-view`,
            {
                view_duration_seconds: viewDurationSeconds,
                viewed_sections: viewedSections,
                source,
                session_id: sessionId,
            }
        );
        return response;
    },

    shareProperty: async (propertyId: number, shareType: string = 'link') => {
        const response = await apiPost<{
            success: boolean;
            share_id: number;
            share_token: string;
            share_url: string;
        }>(`/api/immobilier/biens/${propertyId}/share`, {
            share_type: shareType,
        });
        return response;
    },

    // ============================================================================
    // TERRAINS
    // ============================================================================

    // ✅ Recherche de terrains
    searchLands: async (filters?: {
        ville?: string;
        quartier?: string;
        superficie_min?: number;
        superficie_max?: number;
        prix_min?: number;
        prix_max?: number;
        usage?: string;
        lat?: number;
        lng?: number;
        page?: number;
        limit?: number;
    }) => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/immobilier/terrains',
            filters ? { params: filters } : undefined
        );
        return response;
    },

    // ✅ Détails d'un terrain
    getLandDetails: async (landId: number) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/immobilier/terrains/${landId}`
        );
        return response;
    },

    // ✅ Analyse IA d'un terrain (potentiel, risques, valeur)
    analyzeLand: async (
        superficieM2: number,
        usage: string,
        quartier: string,
        ville: string,
        accesRoute?: boolean,
        viabilise?: boolean
    ) => {
        const response = await apiPost<{ success: boolean; analysis: any }>(
            '/api/immobilier/terrains/ai/analysis',
            {
                superficie_m2: superficieM2,
                usage,
                quartier,
                ville,
                acces_route: accesRoute,
                viabilise,
            }
        );
        return response;
    },

    // ============================================================================
    // UPLOAD MÉDIA & VISITES VIRTUELLES
    // ============================================================================

    // ✅ Upload média (photos/vidéos) pour un bien
    uploadPropertyMedia: async (propertyId: number, mediaUrls: string[], mediaType: 'photo' | 'video' = 'photo') => {
        const response = await apiPost<{ success: boolean; uploaded_count: number }>(
            `/api/immobilier/biens/${propertyId}/upload-media`,
            {
                media_urls: mediaUrls,
                media_type: mediaType,
            }
        );
        return response;
    },

    // ✅ Upload visite virtuelle (360°)
    uploadVirtualTour: async (propertyId: number, tourUrl: string, tourType: string = '360_photo') => {
        const response = await apiPost<{ success: boolean; tour_id: number }>(
            `/api/immobilier/biens/${propertyId}/upload-virtual-tour`,
            {
                tour_url: tourUrl,
                tour_type: tourType,
            }
        );
        return response;
    },

    // ✅ Créer un bien immobilier
    createProperty: async (propertyData: {
        service_id: number;
        titre: string;
        description?: string;
        type_bien: string;
        statut: string;
        adresse?: string;
        quartier?: string;
        ville?: string;
        gps?: string;
        superficie_m2?: number;
        nb_chambres?: number;
        nb_salles_bain?: number;
        standing?: string;
        prix_vente?: number;
        prix_location_mensuel?: number;
        [key: string]: any;
    }) => {
        const response = await apiPost<{ success: boolean; id: number; message: string }>(
            '/api/immobilier/biens',
            propertyData
        );
        return response;
    },

    // ============================================================================
    // HÔTELS & MEUBLÉS - Gestion des chambres et réservations
    // ============================================================================

    // ✅ Obtenir mes propriétés hôtelières gérées
    getMyHotelProperties: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/hotel/my-properties'
        );
        return response;
    },

    // ✅ Obtenir les réservations de mes propriétés
    getMyHotelReservations: async () => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            '/api/hotel/reservations/my'
        );
        return response;
    },

    // ✅ Créer une réservation manuelle (gérant)
    createManualReservation: async (data: {
        property_id: number;
        unit_id?: number;
        unit_number?: string;
        date_arrivee: string;
        date_depart: string;
        nombre_adultes: number;
        nombre_enfants?: number;
        nombre_chambres: number;
        nom_client: string;
        telephone_client: string;
        email_client?: string;
        prix_nuitee: number;
        prix_total: number;
        montant_total: number;
        montant_avance?: number;
        payment_status?: string;
        payment_method?: string;
        manual_reservation_source: string;
        notes?: string;
    }) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            '/api/hotel/reservations/manual',
            data
        );
        return response;
    },

    // ✅ Scanner QR code réservation (gérant à l'accueil)
    scanReservationQR: async (qrCode: string) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            '/api/hotel/reservations/scan-qr',
            { qr_code: qrCode }
        );
        return response;
    },

    // ✅ Obtenir les QR codes d'une réservation (principal + invités)
    getReservationQRCodes: async (reservationId: number) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/hotel/reservations/${reservationId}/qr-codes`
        );
        return response;
    },

    // ✅ Check-in d'une réservation
    checkInReservation: async (reservationId: number) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            `/api/hotel/reservations/${reservationId}/check-in`,
            {}
        );
        return response;
    },

    // ✅ Check-out d'une réservation
    checkOutReservation: async (reservationId: number) => {
        const response = await apiPost<{ success: boolean; message: string }>(
            `/api/hotel/reservations/${reservationId}/check-out`,
            {}
        );
        return response;
    },

    // ✅ Générer un QR invité / co-chambrier
    generateGuestQR: async (reservationId: number, guestLabel?: string) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            `/api/hotel/reservations/${reservationId}/guest-qr`,
            { guest_label: guestLabel }
        );
        return response;
    },

    // ✅ Créer un blocage manuel d'unité (maintenance, occupation hors système)
    createManualBlockage: async (data: {
        unit_id: number;
        property_id: number;
        date_debut: string;
        date_fin: string;
        heure_debut?: string;
        heure_fin?: string;
        raison: string;
        description?: string;
        is_manual_occupation?: boolean;
        client_name?: string;
        client_phone?: string;
        notes_occupation?: string;
    }) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            '/api/hotel/blockages/manual',
            data
        );
        return response;
    },

    // ✅ Supprimer un blocage manuel
    deleteBlockage: async (blockageId: number) => {
        const response = await apiDelete<{ success: boolean; message: string }>(
            `/api/hotel/blockages/${blockageId}`
        );
        return response;
    },

    // ✅ Lister les blocages manuels d'une propriété
    listManualBlockages: async (propertyId: number) => {
        const response = await apiGet<{ success: boolean; data: any[] }>(
            `/api/hotel/properties/${propertyId}/blockages/manual`
        );
        return response;
    },

    // ✅ Suggestion tarif IA pour une unité
    getAIUnitPricing: async (unitId: number, contexte?: string) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            `/api/hotel/units/${unitId}/ai-pricing`,
            { contexte }
        );
        return response;
    },

    // ✅ Suggestion tarif IA pour une propriété
    getAIPropertyPricing: async (propertyId: number, contexte?: string) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            `/api/hotel/properties/${propertyId}/ai-pricing`,
            { contexte }
        );
        return response;
    },

    // ✅ Insights IA pour un bien hôtelier (remplissage, promos, etc.)
    getPropertyAIInsights: async (propertyId: number, saison?: string) => {
        const response = await apiGet<{ success: boolean; data: any }>(
            `/api/hotel/properties/${propertyId}/ai-insights`,
            saison ? { params: { saison } } : undefined
        );
        return response;
    },

    // ✅ Réserver un séjour hôtel/meublé (côté utilisateur)
    bookHotelStay: async (data: {
        property_id: number;
        date_arrivee: string;
        date_depart: string;
        nombre_adultes: number;
        nombre_enfants?: number;
        nombre_chambres: number;
        nom_client: string;
        telephone_client: string;
        email_client?: string;
        prix_nuitee?: number;
        prix_total?: number;
        notes?: string;
    }) => {
        const response = await apiPost<{ success: boolean; data: any }>(
            '/api/hotel/reservations/request',
            data
        );
        return response;
    },

    // ✅ Payer une réservation hôtel (avance ou complet)
    payHotelBooking: async (
        reservationId: number,
        paymentType: 'advance' | 'full',
        paymentMethod: string,
        montantAvance?: number
    ) => {
        const response = await apiPost<{
            success: boolean;
            data: {
                amount_paid: number;
                new_payment_status: string;
                remaining_amount: number;
            };
        }>(`/api/hotel/reservations/${reservationId}/pay`, {
            payment_type: paymentType,
            payment_method: paymentMethod,
            montant_avance: montantAvance,
        });
        return response;
    },
};

