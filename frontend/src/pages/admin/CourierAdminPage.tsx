import React, { useEffect, useState } from 'react';
import ResponsiveContainer from '@/components/layout/ResponsiveContainer';
import RequireAdminPage from '@/components/security/RequireAdminPage';
import { useUser } from '@/hooks/useUser';
import { useToast } from '@/components/ui/use-toast';
import axios from 'axios';
import { CheckCircle, Clock, FileText, MapPin, Truck, X, User, Mail, Calendar, AlertCircle } from 'lucide-react';

interface CourierApplication {
    id: string;
    user_id: number;
    user_name: string;
    user_email?: string;
    user_avatar?: string;
    status: 'draft' | 'submitted' | 'under_review' | 'approved' | 'rejected';
    submitted_at: string | null;
    reviewed_at: string | null;
    reviewer_id: number | null;
    rejection_reason: string | null;
    profile_data: any;
    documents: any;
    notes: any;
    created_at: string;
    updated_at: string;
}

const CourierAdminPage: React.FC = () => {
    const { user } = useUser();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [applications, setApplications] = useState<CourierApplication[]>([]);
    const [filter, setFilter] = useState<'all' | 'submitted' | 'under_review' | 'approved' | 'rejected'>('all');
    const [selectedApplication, setSelectedApplication] = useState<CourierApplication | null>(null);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [processing, setProcessing] = useState<string | null>(null);

    useEffect(() => {
        if (user?.role !== 'admin') {
            return;
        }
        loadApplications();
    }, [user, filter]);

    const loadApplications = async () => {
        try {
            setLoading(true);
            const statusParam = filter !== 'all' ? `?status=${filter}` : '';
            const response = await axios.get(`/api/courier/applications${statusParam}`);
            const data = response.data;
            
            if (data.applications) {
                setApplications(data.applications);
            } else if (Array.isArray(data)) {
                setApplications(data);
            } else {
                setApplications([]);
            }
        } catch (error: any) {
            console.error('[CourierAdminPage] Erreur chargement candidatures:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les candidatures',
                variant: 'destructive',
            });
            setApplications([]);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async (applicationId: string) => {
        try {
            setProcessing(applicationId);
            const response = await axios.post(`/api/courier/applications/${applicationId}/approve`, {});
            
            if (response.data.success !== false) {
                toast({
                    title: '✅ Succès',
                    description: 'La candidature a été approuvée avec succès',
                });
                setShowDetailModal(false);
                loadApplications();
            } else {
                throw new Error(response.data.message || 'Erreur lors de l\'approbation');
            }
        } catch (error: any) {
            console.error('[CourierAdminPage] Erreur approbation:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible d\'approuver la candidature',
                variant: 'destructive',
            });
        } finally {
            setProcessing(null);
        }
    };

    const handleReject = async (applicationId: string) => {
        if (!rejectionReason.trim()) {
            toast({
                title: 'Erreur',
                description: 'Veuillez indiquer une raison de refus',
                variant: 'destructive',
            });
            return;
        }

        try {
            setProcessing(applicationId);
            const response = await axios.post(`/api/courier/applications/${applicationId}/reject`, {
                rejection_reason: rejectionReason,
            });
            
            if (response.data.success !== false) {
                toast({
                    title: '✅ Succès',
                    description: 'La candidature a été rejetée',
                });
                setShowRejectModal(false);
                setShowDetailModal(false);
                setRejectionReason('');
                loadApplications();
            } else {
                throw new Error(response.data.message || 'Erreur lors du rejet');
            }
        } catch (error: any) {
            console.error('[CourierAdminPage] Erreur rejet:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de rejeter la candidature',
                variant: 'destructive',
            });
        } finally {
            setProcessing(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'approved':
                return 'bg-green-100 text-green-800 border-green-300';
            case 'rejected':
                return 'bg-red-100 text-red-800 border-red-300';
            case 'submitted':
            case 'under_review':
                return 'bg-yellow-100 text-yellow-800 border-yellow-300';
            default:
                return 'bg-gray-100 text-gray-800 border-gray-300';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'draft':
                return 'Brouillon';
            case 'submitted':
                return 'Soumis';
            case 'under_review':
                return 'En examen';
            case 'approved':
                return 'Approuvé';
            case 'rejected':
                return 'Rejeté';
            default:
                return status;
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'approved':
                return <CheckCircle className="w-4 h-4" />;
            case 'rejected':
                return <X className="w-4 h-4" />;
            case 'submitted':
            case 'under_review':
                return <Clock className="w-4 h-4" />;
            default:
                return <FileText className="w-4 h-4" />;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'N/A';
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

    const filters = [
        { value: 'all', label: 'Tous' },
        { value: 'submitted', label: 'Soumis' },
        { value: 'under_review', label: 'En examen' },
        { value: 'approved', label: 'Approuvés' },
        { value: 'rejected', label: 'Rejetés' },
    ] as const;

    return (
        <RequireAdminPage>
            <ResponsiveContainer className="py-8">
                <div className="mb-6">
                    <h2 className="text-2xl font-bold mb-2 text-gray-800">
                        🚚 Gestion des candidatures de coursiers/chauffeurs
                    </h2>
                    <p className="text-gray-600">
                        Validez ou rejetez les demandes d'enregistrement de coursiers et chauffeurs
                    </p>
                </div>

                {/* Filtres */}
                <div className="flex flex-wrap gap-2 mb-6">
                    {filters.map((filterOption) => (
                        <button
                            key={filterOption.value}
                            onClick={() => setFilter(filterOption.value)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                                filter === filterOption.value
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            {filterOption.label}
                        </button>
                    ))}
                </div>

                {/* Liste des candidatures */}
                {loading ? (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                ) : applications.length === 0 ? (
                    <div className="text-center py-12">
                        <FileText className="w-16 h-16 mx-auto text-gray-400 mb-4" />
                        <p className="text-gray-500 text-lg">Aucune candidature trouvée</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {applications.map((application) => (
                            <div
                                key={application.id}
                                className="border rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
                                onClick={() => {
                                    setSelectedApplication(application);
                                    setShowDetailModal(true);
                                }}
                            >
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                                            {application.user_avatar ? (
                                                <img
                                                    src={application.user_avatar}
                                                    alt={application.user_name}
                                                    className="w-10 h-10 rounded-full"
                                                />
                                            ) : (
                                                <User className="w-6 h-6 text-blue-600" />
                                            )}
                                        </div>
                                        <div>
                                            <p className="font-semibold text-gray-800">
                                                {application.user_name}
                                            </p>
                                            {application.user_email && (
                                                <p className="text-sm text-gray-500 flex items-center gap-1">
                                                    <Mail className="w-3 h-3" />
                                                    {application.user_email}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div
                                        className={`px-3 py-1 rounded-full border flex items-center gap-1 ${getStatusColor(
                                            application.status,
                                        )}`}
                                    >
                                        {getStatusIcon(application.status)}
                                        <span className="text-xs font-medium">
                                            {getStatusLabel(application.status)}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                    <span className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        Soumis: {formatDate(application.submitted_at)}
                                    </span>
                                    {application.reviewed_at && (
                                        <span className="flex items-center gap-1">
                                            <CheckCircle className="w-4 h-4" />
                                            Examiné: {formatDate(application.reviewed_at)}
                                        </span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal de détails */}
                {showDetailModal && selectedApplication && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end justify-center z-50">
                        <div className="bg-white rounded-t-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b p-4 flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-800">
                                    Détails de la candidature
                                </h3>
                                <button
                                    onClick={() => setShowDetailModal(false)}
                                    className="text-gray-500 hover:text-gray-700"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>
                            <div className="p-6 space-y-4">
                                {/* Informations candidat */}
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                        <User className="w-5 h-5" />
                                        Candidat
                                    </h4>
                                    <p className="text-gray-800 font-medium">
                                        {selectedApplication.user_name}
                                    </p>
                                    {selectedApplication.user_email && (
                                        <p className="text-gray-600 text-sm mt-1">
                                            {selectedApplication.user_email}
                                        </p>
                                    )}
                                </div>

                                {/* Statut */}
                                <div className="border rounded-lg p-4">
                                    <h4 className="font-semibold text-gray-700 mb-3">Statut</h4>
                                    <div
                                        className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(
                                            selectedApplication.status,
                                        )}`}
                                    >
                                        {getStatusIcon(selectedApplication.status)}
                                        <span className="font-medium">
                                            {getStatusLabel(selectedApplication.status)}
                                        </span>
                                    </div>
                                </div>

                                {/* Informations personnelles */}
                                {selectedApplication.profile_data?.personal && (
                                    <div className="border rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                            <User className="w-5 h-5" />
                                            Informations personnelles
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <p>
                                                <span className="font-medium">Nom:</span>{' '}
                                                {selectedApplication.profile_data.personal.fullName ||
                                                    'N/A'}
                                            </p>
                                            <p>
                                                <span className="font-medium">Téléphone:</span>{' '}
                                                {selectedApplication.profile_data.personal.phone ||
                                                    'N/A'}
                                            </p>
                                            <p>
                                                <span className="font-medium">Adresse:</span>{' '}
                                                {selectedApplication.profile_data.personal.address ||
                                                    'N/A'}
                                            </p>
                                            <p>
                                                <span className="font-medium">Ville:</span>{' '}
                                                {selectedApplication.profile_data.personal.city ||
                                                    'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {/* Moyen de transport */}
                                {selectedApplication.profile_data?.transport && (
                                    <div className="border rounded-lg p-4">
                                        <h4 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                                            <Truck className="w-5 h-5" />
                                            Moyen de transport
                                        </h4>
                                        <div className="space-y-2 text-sm">
                                            <p>
                                                <span className="font-medium">Type:</span>{' '}
                                                {selectedApplication.profile_data.transport
                                                    .vehicleType || 'N/A'}
                                            </p>
                                            {selectedApplication.profile_data.transport
                                                .vehicleBrand && (
                                                <p>
                                                    <span className="font-medium">Marque:</span>{' '}
                                                    {
                                                        selectedApplication.profile_data.transport
                                                            .vehicleBrand
                                                    }
                                                </p>
                                            )}
                                            {selectedApplication.profile_data.transport
                                                .vehicleModel && (
                                                <p>
                                                    <span className="font-medium">Modèle:</span>{' '}
                                                    {
                                                        selectedApplication.profile_data.transport
                                                            .vehicleModel
                                                    }
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {/* Raison du refus */}
                                {selectedApplication.rejection_reason && (
                                    <div className="border rounded-lg p-4 border-red-200 bg-red-50">
                                        <h4 className="font-semibold text-red-700 mb-2 flex items-center gap-2">
                                            <AlertCircle className="w-5 h-5" />
                                            Raison du refus
                                        </h4>
                                        <p className="text-red-600 italic">
                                            {selectedApplication.rejection_reason}
                                        </p>
                                    </div>
                                )}

                                {/* Actions */}
                                {(selectedApplication.status === 'submitted' ||
                                    selectedApplication.status === 'under_review') && (
                                    <div className="flex gap-3 pt-4 border-t">
                                        <button
                                            onClick={() => {
                                                if (
                                                    confirm(
                                                        'Êtes-vous sûr de vouloir approuver cette candidature ?',
                                                    )
                                                ) {
                                                    handleApprove(selectedApplication.id);
                                                }
                                            }}
                                            disabled={processing === selectedApplication.id}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <CheckCircle className="w-5 h-5" />
                                            Approuver
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowRejectModal(true);
                                            }}
                                            disabled={processing === selectedApplication.id}
                                            className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                        >
                                            <X className="w-5 h-5" />
                                            Rejeter
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de rejet */}
                {showRejectModal && selectedApplication && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                        <div className="bg-white rounded-lg w-full max-w-md p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-xl font-bold text-gray-800">
                                    Raison du refus
                                </h3>
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
                                    <button
                                        onClick={() => {
                                            setShowRejectModal(false);
                                            setRejectionReason('');
                                        }}
                                        className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg font-medium hover:bg-gray-50"
                                    >
                                        Annuler
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (selectedApplication) {
                                                handleReject(selectedApplication.id);
                                            }
                                        }}
                                        disabled={
                                            !rejectionReason.trim() || processing !== null
                                        }
                                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        Rejeter
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </ResponsiveContainer>
        </RequireAdminPage>
    );
};

export default CourierAdminPage;

