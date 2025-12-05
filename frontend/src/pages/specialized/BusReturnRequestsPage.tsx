// Page pour afficher et gérer les demandes de retour
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface ReturnTripRequest {
    id: string;
    outbound_payment_id: string;
    return_from: string;
    return_to: string;
    preferred_return_date: string;
    preferred_return_time?: string;
    status: string;
    matched_product_id?: string;
    number_of_seats: number;
    created_at: string;
}

const BusReturnRequestsPage: React.FC = () => {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [requests, setRequests] = useState<ReturnTripRequest[]>([]);

    const loadRequests = async () => {
        try {
            const response = await apiGet('/api/bus-tickets/return-requests');
            const data = await response.json();
            if (data.success && data.requests) {
                setRequests(data.requests);
            }
        } catch (error: any) {
            console.error('[BusReturnRequestsPage] Erreur:', error);
            alert('Impossible de charger les demandes de retour');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadRequests();
    }, []);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'matched': return 'bg-blue-100 text-blue-800';
            case 'completed': return 'bg-green-100 text-green-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending': return 'En attente';
            case 'matched': return 'Bus trouvé !';
            case 'completed': return 'Confirmé';
            case 'cancelled': return 'Annulé';
            default: return status;
        }
    };

    const formatDate = (dateStr: string) => {
        try {
            const date = new Date(dateStr);
            return date.toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'long',
                year: 'numeric',
            });
        } catch {
            return dateStr;
        }
    };

    const handleConfirmReturn = (request: ReturnTripRequest) => {
        if (!request.matched_product_id) {
            alert('Aucun bus matché pour cette demande');
            return;
        }

        if (confirm(`Confirmer votre retour de ${request.return_from} à ${request.return_to} ?`)) {
            // TODO: Naviguer vers écran de confirmation avec sélection de sièges
            alert('Fonctionnalité de confirmation en cours de développement');
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 py-8">
                <div className="max-w-4xl mx-auto px-4">
                    <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Mes demandes de retour</h1>

                {requests.length === 0 ? (
                    <Card>
                        <CardContent className="text-center py-12">
                            <div className="text-6xl mb-4">📥</div>
                            <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                Aucune demande de retour
                            </h3>
                            <p className="text-gray-600">
                                Créez une demande de retour après avoir acheté un ticket aller
                            </p>
                        </CardContent>
                    </Card>
                ) : (
                    <div className="space-y-4">
                        {requests.map((request) => (
                            <Card key={request.id} className="hover:shadow-lg transition">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                <span className="font-semibold text-lg">
                                                    {request.return_from}
                                                </span>
                                            </div>
                                            <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                <span className="font-semibold text-lg">
                                                    {request.return_to}
                                                </span>
                                            </div>
                                        </div>
                                        <span
                                            className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                                                request.status
                                            )}`}
                                        >
                                            {getStatusLabel(request.status)}
                                        </span>
                                    </div>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-2 mb-4">
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <span>📅</span>
                                            <span>
                                                {formatDate(request.preferred_return_date)}
                                                {request.preferred_return_time && (
                                                    <> à {request.preferred_return_time}</>
                                                )}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-gray-600">
                                            <span>👥</span>
                                            <span>{request.number_of_seats} place(s)</span>
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Créée le {formatDate(request.created_at)}
                                        </div>
                                    </div>

                                    {request.status === 'matched' && (
                                        <Button
                                            onClick={() => handleConfirmReturn(request)}
                                            className="w-full"
                                        >
                                            Confirmer le retour
                                        </Button>
                                    )}

                                    {request.status === 'pending' && (
                                        <div className="flex items-center justify-center gap-2 p-3 bg-yellow-50 rounded-lg">
                                            <span>⏳</span>
                                            <span className="text-yellow-800 font-medium">
                                                Recherche d'un bus correspondant...
                                            </span>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusReturnRequestsPage;

