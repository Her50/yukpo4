// ✅ Utilitaires pour calcul des coûts de livraison (mobile)

/**
 * Calcule la distance entre deux points GPS en utilisant la formule Haversine
 * @param pos1 Point de départ {latitude, longitude}
 * @param pos2 Point d'arrivée {latitude, longitude}
 * @returns Distance en mètres
 */
export function haversineDistance(
    pos1: { latitude: number; longitude: number },
    pos2: { latitude: number; longitude: number }
): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = ((pos2.latitude - pos1.latitude) * Math.PI) / 180;
    const dLon = ((pos2.longitude - pos1.longitude) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((pos1.latitude * Math.PI) / 180) *
        Math.cos((pos2.latitude * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c * 1000; // Retourne en mètres
}

/**
 * Calcule le coût de livraison basé sur la distance
 * @param distanceKm Distance en kilomètres
 * @returns Coût en FCFA (minimum 1000 FCFA)
 */
export function calculateDeliveryCost(distanceKm: number): number {
    return Math.max(distanceKm * 500, 1000);
}

/**
 * Calcule le coût total (produit + livraison)
 * @param productPrice Prix du produit en FCFA
 * @param deliveryCost Coût de livraison en FCFA
 * @param isDeliveryFree Si true, livraison gratuite (billing_mode = merchant_inclusive)
 * @returns Total en FCFA
 */
export function calculateTotalCost(
    productPrice: number,
    deliveryCost: number,
    isDeliveryFree: boolean
): number {
    return productPrice + (isDeliveryFree ? 0 : deliveryCost);
}

/**
 * Convertit FCFA en centimes
 */
export function fcfaToCents(fcfa: number): number {
    return Math.round(fcfa * 100);
}

/**
 * Convertit centimes en FCFA
 */
export function centsToFcfa(cents: number): number {
    return cents / 100;
}

/**
 * Formate un montant en FCFA avec séparateurs
 */
export function formatFcfa(amount: number): string {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XAF',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(amount);
}

