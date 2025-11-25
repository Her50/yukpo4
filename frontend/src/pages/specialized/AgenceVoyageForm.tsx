import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/useUser';
import axios from 'axios';
import { ArrowLeft } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate } from 'react-router-dom';
import { buildUrl } from '../config/api.config';

export default function AgenceVoyageForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUser();
    const serviceId = location.state?.serviceId;

    const [formData, setFormData] = useState({
        nom: '',
        adresse: '',
        quartier: '',
        ville: '',
        services_offerts: [] as string[],
        partenaires: [] as string[],
        telephone: '',
        whatsapp: '',
        email: '',
    });

    const [loading, setLoading] = useState(false);
    const [selectedServices, setSelectedServices] = useState<string[]>([]);
    const [partenairesText, setPartenairesText] = useState('');

    const servicesOptions = [
        'Billetterie bus',
        'Billetterie avion',
        'Organisation voyages',
        'Réservation hôtels',
    ];

    const toggleService = (service: string) => {
        setSelectedServices((prev) =>
            prev.includes(service) ? prev.filter((s) => s !== service) : [...prev, service]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            toast.error('Le nom de l\'agence est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const partenairesArray = partenairesText
                .split(',')
                .map((p) => p.trim())
                .filter(Boolean);

            const payload = {
                service_id: serviceId,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: null,
                services_offerts: selectedServices.length > 0 ? selectedServices : null,
                partenaires: partenairesArray.length > 0 ? partenairesArray : null,
                telephone: formData.telephone || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
            };

            const response = await axios.post(buildUrl('/api/agences-voyage'), payload, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.data) {
                toast.success('Agence de voyage enregistrée avec succès !');
                navigate(-1);
            }
        } catch (error: any) {
            console.error('Erreur création agence:', error);
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
                        <h1 className="text-xl font-bold text-gray-900">Enregistrer une Agence de Voyage</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nom de l'agence *
                                </label>
                                <Input
                                    value={formData.nom}
                                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                    placeholder="Ex: Agence Voyages Express"
                                    required
                                />
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
                                    <Input
                                        value={formData.quartier}
                                        onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                                        placeholder="Quartier"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                                    <Input
                                        value={formData.ville}
                                        onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                                        placeholder="Ville"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Services offerts
                                </label>
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

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Partenaires (séparés par des virgules)
                                </label>
                                <Input
                                    value={partenairesText}
                                    onChange={(e) => setPartenairesText(e.target.value)}
                                    placeholder="Ex: Voyage Express, Transcam, Camair-Co"
                                />
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
                                    placeholder="agence@example.com"
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
                                {loading ? 'Enregistrement...' : 'Enregistrer l\'Agence'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

