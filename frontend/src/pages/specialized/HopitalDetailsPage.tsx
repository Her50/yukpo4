// ✅ Phase 4: Détails d'un hôpital avec boutons d'action (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, ArrowLeft, Globe, Hospital, Mail, MapPin, Phone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface HopitalDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_etablissement: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    urgences_disponible: boolean;
    banque_sang: boolean;
    rdv_en_ligne: boolean;
    prestations_medicales?: string[];
    planning_hebdomadaire?: any;
    telephone?: string;
    telephone_urgence?: string;
    whatsapp?: string;
    email?: string;
    site_web?: string;
}

const HopitalDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [hopital, setHopital] = useState<HopitalDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);

    useEffect(() => {
        if (id) {
            loadHopitalDetails();
        }
    }, [id]);

    const loadHopitalDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/hopitaux/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setHopital(data.data);
            } else {
                alert('Impossible de charger les détails de l\'hôpital');
                navigate('/hopitaux/search');
            }
        } catch (error: any) {
            console.error('[HopitalDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/hopitaux/search');
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            alert('Veuillez vous connecter pour réserver un rendez-vous');
            navigate('/login');
            return;
        }

        navigate(`/hopitaux/${id}/book`);
    };

    const handleCall = () => {
        if (hopital?.telephone) {
            window.open(`tel:${hopital.telephone}`, '_self');
        }
    };

    const handleCallUrgence = () => {
        if (hopital?.telephone_urgence) {
            window.open(`tel:${hopital.telephone_urgence}`, '_self');
        }
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

    if (!hopital) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Hôpital non trouvé</p>
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
                                    <Hospital className="w-8 h-8" />
                                    {hopital.nom}
                                </CardTitle>
                                <p className="text-gray-600">{hopital.type_etablissement}</p>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Badge
                                    variant={hopital.is_available_now ? 'default' : 'secondary'}
                                    className={`text-lg px-4 py-2 ${hopital.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                                >
                                    {hopital.is_available_now ? 'Disponible' : 'Indisponible'}
                                </Badge>
                                {hopital.urgences_disponible && (
                                    <Badge className="bg-red-100 text-red-800 border-red-300">
                                        <AlertCircle className="w-3 h-3 mr-1" />
                                        Urgences
                                    </Badge>
                                )}
                                {hopital.banque_sang && (
                                    <Badge className="bg-pink-100 text-pink-800 border-pink-300">
                                        Banque de sang
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(hopital.adresse || hopital.ville || hopital.quartier) && (
                            <div className="flex items-start text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                                <div>
                                    {hopital.adresse && <p>{hopital.adresse}</p>}
                                    <p className="text-sm text-gray-600">
                                        {[hopital.quartier, hopital.ville].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {hopital.gps && (
                            <div className="flex items-center text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{hopital.gps}</span>
                            </div>
                        )}

                        {hopital.telephone && (
                            <div className="flex items-center text-gray-700">
                                <Phone className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{hopital.telephone}</span>
                            </div>
                        )}

                        {hopital.telephone_urgence && (
                            <div className="flex items-center text-red-700">
                                <AlertCircle className="w-5 h-5 mr-3 text-red-400" />
                                <span className="font-semibold">Urgences: {hopital.telephone_urgence}</span>
                            </div>
                        )}

                        {hopital.email && (
                            <div className="flex items-center text-gray-700">
                                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{hopital.email}</span>
                            </div>
                        )}

                        {hopital.site_web && (
                            <div className="flex items-center text-gray-700">
                                <Globe className="w-5 h-5 mr-3 text-gray-400" />
                                <a href={hopital.site_web} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                                    {hopital.site_web}
                                </a>
                            </div>
                        )}

                        {hopital.prestations_medicales && hopital.prestations_medicales.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Prestations médicales</p>
                                <div className="flex flex-wrap gap-2">
                                    {hopital.prestations_medicales.map((prest, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700">
                                            {prest}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {hopital.rdv_en_ligne && (
                            <div className="pt-4 border-t">
                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                    ✓ Rendez-vous en ligne disponible
                                </Badge>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Button
                        onClick={handleBook}
                        disabled={booking || !hopital.is_available_now}
                        className="w-full"
                    >
                        <Phone className="w-4 h-4 mr-2" />
                        {booking ? 'Réservation en cours...' : 'Réserver un rendez-vous'}
                    </Button>
                    {hopital.telephone && (
                        <Button
                            variant="outline"
                            onClick={handleCall}
                            className="w-full"
                        >
                            <Phone className="w-4 h-4 mr-2" />
                            Appeler
                        </Button>
                    )}
                    {hopital.telephone_urgence && hopital.urgences_disponible && (
                        <Button
                            variant="outline"
                            onClick={handleCallUrgence}
                            className="w-full bg-red-50 hover:bg-red-100 text-red-700 border-red-300"
                        >
                            <AlertCircle className="w-4 h-4 mr-2" />
                            Appeler les urgences
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default HopitalDetailsPage;

