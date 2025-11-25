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

export default function CovoiturageForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { user } = useUser();
    const serviceId = location.state?.serviceId;

    const [formData, setFormData] = useState({
        point_depart: '',
        point_arrivee: '',
        date_depart: '',
        heure_depart: '08:00',
        nombre_places: '4',
        places_disponibles: '4',
        prix_place: '',
        devise: 'XAF',
        vehicule_marque: '',
        vehicule_modele: '',
        vehicule_couleur: '',
        description: '',
        contact_telephone: '',
        contact_whatsapp: '',
    });

    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.point_depart.trim() || !formData.point_arrivee.trim()) {
            toast.error('Le point de départ et la destination sont obligatoires');
            return;
        }

        if (!formData.prix_place.trim()) {
            toast.error('Le prix par place est obligatoire');
            return;
        }

        try {
            setLoading(true);

            // Formater la date au format ISO 8601
            const dateStr = formData.date_depart
                ? new Date(formData.date_depart).toISOString()
                : new Date().toISOString();

            const payload = {
                service_id: serviceId,
                point_depart: formData.point_depart,
                point_arrivee: formData.point_arrivee,
                gps_depart: null, // À enrichir avec géolocalisation si nécessaire
                gps_arrivee: null,
                date_depart: dateStr,
                heure_depart: formData.heure_depart,
                nombre_places: parseInt(formData.nombre_places) || 4,
                places_disponibles: parseInt(formData.places_disponibles) || 4,
                prix_place: parseFloat(formData.prix_place) || 0,
                devise: formData.devise,
                vehicule_marque: formData.vehicule_marque || null,
                vehicule_modele: formData.vehicule_modele || null,
                vehicule_couleur: formData.vehicule_couleur || null,
                description: formData.description || null,
                contact_telephone: formData.contact_telephone || null,
                contact_whatsapp: formData.contact_whatsapp || null,
            };

            const response = await axios.post(buildUrl('/api/covoiturages'), payload, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.data) {
                toast.success('Trajet de covoiturage créé avec succès !');
                navigate(-1);
            }
        } catch (error: any) {
            console.error('Erreur création covoiturage:', error);
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
                        <h1 className="text-xl font-bold text-gray-900">Proposer un Covoiturage</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Point de départ *
                                </label>
                                <Input
                                    value={formData.point_depart}
                                    onChange={(e) => setFormData({ ...formData, point_depart: e.target.value })}
                                    placeholder="Ex: Douala, Carrefour Ange Raphaël"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Destination *
                                </label>
                                <Input
                                    value={formData.point_arrivee}
                                    onChange={(e) => setFormData({ ...formData, point_arrivee: e.target.value })}
                                    placeholder="Ex: Yaoundé, Gare routière"
                                    required
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Date de départ *
                                    </label>
                                    <Input
                                        value={formData.date_depart}
                                        onChange={(e) => setFormData({ ...formData, date_depart: e.target.value })}
                                        type="date"
                                        min={new Date().toISOString().split('T')[0]}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Heure de départ *
                                    </label>
                                    <Input
                                        value={formData.heure_depart}
                                        onChange={(e) => setFormData({ ...formData, heure_depart: e.target.value })}
                                        type="time"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Type de véhicule
                                    </label>
                                    <Input
                                        value={formData.vehicule_marque}
                                        onChange={(e) =>
                                            setFormData({ ...formData, vehicule_marque: e.target.value })
                                        }
                                        placeholder="Ex: Berline"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Marque/Modèle
                                    </label>
                                    <Input
                                        value={formData.vehicule_modele}
                                        onChange={(e) =>
                                            setFormData({ ...formData, vehicule_modele: e.target.value })
                                        }
                                        placeholder="Ex: Toyota Corolla"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nombre de places
                                    </label>
                                    <Input
                                        value={formData.nombre_places}
                                        onChange={(e) => setFormData({ ...formData, nombre_places: e.target.value })}
                                        type="number"
                                        min="1"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Places disponibles
                                    </label>
                                    <Input
                                        value={formData.places_disponibles}
                                        onChange={(e) =>
                                            setFormData({ ...formData, places_disponibles: e.target.value })
                                        }
                                        type="number"
                                        min="0"
                                    />
                                </div>
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
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Prix par place * (XAF)
                                    </label>
                                    <Input
                                        value={formData.prix_place}
                                        onChange={(e) => setFormData({ ...formData, prix_place: e.target.value })}
                                        type="number"
                                        min="0"
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Devise</label>
                                    <Input
                                        value={formData.devise}
                                        onChange={(e) => setFormData({ ...formData, devise: e.target.value })}
                                        placeholder="XAF"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                    rows={3}
                                    placeholder="Informations complémentaires..."
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Téléphone contact
                                    </label>
                                    <Input
                                        value={formData.contact_telephone}
                                        onChange={(e) =>
                                            setFormData({ ...formData, contact_telephone: e.target.value })
                                        }
                                        placeholder="+237 6XX XX XX XX"
                                        type="tel"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        WhatsApp contact
                                    </label>
                                    <Input
                                        value={formData.contact_whatsapp}
                                        onChange={(e) =>
                                            setFormData({ ...formData, contact_whatsapp: e.target.value })
                                        }
                                        placeholder="+237 6XX XX XX XX"
                                        type="tel"
                                    />
                                </div>
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
                                disabled={
                                    loading ||
                                    !formData.point_depart.trim() ||
                                    !formData.point_arrivee.trim() ||
                                    !formData.prix_place.trim()
                                }
                            >
                                {loading ? 'Création...' : 'Créer le Trajet'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

