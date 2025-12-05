import AppLayout from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/buttons/Button';
import { Input } from '@/components/ui/input';
import { useUser } from '@/hooks/useUser';
import axios from 'axios';
import { ArrowLeft, Droplet, Heart, Phone } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { buildUrl } from '../config/api.config';

const GROUPES_SANGUINS = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];

export default function BanqueSangForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { serviceId: serviceIdParam } = useParams<{ serviceId?: string }>();
    const { user } = useUser();
    const serviceId = serviceIdParam ? parseInt(serviceIdParam, 10) : (location.state?.serviceId as number | undefined);
    const hopitalId = location.state?.hopitalId; // Optionnel

    const [formData, setFormData] = useState({
        nom: '',
        adresse: '',
        quartier: '',
        ville: '',
        accepte_dons: true,
        accepte_demandes: true,
        urgence_24h: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
    });

    const [loading, setLoading] = useState(false);
    const [stocks, setStocks] = useState<Record<string, { quantite: string; unite: string }>>({});
    const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);

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

    const updateStock = (groupe: string, field: 'quantite' | 'unite', value: string) => {
        setStocks((prev) => ({
            ...prev,
            [groupe]: {
                ...prev[groupe],
                [field]: value,
                quantite: field === 'quantite' ? value : prev[groupe]?.quantite || '',
                unite: field === 'unite' ? value : prev[groupe]?.unite || 'poches',
            },
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            toast.error('Le nom de la banque de sang est obligatoire');
            return;
        }

        try {
            setLoading(true);

            // Construire stocks_groupes_sanguins JSONB
            const stocks_json: Record<string, any> = {};
            for (const [groupe, stock] of Object.entries(stocks)) {
                if (stock.quantite && parseInt(stock.quantite) > 0) {
                    stocks_json[groupe] = {
                        quantite: parseInt(stock.quantite),
                        unite: stock.unite || 'poches',
                        derniere_maj: new Date().toISOString(),
                    };
                }
            }

            const token = localStorage.getItem('token');
            const payload = {
                service_id: serviceId,
                hopital_id: hopitalId || null,
                nom: formData.nom,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: userLocation
                    ? `${userLocation.lat},${userLocation.lng}`
                    : null,
                stocks_groupes_sanguins: Object.keys(stocks_json).length > 0 ? stocks_json : null,
                accepte_dons: formData.accepte_dons,
                accepte_demandes: formData.accepte_demandes,
                urgence_24h: formData.urgence_24h,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
            };

            const response = await axios.post(
                buildUrl('/api/banques-sang'),
                payload,
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );

            if (response.data.success || response.data.id) {
                toast.success('Banque de sang enregistrée avec succès !');
                navigate(-1);
            } else {
                toast.error(response.data.error || 'Impossible d\'enregistrer la banque de sang');
            }
        } catch (error: any) {
            console.error('Erreur création banque de sang:', error);
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
                        <Droplet className="w-6 h-6 text-red-600" />
                        <h1 className="text-2xl font-bold text-gray-900">Enregistrer une Banque de Sang</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Informations de base</h2>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom de la banque de sang *
                                    </label>
                                    <Input
                                        value={formData.nom}
                                        onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                        placeholder="Ex: Banque de Sang Centrale"
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
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">
                                Stocks par Groupe Sanguin
                            </h2>
                            <p className="text-sm text-gray-600 mb-6">
                                Indiquez les quantités disponibles pour chaque groupe
                            </p>

                            <div className="space-y-3">
                                {GROUPES_SANGUINS.map((groupe) => (
                                    <div key={groupe} className="flex items-center gap-4 p-3 bg-red-50 rounded-lg border border-red-100">
                                        <div className="w-16">
                                            <span className="text-lg font-bold text-red-600">{groupe}</span>
                                        </div>
                                        <div className="flex-1 grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Quantité</label>
                                                <Input
                                                    type="number"
                                                    value={stocks[groupe]?.quantite || ''}
                                                    onChange={(e) => updateStock(groupe, 'quantite', e.target.value)}
                                                    placeholder="0"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-600 mb-1">Unité</label>
                                                <Input
                                                    value={stocks[groupe]?.unite || 'poches'}
                                                    onChange={(e) => updateStock(groupe, 'unite', e.target.value)}
                                                    placeholder="poches"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                            <h2 className="text-lg font-semibold text-gray-900 mb-4">Services</h2>

                            <div className="space-y-4">
                                <div className="flex items-center justify-between py-2">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Heart className="w-4 h-4 text-green-600" />
                                        Accepte les dons
                                    </label>
                                    <input
                                        type="checkbox"
                                        checked={formData.accepte_dons}
                                        onChange={(e) => setFormData({ ...formData, accepte_dons: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                        <Droplet className="w-4 h-4 text-blue-600" />
                                        Accepte les demandes
                                    </label>
                                    <input
                                        type="checkbox"
                                        checked={formData.accepte_demandes}
                                        onChange={(e) =>
                                            setFormData({ ...formData, accepte_demandes: e.target.checked })
                                        }
                                        className="w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
                                    />
                                </div>

                                <div className="flex items-center justify-between py-2">
                                    <label className="text-sm font-medium text-gray-700">
                                        Urgence 24h/24
                                    </label>
                                    <input
                                        type="checkbox"
                                        checked={formData.urgence_24h}
                                        onChange={(e) => setFormData({ ...formData, urgence_24h: e.target.checked })}
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
                                        Téléphone Urgence
                                    </label>
                                    <Input
                                        type="tel"
                                        value={formData.telephone_urgence}
                                        onChange={(e) =>
                                            setFormData({ ...formData, telephone_urgence: e.target.value })
                                        }
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
                                        Email
                                    </label>
                                    <Input
                                        type="email"
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        placeholder="banque@example.com"
                                    />
                                </div>
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
                                {loading ? 'Enregistrement...' : 'Enregistrer la Banque de Sang'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}

