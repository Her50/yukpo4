// ✅ REFONTE COMPLÈTE - Page de recherche de taxi
// UX moderne inspirée d'Uber, Bolt et applications similaires
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Car, MapPin, Navigation, Phone, Search, Sparkles } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface TaxiSearchFilters {
    zone?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    available_only?: boolean;
    type_vehicule?: string;
}

const TaxiSearchPage: React.FC = () => {
    const navigate = useNavigate();

    // États de recherche principaux
    const [depart, setDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [zone, setZone] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [maxDistance, setMaxDistance] = useState(20);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [typeVehicule, setTypeVehicule] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setGpsString(`${lat},${lng}`);
                    setDepart(`Position actuelle (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
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
        
        if (!depart.trim() && !zone.trim() && !gpsString.trim()) {
            alert('Veuillez renseigner une zone, un lieu de départ ou utiliser votre position GPS');
            return;
        }

        setLoading(true);

        const filters: TaxiSearchFilters = {};
        
        if (depart.trim()) {
            // Utiliser le champ départ comme zone
            filters.zone = depart.trim();
        } else if (zone.trim()) {
            filters.zone = zone.trim();
        }
        
        if (gpsString.trim()) {
            const [lat, lng] = gpsString.split(',').map(parseFloat);
            if (!isNaN(lat) && !isNaN(lng)) {
                filters.lat = lat;
                filters.lng = lng;
            }
        }
        
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (availableOnly) filters.available_only = true;
        if (typeVehicule) filters.type_vehicule = typeVehicule;

        // Simuler un délai de recherche
        setTimeout(() => {
            setLoading(false);
            navigate('/taxis/list', { state: { filters, depart, destination } });
        }, 500);
    };

    const typesVehicules = ['Berline', 'SUV', 'Van', 'Moto', 'Vélo'];

    const quickActions = [
        { label: 'Plus proche', distance: 5 },
        { label: 'Dans 10km', distance: 10 },
        { label: 'Dans 20km', distance: 20 },
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-cyan-50 via-white to-cyan-50">
            {/* Header moderne */}
            <div className="bg-white shadow-sm border-b border-cyan-100">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-cyan-50"
                        >
                            <Navigation className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-cyan-600 flex items-center justify-center">
                                <Car className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Rechercher un taxi</h1>
                                <p className="text-sm text-gray-500">Trouvez rapidement un taxi disponible</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Card principale de recherche - Design moderne */}
                <Card className="shadow-xl border-2 border-cyan-100 mb-8">
                    <CardContent className="p-8">
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Section départ/destination - Design moderne */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="w-5 h-5 text-cyan-600" />
                                    <h2 className="text-lg font-bold text-gray-900">Votre trajet</h2>
                                </div>
                                
                                {/* Point de départ */}
                                <div className="relative">
                                    <Label htmlFor="depart" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <MapPin className="w-4 h-4 text-cyan-600" />
                                        Point de départ
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="depart"
                                            value={depart}
                                            onChange={(e) => setDepart(e.target.value)}
                                            placeholder="Ex: Douala, Centre-ville ou votre adresse"
                                            className="pl-11 h-14 text-lg border-2 border-gray-200 focus:border-cyan-500 rounded-xl"
                                        />
                                        <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-cyan-400" />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleUseCurrentLocation}
                                        className="mt-2 text-sm text-cyan-600 hover:text-cyan-700 font-semibold flex items-center gap-2"
                                    >
                                        <Navigation className="w-4 h-4" />
                                        Utiliser ma position actuelle
                                    </button>
                                </div>

                                {/* Destination (optionnelle) */}
                                <div className="relative">
                                    <Label htmlFor="destination" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                        <Navigation className="w-4 h-4 text-blue-600" />
                                        Destination (optionnel)
                                    </Label>
                                    <div className="relative">
                                        <Input
                                            id="destination"
                                            value={destination}
                                            onChange={(e) => setDestination(e.target.value)}
                                            placeholder="Ex: Yaoundé, Centre-ville"
                                            className="pl-11 h-14 text-lg border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                                        />
                                        <Navigation className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
                                    </div>
                                </div>
                            </div>

                            {/* Zone alternative */}
                            <div>
                                <Label htmlFor="zone" className="text-sm font-semibold text-gray-700 mb-2">
                                    Zone / Quartier (alternative)
                                </Label>
                                <Input
                                    id="zone"
                                    value={zone}
                                    onChange={(e) => setZone(e.target.value)}
                                    placeholder="Ex: Douala, Centre-ville"
                                    className="h-14 text-lg border-2 border-gray-200 focus:border-cyan-500 rounded-xl"
                                />
                            </div>

                            {/* GPS */}
                            <div>
                                <Label htmlFor="gps" className="text-sm font-semibold text-gray-700 mb-2">
                                    Position GPS (optionnel)
                                </Label>
                                <Input
                                    id="gps"
                                    value={gpsString}
                                    onChange={(e) => setGpsString(e.target.value)}
                                    placeholder="Format: latitude,longitude"
                                    className="h-14 text-lg border-2 border-gray-200 focus:border-cyan-500 rounded-xl"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Format: latitude,longitude (ex: 4.0511,9.7679)
                                </p>
                            </div>

                            {/* Distance rapide */}
                            <div>
                                <Label className="text-sm font-semibold text-gray-700 mb-2">
                                    Distance maximale: {maxDistance} km
                                </Label>
                                <div className="flex gap-3 mb-3">
                                    {quickActions.map((action) => (
                                        <button
                                            key={action.label}
                                            type="button"
                                            onClick={() => setMaxDistance(action.distance)}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                maxDistance === action.distance
                                                    ? 'bg-cyan-600 text-white'
                                                    : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                                            }`}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="flex items-center gap-4">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMaxDistance(Math.max(5, maxDistance - 5))}
                                        className="w-12 h-12 rounded-xl"
                                    >
                                        -
                                    </Button>
                                    <div className="flex-1 text-center px-4 py-3 bg-gray-50 rounded-xl font-semibold text-lg">
                                        {maxDistance} km
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMaxDistance(Math.min(100, maxDistance + 5))}
                                        className="w-12 h-12 rounded-xl"
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>

                            {/* Type véhicule */}
                            <div>
                                <Label className="text-sm font-semibold text-gray-700 mb-2">
                                    Type de véhicule (optionnel)
                                </Label>
                                <div className="flex flex-wrap gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setTypeVehicule('')}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                            !typeVehicule
                                                ? 'bg-cyan-600 text-white'
                                                : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                                        }`}
                                    >
                                        Tous
                                    </button>
                                    {typesVehicules.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setTypeVehicule(typeVehicule === type ? '' : type)}
                                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                                typeVehicule === type
                                                    ? 'bg-cyan-600 text-white'
                                                    : 'bg-cyan-50 text-cyan-700 hover:bg-cyan-100'
                                            }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Options */}
                            <div className="border-t border-gray-200 pt-6">
                                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700">
                                            Uniquement les taxis disponibles
                                        </Label>
                                        <p className="text-xs text-gray-500 mt-1">
                                            Afficher seulement les taxis libres
                                        </p>
                                    </div>
                                    <input
                                        type="checkbox"
                                        checked={availableOnly}
                                        onChange={(e) => setAvailableOnly(e.target.checked)}
                                        className="w-5 h-5 text-cyan-600 border-gray-300 rounded focus:ring-cyan-500"
                                    />
                                </div>
                            </div>

                            {/* Boutons de recherche */}
                            <div className="space-y-3">
                                <Button
                                    type="submit"
                                    disabled={loading || (!depart.trim() && !zone.trim() && !gpsString.trim())}
                                    className="w-full h-16 bg-gradient-to-r from-cyan-600 to-cyan-700 hover:from-cyan-700 hover:to-cyan-800 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                                >
                                    {loading ? (
                                        <>
                                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                            Recherche en cours...
                                        </>
                                    ) : (
                                        <>
                                            <Search className="w-5 h-5 mr-2" />
                                            Rechercher des taxis
                                        </>
                                    )}
                                </Button>

                                <Button
                                    type="button"
                                    onClick={() => navigate('/taxis/intelligent-search')}
                                    variant="outline"
                                    className="w-full h-14 border-2 border-cyan-600 text-cyan-600 hover:bg-cyan-50 text-lg font-semibold rounded-xl"
                                >
                                    <Sparkles className="w-5 h-5 mr-2" />
                                    Recherche intelligente (IA)
                                </Button>
                            </div>
                        </form>
                    </CardContent>
                </Card>

                {/* Section informations */}
                <Card className="bg-gradient-to-r from-cyan-50 to-blue-50 border-cyan-100 mb-4">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Car className="w-5 h-5 text-cyan-600" />
                            💡 Bon à savoir
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li>• La recherche intelligente utilise l'IA pour trouver le meilleur taxi selon vos besoins</li>
                            <li>• Les taxis disponibles sont mis à jour en temps réel</li>
                            <li>• Vous pouvez réserver directement depuis l'application</li>
                            <li>• Les tarifs sont estimés selon la distance et le type de véhicule</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Section devenir chauffeur */}
                <Card className="bg-gradient-to-r from-cyan-600 to-cyan-700 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold mb-2 flex items-center gap-2">
                                    <Phone className="w-5 h-5" />
                                    Vous êtes chauffeur de taxi ?
                                </h3>
                                <p className="text-cyan-100">
                                    Rejoignez notre plateforme et augmentez vos revenus
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate('/taxis/register')}
                                className="bg-white text-cyan-600 hover:bg-cyan-50 font-semibold px-6 py-3 rounded-xl"
                            >
                                Devenir chauffeur
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TaxiSearchPage;
