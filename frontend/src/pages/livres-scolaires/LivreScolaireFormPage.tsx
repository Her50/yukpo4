// ✅ Page de création/édition d'un livre scolaire (Frontend)

import { ArrowLeft, BookOpen, Loader2, MapPin } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import { Textarea } from '../../components/ui/textarea';
import { useToast } from '../../hooks/use-toast';
import { apiGet, apiPost, apiPut } from '../../services/apiService';

const niveaux = ['Primaire', 'Collège', 'Lycée'];
const etats = ['Neuf', 'Très bon', 'Bon', 'Acceptable'];

const LivreScolaireFormPage: React.FC = () => {
    const { livreId } = useParams<{ livreId?: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const mode = livreId ? 'edit' : 'create';

    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        titre: '',
        auteur: '',
        editeur: '',
        isbn: '',
        classe_actuelle: '',
        classe_souhaitee: '',
        matiere: '',
        niveau: '',
        etat_livre: '',
        description_etat: '',
        ville: '',
        quartier: '',
    });

    const [selectedNiveau, setSelectedNiveau] = useState('');
    const [selectedEtat, setSelectedEtat] = useState('');
    const [gpsCoordinates, setGpsCoordinates] = useState<{ lat?: number; lng?: number }>({});

    useEffect(() => {
        if (mode === 'edit' && livreId) {
            loadLivreData();
        } else {
            // Pré-remplir GPS avec position actuelle
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition((position) => {
                    setGpsCoordinates({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                    });
                });
            }
        }
    }, [mode, livreId]);

    const loadLivreData = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/livres-scolaires/${livreId}`);
            const data = await response.json();

            if (data.success && data.data?.livre) {
                const livre = data.data.livre;
                setFormData({
                    titre: livre.titre || '',
                    auteur: livre.auteur || '',
                    editeur: livre.editeur || '',
                    isbn: livre.isbn || '',
                    classe_actuelle: livre.classe_actuelle || '',
                    classe_souhaitee: livre.classe_souhaitee || '',
                    matiere: livre.matiere || '',
                    niveau: livre.niveau || '',
                    etat_livre: livre.etat_livre || '',
                    description_etat: livre.description_etat || '',
                    ville: livre.ville || '',
                    quartier: livre.quartier || '',
                });
                setSelectedNiveau(livre.niveau || '');
                setSelectedEtat(livre.etat_livre || '');
                if (livre.gps) {
                    const [lat, lng] = livre.gps.split(',').map(parseFloat);
                    setGpsCoordinates({ lat, lng });
                }
            }
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: 'Impossible de charger les données du livre',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleGPSLocation = () => {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    setGpsCoordinates({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
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

    const handleSubmit = async () => {
        // Validation
        if (!formData.titre.trim()) {
            toast({
                title: 'Erreur',
                description: 'Le titre est obligatoire',
                variant: 'destructive',
            });
            return;
        }
        if (!formData.classe_actuelle.trim()) {
            toast({
                title: 'Erreur',
                description: 'La classe actuelle est obligatoire',
                variant: 'destructive',
            });
            return;
        }
        if (!formData.classe_souhaitee.trim()) {
            toast({
                title: 'Erreur',
                description: 'La classe souhaitée est obligatoire',
                variant: 'destructive',
            });
            return;
        }
        if (!formData.matiere.trim()) {
            toast({
                title: 'Erreur',
                description: 'La matière est obligatoire',
                variant: 'destructive',
            });
            return;
        }
        if (!selectedEtat) {
            toast({
                title: 'Erreur',
                description: 'L\'état du livre est obligatoire',
                variant: 'destructive',
            });
            return;
        }

        try {
            setLoading(true);

            const payload: any = {
                titre: formData.titre.trim(),
                auteur: formData.auteur.trim() || null,
                editeur: formData.editeur.trim() || null,
                isbn: formData.isbn.trim() || null,
                classe_actuelle: formData.classe_actuelle.trim(),
                classe_souhaitee: formData.classe_souhaitee.trim(),
                matiere: formData.matiere.trim(),
                niveau: selectedNiveau || null,
                etat_livre: selectedEtat,
                description_etat: formData.description_etat.trim() || null,
                ville: formData.ville.trim() || null,
                quartier: formData.quartier.trim() || null,
                gps: gpsCoordinates.lat && gpsCoordinates.lng
                    ? `${gpsCoordinates.lat},${gpsCoordinates.lng}`
                    : null,
            };

            let response;
            if (mode === 'edit' && livreId) {
                response = await apiPut(`/api/livres-scolaires/${livreId}`, payload);
            } else {
                response = await apiPost('/api/livres-scolaires', payload);
            }
            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Succès',
                    description: mode === 'edit' ? 'Livre modifié avec succès !' : 'Livre créé avec succès !',
                });
                navigate(`/livres-scolaires/${mode === 'edit' ? livreId : data.data?.livre?.id || ''}`);
            } else {
                toast({
                    title: 'Erreur',
                    description: data.error || 'Une erreur est survenue',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Une erreur est survenue',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <BookOpen className="h-8 w-8 text-indigo-600" />
                            <div>
                                <CardTitle className="text-2xl">
                                    {mode === 'edit' ? 'Modifier le livre' : 'Créer un livre'}
                                </CardTitle>
                                <CardDescription>
                                    {mode === 'edit'
                                        ? 'Modifiez les informations de votre livre'
                                        : 'Publiez un livre scolaire pour l\'échanger'}
                                </CardDescription>
                            </div>
                        </div>
                        <Button variant="ghost" onClick={() => navigate(-1)}>
                            <ArrowLeft className="h-4 w-4 mr-2" />
                            Retour
                        </Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Titre */}
                    <div className="space-y-2">
                        <Label htmlFor="titre">Titre du livre *</Label>
                        <Input
                            id="titre"
                            placeholder="Ex: Mathématiques 6ème"
                            value={formData.titre}
                            onChange={(e) => setFormData({ ...formData, titre: e.target.value })}
                        />
                    </div>

                    {/* Auteur et Éditeur */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="auteur">Auteur</Label>
                            <Input
                                id="auteur"
                                placeholder="Nom de l'auteur"
                                value={formData.auteur}
                                onChange={(e) => setFormData({ ...formData, auteur: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="editeur">Éditeur</Label>
                            <Input
                                id="editeur"
                                placeholder="Ex: Hachette, Nathan"
                                value={formData.editeur}
                                onChange={(e) => setFormData({ ...formData, editeur: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* ISBN */}
                    <div className="space-y-2">
                        <Label htmlFor="isbn">ISBN</Label>
                        <Input
                            id="isbn"
                            placeholder="Numéro ISBN (optionnel)"
                            type="number"
                            value={formData.isbn}
                            onChange={(e) => setFormData({ ...formData, isbn: e.target.value })}
                        />
                    </div>

                    {/* Classes */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="classe_actuelle">Classe actuelle *</Label>
                            <Input
                                id="classe_actuelle"
                                placeholder="Ex: 6ème, 5ème, Terminale"
                                value={formData.classe_actuelle}
                                onChange={(e) => setFormData({ ...formData, classe_actuelle: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="classe_souhaitee">Classe souhaitée *</Label>
                            <Input
                                id="classe_souhaitee"
                                placeholder="Ex: 5ème, 4ème, 1ère"
                                value={formData.classe_souhaitee}
                                onChange={(e) => setFormData({ ...formData, classe_souhaitee: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* Matière */}
                    <div className="space-y-2">
                        <Label htmlFor="matiere">Matière *</Label>
                        <Input
                            id="matiere"
                            placeholder="Ex: Mathématiques, Français"
                            value={formData.matiere}
                            onChange={(e) => setFormData({ ...formData, matiere: e.target.value })}
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
                        <Label>État du livre *</Label>
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

                    {/* Description de l'état */}
                    <div className="space-y-2">
                        <Label htmlFor="description_etat">Description de l'état</Label>
                        <Textarea
                            id="description_etat"
                            placeholder="Décrivez l'état du livre en détail..."
                            rows={4}
                            value={formData.description_etat}
                            onChange={(e) => setFormData({ ...formData, description_etat: e.target.value })}
                        />
                    </div>

                    {/* Localisation */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="ville">Ville</Label>
                            <Input
                                id="ville"
                                placeholder="Ex: Douala, Yaoundé"
                                value={formData.ville}
                                onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="quartier">Quartier</Label>
                            <Input
                                id="quartier"
                                placeholder="Ex: Bonanjo, Akwa"
                                value={formData.quartier}
                                onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* GPS */}
                    <div className="space-y-2">
                        <Label>Position GPS</Label>
                        <div className="flex items-center gap-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGPSLocation}
                                className="flex items-center gap-2"
                            >
                                <MapPin className="h-4 w-4" />
                                {gpsCoordinates.lat ? 'Position enregistrée' : 'Utiliser ma position'}
                            </Button>
                            {gpsCoordinates.lat && (
                                <span className="text-sm text-gray-600">
                                    {gpsCoordinates.lat.toFixed(4)}, {gpsCoordinates.lng?.toFixed(4)}
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Bouton de soumission */}
                    <Button
                        onClick={handleSubmit}
                        className="w-full"
                        size="lg"
                        disabled={loading}
                    >
                        {loading ? (
                            <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                {mode === 'edit' ? 'Enregistrement...' : 'Création...'}
                            </>
                        ) : (
                            <>
                                {mode === 'edit' ? '💾 Enregistrer les modifications' : '✅ Créer le livre'}
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
};

export default LivreScolaireFormPage;

