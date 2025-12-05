// ✅ Page de recherche de livres scolaires (Frontend)

import { BookOpen, MapPin, Search } from 'lucide-react';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { useToast } from '../../hooks/use-toast';

const niveaux = ['Primaire', 'Collège', 'Lycée'];
const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];

interface SearchFilters {
    classe_actuelle?: string;
    classe_souhaitee?: string;
    matiere?: string;
    niveau?: string;
    etat_livre?: string;
    ville?: string;
    quartier?: string;
    gps_lat?: number;
    gps_lon?: number;
    rayon_km?: number;
}

const LivreScolaireSearchPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();

    const [filters, setFilters] = useState<SearchFilters>({
        classe_actuelle: '',
        classe_souhaitee: '',
        matiere: '',
        niveau: '',
        etat_livre: '',
        ville: '',
        quartier: '',
        rayon_km: 10,
    });

    const [selectedNiveau, setSelectedNiveau] = useState('');
    const [selectedEtat, setSelectedEtat] = useState('');
    const [rayonKm, setRayonKm] = useState(10);

    const handleSearch = () => {
        if (!filters.classe_actuelle && !filters.classe_souhaitee && !filters.matiere) {
            toast({
                title: 'Erreur',
                description: 'Veuillez renseigner au moins une classe ou une matière',
                variant: 'destructive',
            });
            return;
        }

        const searchParams = new URLSearchParams();
        if (filters.classe_actuelle) searchParams.append('classe_actuelle', filters.classe_actuelle);
        if (filters.classe_souhaitee) searchParams.append('classe_souhaitee', filters.classe_souhaitee);
        if (filters.matiere) searchParams.append('matiere', filters.matiere);
        if (selectedNiveau) searchParams.append('niveau', selectedNiveau);
        if (selectedEtat) searchParams.append('etat_livre', selectedEtat);
        if (filters.ville) searchParams.append('ville', filters.ville);
        if (filters.quartier) searchParams.append('quartier', filters.quartier);
        if (filters.gps_lat) searchParams.append('gps_lat', filters.gps_lat.toString());
        if (filters.gps_lon) searchParams.append('gps_lon', filters.gps_lon.toString());
        if (rayonKm) searchParams.append('rayon_km', rayonKm.toString());

        navigate(`/livres-scolaires/list?${searchParams.toString()}`);
    };

    const handleGPSLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setFilters({
                        ...filters,
                        gps_lat: position.coords.latitude,
                        gps_lon: position.coords.longitude,
                    });
                    toast({
                        title: 'Position GPS détectée',
                        description: 'Votre position a été enregistrée',
                    });
                },
                (error) => {
                    toast({
                        title: 'Erreur GPS',
                        description: 'Impossible d\'obtenir votre position',
                        variant: 'destructive',
                    });
                }
            );
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-center gap-3">
                        <BookOpen className="h-8 w-8 text-indigo-600" />
                        <div>
                            <CardTitle className="text-2xl">Rechercher un livre scolaire</CardTitle>
                            <CardDescription>
                                Trouvez le livre dont vous avez besoin pour échanger
                            </CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Classe actuelle */}
                    <div className="space-y-2">
                        <Label htmlFor="classe_actuelle">Classe actuelle *</Label>
                        <Input
                            id="classe_actuelle"
                            placeholder="Ex: 6ème, 5ème, Terminale"
                            value={filters.classe_actuelle}
                            onChange={(e) => setFilters({ ...filters, classe_actuelle: e.target.value })}
                        />
                    </div>

                    {/* Classe souhaitée */}
                    <div className="space-y-2">
                        <Label htmlFor="classe_souhaitee">Classe souhaitée *</Label>
                        <Input
                            id="classe_souhaitee"
                            placeholder="Ex: 5ème, 4ème, 1ère"
                            value={filters.classe_souhaitee}
                            onChange={(e) => setFilters({ ...filters, classe_souhaitee: e.target.value })}
                        />
                    </div>

                    {/* Matière */}
                    <div className="space-y-2">
                        <Label htmlFor="matiere">Matière *</Label>
                        <Input
                            id="matiere"
                            placeholder="Ex: Mathématiques, Français"
                            value={filters.matiere}
                            onChange={(e) => setFilters({ ...filters, matiere: e.target.value })}
                        />
                    </div>

                    {/* Niveau */}
                    <div className="space-y-2">
                        <Label>Niveau</Label>
                        <div className="flex flex-wrap gap-2">
                            {niveaux.map((n) => (
                                <Badge
                                    key={n}
                                    variant={selectedNiveau === n ? 'default' : 'outline'}
                                    className="cursor-pointer px-4 py-2"
                                    onClick={() => setSelectedNiveau(selectedNiveau === n ? '' : n)}
                                >
                                    {n}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* État du livre */}
                    <div className="space-y-2">
                        <Label>État du livre</Label>
                        <div className="flex flex-wrap gap-2">
                            {etats.map((etat) => (
                                <Badge
                                    key={etat}
                                    variant={selectedEtat === etat ? 'default' : 'outline'}
                                    className="cursor-pointer px-4 py-2"
                                    onClick={() => setSelectedEtat(selectedEtat === etat ? '' : etat)}
                                >
                                    {etat}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    {/* Localisation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ville">Ville</Label>
                            <Input
                                id="ville"
                                placeholder="Ex: Douala, Yaoundé"
                                value={filters.ville}
                                onChange={(e) => setFilters({ ...filters, ville: e.target.value })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="quartier">Quartier</Label>
                            <Input
                                id="quartier"
                                placeholder="Ex: Bonanjo, Akwa"
                                value={filters.quartier}
                                onChange={(e) => setFilters({ ...filters, quartier: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* GPS */}
                    <div className="space-y-2">
                        <Label>Position GPS (optionnel)</Label>
                        <div className="flex items-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGPSLocation}
                                className="flex items-center gap-2"
                            >
                                <MapPin className="h-4 w-4" />
                                {filters.gps_lat ? 'Position enregistrée' : 'Utiliser ma position'}
                            </Button>
                            {filters.gps_lat && (
                                <span className="text-sm text-gray-600">
                                    {filters.gps_lat.toFixed(4)}, {filters.gps_lon?.toFixed(4)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Rayon de recherche */}
                    {filters.gps_lat && (
                        <div className="space-y-2">
                            <Label>Rayon de recherche: {rayonKm} km</Label>
                            <div className="flex items-center gap-4">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRayonKm(Math.max(1, rayonKm - 1))}
                                >
                                    -
                                </Button>
                                <span className="font-medium">{rayonKm} km</span>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setRayonKm(Math.min(50, rayonKm + 1))}
                                >
                                    +
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Bouton de recherche */}
                    <Button onClick={handleSearch} className="w-full" size="lg">
                        <Search className="h-4 w-4 mr-2" />
                        Rechercher
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default LivreScolaireSearchPage;

