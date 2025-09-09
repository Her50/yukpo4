// src/hooks/useProximityDetector.ts
import { useEffect } from "react";

/**
 * Détecte si l'utilisateur est à proximité du point (lat, lng).
 * @param targetLat Latitude de la cible
 * @param targetLng Longitude de la cible
 * @param onNear Callback déclenché si l'utilisateur est proche (moins de 1km)
 */
export default function useProximityDetector(
  targetLat: number,
  targetLng: number,
  onNear: () => void
): void {
  useEffect(() => {
    const checkProximity = () => {
      if (!navigator.geolocation) return;

      navigator.geolocation.getCurrentPosition((position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const distance = getDistanceFromLatLonInKm(userLat, userLng, targetLat, targetLng);

        if (distance <= 1.0) {
          onNear();
        }
      });
    };

    const interval = setInterval(checkProximity, 30000);
    checkProximity(); // ✅ vérifie dès le montage

    return () => clearInterval(interval);
  }, [targetLat, targetLng, onNear]);
}

function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Rayon de la Terre en km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI / 180);
}
