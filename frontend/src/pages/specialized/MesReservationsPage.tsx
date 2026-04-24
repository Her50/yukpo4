// ✅ NOUVEAU: Page web de liste des réservations

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPatch } from '../../services/apiService';

interface Reservation {
    id: number;
    service_id: number;
    service_type: string;
    reservation_type: string;
    status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
    requested_date: string | null;
    confirmed_date: string | null;
    amount: number | null;
    currency: string | null;
    payment_status: string | null;
    created_at: string;
    details: any;
}

const MesReservationsPage: React.FC = () => {
    const navigate = useNavigate();
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState<string | null>(null);

    useEffect(() => {
        loadReservations();
    }, [statusFilter]);

    const loadReservations = async () => {
        try {
            const params = statusFilter ? `?status=${statusFilter}` : '';
            const response = await apiGet(`/api/specialized-services/reservations${params}`);

            if (response.success) {
                setReservations((response.data as any).reservations || []);
            }
        } catch (error: any) {
            console.error('[MesReservationsPage] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCancel = async (reservationId: number) => {
        if (!confirm('Êtes-vous sûr de vouloir annuler cette réservation ?')) {
            return;
        }

        try {
            const response = await apiPatch(
                `/api/specialized-services/reservations/${reservationId}/cancel`,
                { reason: 'Annulé par le client' }
            );

            if (response.success) {
                alert('Réservation annulée');
                loadReservations();
            } else {
                alert(response.error || 'Erreur');
            }
        } catch (error: any) {
            console.error('[MesReservationsPage] Erreur annulation:', error);
            alert('Une erreur est survenue');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed':
                return 'bg-green-100 text-green-800';
            case 'pending':
                return 'bg-yellow-100 text-yellow-800';
            case 'completed':
                return 'bg-blue-100 text-blue-800';
            case 'cancelled':
                return 'bg-red-100 text-red-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'pending':
                return 'En attente';
            case 'confirmed':
                return 'Confirmée';
            case 'completed':
                return 'Terminée';
            case 'cancelled':
                return 'Annulée';
            default:
                return status;
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Non spécifié';
        try {
            const date = new Date(dateString);
            return date.toLocaleString('fr-FR');
        } catch {
            return dateString;
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center">Chargement...</div>
            </div>
        );
    }

    return (
        <div className="container mx-auto px-4 py-8">
            <h1 className="text-3xl font-bold mb-6">Mes Réservations</h1>

            <div className="flex gap-4 mb-6">
                <button
                    onClick={() => setStatusFilter(null)}
                    className={`px-4 py-2 rounded-lg ${statusFilter === null
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                >
                    Toutes
                </button>
                <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-4 py-2 rounded-lg ${statusFilter === 'pending'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                >
                    En attente
                </button>
                <button
                    onClick={() => setStatusFilter('confirmed')}
                    className={`px-4 py-2 rounded-lg ${statusFilter === 'confirmed'
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                >
                    Confirmées
                </button>
            </div>

            <div className="space-y-4">
                {reservations.length === 0 ? (
                    <div className="text-center py-12 text-gray-500">
                        Aucune réservation
                    </div>
                ) : (
                    reservations.map((reservation) => (
                        <div
                            key={reservation.id}
                            className="bg-white rounded-lg shadow p-6 border-l-4 border-blue-500"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-lg font-semibold">
                                        {reservation.service_type.toUpperCase()}
                                    </h3>
                                    <p className="text-sm text-gray-500">
                                        Type: {reservation.reservation_type}
                                    </p>
                                </div>
                                <span
                                    className={`px-3 py-1 rounded-full text-sm font-semibold ${getStatusColor(
                                        reservation.status
                                    )}`}
                                >
                                    {getStatusLabel(reservation.status)}
                                </span>
                            </div>

                            <div className="space-y-2 mb-4">
                                <p>
                                    <span className="font-medium">Date demandée:</span>{' '}
                                    {formatDate(reservation.requested_date)}
                                </p>
                                {reservation.confirmed_date && (
                                    <p>
                                        <span className="font-medium">Date confirmée:</span>{' '}
                                        {formatDate(reservation.confirmed_date)}
                                    </p>
                                )}
                                {reservation.amount && (
                                    <p>
                                        <span className="font-medium">Montant:</span>{' '}
                                        {reservation.amount} {reservation.currency || 'XOF'}
                                    </p>
                                )}
                            </div>

                            <div className="flex gap-4">
                                {reservation.status === 'pending' && (
                                    <button
                                        onClick={() => handleCancel(reservation.id)}
                                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                                    >
                                        Annuler
                                    </button>
                                )}

                                {reservation.status === 'confirmed' &&
                                    reservation.amount &&
                                    reservation.payment_status !== 'paid' && (
                                        <button
                                            onClick={() =>
                                                navigate(`/payment?reservationId=${reservation.id}`)
                                            }
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            Payer
                                        </button>
                                    )}

                                <button
                                    onClick={() =>
                                        navigate(`/services/${reservation.service_id}`)
                                    }
                                    className="px-4 py-2 text-blue-600 hover:underline"
                                >
                                    Voir le service
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default MesReservationsPage;

