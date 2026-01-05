// ✅ NOUVEAU 2026-01-04: Page de gestion des partenaires de livraison (admin uniquement)
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/buttons";
import { useUser } from "@/hooks/useUser";
import axios from "axios";
import { Edit2, Plus, Trash2, Truck } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS, buildUrl } from "../../config/api.config";

interface DeliveryPartner {
    id: number;
    name: string;
    description?: string;
    partner_type?: string;
    contact_email?: string;
    contact_phone?: string;
    address?: string;
    city?: string;
    country: string;
    continent?: string;
    website?: string;
    logo_url?: string;
    location_latitude?: number;
    location_longitude?: number;
    location_address?: string;
    is_active: boolean;
    created_by?: number;
    created_at: string;
    updated_at: string;
}

const DeliveryPartnersAdminPage = () => {
    const navigate = useNavigate();
    const { user, isLoading } = useUser();
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        partner_type: 'livraison',
        contact_email: '',
        contact_phone: '',
        address: '',
        city: '',
        country: '',
        continent: '',
        website: '',
        logo_url: '',
        location_latitude: undefined as number | undefined,
        location_longitude: undefined as number | undefined,
        location_address: '' as string | undefined,
        is_active: true,
    });

    const partnerTypes = [
        { value: 'livraison', label: 'Livraison' },
        { value: 'pharmacie', label: 'Pharmacie' },
        { value: 'hopital', label: 'Hôpital' },
        { value: 'laboratoire', label: 'Laboratoire' },
        { value: 'agence de voyage', label: 'Agence de voyage' },
        { value: 'demenagement', label: 'Déménagement' },
        { value: 'transport', label: 'Transport' },
        { value: 'assureur', label: 'Assureur' },
        { value: 'supermarche', label: 'Supermarché' },
        { value: 'telecom', label: 'Télécom' },
    ];

    useEffect(() => {
        if (!isLoading && (!user || user.role !== 'admin')) {
            toast.error('Accès réservé aux administrateurs');
            navigate('/dashboard', { replace: true });
            return;
        }
        if (user?.role === 'admin') {
            loadPartners();
        }
    }, [user, isLoading, navigate]);

    const loadPartners = async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const response = await axios.get(
                buildUrl(API_ENDPOINTS.DELIVERY_PARTNERS || '/api/delivery/partners'),
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            const partnersList = response.data?.partners || response.data?.data?.partners || [];
            setPartners(partnersList);
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur chargement partenaires:', error);
            toast.error(error?.response?.data?.error || 'Impossible de charger les partenaires');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setEditingPartner(null);
        setFormData({
            name: '',
            description: '',
            partner_type: 'livraison',
            contact_email: '',
            contact_phone: '',
            address: '',
            city: '',
            country: '',
            continent: '',
            website: '',
            logo_url: '',
            location_latitude: undefined,
            location_longitude: undefined,
            location_address: '',
            is_active: true,
        });
        setShowForm(true);
    };

    const handleEdit = (partner: DeliveryPartner) => {
        setEditingPartner(partner);
        setFormData({
            name: partner.name,
            description: partner.description || '',
            partner_type: partner.partner_type || 'livraison',
            contact_email: partner.contact_email || '',
            contact_phone: partner.contact_phone || '',
            address: partner.address || '',
            city: partner.city || '',
            country: partner.country || '',
            continent: partner.continent || '',
            website: partner.website || '',
            logo_url: partner.logo_url || '',
            location_latitude: partner.location_latitude,
            location_longitude: partner.location_longitude,
            location_address: partner.location_address || '',
            is_active: partner.is_active,
        });
        setShowForm(true);
    };

    const handleDelete = async (partnerId: number) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce partenaire ?')) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(
                buildUrl(`${API_ENDPOINTS.DELIVERY_PARTNERS || '/api/delivery/partners'}/${partnerId}`),
                {
                    headers: { Authorization: `Bearer ${token}` },
                }
            );
            toast.success('Partenaire supprimé avec succès');
            loadPartners();
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur suppression:', error);
            toast.error(error?.response?.data?.error || 'Impossible de supprimer le partenaire');
        }
    };

    const handleSave = async () => {
        if (!formData.name.trim()) {
            toast.error('Le nom est requis');
            return;
        }
        if (!formData.country.trim()) {
            toast.error('Le pays est requis');
            return;
        }

        try {
            const token = localStorage.getItem('token');
            if (editingPartner) {
                await axios.put(
                    buildUrl(`${API_ENDPOINTS.DELIVERY_PARTNERS || '/api/delivery/partners'}/${editingPartner.id}`),
                    formData,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                toast.success('Partenaire mis à jour avec succès');
            } else {
                await axios.post(
                    buildUrl(API_ENDPOINTS.DELIVERY_PARTNERS || '/api/delivery/partners'),
                    formData,
                    {
                        headers: { Authorization: `Bearer ${token}` },
                    }
                );
                toast.success('Partenaire créé avec succès');
            }
            setShowForm(false);
            loadPartners();
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur sauvegarde:', error);
            toast.error(error?.response?.data?.error || 'Impossible de sauvegarder le partenaire');
        }
    };

    if (isLoading || loading) {
        return (
            <AppLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Chargement...</p>
                    </div>
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout>
            <div className="max-w-6xl mx-auto p-6">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-3">
                        <Truck className="w-8 h-8 text-blue-600" />
                        <h1 className="text-3xl font-bold text-gray-900">Gestion des partenaires</h1>
                    </div>
                    <Button onClick={handleCreate} className="flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Nouveau partenaire
                    </Button>
                </div>

                {showForm && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <h2 className="text-xl font-semibold mb-4">
                            {editingPartner ? 'Modifier le partenaire' : 'Nouveau partenaire'}
                        </h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nom *
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Nom du partenaire"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Description
                                </label>
                                <textarea
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Description du partenaire"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Type de partenaire *
                                </label>
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                                    {partnerTypes.map((type) => (
                                        <button
                                            key={type.value}
                                            type="button"
                                            className={`px-4 py-2 rounded-lg border transition-colors ${
                                                formData.partner_type === type.value
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:border-blue-500'
                                            }`}
                                            onClick={() => setFormData({ ...formData, partner_type: type.value })}
                                        >
                                            {type.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Adresse de localisation
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Rechercher l'adresse du partenaire..."
                                    value={formData.location_address || ''}
                                    onChange={(e) => setFormData({ ...formData, location_address: e.target.value })}
                                />
                                {formData.location_address && (
                                    <p className="text-sm text-gray-500 mt-1">
                                        📍 {formData.location_address}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Email de contact
                                    </label>
                                    <input
                                        type="email"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="contact@partenaire.com"
                                        value={formData.contact_email}
                                        onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Téléphone de contact
                                    </label>
                                    <input
                                        type="tel"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="+237 6XX XXX XXX"
                                        value={formData.contact_phone}
                                        onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Adresse
                                </label>
                                <input
                                    type="text"
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Adresse complète"
                                    value={formData.address}
                                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Ville
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Ville"
                                        value={formData.city}
                                        onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Pays *
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Pays"
                                        value={formData.country}
                                        onChange={(e) => setFormData({ ...formData, country: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Continent
                                    </label>
                                    <input
                                        type="text"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Afrique, Europe, Asie..."
                                        value={formData.continent}
                                        onChange={(e) => setFormData({ ...formData, continent: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Site web
                                    </label>
                                    <input
                                        type="url"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="https://..."
                                        value={formData.website}
                                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        URL du logo
                                    </label>
                                    <input
                                        type="url"
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="https://..."
                                        value={formData.logo_url}
                                        onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium text-gray-700">Actif</span>
                                </label>
                            </div>
                            <div className="flex gap-3 pt-4">
                                <Button
                                    variant="outline"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1"
                                >
                                    Annuler
                                </Button>
                                <Button onClick={handleSave} className="flex-1">
                                    {editingPartner ? 'Modifier' : 'Créer'}
                                </Button>
                            </div>
                        </div>
                    </div>
                )}

                {partners.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-md p-12 text-center">
                        <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                            Aucun partenaire enregistré
                        </h3>
                        <p className="text-gray-600 mb-6">
                            Cliquez sur le bouton "Nouveau partenaire" pour créer un partenaire
                        </p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {partners.map((partner) => (
                            <div key={partner.id} className="bg-white rounded-lg shadow-md p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                            {partner.name}
                                        </h3>
                                        {partner.description && (
                                            <p className="text-gray-600 mb-3">{partner.description}</p>
                                        )}
                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                            {partner.partner_type && (
                                                <span>🏷️ Type: {partner.partner_type}</span>
                                            )}
                                            {partner.city && partner.country && (
                                                <span>📍 {partner.city}, {partner.country}</span>
                                            )}
                                            {partner.contact_phone && (
                                                <span>📞 {partner.contact_phone}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="ml-4">
                                        {partner.is_active ? (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                                                Actif
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                                                Inactif
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-3 pt-4 border-t border-gray-200">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleEdit(partner)}
                                        className="flex items-center gap-2"
                                    >
                                        <Edit2 className="w-4 h-4" />
                                        Modifier
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleDelete(partner.id)}
                                        className="flex items-center gap-2 text-red-600 border-red-300 hover:bg-red-50"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Supprimer
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default DeliveryPartnersAdminPage;

