// ✅ Page de gestion des trocs de l'utilisateur (Frontend)

import { ArrowRight, Link as LinkIcon, Loader2, Repeat } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiGet } from '../../services/apiService';

interface TrocLivre {
    id: number;
    type_troc: string;
    statut: string;
    livre_offert_id: number;
    livre_souhaite_id: number;
    participant_id?: number;
    initiateur_id: number;
    chaine_troc_id?: number;
    distance_km?: number;
    validation_initiateur: boolean;
    validation_participant: boolean;
    created_at: string;
    livre_offert?: any;
    livre_souhaite?: any;
}

const MesTrocsPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const [trocs, setTrocs] = useState<TrocLivre[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<string>('all');

    useEffect(() => {
        loadTrocs();
    }, [filter]);

    const loadTrocs = async () => {
        try {
            setLoading(true);
            const params = filter !== 'all' ? `?statut=${filter}` : '';
            const response = await apiGet(`/api/troc-livres/my-trocs${params}`);
            const data = await response.json();

            if (data.success && data.data) {
                setTrocs(data.data.trocs || []);
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger vos trocs',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('[MesTrocsPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger vos trocs',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const getStatutColor = (statut: string): string => {
        switch (statut) {
            case 'en_attente': return 'bg-yellow-100 text-yellow-800';
            case 'accepte': return 'bg-green-100 text-green-800';
            case 'refuse': return 'bg-red-100 text-red-800';
            case 'complete': return 'bg-indigo-100 text-indigo-800';
            case 'annule': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getStatutLabel = (statut: string): string => {
        switch (statut) {
            case 'en_attente': return 'En attente';
            case 'accepte': return 'Accepté';
            case 'refuse': return 'Refusé';
            case 'complete': return 'Complété';
            case 'annule': return 'Annulé';
            default: return statut;
        }
    };

    const filters = [
        { key: 'all', label: 'Tous' },
        { key: 'en_attente', label: 'En attente' },
        { key: 'accepte', label: 'Acceptés' },
        { key: 'complete', label: 'Complétés' },
    ];

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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <h1 className="text-3xl font-bold mb-6">Mes Troc</h1>

            {/* Filtres */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {filters.map((f) => (
                    <Button
                        key={f.key}
                        variant={filter === f.key ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setFilter(f.key)}
                    >
                        {f.label}
                    </Button>
                ))}
            </div>

            {trocs.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <Repeat className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Aucun troc</h3>
                        <p className="text-gray-600 mb-4">
                            {filter === 'all'
                                ? 'Vous n\'avez pas encore de troc. Créez-en un depuis un livre !'
                                : `Aucun troc avec le statut "${filters.find((f) => f.key === filter)?.label}".`}
                        </p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-4">
                    {trocs.map((troc) => {
                        const isInitiateur = user?.id !== undefined && Number(user.id) === troc.initiateur_id;

                        return (
                            <Card
                                key={troc.id}
                                className="cursor-pointer hover:shadow-lg transition-shadow"
                                onClick={() => navigate(`/trocs/${troc.id}`)}
                            >
                                <CardContent className="p-6">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Badge className={getStatutColor(troc.statut)}>
                                                {getStatutLabel(troc.statut)}
                                            </Badge>
                                            {troc.type_troc === 'chaine' && (
                                                <Badge variant="outline" className="flex items-center gap-1">
                                                    <LinkIcon className="h-3 w-3" />
                                                    Chaîne
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-600">
                                                {isInitiateur ? 'Vous offrez' : 'Vous recevez'}
                                            </p>
                                            <p className="font-semibold">
                                                {troc.livre_offert?.titre || 'Livre offert'}
                                            </p>
                                        </div>
                                        <ArrowRight className="hidden md:block h-6 w-6 text-gray-400 self-center" />
                                        <div className="space-y-2">
                                            <p className="text-sm text-gray-600">
                                                {isInitiateur ? 'Vous recevez' : 'Vous offrez'}
                                            </p>
                                            <p className="font-semibold">
                                                {troc.livre_souhaite?.titre || 'Livre souhaité'}
                                            </p>
                                        </div>
                                    </div>

                                    {troc.distance_km && (
                                        <p className="text-sm text-gray-600 mb-3">
                                            📍 {troc.distance_km.toFixed(1)} km
                                        </p>
                                    )}

                                    <div className="flex items-center gap-4 pt-3 border-t">
                                        <span className="text-sm text-gray-600">Validations:</span>
                                        <Badge
                                            variant={
                                                troc.validation_initiateur ? 'default' : 'outline'
                                            }
                                        >
                                            {troc.validation_initiateur ? '✓' : '○'} Initiateur
                                        </Badge>
                                        <Badge
                                            variant={
                                                troc.validation_participant ? 'default' : 'outline'
                                            }
                                        >
                                            {troc.validation_participant ? '✓' : '○'} Participant
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default MesTrocsPage;

