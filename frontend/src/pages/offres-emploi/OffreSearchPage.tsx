// ✅ Page de recherche d'offres d'emploi (Frontend)
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Briefcase, MapPin, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

interface OffreSearchFilters {
    secteur?: string;
    type_contrat?: string[];
    salaire_min?: number;
    salaire_max?: number;
    lieu_travail?: string;
    gps?: string;
    distance_max_km?: number;
    remote?: boolean;
    niveau_etude?: string;
    experience_min?: number;
    competences?: string[];
}

const OffreSearchPage: React.FC = () => {
    const navigate = useNavigate();

    const [secteur, setSecteur] = useState('');
    const [typeContrat, setTypeContrat] = useState<string[]>([]);
    const [salaireMin, setSalaireMin] = useState('');
    const [lieuTravail, setLieuTravail] = useState('');
    const [gpsString, setGpsString] = useState('');
    const [maxDistance, setMaxDistance] = useState(50);
    const [remote, setRemote] = useState(false);
    const [loading, setLoading] = useState(false);

    const secteurs = [
        'Informatique', 'Commerce', 'Santé', 'Éducation', 'Finance',
        'Marketing', 'Ressources Humaines', 'Ingénierie', 'Design', 'Autre'
    ];

    const typesContrat = ['CDI', 'CDD', 'Stage', 'Freelance', 'Temps partiel', 'Alternance'];

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

    const toggleTypeContrat = (type: string) => {
        setTypeContrat(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();

        const filters: OffreSearchFilters = {};
        if (secteur.trim()) filters.secteur = secteur.trim();
        if (typeContrat.length > 0) filters.type_contrat = typeContrat;
        if (salaireMin.trim()) {
            const salaire = parseFloat(salaireMin);
            if (!isNaN(salaire)) filters.salaire_min = salaire;
        }
        if (lieuTravail.trim()) filters.lieu_travail = lieuTravail.trim();
        if (gpsString.trim()) filters.gps = gpsString.trim();
        if (maxDistance > 0) filters.distance_max_km = maxDistance;
        if (remote) filters.remote = true;

        navigate('/offres-emploi/list', { state: { filters } });
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <h1 className="text-3xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Briefcase className="w-8 h-8" />
                    Rechercher une offre d'emploi
                </h1>

                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Critères de recherche</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSearch} className="space-y-6">
                            {/* Secteur */}
                            <div>
                                <Label htmlFor="secteur">Secteur d'activité</Label>
                                <select
                                    id="secteur"
                                    value={secteur}
                                    onChange={(e) => setSecteur(e.target.value)}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                >
                                    <option value="">Tous les secteurs</option>
                                    {secteurs.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                    ))}
                                </select>
                            </div>

                            {/* Type de contrat */}
                            <div>
                                <Label>Type de contrat</Label>
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {typesContrat.map((type) => (
                                        <button
                                            key={type}
                                            type="button"
                                            onClick={() => toggleTypeContrat(type)}
                                            className={`px-4 py-2 rounded-md text-sm font-medium transition ${typeContrat.includes(type)
                                                    ? 'bg-indigo-600 text-white'
                                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                        >
                                            {type}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Salaire minimum */}
                            <div>
                                <Label htmlFor="salaireMin">Salaire minimum (XAF)</Label>
                                <Input
                                    id="salaireMin"
                                    type="number"
                                    value={salaireMin}
                                    onChange={(e) => setSalaireMin(e.target.value)}
                                    placeholder="Ex: 100000"
                                />
                            </div>

                            {/* Localisation */}
                            <div>
                                <Label htmlFor="lieuTravail">Lieu de travail</Label>
                                <Input
                                    id="lieuTravail"
                                    value={lieuTravail}
                                    onChange={(e) => setLieuTravail(e.target.value)}
                                    placeholder="Ex: Douala, Yaoundé"
                                />
                            </div>

                            {/* GPS */}
                            <div>
                                <Label htmlFor="gps">Coordonnées GPS (optionnel)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        id="gps"
                                        value={gpsString}
                                        onChange={(e) => setGpsString(e.target.value)}
                                        placeholder="lat,lng"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={handleUseCurrentLocation}
                                        className="whitespace-nowrap"
                                    >
                                        <MapPin className="w-4 h-4 mr-2" />
                                        Ma position
                                    </Button>
                                </div>
                            </div>

                            {/* Distance max */}
                            {gpsString && (
                                <div>
                                    <Label htmlFor="maxDistance">Distance maximale (km)</Label>
                                    <Input
                                        id="maxDistance"
                                        type="number"
                                        value={maxDistance}
                                        onChange={(e) => setMaxDistance(parseInt(e.target.value) || 50)}
                                        min="1"
                                        max="200"
                                    />
                                </div>
                            )}

                            {/* Remote */}
                            <div className="flex items-center gap-2">
                                <input
                                    type="checkbox"
                                    id="remote"
                                    checked={remote}
                                    onChange={(e) => setRemote(e.target.checked)}
                                    className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <Label htmlFor="remote" className="cursor-pointer">
                                    Télétravail possible
                                </Label>
                            </div>

                            {/* Bouton recherche */}
                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading}
                            >
                                <Search className="w-4 h-4 mr-2" />
                                {loading ? 'Recherche...' : 'Rechercher'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

export default OffreSearchPage;

