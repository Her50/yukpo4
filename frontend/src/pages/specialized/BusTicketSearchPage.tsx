import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface BusTicketResult {
    product_id: string;
    agency_nom: string;
    departure_city?: string;
    arrival_city?: string;
    departure_time?: string;
    ticket_price?: number;
    available_seats: number;
    distance_km?: number;
}

const BusTicketSearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [departureCity, setDepartureCity] = useState('');
    const [arrivalCity, setArrivalCity] = useState('');
    const [departureDate, setDepartureDate] = useState('');
    const [loading, setLoading] = useState(false);
    const [results, setResults] = useState<BusTicketResult[]>([]);
    // ✅ NOUVEAU: Options aller-retour
    const [isRoundTrip, setIsRoundTrip] = useState(false);
    const [returnDate, setReturnDate] = useState('');
    const [returnTime, setReturnTime] = useState('');

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!departureCity.trim() || !arrivalCity.trim()) {
            alert('Veuillez renseigner la ville de départ et d\'arrivée');
            return;
        }

        try {
            setLoading(true);
            const dateStr = departureDate || new Date().toISOString().split('T')[0];

            const params = new URLSearchParams({
                departure_city: departureCity.trim(),
                arrival_city: arrivalCity.trim(),
                departure_date: dateStr,
                radius_km: '100',
                min_seats: '1',
            });

            const response = await apiGet(`/api/bus-tickets/search?${params.toString()}`);
            const data = await response.json();

            if (data.results) {
                setResults(data.results);
                if (data.results.length === 0) {
                    alert('Aucun trajet trouvé');
                }
            }
        } catch (error: any) {
            console.error('[BusTicketSearchPage] Erreur:', error);
            alert('Impossible de rechercher les tickets');
        } finally {
            setLoading(false);
        }
    };

    const formatPrice = (price?: number) => {
        if (!price) return 'Prix non disponible';
        return `${price.toLocaleString('fr-FR')} FCFA`;
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Rechercher un trajet</h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Critères de recherche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Ville de départ *</Label>
                                    <Input
                                        value={departureCity}
                                        onChange={(e) => setDepartureCity(e.target.value)}
                                        placeholder="Ex: Yaoundé"
                                        required
                                    />
                                </div>
                                <div>
                                    <Label>Ville d'arrivée *</Label>
                                    <Input
                                        value={arrivalCity}
                                        onChange={(e) => setArrivalCity(e.target.value)}
                                        placeholder="Ex: Douala"
                                        required
                                    />
                                </div>
                            </div>
                            <div>
                                <Label>Date de départ</Label>
                                <Input
                                    type="date"
                                    value={departureDate}
                                    onChange={(e) => setDepartureDate(e.target.value)}
                                    min={new Date().toISOString().split('T')[0]}
                                />
                            </div>
                            {/* ✅ NOUVEAU: Option Aller-Retour */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="roundTrip"
                                    checked={isRoundTrip}
                                    onChange={(e) => setIsRoundTrip(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <Label htmlFor="roundTrip" className="cursor-pointer">
                                    Aller-Retour
                                </Label>
                            </div>
                            {isRoundTrip && (
                                <>
                                    <div>
                                        <Label>Date de retour</Label>
                                        <Input
                                            type="date"
                                            value={returnDate}
                                            onChange={(e) => setReturnDate(e.target.value)}
                                            min={departureDate || new Date().toISOString().split('T')[0]}
                                        />
                                    </div>
                                    <div>
                                        <Label>Heure de retour (optionnel)</Label>
                                        <Input
                                            type="time"
                                            value={returnTime}
                                            onChange={(e) => setReturnTime(e.target.value)}
                                            placeholder="HH:MM"
                                        />
                                    </div>
                                </>
                            )}
                            <Button type="submit" disabled={loading}>
                                {loading ? 'Recherche en cours...' : 'Rechercher'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {loading && (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">Recherche en cours...</p>
                    </div>
                )}

                {!loading && results.length > 0 && (
                    <div>
                        <h2 className="text-xl font-bold text-gray-900 mb-4">
                            {results.length} trajet(s) trouvé(s)
                        </h2>
                        <div className="space-y-4">
                            {results.map((result) => (
                                <Card
                                    key={result.product_id}
                                    className="cursor-pointer hover:shadow-lg transition"
                                    onClick={() => navigate(`/bus-tickets/booking/${result.product_id}`, {
                                        state: {
                                            ticketData: result,
                                            isRoundTrip,
                                            returnDate: isRoundTrip ? returnDate : undefined,
                                            returnTime: isRoundTrip ? returnTime : undefined,
                                        }
                                    })}
                                >
                                    <CardHeader>
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <CardTitle>{result.agency_nom}</CardTitle>
                                                <div className="mt-4 space-y-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                                                        <span className="font-semibold">{result.departure_city || 'Départ'}</span>
                                                        <span className="text-sm text-gray-500">{result.departure_time?.substring(0, 5)}</span>
                                                    </div>
                                                    <div className="w-0.5 h-6 bg-gray-300 ml-1.5"></div>
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                                        <span className="font-semibold">{result.arrival_city || 'Arrivée'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-2xl font-bold text-blue-600">{formatPrice(result.ticket_price)}</p>
                                                <p className="text-sm text-gray-500">{result.available_seats} places disponibles</p>
                                            </div>
                                        </div>
                                    </CardHeader>
                                </Card>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BusTicketSearchPage;

