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
import { ROUTES } from "@/routes/AppRoutesRegistry";

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
        // ✅ NOUVEAU: Naviguer vers l'écran de création de partenaire
        navigate(ROUTES.PARTNER_REGISTER);
    };

    const handleEdit = (partner: DeliveryPartner) => {
        // ✅ NOUVEAU: Pour l'édition, on peut aussi naviguer vers l'écran de création avec les données pré-remplies
        // Pour l'instant, on garde juste la suppression et on utilise l'écran de création pour créer de nouveaux partenaires
        toast.error('L\'édition des partenaires sera disponible prochainement via l\'écran de création.');
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
