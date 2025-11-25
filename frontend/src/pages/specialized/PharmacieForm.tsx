import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/useUser';
import axios from 'axios';
import { ArrowLeft, Mail, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildUrl } from '../config/api.config';

export default function PharmacieForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUser();
    const serviceId = location.state?.serviceId;

    const [formData, setFormData] = useState({
        nom: '',
        adresse: '',
        quartier: '',
        ville: '',
        jours_garde: '',
        heures_ouverture: '08:00',
        heures_fermeture: '20:00',
        permanent_24h: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
        services: [] as string[],
    });

    const [loading, setLoading] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

    const servicesOptions = ['Garde', 'Délivrance', 'Conseil', 'Vaccination', 'Pansements'];

    useEffect(() => {
        // Obtenir la position GPS de l'utilisateur
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setUserLocation({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                },
                (error) => {
                    console.error('Erreur géolocalisation:', error);
                }
            );
        }
    }, []);

    const toggleService = (service: string) => {
        setSelectedServices((prev) =>
            prev.includes(service)
                ? prev.filter((s) => s !== service)
                : [...prev, service]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            toast.error('Le nom de la pharmacie est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const token = localStorage.getItem('token');
            const payload = {
                service_id: serviceId,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: userLocation
                    ? `${userLocation.lat},${userLocation.lng}`
                    : null,
                jours_garde: formData.jours_garde || null,
                heures_ouverture: formData.heures_ouverture || null,
                heures_fermeture: formData.heures_fermeture || null,
                permanent_24h: formData.permanent_24h,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                services: selectedServices.length > 0 ? selectedServices : null,
            };

            const response = await axios.post(
                buildUrl('/api/pharmacies'),
                payload,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data.success) {
                toast.success('Pharmacie enregistrée avec succès !');
                navigate(-1);
            } else {
                toast.error(response.data.error || 'Impossible d\'enregistrer la pharmacie');
            }
        } catch (error: any) {
            console.error('Erreur création pharmacie:', error);
            toast.error(error.response?.data?.error || 'Une erreur est survenue');
        } finally {
            setLoading(false);
        }
    };

    return (
        <AppLayout>
            <div className="min-h-screen bg-gray-50">
                <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
                    <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
                        <button
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5 text-gray-700" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900">Enregistrer une Pharmacie</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations de base</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom de la pharmacie *
                                    </label>
                                    <Input
                                        value={formData.nom}
                                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                        placeholder="Ex: Pharmacie Centrale"
                                        required
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Adresse
                                    </label>
                                    <Input
                                        value={formData.adresse}
                                        onChange={(e) => setFormData({ ...formData, adresse: e.target.value })}
                                        placeholder="Adresse complète"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Quartier
                                        </label>
                                        <Input
                                            value={formData.quartier}
                                            onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                                            placeholder="Quartier"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Ville
                                        </label>
                                        <Input
                                            value={formData.ville}
                                            onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                                            placeholder="Ville"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Jours de garde
                                    </label>
                                    <Input
                                        value={formData.jours_garde}
                                        onChange={(e) => setFormData({ ...formData, jours_garde: e.target.value })}
                                        placeholder="Ex: Lundi, Mercredi, Vendredi"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Heure d'ouverture
                                        </label>
                                        <Input
                                            type="time"
                                            value={formData.heures_ouverture}
                                            onChange={(e) => setFormData({ ...formData, heures_ouverture: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            Heure de fermeture
                                        </label>
                                        <Input
                                            type="time"
                                            value={formData.heures_fermeture}
                                            onChange={(e) => setFormData({ ...formData, heures_fermeture: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Ouvert 24h/24
                                    </label>
                                    <input
                                        type="checkbox"
                                        checked={formData.permanent_24h}
                                        onChange={(e) => setFormData({ ...formData, permanent_24h: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Contact</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Phone className="w-4 h-4 inline mr-2" />
                                        Téléphone
                                    </label>
                                    <Input
                                        type="tel"
                                        value={formData.telephone}
                                        onChange={(e) => setFormData({ ...formData, telephone: e.target.value })}
                                        placeholder="+237 6XX XX XX XX"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Phone className="w-4 h-4 inline mr-2" />
                                        Téléphone urgence
                                    </label>
                                    <Input
                                        type="tel"
                                        value={formData.telephone_urgence}
                                        onChange={(e) => setFormData({ ...formData, telephone_urgence: e.target.value })}
                                        placeholder="+237 6XX XX XX XX"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        WhatsApp
                                    </label>
                                    <Input
                                        type="tel"
                                        value={formData.whatsapp}
                                        onChange={(e) => setFormData({ ...formData, whatsapp: e.target.value })}
                                        placeholder="+237 6XX XX XX XX"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        <Mail className="w-4 h-4 inline mr-2" />
                                        Email
                                    </label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="pharmacie@example.com"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Services proposés</h2>

                            <div className="flex flex-wrap gap-2">
                                {servicesOptions.map((service) => (
                                    <button
                                        key={service}
                                        type="button"
                                        onClick={() => toggleService(service)}
                                        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedServices.includes(service)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                            }`}
                                    >
                                        {service}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex justify-end gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => navigate(-1)}
                            >
                                Annuler
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading || !formData.nom.trim()}
                            >
                                {loading ? 'Enregistrement...' : 'Enregistrer la Pharmacie'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

