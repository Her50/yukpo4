// ✅ Page de liste des résultats de recherche de livres scolaires (Frontend)

import { BookOpen, Loader2, MapPin } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { apiGet } from '../../services/apiService';

interface LivreScolaire {
    livre: {
        id: number;
        titre: string;
        auteur?: string;
        classe_actuelle: string;
        classe_souhaitee: string;
        matiere: string;
        niveau?: string;
        etat_livre: string;
        ville?: string;
        quartier?: string;
        images_urls?: string[];
        is_available: boolean;
    };
    distance_km?: number;
}

const LivreScolaireListPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { toast } = useToast();

    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);

    useEffect(() => {
        loadLivres();
    }, [searchParams]);

    const loadLivres = async () => {
        try {
            setLoading(true);
            const queryParams = new URLSearchParams(searchParams.toString());
            queryParams.append('limit', '20');
            queryParams.append('offset', ((page - 1) * 20).toString());

            const response = await apiGet(`/api/bourse-livre/search?${queryParams.toString()}`);
            const data = await response.json();

            if (data.success && data.data) {
                const newLivres = data.data.livres || [];
                if (page === 1) {
                    setLivres(newLivres);
                } else {
                    setLivres([...livres, ...newLivres]);
                }
                setHasMore(newLivres.length === 20);
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger les livres',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('[LivreScolaireListPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les livres',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleLoadMore = () => {
        if (!loading && hasMore) {
            setPage(page + 1);
            loadLivres();
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

    if (loading && livres.length === 0) {
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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-6">
                <h1 className="text-3xl font-bold mb-2">
                    {livres.length} livre{livres.length > 1 ? 's' : ''} trouvé{livres.length > 1 ? 's' : ''}
                </h1>
                <Button
                    variant="outline"
                    onClick={() => navigate('/search')}
                >
                    Modifier la recherche
                </Button>
            </div>

            {livres.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Aucun livre trouvé</h3>
                        <p className="text-gray-600 mb-4">
                            Essayez de modifier vos critères de recherche
                        </p>
                        <Button onClick={() => navigate('/search')}>
                            Nouvelle recherche
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
                        {livres.map((item) => {
                            const livre = item.livre;
                            const firstImage = livre.images_urls?.[0];

                            return (
                                <Card
                                    key={livre.id}
                                    className="cursor-pointer hover:shadow-lg transition-shadow"
                                    onClick={() => navigate(`/${livre.id}`)}
                                >
                                    {firstImage && (
                                        <div className="w-full h-48 overflow-hidden rounded-t-lg">
                                            <img
                                                src={firstImage}
                                                alt={livre.titre}
                                                className="w-full h-full object-cover"
                                            />
                                        </div>
                                    )}
                                    <CardContent className="p-4">
                                        <h3 className="font-bold text-lg mb-2 line-clamp-2">
                                            {livre.titre}
                                        </h3>
                                        {livre.auteur && (
                                            <p className="text-sm text-gray-600 mb-2">
                                                {livre.auteur}
                                            </p>
                                        )}
                                        <div className="space-y-1 mb-3">
                                            <p className="text-sm text-gray-600">
                                                📚 {livre.classe_actuelle} → {livre.classe_souhaitee}
                                            </p>
                                            <p className="text-sm text-gray-600">
                                                📖 {livre.matiere}
                                            </p>
                                            {livre.niveau && (
                                                <p className="text-sm text-gray-600">
                                                    🎓 {livre.niveau}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <Badge className={getEtatColor(livre.etat_livre)}>
                                                {livre.etat_livre}
                                            </Badge>
                                            {item.distance_km && (
                                                <span className="text-sm text-gray-600 flex items-center gap-1">
                                                    <MapPin className="h-4 w-4" />
                                                    {item.distance_km.toFixed(1)} km
                                                </span>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            );
                        })}
                    </div>

                    {hasMore && (
                        <div className="text-center">
                            <Button
                                onClick={handleLoadMore}
                                disabled={loading}
                                variant="outline"
                            >
                                {loading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                        Chargement...
                                    </>
                                ) : (
                                    'Charger plus'
                                )}
                            </Button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
};

export default LivreScolaireListPage;

