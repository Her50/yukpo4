// ✅ Page de résultats de matching de troc (Frontend)

import { ArrowLeft, Link as LinkIcon, Loader2, RefreshCw, SearchX } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { useToast } from '../../hooks/use-toast';
import { apiPost } from '../../services/apiService';

interface MatchingDirect {
    livre_offert_id: number;
    livre_souhaite_id: number;
    participant_id: number;
    distance_km?: number;
    score_proximite: number;
    livre_offert?: any;
    livre_souhaite?: any;
}

interface MatchingChaine {
    chaine_id?: number;
    participants: Array<{
        user_id: number;
        livre_offert_id: number;
        livre_souhaite_id: number;
        ordre: number;
    }>;
    distance_totale_km: number;
    score_proximite: number;
    nombre_participants: number;
    livres?: any[];
}

const TrocMatchingPage: React.FC = () => {
    const { livreId } = useParams<{ livreId: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [directMatches, setDirectMatches] = useState<MatchingDirect[]>([]);
    const [chainMatches, setChainMatches] = useState<MatchingChaine[]>([]);

    useEffect(() => {
        const matchings = (location.state as any)?.matchings;
        if (matchings) {
            setDirectMatches(matchings.matches || []);
            setChainMatches(matchings.chaines || []);
            setLoading(false);
        } else if (livreId) {
            loadMatchings();
        }
    }, [livreId, location]);

    const loadMatchings = async () => {
        try {
            setLoading(true);
            const response = await apiPost('/api/troc-livres/match', {
                livre_id: parseInt(livreId || '0'),
                include_chaines: true,
                max_participants: 5,
            });
            const data = await response.json();

            if (data.success && data.data?.matchings) {
                const matchings = data.data.matchings;
                setDirectMatches(matchings.matches || []);
                setChainMatches(matchings.chaines || []);
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de trouver des matchings',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('[TrocMatchingPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les matchings',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateDirectTroc = async (match: MatchingDirect) => {
        try {
            setCreating(true);
            const response = await apiPost('/api/troc-livres/direct', {
                livre_offert_id: match.livre_offert_id,
                livre_souhaite_id: match.livre_souhaite_id,
                participant_id: match.participant_id,
            });
            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Succès',
                    description: 'Troc proposé ! Le participant recevra une notification.',
                });
                setTimeout(() => {
                    navigate('/trocs/mes-trocs');
                }, 1500);
            } else {
                toast({
                    title: 'Erreur',
                    description: data.error || 'Impossible de créer le troc',
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
            setCreating(false);
        }
    };

    const handleCreateChaineTroc = async (chaine: MatchingChaine) => {
        try {
            setCreating(true);
            const response = await apiPost('/api/troc-livres/chaine', {
                participants: chaine.participants,
            });
            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Succès',
                    description: `Chaîne de ${chaine.nombre_participants} personnes créée ! Tous les participants seront notifiés.`,
                });
                setTimeout(() => {
                    navigate('/trocs/mes-trocs');
                }, 1500);
            } else {
                toast({
                    title: 'Erreur',
                    description: data.error || 'Impossible de créer la chaîne',
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
            setCreating(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="flex items-center justify-center min-h-[400px]">
                    <div className="text-center">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mx-auto mb-4" />
                        <p className="text-gray-600">Recherche de matchings...</p>
                    </div>
                </div>
            </div>
        );
    }

    const totalMatches = directMatches.length + chainMatches.length;

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>
                <h1 className="text-3xl font-bold">
                    {totalMatches} matching{totalMatches > 1 ? 's' : ''} trouvé{totalMatches > 1 ? 's' : ''}
                </h1>
            </div>

            {totalMatches === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <SearchX className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Aucun matching trouvé</h3>
                        <p className="text-gray-600 mb-4">
                            Aucun livre ne correspond à vos critères pour le moment.
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-8">
                    {/* Troc Direct */}
                    {directMatches.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">
                                🔄 Troc Direct ({directMatches.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {directMatches.map((match, index) => (
                                    <Card key={index}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle className="text-lg line-clamp-2">
                                                        {match.livre_offert?.titre || 'Livre offert'} ↔
                                                    </CardTitle>
                                                    <CardDescription className="line-clamp-2">
                                                        {match.livre_souhaite?.titre || 'Livre souhaité'}
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-indigo-600">
                                                        {Math.round(match.score_proximite * 100)}%
                                                    </div>
                                                    <div className="text-xs text-gray-600">Match</div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            {match.distance_km && (
                                                <p className="text-sm text-gray-600 mb-4">
                                                    📍 {match.distance_km.toFixed(1)} km
                                                </p>
                                            )}
                                            <Button
                                                onClick={() => handleCreateDirectTroc(match)}
                                                className="w-full"
                                                disabled={creating}
                                            >
                                                {creating ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Création...
                                                    </>
                                                ) : (
                                                    <>
                                                        <RefreshCw className="h-4 w-4 mr-2" />
                                                        Proposer ce troc
                                                    </>
                                                )}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Chaînes de troc */}
                    {chainMatches.length > 0 && (
                        <div>
                            <h2 className="text-2xl font-bold mb-4">
                                🔗 Chaînes de Troc ({chainMatches.length})
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {chainMatches.map((chaine, index) => (
                                    <Card key={index}>
                                        <CardHeader>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <CardTitle>
                                                        Chaîne de {chaine.nombre_participants} personnes
                                                    </CardTitle>
                                                    <CardDescription>
                                                        Distance totale: {chaine.distance_totale_km.toFixed(1)} km
                                                    </CardDescription>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-indigo-600">
                                                        {Math.round(chaine.score_proximite * 100)}%
                                                    </div>
                                                    <div className="text-xs text-gray-600">Score</div>
                                                </div>
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
                                                <div className="flex flex-wrap gap-2">
                                                    {chaine.livres?.slice(0, 3).map((livre: any, i: number) => (
                                                        <Badge key={i} variant="outline" className="text-xs">
                                                            {livre.titre || `Livre ${i + 1}`}
                                                        </Badge>
                                                    ))}
                                                    {chaine.nombre_participants > 3 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{chaine.nombre_participants - 3} autres
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                            <Button
                                                onClick={() => handleCreateChaineTroc(chaine)}
                                                variant="outline"
                                                className="w-full"
                                                disabled={creating}
                                            >
                                                {creating ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                                        Création...
                                                    </>
                                                ) : (
                                                    <>
                                                        <LinkIcon className="h-4 w-4 mr-2" />
                                                        Créer cette chaîne
                                                    </>
                                                )}
                                            </Button>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default TrocMatchingPage;

