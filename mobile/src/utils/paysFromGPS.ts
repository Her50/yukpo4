/**
 * Détection pays depuis coordonnées GPS — bounding boxes des pays supportés.
 * Simple, offline, suffit pour notre besoin (filtre système scolaire).
 */
import { PAYS_PAR_DEFAUT, type PaysCode } from '../data/schoolSystems';

interface Box {
  pays: PaysCode;
  minLat: number; maxLat: number;
  minLon: number; maxLon: number;
}

const BOXES: Box[] = [
  { pays: 'CM', minLat: 1.6,   maxLat: 13.0, minLon: 8.5,   maxLon: 16.2 },
  { pays: 'CI', minLat: 4.3,   maxLat: 10.8, minLon: -8.7,  maxLon: -2.4 },
  { pays: 'SN', minLat: 12.3,  maxLat: 16.7, minLon: -17.7, maxLon: -11.3 },
  { pays: 'GA', minLat: -3.9,  maxLat: 2.4,  minLon: 8.7,   maxLon: 14.5 },
  { pays: 'CG', minLat: -5.1,  maxLat: 3.7,  minLon: 11.1,  maxLon: 18.7 },
  { pays: 'CD', minLat: -13.5, maxLat: 5.4,  minLon: 12.2,  maxLon: 31.3 },
  { pays: 'BJ', minLat: 6.1,   maxLat: 12.5, minLon: 0.8,   maxLon: 3.9 },
  { pays: 'TG', minLat: 6.1,   maxLat: 11.2, minLon: -0.2,  maxLon: 1.8 },
  { pays: 'BF', minLat: 9.4,   maxLat: 15.1, minLon: -5.5,  maxLon: 2.4 },
  { pays: 'ML', minLat: 10.1,  maxLat: 25.0, minLon: -12.3, maxLon: 4.3 },
  { pays: 'NE', minLat: 11.7,  maxLat: 23.5, minLon: 0.2,   maxLon: 16.0 },
  { pays: 'NG', minLat: 4.2,   maxLat: 13.9, minLon: 2.7,   maxLon: 14.7 },
  { pays: 'GH', minLat: 4.7,   maxLat: 11.2, minLon: -3.3,  maxLon: 1.2 },
];

export function detectPaysFromGPS(lat: number, lon: number): PaysCode {
  for (const b of BOXES) {
    if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon) {
      return b.pays;
    }
  }
  return PAYS_PAR_DEFAUT;
}

export function detectPaysFromGPSOrNull(lat?: number | null, lon?: number | null): PaysCode | null {
  if (lat == null || lon == null) return null;
  for (const b of BOXES) {
    if (lat >= b.minLat && lat <= b.maxLat && lon >= b.minLon && lon <= b.maxLon) {
      return b.pays;
    }
  }
  return null;
}
