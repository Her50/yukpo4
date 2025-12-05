// ✅ Tests unitaires React Native pour calcul coûts livraison
import { calculateDeliveryCost, calculateTotalCost, haversineDistance } from '../utils/deliveryPricing';

describe('Delivery Pricing Calculations', () => {
    describe('haversineDistance', () => {
        it('should calculate distance between two points correctly', () => {
            // Douala à Yaoundé (~240 km)
            const douala = { latitude: 4.0511, longitude: 9.7679 };
            const yaounde = { latitude: 3.8480, longitude: 11.5021 };

            const distance = haversineDistance(douala, yaounde);
            const distanceKm = distance / 1000;

            expect(distanceKm).toBeGreaterThan(216);
            expect(distanceKm).toBeLessThan(264);
        });

        it('should return 0 for same point', () => {
            const point = { latitude: 4.0511, longitude: 9.7679 };
            const distance = haversineDistance(point, point);
            expect(distance).toBe(0);
        });
    });

    describe('calculateDeliveryCost', () => {
        it('should apply minimum cost for short distances', () => {
            const distanceKm = 0.5;
            const cost = calculateDeliveryCost(distanceKm);

            expect(cost).toBe(1000); // Minimum
        });

        it('should calculate cost for medium distance', () => {
            const distanceKm = 5;
            const cost = calculateDeliveryCost(distanceKm);

            expect(cost).toBe(2500); // 5 * 500
        });

        it('should calculate cost for long distance', () => {
            const distanceKm = 20;
            const cost = calculateDeliveryCost(distanceKm);

            expect(cost).toBe(10000); // 20 * 500
        });
    });

    describe('calculateTotalCost', () => {
        it('should calculate total with standard billing mode', () => {
            const productPrice = 4000;
            const deliveryCost = 1500;
            const isDeliveryFree = false;

            const total = calculateTotalCost(productPrice, deliveryCost, isDeliveryFree);

            expect(total).toBe(5500);
        });

        it('should calculate total with merchant_inclusive billing mode', () => {
            const productPrice = 4000;
            const deliveryCost = 1500;
            const isDeliveryFree = true;

            const total = calculateTotalCost(productPrice, deliveryCost, isDeliveryFree);

            expect(total).toBe(4000); // Pas de livraison
        });
    });
});

// Utilitaires de calcul (à créer dans utils/deliveryPricing.ts)
export function haversineDistance(
    pos1: { latitude: number; longitude: number },
    pos2: { latitude: number; longitude: number }
): number {
    const R = 6371; // Rayon Terre en km
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

export function calculateDeliveryCost(distanceKm: number): number {
    return Math.max(distanceKm * 500, 1000);
}

export function calculateTotalCost(
    productPrice: number,
    deliveryCost: number,
    isDeliveryFree: boolean
): number {
    return productPrice + (isDeliveryFree ? 0 : deliveryCost);
}

