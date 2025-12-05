// ✅ Phase 5: Page de recherche de taxis (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Search } from 'lucide-react';
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

    const [zone, setZone] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [maxDistance, setMaxDistance] = useState(50);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [typeVehicule, setTypeVehicule] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!zone.trim() && !gpsString.trim()) {
            alert('Veuillez renseigner une zone ou un point GPS');
            return;
        }

        const filters: TaxiSearchFilters = {};
        if (zone.trim()) filters.zone = zone.trim();
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

        navigate('/taxis/list', { state: { filters } });
    };

    const typesVehicules = ['Berline', 'SUV', 'Van', 'Moto', 'Vélo'];

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Rechercher un taxi</h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Critères de recherche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Zone */}
                            <div>
                                <Label htmlFor="zone">Zone / Quartier</Label>
                                <Input
                                    id="zone"
                                    value={zone}
                                    onChange={(e) => setZone(e.target.value)}
                                    placeholder="Ex: Douala, Centre-ville"
                                />
                            </div>

                            {/* GPS */}
                            <div>
                                <Label htmlFor="gps">Position GPS (optionnel)</Label>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="gps"
                                        value={gpsString}
                                        onChange={(e) => setGpsString(e.target.value)}
                                        placeholder="Ex: 4.0511,9.7679"
                                        className="pl-10"
                                    />
                                </div>
                                <p className="text-sm text-gray-500 mt-1">
                                    Format: latitude,longitude
                                </p>
                            </div>

                            {/* Distance max */}
                            <div>
                                <Label>Distance maximale: {maxDistance} km</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMaxDistance(Math.max(5, maxDistance - 5))}
                                    >
                                        -
                                    </Button>
                                    <span className="flex-1 text-center font-semibold">{maxDistance} km</span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMaxDistance(Math.min(200, maxDistance + 5))}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>

                            {/* Disponibilité */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="availableOnly"
                                    checked={availableOnly}
                                    onChange={(e) => setAvailableOnly(e.target.checked)}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                />
                                <Label htmlFor="availableOnly" className="cursor-pointer">
                                    Uniquement les taxis disponibles
                                </Label>
                            </div>

                            {/* Type véhicule */}
                            <div>
                                <Label>Type de véhicule (optionnel)</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    <button
                                        type="button"
                                        onClick={() => setTypeVehicule('')}
                                        className={`px-4 py-2 rounded-lg border ${!typeVehicule
                                                ? 'bg-blue-600 text-white border-blue-600'
                                                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                            }`}
                                    >
                                        Tous
                                    </button>
                                    {typesVehicules.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => setTypeVehicule(typeVehicule === type ? '' : type)}
                                            className={`px-4 py-2 rounded-lg border ${typeVehicule === type
                                                    ? 'bg-blue-600 text-white border-blue-600'
                                                    : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <Button type="submit" disabled={loading} className="w-full">
                                <Search className="w-4 h-4 mr-2" />
                                {loading ? 'Recherche en cours...' : 'Rechercher'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default TaxiSearchPage;

