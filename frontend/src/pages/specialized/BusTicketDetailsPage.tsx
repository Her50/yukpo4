import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import QRCode from 'qrcode.react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface TicketDetails {
    payment_id: string;
    product_id: string;
    departure_city: string;
    arrival_city: string;
    departure_date: string;
    departure_time: string;
    return_date?: string;
    return_time?: string;
    is_round_trip?: boolean;
    ticket_price: number;
    number_of_tickets: number;
    total_amount: number;
    currency: string;
    payment_status: string;
    reservation_ids: string[];
    reservations_details?: Array<{
        seat_number: number;
        passenger_name?: string;
    }>;
}

const BusTicketDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { paymentId } = useParams<{ paymentId: string }>();
    const [loading, setLoading] = useState(true);
    const [ticket, setTicket] = useState<TicketDetails | null>(null);

    useEffect(() => {
        if (paymentId) {
            loadTicketDetails();
        }
    }, [paymentId]);

    const loadTicketDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bus-tickets/ticket/${paymentId}`);
            const data = await response.json();

            if (data.success && data.ticket) {
                setTicket(data.ticket as TicketDetails);
            } else {
                alert('Ticket non trouvé');
                navigate(-1);
            }
        } catch (error: any) {
            console.error('[BusTicketDetailsPage] Erreur:', error);
            alert('Erreur');
            navigate(-1);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!ticket) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Ticket non trouvé</p>
            </div>
        );
    }

    const qrData = JSON.stringify({
        id: ticket.reservation_ids[0],
        payment_id: ticket.payment_id,
        product_id: ticket.product_id,
        timestamp: new Date().toISOString(),
        type: 'bus_ticket',
    });

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <button
                    onClick={() => navigate(-1)}
                    className="text-blue-600 hover:text-blue-700 mb-4"
                >
                    ← Retour
                </button>
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Mon ticket</h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Code QR d'embarquement</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                        <div className="bg-white p-4 rounded-lg mb-4">
                            <QRCode value={qrData} size={200} />
                        </div>
                        <p className="text-sm text-gray-600">Présentez ce code QR lors de l'embarquement</p>
                    </CardContent>
                </Card>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Informations du trajet</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                <span className="font-semibold">{ticket.departure_city}</span>
                                <span className="text-sm text-gray-500">{ticket.departure_time.substring(0, 5)}</span>
                            </div>
                            <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                <span className="font-semibold">{ticket.arrival_city}</span>
                            </div>
                        </div>
                        <div className="text-sm text-gray-600">
                            {new Date(ticket.departure_date).toLocaleDateString('fr-FR', {
                                weekday: 'long',
                                day: 'numeric',
                                month: 'long',
                            })}
                        </div>
                    </CardContent>
                </Card>

                {ticket.reservations_details && ticket.reservations_details.length > 0 && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>Places réservées</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                {ticket.reservations_details.map((reservation, index) => (
                                    <div key={index} className="flex justify-between items-center">
                                        <span className="font-semibold">Place {reservation.seat_number}</span>
                                        {reservation.passenger_name && (
                                            <span className="text-sm text-gray-600">{reservation.passenger_name}</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Informations de paiement</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <span className="text-gray-600">Nombre de tickets</span>
                                <span className="font-semibold">{ticket.number_of_tickets}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-600">Prix unitaire</span>
                                <span className="font-semibold">
                                    {ticket.ticket_price.toLocaleString('fr-FR')} {ticket.currency}
                                </span>
                            </div>
                            <div className="flex justify-between pt-2 border-t">
                                <span className="font-bold">Total payé</span>
                                <span className="font-bold text-blue-600 text-lg">
                                    {ticket.total_amount.toLocaleString('fr-FR')} {ticket.currency}
                                </span>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* ✅ NOUVEAU: Bouton créer demande retour si aller simple */}
                {ticket.payment_status === 'completed' && !ticket.is_round_trip && (
                    <div className="mt-6">
                        <button
                            onClick={() => navigate(`/bus-tickets/return-request/create/${ticket.payment_id}`)}
                            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition"
                        >
                            Créer une demande de retour
                        </button>
                    </div>
                )}

                {/* Affichage info retour si aller-retour */}
                {ticket.is_round_trip && ticket.return_date && (
                    <Card className="mb-6 mt-6">
                        <CardHeader>
                            <CardTitle>Informations retour</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span className="font-semibold">{ticket.arrival_city}</span>
                                    {ticket.return_time && (
                                        <span className="text-sm text-gray-500">{ticket.return_time.substring(0, 5)}</span>
                                    )}
                                </div>
                                <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span className="font-semibold">{ticket.departure_city}</span>
                                </div>
                                <div className="text-sm text-gray-600">
                                    Date de retour: {ticket.return_date}
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
};

export default BusTicketDetailsPage;

