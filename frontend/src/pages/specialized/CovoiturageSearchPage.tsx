// ✅ REFONTE COMPLÈTE - Page de recherche de covoiturage
// UX moderne inspirée de BlaBlaCar et applications similaires
import { Button } from '@/components/ui/buttons';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ArrowLeftRight, Calendar, Car, DollarSign, MapPin, Search, Users } from 'lucide-react';
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

    // États de recherche principaux
    const [depart, setDepart] = useState('');
    const [destination, setDestination] = useState('');
    const [dateDepart, setDateDepart] = useState('');
    const [minPlaces, setMinPlaces] = useState(1);
    const [maxPrix, setMaxPrix] = useState('');
    const [loading, setLoading] = useState(false);

    // Date minimale = aujourd'hui
    const today = new Date().toISOString().split('T')[0];

    const handleSwapLocations = () => {
        const temp = depart;
        setDepart(destination);
        setDestination(temp);
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!depart.trim() || !destination.trim()) {
            alert('Veuillez renseigner le lieu de départ et la destination');
            return;
        }

        setLoading(true);

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

        // Simuler un délai de recherche
        setTimeout(() => {
            setLoading(false);
            navigate('/covoiturages/list', { state: { filters } });
        }, 500);
    };

    const quickDateOptions = [
        { label: "Aujourd'hui", value: today },
        { label: 'Demain', value: new Date(Date.now() + 86400000).toISOString().split('T')[0] },
        { label: 'Ce week-end', value: '' }, // À calculer selon le jour actuel
    ];

    return (
        <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-green-50">
            {/* Header moderne */}
            <div className="bg-white shadow-sm border-b border-green-100">
                <div className="max-w-6xl mx-auto px-4 py-6">
                    <div className="flex items-center gap-4 mb-4">
                        <Button
                            variant="ghost"
                            onClick={() => navigate(-1)}
                            className="p-2 hover:bg-green-50"
                        >
                            <ArrowLeftRight className="w-5 h-5" />
                        </Button>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl bg-green-600 flex items-center justify-center">
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Rechercher un covoiturage</h1>
                                <p className="text-sm text-gray-500">Voyagez ensemble, économisez plus</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-8">
                {/* Card principale de recherche - Design moderne */}
                <Card className="shadow-xl border-2 border-green-100 mb-8">
                    <CardContent className="p-8">
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Section départ/destination - Design moderne */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <MapPin className="w-5 h-5 text-green-600" />
                                    <h2 className="text-lg font-bold text-gray-900">Votre trajet</h2>
                                </div>
                                
                                <div className="relative">
                                    {/* Champs départ et destination côte à côte */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {/* Départ */}
                                        <div className="relative flex-1">
                                            <Label htmlFor="depart" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-green-600" />
                                                Lieu de départ *
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="depart"
                                                    value={depart}
                                                    onChange={(e) => setDepart(e.target.value)}
                                                    placeholder="Ex: Douala, Centre-ville"
                                                    className="pl-11 h-14 text-lg border-2 border-gray-200 focus:border-green-500 rounded-xl"
                                                    required
                                                />
                                                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-green-400" />
                                            </div>
                                        </div>

                                        {/* Bouton swap */}
                                        <div className="flex items-end justify-center pb-2">
                                            <button
                                                type="button"
                                                onClick={handleSwapLocations}
                                                className="w-10 h-10 rounded-full bg-green-100 hover:bg-green-200 flex items-center justify-center transition-colors"
                                                title="Inverser départ et destination"
                                            >
                                                <ArrowLeftRight className="w-5 h-5 text-green-600" />
                                            </button>
                                        </div>

                                        {/* Destination */}
                                        <div className="relative flex-1">
                                            <Label htmlFor="destination" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                                <MapPin className="w-4 h-4 text-blue-600" />
                                                Destination *
                                            </Label>
                                            <div className="relative">
                                                <Input
                                                    id="destination"
                                                    value={destination}
                                                    onChange={(e) => setDestination(e.target.value)}
                                                    placeholder="Ex: Yaoundé, Centre-ville"
                                                    className="pl-11 h-14 text-lg border-2 border-gray-200 focus:border-blue-500 rounded-xl"
                                                    required
                                                />
                                                <MapPin className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-blue-400" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Dates rapides */}
                            <div className="flex flex-wrap gap-3">
                                {quickDateOptions.map((option, index) => (
                                    <button
                                        key={index}
                                        type="button"
                                        onClick={() => option.value && setDateDepart(option.value)}
                                        className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                                            dateDepart === option.value
                                                ? 'bg-green-600 text-white'
                                                : 'bg-green-50 text-green-700 hover:bg-green-100'
                                        }`}
                                    >
                                        {option.label}
                                    </button>
                                ))}
                            </div>

                            {/* Date de départ */}
                            <div>
                                <Label htmlFor="dateDepart" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-green-600" />
                                    Date de départ
                                </Label>
                                <Input
                                    id="dateDepart"
                                    type="date"
                                    value={dateDepart}
                                    onChange={(e) => setDateDepart(e.target.value)}
                                    min={today}
                                    className="h-14 text-lg border-2 border-gray-200 focus:border-green-500 rounded-xl"
                                />
                            </div>

                            {/* Options avancées */}
                            <div className="border-t border-gray-200 pt-6 space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Places minimum */}
                                    <div>
                                        <Label className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                            <Users className="w-4 h-4 text-green-600" />
                                            Places minimum: {minPlaces}
                                        </Label>
                                        <div className="flex items-center gap-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setMinPlaces(Math.max(1, minPlaces - 1))}
                                                className="w-12 h-12 rounded-xl"
                                            >
                                                -
                                            </Button>
                                            <div className="flex-1 text-center px-4 py-3 bg-gray-50 rounded-xl font-semibold text-lg">
                                                {minPlaces}
                                            </div>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => setMinPlaces(Math.min(10, minPlaces + 1))}
                                                className="w-12 h-12 rounded-xl"
                                            >
                                                +
                                            </Button>
                                        </div>
                                    </div>

                                    {/* Prix max */}
                                    <div>
                                        <Label htmlFor="maxPrix" className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                                            <DollarSign className="w-4 h-4 text-green-600" />
                                            Prix maximum (FCFA)
                                        </Label>
                                        <Input
                                            id="maxPrix"
                                            type="number"
                                            value={maxPrix}
                                            onChange={(e) => setMaxPrix(e.target.value)}
                                            placeholder="Ex: 5000"
                                            min="0"
                                            className="h-14 text-lg border-2 border-gray-200 focus:border-green-500 rounded-xl"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Bouton de recherche - Prominent */}
                            <Button
                                type="submit"
                                disabled={loading || !depart.trim() || !destination.trim()}
                                className="w-full h-16 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-lg font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                            >
                                {loading ? (
                                    <>
                                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                                        Recherche en cours...
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-5 h-5 mr-2" />
                                        Rechercher des trajets
                                    </>
                                )}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Section informations */}
                <Card className="bg-gradient-to-r from-green-50 to-emerald-50 border-green-100">
                    <CardContent className="p-6">
                        <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                            <Car className="w-5 h-5 text-green-600" />
                            💡 Bon à savoir
                        </h3>
                        <ul className="space-y-2 text-sm text-gray-700">
                            <li>• Le covoiturage permet de partager les frais de transport et de réduire les coûts</li>
                            <li>• Vérifiez les avis et le profil du conducteur avant de réserver</li>
                            <li>• Réservez à l'avance pour garantir votre place</li>
                            <li>• Les trajets réguliers peuvent vous faire économiser encore plus</li>
                        </ul>
                    </CardContent>
                </Card>

                {/* Section devenir conducteur */}
                <Card className="mt-4 bg-gradient-to-r from-green-600 to-green-700 text-white border-0">
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-bold mb-2">Vous êtes conducteur ?</h3>
                                <p className="text-green-100">
                                    Proposez vos trajets et gagnez de l'argent en covoiturant
                                </p>
                            </div>
                            <Button
                                onClick={() => navigate('/covoiturages/create')}
                                className="bg-white text-green-600 hover:bg-green-50 font-semibold px-6 py-3 rounded-xl"
                            >
                                Publier un trajet
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default CovoiturageSearchPage;
