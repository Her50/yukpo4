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
import { buildUrl } from '../config/api.config';

export default function HopitalForm() {
    const navigate = useNavigate();
    const location = useLocation();
    const { serviceId: serviceIdParam } = useParams<{ serviceId?: string }>();
    const { user } = useUser();
    const serviceId = serviceIdParam ? parseInt(serviceIdParam, 10) : (location.state?.serviceId as number | undefined);

    const [formData, setFormData] = useState({
        nom: '',
        type_etablissement: 'Hôpital',
        adresse: '',
        quartier: '',
        ville: '',
        prestations_medicales: [] as string[],
        banque_sang: false,
        urgences_disponible: false,
        rdv_en_ligne: false,
        telephone: '',
        telephone_urgence: '',
        whatsapp: '',
        email: '',
        site_web: '',
    });

    const [loading, setLoading] = useState(false);
    const [selectedPrestations, setSelectedPrestations] = useState<string[]>([]);

    const typesEtablissement = ['Hôpital', 'Clinique', 'Centre de santé', 'Dispensaire'];
    const prestationsOptions = [
        'Urgences',
        'Consultation générale',
        'Chirurgie',
        'Maternité',
        'Pédiatrie',
        'Cardiologie',
        'Radiologie',
    ];

    const togglePrestation = (prestation: string) => {
        setSelectedPrestations((prev) =>
            prev.includes(prestation)
                ? prev.filter((p) => p !== prestation)
                : [...prev, prestation]
        );
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!serviceId) {
            toast.error('Service ID manquant. Veuillez créer un service d\'abord.');
            return;
        }

        if (!formData.nom.trim()) {
            toast.error('Le nom de l\'établissement est obligatoire');
            return;
        }

        try {
            setLoading(true);

            const payload = {
                service_id: serviceId,
                nom: formData.nom,
                type_etablissement: formData.type_etablissement,
                adresse: formData.adresse || null,
                quartier: formData.quartier || null,
                ville: formData.ville || null,
                gps: null, // À enrichir avec géolocalisation si nécessaire
                prestations_medicales: selectedPrestations.length > 0 ? selectedPrestations : null,
                banque_sang: formData.banque_sang,
                urgences_disponible: formData.urgences_disponible,
                rdv_en_ligne: formData.rdv_en_ligne,
                telephone: formData.telephone || null,
                telephone_urgence: formData.telephone_urgence || null,
                whatsapp: formData.whatsapp || null,
                email: formData.email || null,
                site_web: formData.site_web || null,
            };

            const response = await axios.post(buildUrl('/api/hopitaux'), payload, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem('token')}`,
                },
            });

            if (response.data) {
                toast.success('Établissement de santé enregistré avec succès !');
                navigate(-1);
            }
        } catch (error: any) {
            console.error('Erreur création hôpital:', error);
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
                        <h1 className="text-xl font-bold text-gray-900">Enregistrer un Hôpital/Clinique</h1>
                    </div>
                </div>

                <div className="max-w-4xl mx-auto px-4 py-6">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="bg-white rounded-lg shadow-sm p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Nom de l'établissement *
                                </label>
                                <Input
                                    value={formData.nom}
                                    onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                                    placeholder="Ex: Hôpital Central"
                                    required
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Type d'établissement
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {typesEtablissement.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setFormData({ ...formData, type_etablissement: type })}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${formData.type_etablissement === type
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
                                    Prestations médicales
                                </label>
                                <div className="flex flex-wrap gap-2">
                                    {prestationsOptions.map((prestation) => (
                                        <button
                                            key={prestation}
                                            type="button"
                                            onClick={() => togglePrestation(prestation)}
                                            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedPrestations.includes(prestation)
                                                ? 'bg-indigo-600 text-white'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {prestation}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.banque_sang}
                                        onChange={(e) => setFormData({ ...formData, banque_sang: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Banque de sang</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.urgences_disponible}
                                        onChange={(e) =>
                                            setFormData({ ...formData, urgences_disponible: e.target.checked })
                                        }
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Urgences disponibles</span>
                                </label>

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.rdv_en_ligne}
                                        onChange={(e) => setFormData({ ...formData, rdv_en_ligne: e.target.checked })}
                                        className="w-5 h-5 text-indigo-600 rounded border-gray-300"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Rendez-vous en ligne</span>
                                </label>
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
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Téléphone Urgence
                                </label>
                                <Input
                                    value={formData.telephone_urgence}
                                    onChange={(e) =>
                                        setFormData({ ...formData, telephone_urgence: e.target.value })
                                    }
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
                                    placeholder="hopital@example.com"
                                    type="email"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Site Web</label>
                                <Input
                                    value={formData.site_web}
                                    onChange={(e) => setFormData({ ...formData, site_web: e.target.value })}
                                    placeholder="https://..."
                                    type="url"
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
                                {loading ? 'Enregistrement...' : 'Enregistrer l\'Établissement'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </AppLayout>
    );
}
