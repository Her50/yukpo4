import { MapPin, Pill, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';

const PharmacieSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [ville, setVille] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [gpsCoords, setGpsCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [onDutyOnly, setOnDutyOnly] = useState(false);
  const [maxDistance, setMaxDistance] = useState(20);
  const [locating, setLocating] = useState(false);

  const handleGPS = () => {
    if (!navigator.geolocation) {
      toast({ title: 'Géolocalisation non supportée', variant: 'destructive' });
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGpsCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setLocating(false);
        toast({ title: 'Position GPS détectée' });
      },
      () => {
        setLocating(false);
        toast({ title: "Impossible d'obtenir la position", variant: 'destructive' });
      }
    );
  };

  const handleSearch = () => {
    if (!ville.trim() && !gpsCoords && !productSearch.trim()) {
      toast({ title: 'Saisissez une ville ou activez le GPS', variant: 'destructive' });
      return;
    }
    const filters: Record<string, any> = { max_distance_km: maxDistance, available_only: true };
    if (ville.trim()) filters.ville = ville.trim();
    if (gpsCoords) { filters.lat = gpsCoords.lat; filters.lng = gpsCoords.lng; }
    if (onDutyOnly) filters.on_duty_only = true;
    if (productSearch.trim()) filters.product_search = productSearch.trim();
    navigate('/list', { state: { filters } });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-500">
      <div className="px-5 pt-10 pb-8 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Pill className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Pharmacies</h1>
        </div>
        <p className="text-blue-100 text-sm">Trouvez une pharmacie près de chez vous</p>
      </div>

      <div className="bg-white rounded-t-3xl min-h-screen px-5 pt-6 pb-24">
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Médicament (optionnel)</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
              placeholder="Ex: paracétamol, amoxicilline..."
              value={productSearch}
              onChange={e => setProductSearch(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ville</label>
          <input
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
            placeholder="Ex: Douala, Yaoundé, Bafoussam..."
            value={ville}
            onChange={e => setVille(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>

        <button
          onClick={handleGPS}
          disabled={locating}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 mb-5 text-sm font-medium transition-all ${gpsCoords ? 'border-green-500 bg-green-50 text-green-700' : 'border-blue-300 bg-blue-50 text-blue-700'}`}
        >
          <MapPin className="w-4 h-4" />
          {locating ? 'Localisation en cours...' : gpsCoords ? `GPS actif · ${gpsCoords.lat.toFixed(3)}, ${gpsCoords.lng.toFixed(3)}` : 'Utiliser ma position GPS'}
        </button>

        <div className="mb-5">
          <div className="flex justify-between items-center mb-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rayon de recherche</label>
            <span className="text-sm font-bold text-blue-600">{maxDistance} km</span>
          </div>
          <input
            type="range" min={5} max={100} step={5}
            value={maxDistance}
            onChange={e => setMaxDistance(Number(e.target.value))}
            className="w-full accent-blue-600 h-2"
          />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>5 km</span><span>100 km</span>
          </div>
        </div>

        <label className="flex items-center gap-3 mb-7 cursor-pointer select-none">
          <button
            onClick={() => setOnDutyOnly(!onDutyOnly)}
            className={`w-12 h-6 rounded-full transition-colors flex items-center px-1 shrink-0 ${onDutyOnly ? 'bg-blue-600' : 'bg-gray-200'}`}
          >
            <div className={`w-4 h-4 rounded-full bg-white shadow transition-transform ${onDutyOnly ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
          <span className="text-sm text-gray-700 font-medium">De garde uniquement</span>
        </label>

        <button
          onClick={handleSearch}
          className="w-full bg-blue-600 active:bg-blue-700 text-white py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
        >
          <Search className="w-5 h-5" />
          Rechercher des pharmacies
        </button>
      </div>
    </div>
  );
};

export default PharmacieSearchPage;
