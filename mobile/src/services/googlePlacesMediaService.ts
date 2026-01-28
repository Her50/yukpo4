import ENVIRONMENT from '../config/environment';

type GooglePlacePhoto = {
  photo_reference: string;
  height?: number;
  width?: number;
  html_attributions?: string[];
};

type GooglePlaceDetailsResult = {
  name?: string;
  formatted_address?: string;
  geometry?: { location?: { lat: number; lng: number } };
  photos?: GooglePlacePhoto[];
};

type GooglePlaceDetailsResponse = {
  status: string;
  result?: GooglePlaceDetailsResult;
  error_message?: string;
};

export type PlaceDetails = {
  name?: string;
  formattedAddress?: string;
  location?: { lat: number; lng: number };
  photoReferences: string[];
};

function requireGoogleKey(): string {
  const key = ENVIRONMENT.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw new Error('GOOGLE_MAPS_API_KEY manquant (EXPO_PUBLIC_GOOGLE_MAPS_API_KEY)');
  }
  return key;
}

export const googlePlacesMediaService = {
  async getPlaceDetails(placeId: string): Promise<PlaceDetails> {
    const key = requireGoogleKey();
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json` +
      `?place_id=${encodeURIComponent(placeId)}` +
      `&fields=${encodeURIComponent('name,formatted_address,geometry,photo')}` +
      `&language=fr` +
      `&key=${encodeURIComponent(key)}`;

    const res = await fetch(url);
    const data = (await res.json()) as GooglePlaceDetailsResponse;

    if (!res.ok) {
      throw new Error(`Google Place Details HTTP ${res.status}`);
    }
    if (data.status !== 'OK' || !data.result) {
      throw new Error(data.error_message || `Google Place Details status=${data.status}`);
    }

    const photoReferences = (data.result.photos || [])
      .map((p) => p.photo_reference)
      .filter(Boolean);

    return {
      name: data.result.name,
      formattedAddress: data.result.formatted_address,
      location: data.result.geometry?.location
        ? { lat: data.result.geometry.location.lat, lng: data.result.geometry.location.lng }
        : undefined,
      photoReferences,
    };
  },

  getPhotoUrl(photoReference: string, maxWidth: number = 1600): string {
    const key = requireGoogleKey();
    return (
      `https://maps.googleapis.com/maps/api/place/photo` +
      `?maxwidth=${encodeURIComponent(String(maxWidth))}` +
      `&photoreference=${encodeURIComponent(photoReference)}` +
      `&key=${encodeURIComponent(key)}`
    );
  },

  async getPlacePhotoUrls(placeId: string, opts?: { maxPhotos?: number; maxWidth?: number }): Promise<string[]> {
    const { maxPhotos = 10, maxWidth = 1600 } = opts || {};
    const details = await this.getPlaceDetails(placeId);
    return details.photoReferences.slice(0, maxPhotos).map((ref) => this.getPhotoUrl(ref, maxWidth));
  },
};


