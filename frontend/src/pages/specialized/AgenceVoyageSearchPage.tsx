// ✅ REFONTE COMPLÈTE - Page de recherche de tickets de voyage/bus
// UX moderne inspirée des meilleures applications de réservation de bus
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeftRight, Bus, Calendar, Clock, MapPin, Search, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface BusTicketSearchFilters {
    departure?: string;
    arrival?: string;
    departureDate?: string;
    departureTime?: string;
    minSeats?: number;
    maxPrice?: number;
    company?: string;
    lat?: number;
    lng?: number;
    radius_km?: number;
}

const AgenceVoyageSearchPage: React.FC = () => {
    const navigate = useNavigate();

    // États de recherche principaux
    const [departure, setDeparture] = useState('');
    const [arrival, setArrival] = useState('');
    const [departureDate, setDepartureDate] = useState('');
    const [departureTime, setDepartureTime] = useState('');
    const [minSeats, setMinSeats] = useState(1);
    const [maxPrice, setMaxPrice] = useState('');
    const [company, setCompany] = useState('');
    const [loading, setLoading] = useState(false);

    // État pour utiliser GPS
    const [useGPS, setUseGPS] = useState(false);
    const [gpsString, setGpsString] = useState('');

    // Date minimale = aujourd'hui
    const today = new Date().toISOString().split('T')[0];

    const handleSwapLocations = () => {
        const temp = departure;
        setDeparture(arrival);
        setArrival(temp);
    };

    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setGpsString(`${lat},${lng}`);
                    setUseGPS(true);
                },
                (error) => {
                    alert('Impossible d\'obtenir votre position');
                }
            );
        } else {
            alert('La géolocalisation n\'est pas supportée par votre navigateur');
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!departure.trim() || !arrival.trim()) {
            alert('Veuillez renseigner la ville de départ et la ville d\'arrivée');
            return;
        }

        setLoading(true);

        const filters: BusTicketSearchFilters = {
            departure: departure.trim(),
            arrival: arrival.trim(),
        };

        if (departureDate) filters.departureDate = departureDate;
        if (departureTime) filters.departureTime = departureTime;
        if (minSeats > 1) filters.minSeats = minSeats;
        if (maxPrice) {
            const price = parseInt(maxPrice);
            if (!isNaN(price) && price > 0) filters.maxPrice = price;
        }
        if (company.trim()) filters.company = company.trim();
        
        if (useGPS && gpsString) {
            const [lat, lng] = gpsString.split(',').map(parseFloat);
            if (!isNaN(lat) && !isNaN(lng)) {
                filters.lat = lat;
                filters.lng = lng;
                filters.radius_km = 50;
            }
        }

        // Simuler un délai de recherche
        setTimeout(() => {
            setLoading(false);
            navigate('/agences-voyage/list', { state: { filters } });
        }, 500);
    };

    const quickDateOptions = [
        { label: "Aujourd'hui", value: today },
        { label: 'Demain', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-purple-50">
            {/* Header moderne */}
            <div className="bg-white shadow-sm border-b border-purple-100">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-purple-50"
                        >
                            <ArrowLeftRight className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-purple-600 flex items-center justify-center">
                                <Bus className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Rechercher un ticket de bus</h1>
                                <p className="text-sm text-gray-500">Trouvez votre trajet en quelques clics</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Card principale de recherche - Design moderne */}
                <Card className="shadow-xl border-2 border-purple-100 mb-8">
                    <CardContent className="p-8">
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Section départ/arrivée - Design moderne */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="w-5 h-5 text-purple-600" />
                                    <h2 className="text-lg font-bold text-gray-900">Itinéraire</h2>
                                </div>
                                
                                <div className="relative">
                                    {/* Champs départ et arrivée côte à côte */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Départ */}
                                        <div className="relative flex-1">
                                            <Label htmlFor="departure" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-purple-600" />
                                                Ville de départ *
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="departure"
                                                    value={departure}
                                                    onChange={(e) => setDeparture(e.target.value)}
                                                    placeholder="Ex: Douala, Yaoundé, Bafoussam"
                                                    className="pl-11 h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
                                                    required
                                                />
                                                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-purple-400" />
                                            </div>
                                        </div>

                                        {/* Bouton swap */}
                                        <div className="flex items-end justify-center pb-2">
                                            <button
                                                type="button"
                                                onClick={handleSwapLocations}
                                                className="w-10 h-10 rounded-full bg-purple-100 hover:bg-purple-200 flex items-center justify-center transition-colors"
                                                title="Inverser départ et arrivée"
                                            >
                                                <ArrowLeftRight className="w-5 h-5 text-purple-600" />
                                            </button>
                                        </div>

                                        {/* Arrivée */}
                                        <div className="relative flex-1">
                                            <Label htmlFor="arrival" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-green-600" />
                                                Ville d'arrivée *
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="arrival"
                                                    value={arrival}
                                                    onChange={(e) => setArrival(e.target.value)}
                                                    placeholder="Ex: Douala, Yaoundé, Bafoussam"
                                                    className="pl-11 h-14 text-lg border-2 border-gray-200 focus:border-green-500 rounded-xl"
                                                    required
                                                />
                                                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dates rapides */}
                            <div className="flex flex-wrap gap-3">
                                {quickDateOptions.map((option) => (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onClick={() => setDepartureDate(option.value)}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                            departureDate === option.value
                                                ? 'bg-purple-600 text-white'
                                                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {/* Date et heure */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="departureDate" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-purple-600" />
                                        Date de départ
                                    </Label>
                                    <Input
                                        id="departureDate"
                                        type="date"
                                        value={departureDate}
                                        onChange={(e) => setDepartureDate(e.target.value)}
                                        min={today}
                                        className="h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor="departureTime" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <Clock className="w-4 h-4 text-purple-600" />
                                        Heure de départ
                                    </Label>
                                    <Input
                                        id="departureTime"
                                        type="time"
                                        value={departureTime}
                                        onChange={(e) => setDepartureTime(e.target.value)}
                                        className="h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
                                    />
                                </div>
                            </div>

                            {/* Options avancées - Repliables */}
                            <div className="border-t border-gray-200 pt-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* Places minimum */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-purple-600" />
                                            Places minimum: {minSeats}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setMinSeats(Math.max(1, minSeats - 1))}
                                                className="w-12 h-12 rounded-xl"
                                            >
                                                -
                                            </Button>
                                            <div className="flex-1 text-center px-4 py-3 bg-gray-50 rounded-xl font-semibold text-lg">
                                                {minSeats}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setMinSeats(Math.min(10, minSeats + 1))}
                                                className="w-12 h-12 rounded-xl"
                                            >
                                                +
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Prix max */}
                                    <div>
                                        <Label htmlFor="maxPrice" className="text-sm font-semibold text-gray-700 mb-2">
                                            Prix maximum (FCFA)
                                        </Label>
                                        <Input
                                            id="maxPrice"
                                            type="number"
                                            value={maxPrice}
                                            onChange={(e) => setMaxPrice(e.target.value)}
                                            placeholder="Ex: 5000"
                                            min="0"
                                            className="h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
                                        />
                                    </div>

                                    {/* Compagnie */}
                                    <div>
                                        <Label htmlFor="company" className="text-sm font-semibold text-gray-700 mb-2">
                                            Compagnie (optionnel)
                                        </Label>
                                        <Input
                                            id="company"
                                            value={company}
                                            onChange={(e) => setCompany(e.target.value)}
                                            placeholder="Ex: Amour Mezam"
                                            className="h-14 text-lg border-2 border-gray-200 focus:border-purple-500 rounded-xl"
                                        />
                                    </div>
                                </div>

                                {/* GPS optionnel */}
                                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
                                    <button
                                        type="button"
                                        onClick={handleUseCurrentLocation}
                                        className="px-4 py-2 bg-purple-100 hover:bg-purple-200 text-purple-700 rounded-lg font-semibold text-sm transition-colors"
                                    >
                                        Utiliser ma position
                                    </button>
                                    {gpsString && (
                                        <span className="text-sm text-gray-600">
                                            Position: {gpsString}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Bouton de recherche - Prominent */}
                            <Button
                                type="submit"
                                disabled={loading || !departure.trim() || !arrival.trim()}
                                className="w-full h-16 bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                        Recherche en cours...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5 mr-2" />
                                        Rechercher des tickets
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Section informations */}
                <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-100">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Bus className="w-5 h-5 text-purple-600" />
                            💡 Bon à savoir
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li>• Réservez vos billets à l'avance pour obtenir les meilleurs prix</li>
                            <li>• Vérifiez les horaires de départ et d'arrivée avant de réserver</li>
                            <li>• Les tickets sont généralement remboursables sous conditions</li>
                            <li>• Consultez les avis des compagnies pour choisir la meilleure option</li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default AgenceVoyageSearchPage;
