// ✅ Page de détails d'un troc (Frontend)

import { ArrowLeft, CheckCircle2, Link as LinkIcon, Loader2, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiGet, apiPost } from '../../services/apiService';

interface TrocDetails {
    troc: {
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
    };
    livre_offert?: any;
    livre_souhaite?: any;
    initiateur?: any;
    participant?: any;
    chaine?: any;
}

const TrocDetailsPage: React.FC = () => {
    const { trocId } = useParams<{ trocId: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const [loading, setLoading] = useState(true);
    const [actionLoading, setActionLoading] = useState(false);
    const [troc, setTroc] = useState<TrocDetails | null>(null);

    useEffect(() => {
        if (trocId) {
            loadTrocDetails();
        }
    }, [trocId]);

    const loadTrocDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/troc-livres/${trocId}`);
            const data = await response.json();

            if (data.success && data.data) {
                setTroc(data.data);
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger les détails du troc',
                    variant: 'destructive',
                });
                navigate('/trocs/mes-trocs');
            }
        } catch (error: any) {
            console.error('[TrocDetailsPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger les détails',
                variant: 'destructive',
            });
            navigate('/trocs/mes-trocs');
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        try {
            setActionLoading(true);
            const response = await apiPost(`/api/troc-livres/${trocId}/accept`, {});
            const data = await response.json();

            if (data.success) {
                toast({
                    title: 'Succès',
                    description: 'Troc accepté !',
                });
                await loadTrocDetails();
            } else {
                toast({
                    title: 'Erreur',
                    description: data.error || 'Impossible d\'accepter le troc',
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
            setActionLoading(false);
        }
    };

    const handleRefuse = async () => {
        if (confirm('Êtes-vous sûr de vouloir refuser ce troc ?')) {
            try {
                setActionLoading(true);
                const response = await apiPost(`/api/troc-livres/${trocId}/refuse`, {});
                const data = await response.json();

                if (data.success) {
                    toast({
                        title: 'Succès',
                        description: 'Troc refusé',
                    });
                    navigate('/trocs/mes-trocs');
                } else {
                    toast({
                        title: 'Erreur',
                        description: data.error || 'Impossible de refuser le troc',
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
                setActionLoading(false);
            }
        }
    };

    const handleComplete = async () => {
        if (confirm('Confirmez-vous que l\'échange a été effectué ?')) {
            try {
                setActionLoading(true);
                const response = await apiPost(`/api/troc-livres/${trocId}/complete`, {});
                const data = await response.json();

                if (data.success) {
                    toast({
                        title: 'Succès',
                        description: 'Troc finalisé avec succès !',
                    });
                    await loadTrocDetails();
                } else {
                    toast({
                        title: 'Erreur',
                        description: data.error || 'Impossible de finaliser le troc',
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
                setActionLoading(false);
            }
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

    if (!troc) {
        return (
            <div className="container mx-auto px-4 py-8">
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <h3 className="text-xl font-semibold mb-2">Troc non trouvé</h3>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const isInitiateur = user?.id === troc.troc.initiateur_id;
    const canAccept = !isInitiateur && troc.troc.statut === 'en_attente';
    const canRefuse = troc.troc.statut === 'en_attente';
    const canComplete = troc.troc.statut === 'accepte';

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="mb-6">
                <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4">
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Retour
                </Button>
            </div>

            {/* Statut */}
            <Card className="mb-6">
                <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                        <Badge className={getStatutColor(troc.troc.statut)}>
                            {getStatutLabel(troc.troc.statut)}
                        </Badge>
                        {troc.troc.type_troc === 'chaine' && (
                            <Badge variant="outline" className="flex items-center gap-1">
                                <LinkIcon className="h-3 w-3" />
                                Chaîne de troc
                            </Badge>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Échange */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>📚 Échange</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                                {isInitiateur ? 'Vous offrez' : 'Vous recevez'}
                            </p>
                            <p className="font-bold text-lg">{troc.livre_offert?.titre || 'Livre offert'}</p>
                            {troc.livre_offert && (
                                <p className="text-sm text-gray-600">
                                    📖 {troc.livre_offert.classe_actuelle} → {troc.livre_offert.classe_souhaitee}
                                </p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <p className="text-sm text-gray-600">
                                {isInitiateur ? 'Vous recevez' : 'Vous offrez'}
                            </p>
                            <p className="font-bold text-lg">{troc.livre_souhaite?.titre || 'Livre souhaité'}</p>
                            {troc.livre_souhaite && (
                                <p className="text-sm text-gray-600">
                                    📖 {troc.livre_souhaite.classe_actuelle} → {troc.livre_souhaite.classe_souhaitee}
                                </p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Informations */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>ℹ️ Informations</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    {troc.troc.distance_km && (
                        <p className="text-gray-600">
                            📍 Distance: {troc.troc.distance_km.toFixed(1)} km
                        </p>
                    )}
                    <p className="text-gray-600">
                        📅 Créé le: {new Date(troc.troc.created_at).toLocaleDateString()}
                    </p>
                </CardContent>
            </Card>

            {/* Validations */}
            <Card className="mb-6">
                <CardHeader>
                    <CardTitle>✅ Validations</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                        <div className={`p-4 rounded-lg border-2 ${troc.troc.validation_initiateur ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                            <p className="font-semibold mb-1">
                                {troc.troc.validation_initiateur ? '✓' : '○'} Initiateur
                            </p>
                        </div>
                        <div className={`p-4 rounded-lg border-2 ${troc.troc.validation_participant ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                            <p className="font-semibold mb-1">
                                {troc.troc.validation_participant ? '✓' : '○'} Participant
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Actions */}
            {(canAccept || canRefuse || canComplete) && (
                <Card>
                    <CardContent className="p-6 space-y-4">
                        {canAccept && (
                            <Button
                                onClick={handleAccept}
                                className="w-full"
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Traitement...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Accepter le troc
                                    </>
                                )}
                            </Button>
                        )}
                        {canRefuse && (
                            <Button
                                onClick={handleRefuse}
                                variant="outline"
                                className="w-full"
                                disabled={actionLoading}
                            >
                                <XCircle className="h-4 w-4 mr-2" />
                                Refuser le troc
                            </Button>
                        )}
                        {canComplete && (
                            <Button
                                onClick={handleComplete}
                                className="w-full"
                                disabled={actionLoading}
                            >
                                {actionLoading ? (
                                    <>
                                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        Traitement...
                                    </>
                                ) : (
                                    <>
                                        <CheckCircle2 className="h-4 w-4 mr-2" />
                                        Finaliser l'échange
                                    </>
                                )}
                            </Button>
                        )}
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default TrocDetailsPage;

