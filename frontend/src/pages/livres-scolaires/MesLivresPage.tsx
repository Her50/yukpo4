// ✅ Page de gestion des livres scolaires de l'utilisateur (Frontend)

import { BookOpen, Edit, Eye, EyeOff, Loader2, Plus, Trash2 } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Card, CardContent } from '../../components/ui/card';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../hooks/use-toast';
import { apiDelete, apiGet, apiPost } from '../../services/apiService';

interface LivreScolaire {
    id: number;
    titre: string;
    auteur?: string;
    classe_actuelle: string;
    classe_souhaitee: string;
    matiere: string;
    niveau?: string;
    etat_livre: string;
    images_urls?: string[];
    is_available: boolean;
    is_active: boolean;
    created_at: string;
}

const MesLivresPage: React.FC = () => {
    const navigate = useNavigate();
    const { toast } = useToast();
    const { user } = useAuth();

    const [livres, setLivres] = useState<LivreScolaire[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadLivres();
    }, []);

    const loadLivres = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/livres-scolaires/mes-livres');
            const data = await response.json();

            if (data.success && data.data) {
                setLivres(data.data.livres || []);
            } else {
                toast({
                    title: 'Erreur',
                    description: 'Impossible de charger vos livres',
                    variant: 'destructive',
                });
            }
        } catch (error: any) {
            console.error('[MesLivresPage] Erreur:', error);
            toast({
                title: 'Erreur',
                description: error.message || 'Impossible de charger vos livres',
                variant: 'destructive',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleToggleAvailability = async (livre: LivreScolaire) => {
        try {
            const response = await apiPost(`/api/livres-scolaires/${livre.id}/availability`, {
                is_available: !livre.is_available,
            });
            const data = await response.json();

            if (data.success) {
                await loadLivres();
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
        }
    };

    const handleDelete = async (livre: LivreScolaire) => {
        if (confirm(`Êtes-vous sûr de vouloir supprimer "${livre.titre}" ?`)) {
            try {
                const response = await apiDelete(`/api/livres-scolaires/${livre.id}`);
                const data = await response.json();
                if (data.success) {
                    await loadLivres();
                    toast({
                        title: 'Succès',
                        description: 'Livre supprimé',
                    });
                } else {
                    toast({
                        title: 'Erreur',
                        description: 'Impossible de supprimer le livre',
                        variant: 'destructive',
                    });
                }
            } catch (error: any) {
                toast({
                    title: 'Erreur',
                    description: error.message || 'Impossible de supprimer le livre',
                    variant: 'destructive',
                });
            }
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

    return (
        <div className="container mx-auto px-4 py-8 max-w-6xl">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-3xl font-bold">Mes Livres</h1>
                <Button onClick={() => navigate('/livres-scolaires/new')}>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer un livre
                </Button>
            </div>

            {livres.length === 0 ? (
                <Card>
                    <CardContent className="flex flex-col items-center justify-center py-12">
                        <BookOpen className="h-16 w-16 text-gray-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Aucun livre publié</h3>
                        <p className="text-gray-600 mb-4">
                            Créez votre premier livre scolaire pour commencer à échanger
                        </p>
                        <Button onClick={() => navigate('/livres-scolaires/new')}>
                            <Plus className="h-4 w-4 mr-2" />
                            Créer un livre
                        </Button>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {livres.map((livre) => {
                        const firstImage = livre.images_urls?.[0];

                        return (
                            <Card key={livre.id} className="hover:shadow-lg transition-shadow">
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
                                    <h3 className="font-bold text-lg mb-2 line-clamp-2">{livre.titre}</h3>
                                    {livre.auteur && (
                                        <p className="text-sm text-gray-600 mb-2">{livre.auteur}</p>
                                    )}
                                    <div className="space-y-1 mb-3">
                                        <p className="text-sm text-gray-600">
                                            📚 {livre.classe_actuelle} → {livre.classe_souhaitee}
                                        </p>
                                        <p className="text-sm text-gray-600">📖 {livre.matiere}</p>
                                    </div>
                                    <div className="flex items-center justify-between mb-3">
                                        <Badge className={getEtatColor(livre.etat_livre)}>
                                            {livre.etat_livre}
                                        </Badge>
                                        <Badge
                                            variant={livre.is_available ? 'default' : 'secondary'}
                                        >
                                            {livre.is_available ? 'Disponible' : 'Indisponible'}
                                        </Badge>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            className="flex-1"
                                            onClick={() => navigate(`/livres-scolaires/${livre.id}/edit`)}
                                        >
                                            <Edit className="h-4 w-4 mr-1" />
                                            Modifier
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleToggleAvailability(livre)}
                                        >
                                            {livre.is_available ? (
                                                <EyeOff className="h-4 w-4" />
                                            ) : (
                                                <Eye className="h-4 w-4" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleDelete(livre)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
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

export default MesLivresPage;

