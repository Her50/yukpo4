// ✅ Page de détails d'un livre scolaire (Frontend)

import { ArrowLeft, BookOpen, Edit, Eye, EyeOff, Loader2, MapPin, RefreshCw } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiGet, apiPost } from '../../services/apiService';

const LivreScolaireDetailsPage: React.FC = () => {
    const { id: livreId } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);
    const [livre, setLivre] = useState<any>(null);

    useEffect(() => {
        if (livreId) {
            loadLivreDetails();
        }
    }, [livreId]);

    const loadLivreDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/bourse-livre/${livreId}`);
            const data = await response.json();

            if (data.success && data.data?.livre) {
                setLivre(data.data.livre);
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger les détails du livre',
                    variant: 'destructive',
                });
                navigate('/search');
            }
        } catch (error: any) {
            console.error('[LivreScolaireDetailsPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les détails',
                variant: 'destructive',
            });
            navigate('/search');
        } finally {
            setLoading(false);
        }
    };

    const handleFindMatching = async () => {
        if (!livre) return;

        try {
            const response = await apiPost('/api/troc-livres/match', {
                livre_id: livre.id,
                include_chaines: true,
                max_participants: 5,
            });
            const data = await response.json();

            if (data.success && data.data?.matchings) {
                navigate(`/${livre.id}/matching`, {
                    state: { matchings: data.data.matchings }
                });
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de trouver des matchings',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            toast({
                title: 'Erreur',
                description: error.message || 'Une erreur est survenue',
                variant: 'destructive',
            });
        }
    };

    const handleToggleAvailability = async () => {
        if (!livre) return;

        try {
            setUpdating(true);
            const response = await apiPost(`/api/bourse-livre/${livre.id}/availability`, {
                is_available: !livre.is_available,
            });
            const data = await response.json();

            if (data.success) {
                await loadLivreDetails();
                toast({
                    title: 'Succès',
                    description: 'Disponibilité mise à jour',
                });
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de mettre à jour la disponibilité',
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
            setUpdating(false);
        }
    };

    const getEtatColor = (etat: string): string => {
        switch (etat) {
            case 'Neuf': return 'bg-green-100 text-green-800';
            case 'Très bon': return 'bg-emerald-100 text-emerald-800';
            case 'Bon': return 'bg-yellow-100 text-yellow-800';
            case 'Acceptable': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">Chargement...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (!livre) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Livre non trouvé</h3>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isOwner = user?.id === livre.user_id;

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            {/* Header avec bouton retour */}
            <div className="mb-6">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-4"
                >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>
            </div>

            {/* Images */}
            {livre.images_urls && livre.images_urls.length > 0 && (
                <Card className="mb-6">
                    <CardContent className="p-0">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4">
                            {livre.images_urls.map((url: string, index: number) => (
                                <img
                                    key={index}
                                    src={url}
                                    alt={`${livre.titre} - Image ${index + 1}`}
                                    className="w-full h-64 object-cover rounded-lg"
                                />
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Informations principales */}
            <Card className="mb-6">
                <CardHeader>
                    <div className="flex items-start justify-between">
                        <div>
                            <CardTitle className="text-3xl mb-2">{livre.titre}</CardTitle>
                            {livre.auteur && (
                                <CardDescription className="text-lg">
                                    Par {livre.auteur}
                                </CardDescription>
                            )}
                        </div>
                        <Badge className={getEtatColor(livre.etat_livre)}>
                            {livre.etat_livre}
                        </Badge>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    {livre.editeur && (
                        <p className="text-gray-600">
                            <span className="font-semibold">Éditeur:</span> {livre.editeur}
                        </p>
                    )}
                    {livre.isbn && (
                        <p className="text-gray-600">
                            <span className="font-semibold">ISBN:</span> {livre.isbn}
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* Échange */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <BookOpen className="h-5 w-5" />
                        Échange
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="flex items-center gap-4">
                        <div className="flex-1">
                            <p className="text-sm text-gray-600 mb-1">Classe actuelle</p>
                            <p className="text-xl font-bold text-indigo-600">{livre.classe_actuelle}</p>
                        </div>
                        <ArrowLeft className="h-6 w-6 text-gray-400" />
                        <div className="flex-1">
                            <p className="text-sm text-gray-600 mb-1">Classe souhaitée</p>
                            <p className="text-xl font-bold text-indigo-600">{livre.classe_souhaitee}</p>
                        </div>
                    </div>
                    <div className="flex gap-4 pt-4 border-t">
                        <p className="text-gray-600">
                            <span className="font-semibold">📖 Matière:</span> {livre.matiere}
                        </p>
                        {livre.niveau && (
                            <p className="text-gray-600">
                                <span className="font-semibold">🎓 Niveau:</span> {livre.niveau}
                            </p>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* État */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>État du livre</CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-gray-700">{livre.description_etat || 'Aucune description'}</p>
                </CardContent>
            </Card>

            {/* Localisation */}
            {(livre.ville || livre.quartier) && (
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5" />
                            Localisation
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {livre.ville && (
                            <p className="text-gray-600 mb-1">
                                <span className="font-semibold">Ville:</span> {livre.ville}
                            </p>
                        )}
                        {livre.quartier && (
                            <p className="text-gray-600">
                                <span className="font-semibold">Quartier:</span> {livre.quartier}
                            </p>
                        )}
                    </CardContent>
                </Card>
            )}

            {/* Actions */}
            {!isOwner && livre.is_available && (
                <Card>
                    <CardContent className="p-6">
                        <Button
                            onClick={handleFindMatching}
                            className="w-full"
                            size="lg"
                        >
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Trouver un troc
                        </Button>
                    </CardContent>
                </Card>
            )}

            {isOwner && (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        <Button
                            onClick={() => navigate(`/${livre.id}/modifier`)}
                            variant="outline"
                            className="w-full"
                        >
                            <Edit className="h-4 w-4 mr-2" />
                            Modifier
                        </Button>
                        <Button
                            onClick={handleToggleAvailability}
                            variant="outline"
                            className="w-full"
                            disabled={updating}
                        >
                            {updating ? (
                                <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Mise à jour...
                                </>
                            ) : livre.is_available ? (
                                <>
                                    <EyeOff className="h-4 w-4 mr-2" />
                                    Marquer comme indisponible
                                </>
                            ) : (
                                <>
                                    <Eye className="h-4 w-4 mr-2" />
                                    Marquer comme disponible
                                </>
                            )}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default LivreScolaireDetailsPage;

