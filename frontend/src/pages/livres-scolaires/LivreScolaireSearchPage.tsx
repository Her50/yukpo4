import { BookOpen, MapPin, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../../hooks/use-toast';

const NIVEAUX = ['Primaire', 'Collège', 'Lycée'];
const ETATS = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];

const LivreScolaireSearchPage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [classe, setClasse] = useState('');
  const [matiere, setMatiere] = useState('');
  const [niveau, setNiveau] = useState('');
  const [etat, setEtat] = useState('');
  const [ville, setVille] = useState('');
  const [gps, setGps] = useState<{ lat: number; lon: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [rayon, setRayon] = useState(10);

  const handleGPS = () => {
    if (!navigator.geolocation) { toast({ title: 'GPS non supporté', variant: 'destructive' }); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => { setGps({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocating(false); toast({ title: 'Position GPS détectée' }); },
      () => { setLocating(false); toast({ title: "Impossible d'obtenir la position", variant: 'destructive' }); }
    );
  };

  const handleSearch = () => {
    if (!classe.trim() && !matiere.trim()) {
      toast({ title: 'Saisissez une classe ou une matière', variant: 'destructive' });
      return;
    }
    const p = new URLSearchParams();
    if (classe.trim()) { p.append('classe_actuelle', classe.trim()); p.append('classe_souhaitee', classe.trim()); }
    if (matiere.trim()) p.append('matiere', matiere.trim());
    if (niveau) p.append('niveau', niveau);
    if (etat) p.append('etat_livre', etat);
    if (ville.trim()) p.append('ville', ville.trim());
    if (gps) { p.append('gps_lat', gps.lat.toString()); p.append('gps_lon', gps.lon.toString()); p.append('rayon_km', rayon.toString()); }
    navigate(`/list?${p.toString()}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-500">
      <div className="px-5 pt-10 pb-8 text-white">
        <div className="flex items-center gap-2 mb-1">
          <BookOpen className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Bourse du Livre</h1>
        </div>
        <p className="text-indigo-100 text-sm">Trouvez et échangez des livres scolaires</p>
      </div>

      <div className="bg-white rounded-t-3xl min-h-screen px-5 pt-6 pb-24">
        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Classe</label>
          <input
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            placeholder="Ex: 6ème, 5ème, Terminale, CM2..."
            value={classe}
            onChange={e => setClasse(e.target.value)}
          />
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Matière</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
              placeholder="Ex: Mathématiques, Français, SVT..."
              value={matiere}
              onChange={e => setMatiere(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
            />
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">Niveau</label>
          <div className="flex gap-2 flex-wrap">
            {NIVEAUX.map(n => (
              <button
                key={n}
                onClick={() => setNiveau(niveau === n ? '' : n)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${niveau === n ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white'}`}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 block">État du livre</label>
          <div className="flex gap-2 flex-wrap">
            {ETATS.map(e => (
              <button
                key={e}
                onClick={() => setEtat(etat === e ? '' : e)}
                className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${etat === e ? 'bg-indigo-600 text-white border-indigo-600' : 'border-gray-200 text-gray-600 bg-white'}`}
              >
                {e}
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">Ville (optionnel)</label>
          <input
            className="w-full px-4 py-3.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
            placeholder="Ex: Douala, Yaoundé..."
            value={ville}
            onChange={e => setVille(e.target.value)}
          />
        </div>

        <button
          onClick={handleGPS}
          disabled={locating}
          className={`w-full flex items-center justify-center gap-2 py-3.5 rounded-xl border-2 mb-5 text-sm font-medium transition-all ${gps ? 'border-green-500 bg-green-50 text-green-700' : 'border-indigo-300 bg-indigo-50 text-indigo-700'}`}
        >
          <MapPin className="w-4 h-4" />
          {locating ? 'Localisation...' : gps ? `GPS actif · ${gps.lat.toFixed(3)}, ${gps.lon.toFixed(3)}` : 'Utiliser ma position GPS'}
        </button>

        {gps && (
          <div className="mb-5">
            <div className="flex justify-between items-center mb-2">
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Rayon de recherche</label>
              <span className="text-sm font-bold text-indigo-600">{rayon} km</span>
            </div>
            <input type="range" min={1} max={50} step={1} value={rayon} onChange={e => setRayon(Number(e.target.value))} className="w-full accent-indigo-600 h-2" />
          </div>
        )}

        <button
          onClick={handleSearch}
          className="w-full bg-indigo-600 active:bg-indigo-700 text-white py-4 rounded-2xl font-semibold text-base flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
        >
          <Search className="w-5 h-5" />
          Rechercher des livres
        </button>

        <div className="mt-5 flex gap-3">
          <button
            onClick={() => navigate('/nouveau')}
            className="flex-1 border-2 border-indigo-600 text-indigo-600 py-3.5 rounded-xl font-semibold text-sm text-center"
          >
            + Publier un livre
          </button>
          <button
            onClick={() => navigate('/mes-livres')}
            className="flex-1 border-2 border-gray-200 text-gray-600 py-3.5 rounded-xl font-semibold text-sm text-center"
          >
            Mes livres
          </button>
        </div>
      </div>
    </div>
  );
};

export default LivreScolaireSearchPage;
