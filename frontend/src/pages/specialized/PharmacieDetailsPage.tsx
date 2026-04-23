import { ArrowLeft, ExternalLink, Mail, MapPin, Phone, Pill } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { apiGet } from '../../services/apiService';

interface PharmacieDetails {
  id: number;
  nom: string;
  adresse?: string;
  quartier?: string;
  ville?: string;
  gps?: string;
  is_available_now: boolean;
  is_on_duty: boolean;
  telephone?: string;
  telephone_urgence?: string;
  email?: string;
  horaires?: any;
}

const PharmacieDetailsPage: React.FC = () => {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { toast } = useToast();
  const [pharmacie, setPharmacie] = useState<PharmacieDetails | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { if (id) load(); }, [id]);

  const load = async () => {
    try {
      const res = await apiGet(`/api/pharmacies/${id}`);
      const data = await res.json();
      if (data.success && data.data) setPharmacie(data.data);
      else { toast({ title: 'Pharmacie introuvable', variant: 'destructive' }); navigate(-1); }
    } catch (e: any) {
      toast({ title: 'Erreur', description: e.message, variant: 'destructive' });
      navigate(-1);
    } finally { setLoading(false); }
  };

  const openMaps = () => {
    if (!pharmacie) return;
    const query = pharmacie.gps || `${pharmacie.adresse || ''} ${pharmacie.quartier || ''} ${pharmacie.ville || ''}`.trim();
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(query)}`, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
        <span className="font-semibold text-gray-800">Détails</span>
      </div>
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    </div>
  );

  if (!pharmacie) return null;

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <div className="sticky top-0 bg-white border-b px-4 py-3 flex items-center gap-3 z-10 shadow-sm">
        <button onClick={() => navigate(-1)} className="p-1 text-gray-500 active:text-gray-800"><ArrowLeft className="w-5 h-5" /></button>
        <span className="font-semibold text-gray-800 flex-1 truncate">{pharmacie.nom}</span>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${pharmacie.is_available_now ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
          {pharmacie.is_available_now ? 'Ouvert' : 'Fermé'}
        </span>
      </div>

      {/* Hero */}
      <div className="bg-white px-5 py-6 border-b">
        <div className="flex items-start gap-3">
          <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
            <Pill className="w-7 h-7 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{pharmacie.nom}</h1>
            {(pharmacie.quartier || pharmacie.ville) && (
              <p className="text-sm text-gray-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3.5 h-3.5" />
                {[pharmacie.quartier, pharmacie.ville].filter(Boolean).join(', ')}
              </p>
            )}
            {pharmacie.is_on_duty && (
              <span className="inline-block mt-2 text-xs bg-blue-100 text-blue-700 px-2.5 py-0.5 rounded-full font-medium">De garde</span>
            )}
          </div>
        </div>

        {/* CTAs principaux */}
        <div className="flex gap-3 mt-5">
          {pharmacie.telephone && (
            <a
              href={`tel:${pharmacie.telephone}`}
              className="flex-1 bg-green-600 active:bg-green-700 text-white py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm shadow-md shadow-green-200"
            >
              <Phone className="w-4 h-4" /> Appeler
            </a>
          )}
          <button
            onClick={openMaps}
            className="flex-1 bg-white border-2 border-blue-600 text-blue-600 py-3.5 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm active:bg-blue-50"
          >
            <ExternalLink className="w-4 h-4" /> Itinéraire
          </button>
        </div>
      </div>

      {/* Infos */}
      <div className="px-4 py-4 space-y-3">
        {pharmacie.telephone_urgence && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
            <Phone className="w-5 h-5 text-red-500 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-red-500 uppercase">Urgences</p>
              <a href={`tel:${pharmacie.telephone_urgence}`} className="font-bold text-red-700 text-base">
                {pharmacie.telephone_urgence}
              </a>
            </div>
          </div>
        )}

        {pharmacie.adresse && (
          <div className="bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-100">
            <MapPin className="w-5 h-5 text-gray-400 shrink-0" />
            <p className="text-sm text-gray-700">{pharmacie.adresse}</p>
          </div>
        )}

        {pharmacie.telephone && (
          <a href={`tel:${pharmacie.telephone}`} className="bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-100 w-full text-left">
            <Phone className="w-5 h-5 text-gray-400 shrink-0" />
            <p className="text-sm text-gray-700">{pharmacie.telephone}</p>
          </a>
        )}

        {pharmacie.email && (
          <a href={`mailto:${pharmacie.email}`} className="bg-white rounded-xl p-4 flex items-center gap-3 border border-gray-100 w-full text-left">
            <Mail className="w-5 h-5 text-gray-400 shrink-0" />
            <p className="text-sm text-gray-700">{pharmacie.email}</p>
          </a>
        )}
      </div>
    </div>
  );
};

export default PharmacieDetailsPage;
