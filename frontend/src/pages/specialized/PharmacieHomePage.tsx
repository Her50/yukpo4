import { Camera, ChevronRight, FileText, Loader2, MapPin, MessageSquare, Phone, Pill, RefreshCw, Search, Send, Shield, Sparkles, Star, Tag, X } from 'lucide-react';
import YukpoCostBadge from '@/components/YukpoCostBadge';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiGet, apiPost } from '@/services/apiService';

interface Medication {
  id: number;
  nom_produit: string;
  prix?: number;
  stock?: number;
  unite?: string;
  categorie?: string;
  description?: string;
  distance_km?: number;
  pharmacy_name?: string;
  pharmacy_ville?: string;
  pharmacy_quartier?: string;
  pharmacy_telephone?: string;
  pharmacy_service_id?: number;
}

const QUICK_FILTERS = [
  { id: 'proche', label: 'Proche de moi', icon: 'map', radius: 5 },
  { id: 'disponible', label: 'Disponible', icon: 'check' },
  { id: 'garde', label: 'De garde', icon: 'shield' },
  { id: 'prix_bas', label: 'Prix bas', icon: 'tag' },
];

const AI_SUGGESTIONS = [
  'Quels médicaments pour la fièvre ?',
  'Comment traiter un mal de tête ?',
  'Médicaments disponibles près de moi',
];

const PharmacieHomePage: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const ordonnanceInputRef = useRef<HTMLInputElement>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [medications, setMedications] = useState<Medication[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [onDutyOnly, setOnDutyOnly] = useState(false);
  const [radiusKm, setRadiusKm] = useState(20);
  const [activeChip, setActiveChip] = useState<string | null>(null);

  // AI chat
  const [showAI, setShowAI] = useState(false);
  const [aiQuestion, setAiQuestion] = useState('');
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Image analysis
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [imageResult, setImageResult] = useState<string | null>(null);

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      pos => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {}
    );
  }, []);

  useEffect(() => {
    loadMedications();
  }, [gps, onDutyOnly, radiusKm]);

  const loadMedications = async (q = '') => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (q || searchQuery) params.set('q', q || searchQuery);
      if (gps) { params.set('lat', gps.lat.toString()); params.set('lng', gps.lng.toString()); params.set('radius_km', radiusKm.toString()); }
      if (onDutyOnly) params.set('on_duty_only', 'true');
      params.set('limit', '20');
      const res = await apiGet(`/api/medicines/nearby?${params}`, { isAuthenticated: false });
      if (!res.ok) { setMedications([]); return; }
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      const items = data?.items || data?.data?.items || [];
      setMedications(Array.isArray(items) ? items : []);
    } catch {
      setMedications([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) { toast({ title: 'Saisissez un médicament', variant: 'destructive' }); return; }
    loadMedications(searchQuery);
  };

  const handleChip = (chip: typeof QUICK_FILTERS[0]) => {
    const next = activeChip === chip.id ? null : chip.id;
    setActiveChip(next);
    if (chip.id === 'proche') setRadiusKm(next ? 5 : 20);
    if (chip.id === 'garde') setOnDutyOnly(next !== null);
  };

  const handleAskAI = async (question?: string) => {
    const q = question || aiQuestion;
    if (!q.trim()) return;
    setAiLoading(true);
    setShowAI(true);
    setAiResponse(null);
    try {
      const medNames = medications.slice(0, 5).map(m => m.nom_produit);
      const res = await apiPost('/ai/chat', { question: q, context: `Pharmacie. Médicaments disponibles: ${medNames.join(', ')}`, type: 'pharmacy' });
      const data = await res.json();
      const msg = data?.data?.message || data?.message || data?.response || 'Consultez votre pharmacien pour des conseils personnalisés.';
      setAiResponse(typeof msg === 'string' ? msg : JSON.stringify(msg));
      if (question) setAiQuestion(question);
    } catch {
      setAiResponse('Service IA temporairement indisponible. Consultez votre pharmacien.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleImageAnalysis = async (e: React.ChangeEvent<HTMLInputElement>, type: 'ordonnance' | 'boite') => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAnalyzingImage(true);
    setImageResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(',')[1];
        const res = await apiPost('/api/pharmacies/ai/extract-ordonnance', {
          image_base64: base64,
          lat: gps?.lat,
          lng: gps?.lng,
        });
        const data = await res.json();
        if (data?.success && data?.medications?.length > 0) {
          const meds = data.medications.map((m: any) => m.name || m.nom).join(', ');
          setImageResult(`Médicaments détectés : ${meds}`);
          const q = type === 'ordonnance'
            ? `Ordonnance avec : ${meds}. Où trouver ces médicaments près de moi ?`
            : `Médicament identifié : ${meds}. Posologie, effets secondaires et précautions ?`;
          setAiQuestion(q);
          handleAskAI(q);
        } else {
          setImageResult('Aucun médicament détecté. Prenez une photo plus nette.');
          toast({ title: 'Aucun médicament détecté', variant: 'destructive' });
        }
        setAnalyzingImage(false);
      };
      reader.readAsDataURL(file);
    } catch (e: any) {
      toast({ title: 'Erreur analyse', description: e.message, variant: 'destructive' });
      setAnalyzingImage(false);
    }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-600 to-blue-500">
      {/* Header */}
      <div className="px-5 pt-10 pb-6 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Pill className="w-7 h-7" />
          <h1 className="text-2xl font-bold">Pharmacies</h1>
        </div>
        <p className="text-blue-100 text-sm">Trouvez médicaments et pharmacies de garde</p>
      </div>

      <div className="bg-white rounded-t-3xl min-h-screen pb-24">
        {/* Search bar */}
        <div className="px-4 pt-5 pb-2">
          <form onSubmit={handleSearch} className="flex gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                className="w-full pl-9 pr-3 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                placeholder="Médicament, maladie, symptôme..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <button type="submit" className="bg-blue-600 active:bg-blue-700 text-white px-4 py-3 rounded-xl font-medium text-sm">
              OK
            </button>
          </form>

          {/* Quick filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide mb-4">
            {QUICK_FILTERS.map(chip => (
              <button
                key={chip.id}
                onClick={() => handleChip(chip)}
                className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium border transition-colors ${
                  activeChip === chip.id ? 'bg-blue-600 text-white border-blue-600' : 'border-gray-200 text-gray-600 bg-white'
                }`}
              >
                {chip.id === 'map' && <MapPin className="w-3 h-3" />}
                {chip.id === 'garde' && <Shield className="w-3 h-3" />}
                {chip.id === 'prix_bas' && <Tag className="w-3 h-3" />}
                {chip.label}
              </button>
            ))}
          </div>

          {/* Action buttons: scan ordonnance + analyser médicament */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <label className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 border-blue-200 bg-blue-50 cursor-pointer active:bg-blue-100 text-center ${analyzingImage ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                {analyzingImage ? <Loader2 className="w-5 h-5 text-blue-600 animate-spin" /> : <FileText className="w-5 h-5 text-blue-600" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-800">Scanner ordonnance</p>
                <p className="text-xs text-blue-500">Yukpo extrait les médicaments</p>
                <YukpoCostBadge action="ordonnance_extract" variant="inline" className="mt-1" />
              </div>
              <input
                ref={ordonnanceInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleImageAnalysis(e, 'ordonnance')}
              />
            </label>

            <label className={`flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 border-indigo-200 bg-indigo-50 cursor-pointer active:bg-indigo-100 text-center ${analyzingImage ? 'opacity-60 pointer-events-none' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
                {analyzingImage ? <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" /> : <Camera className="w-5 h-5 text-indigo-600" />}
              </div>
              <div>
                <p className="text-xs font-semibold text-indigo-800">Analyser médicament</p>
                <p className="text-xs text-indigo-500">Photo boîte → infos & posologie</p>
                <YukpoCostBadge action="vision_image" variant="inline" className="mt-1" />
              </div>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={e => handleImageAnalysis(e, 'boite')}
              />
            </label>
          </div>

          {imageResult && (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-800 mb-4 flex items-start gap-2">
              <Pill className="w-4 h-4 mt-0.5 shrink-0 text-green-600" />
              {imageResult}
            </div>
          )}

          {/* AI Assistant panel */}
          <div className="rounded-2xl border border-blue-100 bg-blue-50 mb-4 overflow-hidden">
            <button
              onClick={() => setShowAI(v => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span className="text-sm font-semibold text-blue-800">Assistant pharmacien Yukpo</span>
                <YukpoCostBadge action="chat_message" variant="inline" />
              </div>
              <ChevronRight className={`w-4 h-4 text-blue-400 transition-transform ${showAI ? 'rotate-90' : ''}`} />
            </button>

            {showAI && (
              <div className="px-4 pb-4">
                {aiResponse && (
                  <div className="bg-white rounded-xl p-3 mb-3 text-sm text-gray-700 leading-relaxed border border-blue-100 max-h-48 overflow-y-auto">
                    {aiResponse}
                  </div>
                )}
                {aiLoading && (
                  <div className="flex items-center gap-2 mb-3 text-sm text-blue-600">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Yukpo analyse votre demande...
                  </div>
                )}
                <div className="flex gap-2 overflow-x-auto pb-2 mb-3 scrollbar-hide">
                  {AI_SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => handleAskAI(s)}
                      className="shrink-0 text-xs bg-white border border-blue-200 text-blue-600 px-3 py-1.5 rounded-full"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    className="flex-1 px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white"
                    placeholder="Posez votre question..."
                    value={aiQuestion}
                    onChange={e => setAiQuestion(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAskAI()}
                  />
                  <button
                    onClick={() => handleAskAI()}
                    disabled={aiLoading}
                    className="bg-blue-600 text-white p-2.5 rounded-xl"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Divider + Nearby medications */}
        <div className="px-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-gray-800 text-sm">
              {gps ? 'Médicaments disponibles près de vous' : 'Médicaments disponibles'}
            </h2>
            <button onClick={() => { setRefreshing(true); loadMedications(); }} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 text-blue-600 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : medications.length === 0 ? (
            <div className="flex flex-col items-center py-14 text-center">
              <Pill className="w-12 h-12 text-gray-200 mb-3" />
              <p className="text-gray-500 text-sm">Aucun médicament trouvé</p>
              <p className="text-gray-400 text-xs mt-1">Essayez une recherche ou modifiez les filtres</p>
            </div>
          ) : (
            <div className="space-y-2">
              {medications.map((med, i) => (
                <div
                  key={med.id || i}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 cursor-pointer active:bg-gray-50"
                  onClick={() => med.pharmacy_service_id && navigate(`/${med.pharmacy_service_id}`)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-gray-900 text-sm leading-tight">{med.nom_produit}</p>
                      {med.pharmacy_name && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3" />
                          {med.pharmacy_name}
                          {(med.pharmacy_quartier || med.pharmacy_ville) && ` · ${[med.pharmacy_quartier, med.pharmacy_ville].filter(Boolean).join(', ')}`}
                        </p>
                      )}
                      {med.categorie && (
                        <span className="inline-block mt-1 text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{med.categorie}</span>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      {med.prix ? (
                        <p className="text-sm font-bold text-blue-600">{Number(med.prix).toLocaleString()} FCFA</p>
                      ) : null}
                      {med.distance_km !== undefined && (
                        <p className="text-xs text-gray-400 mt-0.5">{med.distance_km.toFixed(1)} km</p>
                      )}
                    </div>
                  </div>
                  {med.pharmacy_telephone && (
                    <a
                      href={`tel:${med.pharmacy_telephone}`}
                      onClick={e => e.stopPropagation()}
                      className="flex items-center gap-1 mt-2 text-xs text-green-600 w-fit"
                    >
                      <Phone className="w-3 h-3" /> {med.pharmacy_telephone}
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Link to full pharmacy search */}
          <button
            onClick={() => navigate('/search')}
            className="w-full mt-5 border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2"
          >
            <Search className="w-4 h-4" />
            Recherche avancée de pharmacies
          </button>
        </div>
      </div>
    </div>
  );
};

export default PharmacieHomePage;
