import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/useUser';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { buildUrl } from '../config/api.config';

export default function TaxiForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { serviceId: serviceIdParam } = useParams<{ serviceId?: string }>();
    const { user } = useUser();
    const serviceId = serviceIdParam ? parseInt(serviceIdParam, 10) : (location.state?.serviceId as number | undefined);

    const [formData, setFormData] = useState({
        zone_service: [] as string[],
        vehicule_marque: '',
        vehicule_modele: '',
        vehicule_couleur: '',
        numero_plaque: '',
        telephone: '',
        whatsapp: '',
        is_available_now: false,
        is_on_duty: false,
    });

    const [loading, setLoading] = useState(false);
    const [selectedZones, setSelectedZones] = useState<string[]>([]);
    const [zoneText, setZoneText] = useState('');

    const zonesOptions = ['Douala', 'Yaoundé', 'Bafoussam', 'Garoua', 'Maroua', 'Centre-ville'];

    const toggleZone = (zone: string) => {
        setSelectedZones((prev) =>
            prev.includes(zone) ? prev.filter((z) => z !== zone) : [...prev, zone]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        // Combiner zones sélectionnées et zones saisies manuellement
        const zonesArray = [
            ...selectedZones,
            ...zoneText
                .split(',')
                .map((z) => z.trim())
                .filter(Boolean),
        ];

        if (zonesArray.length === 0) {
            toast.error('Veuillez sélectionner au moins une zone de service');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: serviceId,
                zone_service: zonesArray.length > 0 ? zonesArray : null,
                gps_actuel: null, // À enrichir avec géolocalisation si nécessaire
                vehicule_marque: formData.vehicule_marque || null,
                vehicule_modele: formData.vehicule_modele || null,
                vehicule_couleur: formData.vehicule_couleur || null,
                numero_plaque: formData.numero_plaque || null,
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                is_available_now: formData.is_available_now,
                is_on_duty: formData.is_on_duty,
            };

            const response = await axios.post(buildUrl('/api/taxis'), payload, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.data) {
                toast.success('Taxi enregistré avec succès !');
                navigate(-1);
            }
        } catch (error: any) {
            console.error('Erreur création taxi:', error);
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
                        <h1 className="text-xl font-bold text-gray-900">Enregistrer un Taxi de Ville</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Zones de service *
                                </label>
                                <div className="flex flex-wrap gap-2 mb-3">
                                    {zonesOptions.map((zone) => (
                                        <button
                                            key={zone}
                                            type="button"
                                            onClick={() => toggleZone(zone)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedZones.includes(zone)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {zone}
                                        </button>
                                    ))}
                                </div>
                                <Input
                                    value={zoneText}
                                    onChange={(e) => setZoneText(e.target.value)}
                                    placeholder="Ou saisir d'autres zones (séparées par des virgules)"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Marque du véhicule
                                    </label>
                                    <Input
                                        value={formData.vehicule_marque}
                                        onChange={(e) =>
                                            setFormData({ ...formData, vehicule_marque: e.target.value })
                                        }
                                        placeholder="Ex: Toyota"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Modèle du véhicule
                                    </label>
                                    <Input
                                        value={formData.vehicule_modele}
                                        onChange={(e) =>
                                            setFormData({ ...formData, vehicule_modele: e.target.value })
                                        }
                                        placeholder="Ex: Corolla"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Couleur</label>
                                    <Input
                                        value={formData.vehicule_couleur}
                                        onChange={(e) =>
                                            setFormData({ ...formData, vehicule_couleur: e.target.value })
                                        }
                                        placeholder="Ex: Blanc"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Numéro de plaque
                                    </label>
                                    <Input
                                        value={formData.numero_plaque}
                                        onChange={(e) =>
                                            setFormData({ ...formData, numero_plaque: e.target.value })
                                        }
                                        placeholder="Ex: LT-1234-AB"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
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
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_available_now}
                                        onChange={(e) =>
                                            setFormData({ ...formData, is_available_now: e.target.checked })
                                        }
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">
                                        Disponible pour prendre des clients maintenant
                                    </span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_on_duty}
                                        onChange={(e) => setFormData({ ...formData, is_on_duty: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Chauffeur en service</span>
                                </label>
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
                            <Button
                                type="submit"
                                variant="primary"
                                disabled={loading || selectedZones.length === 0}
                            >
                                {loading ? 'Enregistrement...' : 'Enregistrer le Taxi'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

