// ✅ Phase 5: Page de recherche de covoiturages (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface CovoiturageSearchFilters {
    depart?: string;
    destination?: string;
    date_depart?: string;
    min_places?: number;
    max_prix?: number;
}

const CovoiturageSearchPage: React.FC = () => {
    const navigate = useNavigate();

    const [depart, setDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [dateDepart, setDateDepart] = useState('');
    const [minPlaces, setMinPlaces] = useState(1);
    const [maxPrix, setMaxPrix] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        if (!depart.trim() || !destination.trim()) {
            alert('Veuillez renseigner le lieu de départ et la destination');
            return;
        }

        const filters: CovoiturageSearchFilters = {
            depart: depart.trim(),
            destination: destination.trim(),
        };

        if (dateDepart) filters.date_depart = dateDepart;
        if (minPlaces > 1) filters.min_places = minPlaces;
        if (maxPrix) {
            const prix = parseInt(maxPrix);
            if (!isNaN(prix) && prix > 0) filters.max_prix = prix;
        }

        navigate('/covoiturages/list', { state: { filters } });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">Rechercher un covoiturage</h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Critères de recherche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Départ */}
                            <div>
                                <Label htmlFor="depart">Lieu de départ *</Label>
                                <Input
                                    id="depart"
                                    value={depart}
                                    onChange={(e) => setDepart(e.target.value)}
                                    placeholder="Ex: Douala, Centre-ville"
                                    required
                                />
                            </div>

                            {/* Destination */}
                            <div>
                                <Label htmlFor="destination">Destination *</Label>
                                <Input
                                    id="destination"
                                    value={destination}
                                    onChange={(e) => setDestination(e.target.value)}
                                    placeholder="Ex: Yaoundé, Centre-ville"
                                    required
                                />
                            </div>

                            {/* Date départ */}
                            <div>
                                <Label htmlFor="dateDepart">Date de départ</Label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <Input
                                        id="dateDepart"
                                        type="date"
                                        value={dateDepart}
                                        onChange={(e) => setDateDepart(e.target.value)}
                                        min={new Date().toISOString().split('T')[0]}
                                        className="pl-10"
                                    />
                                </div>
                            </div>

                            {/* Places min */}
                            <div>
                                <Label>Places minimum: {minPlaces}</Label>
                                <div className="flex items-center gap-4 mt-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMinPlaces(Math.max(1, minPlaces - 1))}
                                    >
                                        -
                                    </Button>
                                    <span className="flex-1 text-center font-semibold">
                                        {minPlaces} place{minPlaces > 1 ? 's' : ''}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setMinPlaces(Math.min(10, minPlaces + 1))}
                                    >
                                        +
                                    </Button>
                                </div>
                            </div>

                            {/* Prix max */}
                            <div>
                                <Label htmlFor="maxPrix">Prix maximum (FCFA) - optionnel</Label>
                                <Input
                                    id="maxPrix"
                                    type="number"
                                    value={maxPrix}
                                    onChange={(e) => setMaxPrix(e.target.value)}
                                    placeholder="Ex: 5000"
                                    min="0"
                                />
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

export default CovoiturageSearchPage;

