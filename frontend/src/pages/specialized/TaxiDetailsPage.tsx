// ✅ Phase 5: Détails d'un taxi avec boutons d'action (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Car, Mail, MapPin, Phone, User } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

interface TaxiDetails {
    id: number;
    service_id: number;
    user_id: number;
    zone: string;
    gps_actuel?: string;
    is_available_now: boolean;
    type_vehicule?: string;
    marque_modele?: string;
    telephone?: string;
    email?: string;
    prestataire?: {
        nom_complet?: string;
        avatar_url?: string;
        user_id: number;
    };
}

const TaxiDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [taxi, setTaxi] = useState<TaxiDetails | null>(null);
    const [loading, setLoading] = useState(true);
    const [booking, setBooking] = useState(false);

    useEffect(() => {
        if (id) {
            loadTaxiDetails();
        }
    }, [id]);

    const loadTaxiDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/taxis/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setTaxi(data.data);
            } else {
                alert('Impossible de charger les détails du taxi');
                navigate('/taxis/search');
            }
        } catch (error: any) {
            console.error('[TaxiDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/taxis/search');
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async () => {
        if (!user) {
            alert('Veuillez vous connecter pour réserver un taxi');
            navigate('/login');
            return;
        }

        try {
            setBooking(true);
            const response = await apiPost(`/api/taxis/${id}/book`, {
                notes: 'Réservation depuis le site web',
            });
            const data = await response.json();

            if (data.success) {
                alert('Réservation créée avec succès. Le chauffeur sera notifié.');
                navigate('/reservations');
            } else {
                alert(data.error || 'Impossible de créer la réservation');
            }
        } catch (error: any) {
            console.error('[TaxiDetailsPage] Erreur réservation:', error);
            alert(error.message || 'Impossible de créer la réservation');
        } finally {
            setBooking(false);
        }
    };

    const handleCall = () => {
        if (taxi?.telephone) {
            window.open(`tel:${taxi.telephone}`, '_self');
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

    if (!taxi) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Taxi non trouvé</p>
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
                            <div>
                                <CardTitle className="text-3xl mb-2">{taxi.zone}</CardTitle>
                                {taxi.type_vehicule && (
                                    <p className="text-gray-600">{taxi.type_vehicule}</p>
                                )}
                            </div>
                            <Badge
                                variant={taxi.is_available_now ? 'default' : 'secondary'}
                                className={`text-lg px-4 py-2 ${taxi.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                            >
                                {taxi.is_available_now ? 'Disponible' : 'Occupé'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {taxi.marque_modele && (
                            <div className="flex items-center text-gray-700">
                                <Car className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{taxi.marque_modele}</span>
                            </div>
                        )}

                        {taxi.telephone && (
                            <div className="flex items-center text-gray-700">
                                <Phone className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{taxi.telephone}</span>
                            </div>
                        )}

                        {taxi.email && (
                            <div className="flex items-center text-gray-700">
                                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{taxi.email}</span>
                            </div>
                        )}

                        {taxi.gps_actuel && (
                            <div className="flex items-center text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{taxi.gps_actuel}</span>
                            </div>
                        )}

                        {taxi.prestataire && (
                            <div className="pt-4 border-t">
                                <div className="flex items-center text-gray-700">
                                    <User className="w-5 h-5 mr-3 text-gray-400" />
                                    <div>
                                        <p className="font-semibold">Chauffeur</p>
                                        <p className="text-sm text-gray-600">
                                            {taxi.prestataire.nom_complet || 'Non renseigné'}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {/* ✅ Phase 6: Bouton gestion pour propriétaire */}
                    {user && taxi.user_id === Number(user.id) && (
                        <Button
                            variant="outline"
                            onClick={() => navigate(`/taxis/${id}/availability`)}
                            className="w-full"
                        >
                            ⚙️ Gérer la disponibilité
                        </Button>
                    )}
                    <Button
                        onClick={handleBook}
                        disabled={booking || !taxi.is_available_now}
                        className="w-full"
                    >
                        <Phone className="w-4 h-4 mr-2" />
                        {booking ? 'Réservation en cours...' : 'Réserver / Appeler'}
                    </Button>
                    {taxi.telephone && (
                        <Button
                            variant="outline"
                            onClick={handleCall}
                            className="w-full"
                        >
                            <Phone className="w-4 h-4 mr-2" />
                            Appeler directement
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default TaxiDetailsPage;

