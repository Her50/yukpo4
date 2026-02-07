// ✅ NOUVEAU 2026-01-04: Page de gestion des partenaires de livraison (admin uniquement)
// ✅ REFONDU 2026-01-22: Aligné avec le mobile - Ajout gestion candidatures en attente et édition
import AppLayout from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/buttons";
import { useUser } from "@/hooks/useUser";
import axios from "axios";
import { Edit2, Plus, Trash2, Truck, X, CheckCircle, Clock, User, Mail, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS, buildUrl } from "../../config/api.config";
import { ROUTES } from "@/routes/AppRoutesRegistry";
import { isAdminUser } from "@/utils/roleHelpers"; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

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

interface PendingPartner {
    id: number;
    email: string;
    nom_complet?: string;
    partner_type?: string;
    partner_status: string | null;
    created_at: string;
}

const DeliveryPartnersAdminPage = () => {
    const navigate = useNavigate();
    const { user, isLoading } = useUser();
    const [activeTab, setActiveTab] = useState<'pending' | 'approved'>('pending');
    const [partners, setPartners] = useState<DeliveryPartner[]>([]);
    const [pendingPartners, setPendingPartners] = useState<PendingPartner[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingPending, setLoadingPending] = useState(true);
    const [selectedPendingPartner, setSelectedPendingPartner] = useState<PendingPartner | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState<number | null>(null);
    const [editingPartner, setEditingPartner] = useState<DeliveryPartner | null>(null);
    const [editForm, setEditForm] = useState({
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
        location_address: '',
        is_active: true,
    });

    useEffect(() => {
        // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
        if (!isLoading && (!user || !isAdminUser(user))) {
            toast.error('Accès réservé aux administrateurs');
            navigate('/dashboard', { replace: true });
            return;
        }
        if (isAdminUser(user)) {
            if (activeTab === 'pending') {
                loadPendingPartners();
            } else {
                loadPartners();
            }
        }
    }, [user, isLoading, navigate, activeTab]);

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

    const loadPendingPartners = async () => {
        try {
            setLoadingPending(true);
            const token = localStorage.getItem('token');
            const response = await axios.get('/api/admin/partners/pending', {
                headers: { Authorization: `Bearer ${token}` },
            });
            
            // ✅ Gérer la structure de réponse comme le mobile
            let partnersList: PendingPartner[] = [];
            if (response.data && typeof response.data === 'object') {
                if (response.data.data && response.data.data.partners && Array.isArray(response.data.data.partners)) {
                    partnersList = response.data.data.partners;
                } else if (response.data.partners && Array.isArray(response.data.partners)) {
                    partnersList = response.data.partners;
                } else if (Array.isArray(response.data)) {
                    partnersList = response.data;
                }
            }
            
            setPendingPartners(partnersList);
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur chargement candidatures:', error);
            toast.error(error?.response?.data?.error || 'Impossible de charger les candidatures');
            setPendingPartners([]);
        } finally {
            setLoadingPending(false);
        }
    };

    const handleApprove = async (userId: number) => {
        try {
            setProcessing(userId);
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `/api/admin/partners/${userId}/validate`,
                { action: 'approve' },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success !== false) {
                toast.success('Le partenaire a été approuvé avec succès');
                setShowDetailModal(false);
                loadPendingPartners();
                loadPartners();
            } else {
                throw new Error(response.data.message || 'Erreur lors de l\'approbation');
            }
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur approbation:', error);
            toast.error(error?.response?.data?.error || 'Impossible d\'approuver le partenaire');
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (userId: number) => {
        if (!rejectionReason.trim()) {
            toast.error('Veuillez indiquer une raison de refus');
            return;
        }

        try {
            setProcessing(userId);
            const token = localStorage.getItem('token');
            const response = await axios.post(
                `/api/admin/partners/${userId}/validate`,
                { action: 'reject', reason: rejectionReason },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success !== false) {
                toast.success('Le partenaire a été rejeté');
                setShowRejectModal(false);
                setShowDetailModal(false);
                setRejectionReason('');
                loadPendingPartners();
            } else {
                throw new Error(response.data.message || 'Erreur lors du rejet');
            }
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur rejet:', error);
            toast.error(error?.response?.data?.error || 'Impossible de rejeter le partenaire');
        } finally {
            setProcessing(null);
        }
    };

    const handleCreate = () => {
        navigate(ROUTES.PARTNER_REGISTER);
    };

    const handleEdit = (partner: DeliveryPartner) => {
        setEditingPartner(partner);
        setEditForm({
            name: partner.name || '',
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
        setShowEditModal(true);
    };

    const handleSaveEdit = async () => {
        if (!editingPartner || !editForm.name.trim()) {
            toast.error('Le nom est requis');
            return;
        }

        try {
            setProcessing(editingPartner.id);
            const token = localStorage.getItem('token');
            const response = await axios.put(
                `/api/delivery/partners/${editingPartner.id}`,
                editForm,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            
            if (response.data.success !== false) {
                toast.success('Le partenaire a été modifié avec succès');
                setShowEditModal(false);
                setEditingPartner(null);
                loadPartners();
            } else {
                throw new Error(response.data.message || 'Erreur lors de la modification');
            }
        } catch (error: any) {
            console.error('[DeliveryPartnersAdminPage] Erreur modification:', error);
            toast.error(error?.response?.data?.error || 'Impossible de modifier le partenaire');
        } finally {
            setProcessing(null);
        }
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

    const formatDate = (dateString: string) => {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
            });
        } catch {
            return dateString;
        }
    };

    if (isLoading) {
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
                    {activeTab === 'approved' && (
                        <Button onClick={handleCreate} className="flex items-center gap-2">
                            <Plus className="w-5 h-5" />
                            Nouveau partenaire
                        </Button>
                    )}
                </div>

                {/* Onglets */}
                <div className="flex gap-2 mb-6 border-b">
                    <button
                        onClick={() => setActiveTab('pending')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'pending'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Candidatures ({pendingPartners.length})
                    </button>
                    <button
                        onClick={() => setActiveTab('approved')}
                        className={`px-4 py-2 font-medium transition-colors ${
                            activeTab === 'approved'
                                ? 'border-b-2 border-blue-600 text-blue-600'
                                : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Partenaires validés ({partners.length})
                    </button>
                </div>

                {/* Contenu selon l'onglet actif */}
                {activeTab === 'pending' ? (
                    <div>
                        {loadingPending ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : pendingPartners.length === 0 ? (
                            <div className="bg-white rounded-lg shadow-md p-12 text-center">
                                <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                    Aucune candidature en attente
                                </h3>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {pendingPartners.map((partner) => (
                                    <div
                                        key={partner.id}
                                        className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                                        onClick={() => {
                                            setSelectedPendingPartner(partner);
                                            setShowDetailModal(true);
                                        }}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                                                    <User className="w-6 h-6 text-blue-600" />
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-gray-800">
                                                        {partner.nom_complet || partner.email}
                                                    </p>
                                                    <p className="text-sm text-gray-500 flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {partner.email}
                                                    </p>
                                                    {partner.partner_type && (
                                                        <p className="text-sm text-gray-500 mt-1">
                                                            🏷️ Type: {partner.partner_type}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4 text-yellow-600" />
                                                <span className="text-sm text-gray-600">
                                                    {formatDate(partner.created_at)}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div>
                        {loading ? (
                            <div className="flex justify-center items-center py-12">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                            </div>
                        ) : partners.length === 0 ? (
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
                )}

                {/* Modal de détails pour candidature en attente */}
                {showDetailModal && selectedPendingPartner && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" style={{ zIndex: 1000 }}>
                        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-800">Détails de la candidature</h3>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Candidat
                                    </h4>
                                    <p className="text-gray-800 font-medium">
                                        {selectedPendingPartner.nom_complet || selectedPendingPartner.email}
                                    </p>
                                    <p className="text-gray-600 text-sm mt-1 flex items-center gap-1">
                                        <Mail className="w-4 h-4" />
                                        {selectedPendingPartner.email}
                                    </p>
                                    {selectedPendingPartner.partner_type && (
                                        <p className="text-gray-600 text-sm mt-1">
                                            🏷️ Type: {selectedPendingPartner.partner_type}
                                        </p>
                                    )}
                                </div>
                                <div className="flex gap-3 pt-4 border-t">
                                    <Button
                                        onClick={() => handleApprove(selectedPendingPartner.id)}
                                        disabled={processing === selectedPendingPartner.id}
                                        className="flex-1 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        Approuver
                                    </Button>
                                    <Button
                                        onClick={() => setShowRejectModal(true)}
                                        disabled={processing === selectedPendingPartner.id}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
                                    >
                                        <X className="w-5 h-5" />
                                        Rejeter
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de rejet */}
                {showRejectModal && selectedPendingPartner && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-800">Raison du refus</h3>
                                <button
                                    onClick={() => {
                                        setShowRejectModal(false);
                                        setRejectionReason('');
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Indiquez la raison du refus (obligatoire)
                                    </label>
                                    <textarea
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
                                        placeholder="Ex: Documents incomplets, informations manquantes..."
                                        value={rejectionReason}
                                        onChange={(e) => setRejectionReason(e.target.value)}
                                        rows={4}
                                    />
                                </div>
                                <div className="flex gap-3">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowRejectModal(false);
                                            setRejectionReason('');
                                        }}
                                        className="flex-1"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={() => {
                                            if (selectedPendingPartner) {
                                                handleReject(selectedPendingPartner.id);
                                            }
                                        }}
                                        disabled={!rejectionReason.trim() || processing !== null}
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white disabled:opacity-50"
                                    >
                                        Rejeter
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal d'édition */}
                {showEditModal && editingPartner && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-800">Modifier le partenaire</h3>
                                <button
                                    onClick={() => {
                                        setShowEditModal(false);
                                        setEditingPartner(null);
                                    }}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Nom *</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Nom du partenaire"
                                        value={editForm.name}
                                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                                    <textarea
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Description du partenaire"
                                        value={editForm.description}
                                        onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                                        rows={3}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="livraison, pharmacie, etc."
                                        value={editForm.partner_type}
                                        onChange={(e) => setEditForm({ ...editForm, partner_type: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                                    <input
                                        type="email"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="contact@partenaire.com"
                                        value={editForm.contact_email}
                                        onChange={(e) => setEditForm({ ...editForm, contact_email: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Téléphone</label>
                                    <input
                                        type="tel"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="+237 6XX XXX XXX"
                                        value={editForm.contact_phone}
                                        onChange={(e) => setEditForm({ ...editForm, contact_phone: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Adresse</label>
                                    <textarea
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Adresse complète"
                                        value={editForm.address}
                                        onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                                        rows={2}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Ville</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Ville"
                                            value={editForm.city}
                                            onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Pays *</label>
                                        <input
                                            type="text"
                                            className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Cameroun, Sénégal, etc."
                                            value={editForm.country}
                                            onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Continent</label>
                                    <input
                                        type="text"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Afrique, Europe, etc."
                                        value={editForm.continent}
                                        onChange={(e) => setEditForm({ ...editForm, continent: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Site web</label>
                                    <input
                                        type="url"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://..."
                                        value={editForm.website}
                                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">URL du logo</label>
                                    <input
                                        type="url"
                                        className="w-full border rounded-lg p-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://..."
                                        value={editForm.logo_url}
                                        onChange={(e) => setEditForm({ ...editForm, logo_url: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={editForm.is_active}
                                            onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                                            className="w-4 h-4"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Partenaire actif</span>
                                    </label>
                                </div>
                                <div className="flex gap-3 pt-4 border-t">
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setEditingPartner(null);
                                        }}
                                        className="flex-1"
                                    >
                                        Annuler
                                    </Button>
                                    <Button
                                        onClick={handleSaveEdit}
                                        disabled={!editForm.name.trim() || processing === editingPartner.id}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                                    >
                                        {processing === editingPartner.id ? 'Enregistrement...' : 'Enregistrer'}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AppLayout>
    );
};

export default DeliveryPartnersAdminPage;
