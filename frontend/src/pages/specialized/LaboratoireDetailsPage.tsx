// ✅ Phase 4: Détails d'un laboratoire avec boutons d'action (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, CheckCircle, Mail, MapPin, Microscope, Phone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface LaboratoireDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    type_laboratoire: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    analyses_disponibles?: string[];
    imagerie_disponible?: string[];
    rdv_requis: boolean;
    resultats_en_ligne: boolean;
    planning_hebdomadaire?: any;
    telephone?: string;
    whatsapp?: string;
    email?: string;
}

const LaboratoireDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [laboratoire, setLaboratoire] = useState<LaboratoireDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);

    useEffect(() => {
        if (id) {
            loadLaboratoireDetails();
        }
    }, [id]);

    const loadLaboratoireDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/laboratoires/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setLaboratoire(data.data);
            } else {
                alert('Impossible de charger les détails du laboratoire');
                navigate('/laboratoires/search');
            }
        } catch (error: any) {
            console.error('[LaboratoireDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/laboratoires/search');
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

        navigate(`/laboratoires/${id}/book`);
    };

    const handleCall = () => {
        if (laboratoire?.telephone) {
            window.open(`tel:${laboratoire.telephone}`, '_self');
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

    if (!laboratoire) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Laboratoire non trouvé</p>
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
                                    <Microscope className="w-8 h-8" />
                                    {laboratoire.nom}
                                </CardTitle>
                                <p className="text-gray-600">{laboratoire.type_laboratoire}</p>
                            </div>
                            <Badge
                                variant={laboratoire.is_available_now ? 'default' : 'secondary'}
                                className={`text-lg px-4 py-2 ${laboratoire.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                            >
                                {laboratoire.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(laboratoire.adresse || laboratoire.ville || laboratoire.quartier) && (
                            <div className="flex items-start text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                                <div>
                                    {laboratoire.adresse && <p>{laboratoire.adresse}</p>}
                                    <p className="text-sm text-gray-600">
                                        {[laboratoire.quartier, laboratoire.ville].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {laboratoire.gps && (
                            <div className="flex items-center text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{laboratoire.gps}</span>
                            </div>
                        )}

                        {laboratoire.telephone && (
                            <div className="flex items-center text-gray-700">
                                <Phone className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{laboratoire.telephone}</span>
                            </div>
                        )}

                        {laboratoire.email && (
                            <div className="flex items-center text-gray-700">
                                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{laboratoire.email}</span>
                            </div>
                        )}

                        {laboratoire.analyses_disponibles && laboratoire.analyses_disponibles.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Analyses disponibles</p>
                                <div className="flex flex-wrap gap-2">
                                    {laboratoire.analyses_disponibles.map((anal, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-purple-50 text-purple-700">
                                            {anal}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {laboratoire.imagerie_disponible && laboratoire.imagerie_disponible.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Imagerie disponible</p>
                                <div className="flex flex-wrap gap-2">
                                    {laboratoire.imagerie_disponible.map((img, idx) => (
                                        <Badge key={idx} variant="outline" className="bg-blue-50 text-blue-700">
                                            {img}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="pt-4 border-t space-y-2">
                            {laboratoire.rdv_requis && (
                                <Badge className="bg-yellow-100 text-yellow-800 border-yellow-300">
                                    Rendez-vous requis
                                </Badge>
                            )}
                            {laboratoire.resultats_en_ligne && (
                                <Badge className="bg-green-100 text-green-800 border-green-300">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Résultats en ligne disponible
                                </Badge>
                            )}
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Button
                        onClick={handleBook}
                        disabled={booking || !laboratoire.is_available_now}
                        className="w-full"
                    >
                        <Phone className="w-4 h-4 mr-2" />
                        {booking ? 'Réservation en cours...' : 'Réserver un rendez-vous'}
                    </Button>
                    {laboratoire.telephone && (
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

export default LaboratoireDetailsPage;

