/**
 * Service d'estimation des routes non goudronnées
 * Utilise l'API Google Maps pour analyser le type de route
 */

interface Coordinates {
    latitude: number;
    longitude: number;
}

interface RouteSegment {
    distance: number;
    isPaved: boolean;
    roadType: string;
}

interface UnpavedRoadEstimation {
    totalDistance: number;
    pavedDistance: number;
    unpavedDistance: number;
    unpavedPercentage: number;
    segments: RouteSegment[];
    estimatedCondition: 'good' | 'moderate' | 'poor';
}

/**
 * Estime la portion de route non goudronnée entre deux points
 */
export async function estimateUnpavedRoad(
    origin: Coordinates,
    destination: Coordinates,
    googleMapsApiKey: string
): Promise<UnpavedRoadEstimation> {
    try {
        // Appel à l'API Google Maps Directions
        const response = await fetch(
            `https://maps.googleapis.com/maps/api/directions/json?` +
            `origin=${origin.latitude},${origin.longitude}&` +
            `destination=${destination.latitude},${destination.longitude}&` +
            `mode=driving&` +
            `key=${googleMapsApiKey}`
        );

        const data = await response.json();

        if (data.status !== 'OK' || !data.routes || data.routes.length === 0) {
            throw new Error('Impossible de calculer l\'itinéraire');
        }

        const route = data.routes[0];
        const legs = route.legs;

        let totalDistance = 0;
        let unpavedDistance = 0;
        const segments: RouteSegment[] = [];

        // Analyser chaque segment de la route
        for (const leg of legs) {
            for (const step of leg.steps) {
                const distance = step.distance.value / 1000; // Convertir en km
                totalDistance += distance;

                // Déterminer si le segment est goudronné basé sur les instructions
                const isPaved = isRoadPaved(step);
                
                if (!isPaved) {
                    unpavedDistance += distance;
                }

                segments.push({
                    distance,
                    isPaved,
                    roadType: step.html_instructions || 'Route non spécifiée',
                });
            }
        }

        const pavedDistance = totalDistance - unpavedDistance;
        const unpavedPercentage = (unpavedDistance / totalDistance) * 100;

        // Estimer la condition globale
        let estimatedCondition: 'good' | 'moderate' | 'poor';
        if (unpavedPercentage < 10) {
            estimatedCondition = 'good';
        } else if (unpavedPercentage < 30) {
            estimatedCondition = 'moderate';
        } else {
            estimatedCondition = 'poor';
        }

        return {
            totalDistance,
            pavedDistance,
            unpavedDistance,
            unpavedPercentage,
            segments,
            estimatedCondition,
        };
    } catch (error) {
        console.error('Erreur estimation route non goudronnée:', error);
        
        // Fallback: estimation basique basée sur la distance
        const distance = calculateHaversineDistance(origin, destination);
        return {
            totalDistance: distance,
            pavedDistance: distance * 0.7, // Estimation: 70% goudronné
            unpavedDistance: distance * 0.3, // Estimation: 30% non goudronné
            unpavedPercentage: 30,
            segments: [],
            estimatedCondition: 'moderate',
        };
    }
}

/**
 * Détermine si une route est goudronnée basé sur les instructions Google Maps
 */
function isRoadPaved(step: any): boolean {
    const instructions = (step.html_instructions || '').toLowerCase();
    const roadName = (step.street_name || '').toLowerCase();
    
    // Mots-clés indiquant une route non goudronnée
    const unpavedKeywords = [
        'dirt road', 'unpaved', 'gravel', 'terre', 'latérite',
        'piste', 'chemin', 'sentier', 'non goudronné',
    ];

    // Mots-clés indiquant une route goudronnée
    const pavedKeywords = [
        'highway', 'motorway', 'expressway', 'avenue', 'boulevard',
        'autoroute', 'route nationale', 'route goudronnée',
    ];

    // Vérifier les mots-clés de route non goudronnée
    for (const keyword of unpavedKeywords) {
        if (instructions.includes(keyword) || roadName.includes(keyword)) {
            return false;
        }
    }

    // Vérifier les mots-clés de route goudronnée
    for (const keyword of pavedKeywords) {
        if (instructions.includes(keyword) || roadName.includes(keyword)) {
            return true;
        }
    }

    // Par défaut, considérer comme goudronné si pas d'indication contraire
    return true;
}

/**
 * Calcule la distance à vol d'oiseau entre deux points (formule de Haversine)
 */
function calculateHaversineDistance(
    point1: Coordinates,
    point2: Coordinates
): number {
    const R = 6371; // Rayon de la Terre en km
    const dLat = toRadians(point2.latitude - point1.latitude);
    const dLon = toRadians(point2.longitude - point1.longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRadians(point1.latitude)) *
        Math.cos(toRadians(point2.latitude)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Convertit des degrés en radians
 */
function toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
}

/**
 * Calcule le supplément de prix recommandé basé sur la route non goudronnée
 */
export function calculateUnpavedSurcharge(
    unpavedDistance: number,
    basePrice: number
): number {
    // Supplément de 20-50% selon la distance non goudronnée
    const surchargePerKm = 50; // 50 FCFA par km non goudronné
    return Math.round(unpavedDistance * surchargePerKm);
}

/**
 * Obtient un message descriptif sur l'état de la route
 */
export function getRouteConditionMessage(
    estimation: UnpavedRoadEstimation
): string {
    if (estimation.unpavedPercentage < 10) {
        return '✅ Route majoritairement goudronnée';
    } else if (estimation.unpavedPercentage < 30) {
        return '⚠️ Quelques portions non goudronnées';
    } else if (estimation.unpavedPercentage < 50) {
        return '⚠️ Route partiellement non goudronnée';
    } else {
        return '\uD83D\uDEA7 Route majoritairement non goudronnée';
    }
}

export default {
    estimateUnpavedRoad,
    calculateUnpavedSurcharge,
    getRouteConditionMessage,
};

