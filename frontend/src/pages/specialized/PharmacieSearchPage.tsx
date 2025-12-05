// ✅ Page de recherche de pharmacies (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MapPin, Pill, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface PharmacieSearchFilters {
    ville?: string;
    quartier?: string;
    lat?: number;
    lng?: number;
    max_distance_km?: number;
    on_duty_only?: boolean;
    available_only?: boolean;
}

const PharmacieSearchPage: React.FC = () => {
    const navigate = useNavigate();

    const [ville, setVille] = useState('');
    const [quartier, setQuartier] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [maxDistance, setMaxDistance] = useState(50);
    const [onDutyOnly, setOnDutyOnly] = useState(false);
    const [availableOnly, setAvailableOnly] = useState(true);
    const [loading, setLoading] = useState(false);

    const handleUseCurrentLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    setGpsString(`${lat},${lng}`);
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
        if (!ville.trim() && !quartier.trim() && !gpsString.trim()) {
            alert('Veuillez renseigner une ville/quartier ou un point GPS');
            return;
        }

        const filters: PharmacieSearchFilters = {};
        if (ville.trim()) filters.ville = ville.trim();
        if (quartier.trim()) filters.quartier = quartier.trim();
        if (gpsString.trim()) {
            const [lat, lng] = gpsString.split(',').map(parseFloat);
            if (!isNaN(lat) && !isNaN(lng)) {
                filters.lat = lat;
                filters.lng = lng;
            }
        }
        if (maxDistance > 0) filters.max_distance_km = maxDistance;
        if (onDutyOnly) filters.on_duty_only = true;
        if (availableOnly) filters.available_only = true;

        navigate('/pharmacies/list', { state: { filters } });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Pill className="w-8 h-8" />
                    Rechercher une pharmacie
                </h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Critères de recherche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Ville */}
                            <div>
                                <Label htmlFor="ville">Ville</Label>
                                <Input
                                    id="ville"
                                    value={ville}
                                    onChange={(e) => setVille(e.target.value)}
                                    placeholder="Ex: Douala, Yaoundé"
                                />
                            </div>

                            {/* Quartier */}
                            <div>
                                <Label htmlFor="quartier">Quartier (optionnel)</Label>
                                <Input
                                    id="quartier"
                                    value={quartier}
                                    onChange={(e) => setQuartier(e.target.value)}
                                    placeholder="Ex: Bonanjo, Akwa"
                                />
                            </div>

                            {/* GPS */}
                            <div>
                                <Label htmlFor="gps">Position GPS (optionnel)</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <MapPin className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <Input
                                            id="gps"
                                            value={gpsString}
                                            onChange={(e) => setGpsString(e.target.value)}
                                            placeholder="Ex: 4.0511,9.7679"
                                            className="pl-10"
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleUseCurrentLocation}
                                    >
                                        Ma position
                                    </Button>
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

                            {/* Options */}
                            <div className="space-y-2">
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="onDutyOnly"
                                        checked={onDutyOnly}
                                        onChange={(e) => setOnDutyOnly(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <Label htmlFor="onDutyOnly" className="cursor-pointer">
                                        De garde uniquement
                                    </Label>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="checkbox"
                                        id="availableOnly"
                                        checked={availableOnly}
                                        onChange={(e) => setAvailableOnly(e.target.checked)}
                                        className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                    />
                                    <Label htmlFor="availableOnly" className="cursor-pointer">
                                        Disponibles maintenant
                                    </Label>
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

export default PharmacieSearchPage;

