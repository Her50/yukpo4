// ============================================================================
// DeliveryLocationOnboardingPage — Onboarding lieu de livraison + WhatsApp
// ============================================================================
// Affichée automatiquement au 1er login (si delivery_location_saved_at est NULL).
// L'user déclare une seule fois son lieu de livraison + numéro WhatsApp.
// Persisté dans users → utilisé pour le matching troc (proximité géo) et la
// livraison. Plus jamais redemandé in-flow (suppression des GpsGate).
// ============================================================================

import { ArrowRight, Loader2, MapPin, Phone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPut } from '../../services/apiService';
import { useToast } from '../../hooks/use-toast';

interface PhotonFeature {
  properties: {
    name?: string;
    street?: string;
    housenumber?: string;
    postcode?: string;
    city?: string;
    state?: string;
    country?: string;
  };
  geometry: { coordinates: [number, number] };
}

interface Suggestion {
  label: string;
  lat: number;
  lng: number;
}

const PHOTON_URL = 'https://photon.komoot.io/api';

function formatPhotonLabel(f: PhotonFeature): string {
  const p = f.properties;
  const parts = [
    p.name || '',
    [p.housenumber, p.street].filter(Boolean).join(' '),
    [p.postcode, p.city].filter(Boolean).join(' '),
    p.state || '',
    p.country || '',
  ].filter(s => s && s.trim().length > 0);
  const dedup: string[] = [];
  for (const s of parts) if (!dedup.includes(s)) dedup.push(s);
  return dedup.join(', ');
}

const DeliveryLocationOnboardingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [loadingExisting, setLoadingExisting] = useState(true);
  const [locationQuery, setLocationQuery] = useState('');
  const [locationCoords, setLocationCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [searching, setSearching] = useState(false);
  const [predictions, setPredictions] = useState<Suggestion[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);

  const [whatsappPrimary, setWhatsappPrimary] = useState('');
  const [whatsappSecondary, setWhatsappSecondary] = useState('');
  const [saving, setSaving] = useState(false);

  // Charge l'état actuel : si user a déjà fait l'onboarding, on pré-remplit
  // pour permettre l'édition. Sinon vide.
  useEffect(() => {
    (async () => {
      try {
        const res = await apiGet('/api/users/me/delivery-info');
        const data = await res.json().catch(() => ({}));
        if (data?.success) {
          if (data.delivery_location_text) {
            setLocationQuery(data.delivery_location_text);
            if (typeof data.delivery_location_lat === 'number' && typeof data.delivery_location_lng === 'number') {
              setLocationCoords({ lat: data.delivery_location_lat, lng: data.delivery_location_lng });
            }
          }
          if (data.whatsapp_number_primary) setWhatsappPrimary(String(data.whatsapp_number_primary));
          if (data.whatsapp_number_secondary) setWhatsappSecondary(String(data.whatsapp_number_secondary));
        }
      } catch {
        // silent — l'user fera l'onboarding from scratch
      } finally {
        setLoadingExisting(false);
      }
    })();
  }, []);

  // Recherche autocomplete Photon (rues, POI, quartiers, villes)
  useEffect(() => {
    const q = locationQuery.trim();
    if (q.length < 3) {
      setPredictions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const url = `${PHOTON_URL}/?q=${encodeURIComponent(q)}&lang=fr&limit=10`;
        const r = await fetch(url);
        if (!r.ok) {
          setPredictions([]);
          return;
        }
        const data = await r.json();
        if (cancelled) return;
        const feats: PhotonFeature[] = Array.isArray(data?.features) ? data.features : [];
        const items: Suggestion[] = feats
          .filter(f => f?.geometry?.coordinates?.length === 2)
          .map(f => ({
            label: formatPhotonLabel(f),
            lng: f.geometry.coordinates[0],
            lat: f.geometry.coordinates[1],
          }));
        setPredictions(items);
      } catch {
        if (!cancelled) setPredictions([]);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [locationQuery]);

  const pickPrediction = (p: Suggestion) => {
    setLocationQuery(p.label);
    setLocationCoords({ lat: p.lat, lng: p.lng });
    setPredictions([]);
    setShowPredictions(false);
  };

  const canSave = locationQuery.trim().length >= 3 && !saving;

  const onSave = async () => {
    if (!canSave) return;
    setSaving(true);
    try {
      const res = await apiPut('/api/users/me/delivery-info', {
        delivery_location_text: locationQuery.trim(),
        delivery_location_lat: locationCoords?.lat ?? null,
        delivery_location_lng: locationCoords?.lng ?? null,
        whatsapp_number_primary: whatsappPrimary.trim() || null,
        whatsapp_number_secondary: whatsappSecondary.trim() || null,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data?.success === false) {
        throw new Error(data?.error || data?.message || 'Échec de la sauvegarde');
      }
      toast({
        title: t('bourse.delivery.saved_title', { defaultValue: 'Lieu enregistré' }),
        description: t('bourse.delivery.saved_desc', {
          defaultValue: 'Yukpo utilisera cette adresse pour le troc et la livraison.',
        }),
      });
      navigate('/', { replace: true });
    } catch (e: any) {
      toast({
        title: t('bourse.delivery.error_title', { defaultValue: 'Erreur' }),
        description: e?.message || 'Impossible de sauvegarder. Vérifiez votre connexion.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loadingExisting) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50 pb-20">
      <div className="max-w-md mx-auto px-4 pt-10">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-3 shadow-lg">
            <MapPin className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-1">
            {t('bourse.delivery.title', { defaultValue: 'Où vous livrer ?' })}
          </h1>
          <p className="text-sm text-gray-600 leading-snug">
            {t('bourse.delivery.subtitle', {
              defaultValue: 'Indiquez-nous votre lieu une seule fois. Yukpo l\'utilisera pour le troc et la livraison.',
            })}
          </p>
        </div>

        {/* Champ lieu autocomplete */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">
            <MapPin className="w-3 h-3 inline-block mr-1 text-amber-600" />
            {t('bourse.delivery.location_label', { defaultValue: 'Lieu de livraison' })}
            <span className="text-red-500"> *</span>
          </label>
          <div className="relative">
            <input
              type="search"
              value={locationQuery}
              onChange={e => {
                setLocationQuery(e.target.value);
                setLocationCoords(null); // invalide les coords si l'user retape
                setShowPredictions(true);
              }}
              onFocus={() => setShowPredictions(true)}
              placeholder={t('bourse.delivery.location_placeholder', {
                defaultValue: 'Rue, quartier, POI, ville…',
              })}
              className="w-full px-3 py-3 pr-10 border-2 border-amber-200 rounded-xl text-sm focus:outline-none focus:border-amber-500 focus:bg-amber-50/30"
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-amber-500" />
            )}
            {locationCoords && !searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-emerald-600 text-sm" title="Coordonnées valides">✓</span>
            )}

            {/* Suggestions dropdown */}
            {showPredictions && predictions.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-30 max-h-64 overflow-y-auto">
                {predictions.map((p, i) => (
                  <button
                    key={`${p.lat}-${p.lng}-${i}`}
                    onClick={() => pickPrediction(p)}
                    className="w-full text-left px-3 py-2 hover:bg-amber-50 active:bg-amber-100 border-b border-gray-50 last:border-b-0"
                  >
                    <div className="flex items-start gap-2">
                      <MapPin className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
                      <span className="text-xs text-gray-800">{p.label}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
          <p className="text-[10px] text-gray-500 mt-2 leading-snug">
            {t('bourse.delivery.location_hint', {
              defaultValue: '💡 Soyez précis (ex : « Boulangerie Mvog-Ada, Yaoundé ») pour une livraison rapide et un matching troc pertinent.',
            })}
          </p>
        </div>

        {/* Champ WhatsApp principal */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-4">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">
            <Phone className="w-3 h-3 inline-block mr-1 text-emerald-600" />
            {t('bourse.delivery.whatsapp_primary_label', { defaultValue: 'Numéro WhatsApp principal' })}
          </label>
          <input
            type="tel"
            value={whatsappPrimary}
            onChange={e => setWhatsappPrimary(e.target.value)}
            placeholder="+237 6XX XXX XXX"
            className="w-full px-3 py-3 border-2 border-emerald-200 rounded-xl text-sm focus:outline-none focus:border-emerald-500"
          />
          <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
            {t('bourse.delivery.whatsapp_primary_hint', {
              defaultValue: 'Yukpo vous notifie ici pour le troc, la livraison et les rappels.',
            })}
          </p>
        </div>

        {/* Champ WhatsApp secondaire (optionnel) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 mb-6">
          <label className="text-xs font-bold text-gray-600 uppercase tracking-wide block mb-2">
            <Phone className="w-3 h-3 inline-block mr-1 text-gray-400" />
            {t('bourse.delivery.whatsapp_secondary_label', {
              defaultValue: 'Numéro WhatsApp secondaire (optionnel)',
            })}
          </label>
          <input
            type="tel"
            value={whatsappSecondary}
            onChange={e => setWhatsappSecondary(e.target.value)}
            placeholder="+237 6XX XXX XXX"
            className="w-full px-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-gray-400"
          />
          <p className="text-[10px] text-gray-500 mt-1.5 leading-snug">
            {t('bourse.delivery.whatsapp_secondary_hint', {
              defaultValue: 'Conjoint, autre membre du foyer joignable en cas d\'absence.',
            })}
          </p>
        </div>

        {/* CTA Save */}
        <button
          onClick={onSave}
          disabled={!canSave}
          className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 disabled:bg-gray-300 text-white font-bold py-4 rounded-2xl text-sm flex items-center justify-center gap-2 shadow-md"
        >
          {saving ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              {t('bourse.delivery.saving', { defaultValue: 'Sauvegarde…' })}
            </>
          ) : (
            <>
              {t('bourse.delivery.cta_save', { defaultValue: 'Continuer' })}
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        <p className="text-[10px] text-gray-400 text-center mt-3 leading-snug px-4">
          {t('bourse.delivery.privacy_hint', {
            defaultValue: '🔒 Vos informations sont privées et utilisées uniquement pour la livraison et le matching troc.',
          })}
        </p>
      </div>
    </div>
  );
};

export default DeliveryLocationOnboardingPage;
