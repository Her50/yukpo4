import BusSeatSelector from '@/components/ui/BusSeatSelector';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import React, { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { apiPost } from '../../services/apiService';

const BusTicketBookingPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { productId } = useParams<{ productId: string }>();
    const ticketData = location.state?.ticketData;
    // ✅ NOUVEAU: Infos retour pour aller-retour
    const isRoundTrip = location.state?.isRoundTrip || false;
    const returnDate = location.state?.returnDate;
    const returnTime = location.state?.returnTime;

    const [showSeatSelector, setShowSeatSelector] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleSelectSeats = () => {
        setShowSeatSelector(true);
    };

    const handleReserve = async (selectedSeats: any[], totalPrice: number) => {
        if (!productId) return;

        try {
            setLoading(true);
            setShowSeatSelector(false);

            const seatsPayload = selectedSeats.map((seat) => ({
                seat_id: seat.seat_id,
                seat_number: seat.seat_number,
                passenger_name: 'Passager',
            }));

            const response = await apiPost('/api/bus-tickets/reservations', {
                product_id: productId,
                seats: seatsPayload,
            });

            const data = await response.json();
            if (data.success) {
                const reservations = data.data?.reservations || [];
                if (confirm('Réservation créée ! Voulez-vous payer maintenant ?')) {
                    navigate(`/bus-tickets/payment/${productId}`, {
                        state: {
                            reservationIds: reservations.map((r: any) => r.reservation_id),
                            isRoundTrip,
                            returnDate,
                            returnTime,
                        }
                    });
                }
            } else {
                alert(data.error || 'Erreur');
            }
        } catch (error: any) {
            console.error('[BusTicketBookingPage] Erreur:', error);
            alert('Erreur lors de la réservation');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Réserver des places</h1>

                {ticketData && (
                    <Card className="mb-6">
                        <CardHeader>
                            <CardTitle>{ticketData.agency_nom}</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-2 mb-4">
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                    <span>{ticketData.departure_city}</span>
                                    <span className="text-sm text-gray-500">{ticketData.departure_time?.substring(0, 5)}</span>
                                </div>
                                <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                                <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    <span>{ticketData.arrival_city}</span>
                                </div>
                            </div>
                            <div className="text-right">
                                <p className="text-xl font-bold text-blue-600">
                                    {ticketData.ticket_price?.toLocaleString('fr-FR')} FCFA
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                <Card>
                    <CardHeader>
                        <CardTitle>Sélectionner les places</CardTitle>
                        <p className="text-sm text-gray-600">{ticketData?.available_seats || 0} place(s) disponible(s)</p>
                    </CardHeader>
                    <CardContent>
                        <Button onClick={handleSelectSeats} disabled={loading} className="w-full">
                            Choisir les places
                        </Button>
                    </CardContent>
                </Card>
            </div>

            {showSeatSelector && productId && ticketData && (
                <BusSeatSelector
                    isOpen={showSeatSelector}
                    onClose={() => setShowSeatSelector(false)}
                    onSelectSeat={(seatLabel) => {
                        // Le composant gère la sélection
                    }}
                />
            )}
        </div>
    );
};

export default BusTicketBookingPage;

