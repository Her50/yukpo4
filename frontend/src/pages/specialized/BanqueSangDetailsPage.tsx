// ✅ Détails d'une banque de sang avec boutons d'action (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Droplet, Mail, MapPin, Phone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface BanqueSangDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    stocks?: Record<string, number>;
    telephone?: string;
    email?: string;
}

const BanqueSangDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [banque, setBanque] = useState<BanqueSangDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadBanqueDetails();
        }
    }, [id]);

    const loadBanqueDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/banques-sang/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setBanque(data.data);
            } else {
                alert('Impossible de charger les détails de la banque de sang');
                navigate('/banques-sang/search');
            }
        } catch (error: any) {
            console.error('[BanqueSangDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/banques-sang/search');
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (banque?.telephone) {
            window.open(`tel:${banque.telephone}`, '_self');
        }
    };

    const handleRequestDonation = () => {
        if (!user) {
            alert('Veuillez vous connecter pour faire une demande de don');
            navigate('/login');
            return;
        }
        navigate('/blood-donation/request');
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!banque) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Banque de sang non trouvée</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <Button
                    variant="ghost"
                    onClick={() => navigate(-1)}
                    className="mb-6"
                >
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Retour
                </Button>

                <Card className="mb-6">
                    <CardHeader>
                        <div className="flex items-start justify-between">
                            <div className="flex-1">
                                <CardTitle className="text-3xl mb-2 flex items-center gap-2">
                                    <Droplet className="w-8 h-8" />
                                    {banque.nom}
                                </CardTitle>
                            </div>
                            <Badge
                                variant={banque.is_available_now ? 'default' : 'secondary'}
                                className={`text-lg px-4 py-2 ${banque.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                            >
                                {banque.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(banque.adresse || banque.ville || banque.quartier) && (
                            <div className="flex items-start text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                                <div>
                                    {banque.adresse && <p>{banque.adresse}</p>}
                                    <p className="text-sm text-gray-600">
                                        {[banque.quartier, banque.ville].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {banque.gps && (
                            <div className="flex items-center text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{banque.gps}</span>
                            </div>
                        )}

                        {banque.telephone && (
                            <div className="flex items-center text-gray-700">
                                <Phone className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{banque.telephone}</span>
                            </div>
                        )}

                        {banque.email && (
                            <div className="flex items-center text-gray-700">
                                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{banque.email}</span>
                            </div>
                        )}

                        {banque.stocks && Object.keys(banque.stocks).length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Stocks disponibles</p>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {Object.entries(banque.stocks).map(([groupe, qty]) => (
                                        <div key={groupe} className="p-3 bg-red-50 rounded-lg">
                                            <p className="text-sm font-semibold text-red-900">{groupe}</p>
                                            <p className="text-lg font-bold text-red-700">{qty} unités</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Button
                        onClick={handleRequestDonation}
                        className="w-full"
                    >
                        <Droplet className="w-4 h-4 mr-2" />
                        Faire une demande de don
                    </Button>
                    {banque.telephone && (
                        <Button
                            variant="outline"
                            onClick={handleCall}
                            className="w-full"
                        >
                            <Phone className="w-4 h-4 mr-2" />
                            Appeler
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default BanqueSangDetailsPage;

