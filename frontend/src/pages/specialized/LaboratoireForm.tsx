import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import LocationSelector, { LocationObject } from '@/components/ui/LocationSelector';
import { useUser } from '@/hooks/useUser';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { buildUrl } from '../../config/api.config';

export default function LaboratoireForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { serviceId: serviceIdParam } = useParams<{ serviceId?: string }>();
    const { user } = useUser();
    const serviceId = serviceIdParam ? parseInt(serviceIdParam, 10) : (location.state?.serviceId as number | undefined);

    const [formData, setFormData] = useState({
        nom: '',
        type_laboratoire: 'Laboratoire',
        adresse: '',
        quartier: '',
        ville: '',
        analyses_proposees: [] as string[],
        equipements: [] as string[],
        telephone: '',
        whatsapp: '',
        email: '',
    });

    const [loading, setLoading] = useState(false);
    const [selectedAnalyses, setSelectedAnalyses] = useState<string[]>([]);
    const [selectedEquipements, setSelectedEquipements] = useState<string[]>([]);

    const typesLaboratoire = ['Laboratoire', 'Centre d\'imagerie', 'Laboratoire + Imagerie'];
    const analysesOptions = [
        'Analyses sanguines',
        'Analyses urinaires',
        'Bactériologie',
        'Parasitologie',
        'Sérologie',
        'Biochimie',
    ];
    const equipementsOptions = ['Scanner', 'IRM', 'Échographie', 'Radiographie', 'Mammographie'];

    const toggleAnalyse = (analyse: string) => {
        setSelectedAnalyses((prev) =>
            prev.includes(analyse) ? prev.filter((a) => a !== analyse) : [...prev, analyse]
        );
    };

    const toggleEquipement = (equipement: string) => {
        setSelectedEquipements((prev) =>
            prev.includes(equipement)
                ? prev.filter((e) => e !== equipement)
                : [...prev, equipement]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            toast.error('Le nom du laboratoire est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: serviceId,
                nom: formData.nom,
                type_laboratoire: formData.type_laboratoire,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: null,
                analyses_proposees: selectedAnalyses.length > 0 ? selectedAnalyses : null,
                equipements: selectedEquipements.length > 0 ? selectedEquipements : null,
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
            };

            const response = await axios.post(buildUrl('/api/laboratoires'), payload, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.data) {
                toast.success('Laboratoire enregistré avec succès !');
                navigate(-1);
            }
        } catch (error: any) {
            console.error('Erreur création laboratoire:', error);
            toast.error(error.response?.data?.error || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="min-h-screen bg-gray-50">
                <div className="bg-white border-b border-gray-200">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <h1 className="text-xl font-bold text-gray-900">Enregistrer un Laboratoire/Imagerie</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nom du laboratoire *
                                </label>
                                <Input
                                    value={formData.nom}
                                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                    placeholder="Ex: Laboratoire Central"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Type de laboratoire
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {typesLaboratoire.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type_laboratoire: type })}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${formData.type_laboratoire === type
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                                <Input
                                    value={formData.adresse}
                                    onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                                    placeholder="Adresse complète"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Quartier</label>
                                    <LocationSelector
                                        label="Quartier"
                                        value={formData.quartier ? (typeof formData.quartier === 'string' ? { raw: formData.quartier, place_name: formData.quartier } : formData.quartier) : ''}
                                        onSelect={(location) => {
                                            const quartierValue = location.raw || location.place_name || '';
                                            setFormData({ 
                                                ...formData, 
                                                quartier: quartierValue,
                                                ville: location.components?.ville || formData.ville,
                                                pays: location.components?.pays || formData.pays,
                                            });
                                        }}
                                        placeholder="Rechercher un quartier..."
                                        scope="neighborhood" // ✅ EXPLICITE: Recherche de quartiers/neighborhoods
                                        enrichWithBackend
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                                    <LocationSelector
                                        label="Ville"
                                        value={formData.ville ? (typeof formData.ville === 'string' ? { raw: formData.ville, place_name: formData.ville } : formData.ville) : ''}
                                        onSelect={(location) => {
                                            const villeValue = location.raw || location.place_name || '';
                                            setFormData({ 
                                                ...formData, 
                                                ville: villeValue,
                                                pays: location.components?.pays || formData.pays,
                                            });
                                        }}
                                        placeholder="Rechercher une ville..."
                                        scope="city" // ✅ EXPLICITE: Recherche de villes uniquement
                                        enrichWithBackend
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Analyses proposées
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {analysesOptions.map((analyse) => (
                                        <button
                                            key={analyse}
                                            type="button"
                                            onClick={() => toggleAnalyse(analyse)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedAnalyses.includes(analyse)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {analyse}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Équipements</label>
                                <div className="flex flex-wrap gap-2">
                                    {equipementsOptions.map((equipement) => (
                                        <button
                                            key={equipement}
                                            type="button"
                                            onClick={() => toggleEquipement(equipement)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedEquipements.includes(equipement)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {equipement}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                                <Input
                                    value={formData.telephone}
                                    onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                    placeholder="+237 6XX XX XX XX"
                                    type="tel"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">WhatsApp</label>
                                <Input
                                    value={formData.whatsapp}
                                    onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                    placeholder="+237 6XX XX XX XX"
                                    type="tel"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                <Input
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    placeholder="laboratoire@example.com"
                                    type="email"
                                />
                            </div>
                        </div>

                        <div className="flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(-1)}
                                disabled={loading}
                            >
                                Annuler
                            </Button>
                            <Button type="submit" variant="primary" disabled={loading || !formData.nom.trim()}>
                                {loading ? 'Enregistrement...' : 'Enregistrer le Laboratoire'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

