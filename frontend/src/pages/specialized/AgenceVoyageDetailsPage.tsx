// ✅ Détails d'une agence de voyage avec boutons d'action (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Bus, Mail, MapPin, Phone } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface AgenceVoyageDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom_agence: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    services_voyage?: string[];
    compagnies_bus?: string[];
    destinations?: string[];
    heures_ouverture?: string;
    heures_fermeture?: string;
    telephone?: string;
    email?: string;
}

const AgenceVoyageDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [agence, setAgence] = useState<AgenceVoyageDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadAgenceDetails();
        }
    }, [id]);

    const loadAgenceDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/agences-voyage/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setAgence(data.data);
            } else {
                alert('Impossible de charger les détails de l\'agence de voyage');
                navigate('/agences-voyage/search');
            }
        } catch (error: any) {
            console.error('[AgenceVoyageDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/agences-voyage/search');
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (agence?.telephone) {
            window.open(`tel:${agence.telephone}`, '_self');
        }
    };

    const handleBookTicket = () => {
        navigate('/bus-tickets/search');
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

    if (!agence) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Agence de voyage non trouvée</p>
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
                                    <Bus className="w-8 h-8" />
                                    {agence.nom_agence}
                                </CardTitle>
                            </div>
                            <Badge
                                variant={agence.is_available_now ? 'default' : 'secondary'}
                                className={`text-lg px-4 py-2 ${agence.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                            >
                                {agence.is_available_now ? 'Disponible' : 'Indisponible'}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(agence.adresse || agence.ville || agence.quartier) && (
                            <div className="flex items-start text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                                <div>
                                    {agence.adresse && <p>{agence.adresse}</p>}
                                    <p className="text-sm text-gray-600">
                                        {[agence.quartier, agence.ville].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {agence.gps && (
                            <div className="flex items-center text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{agence.gps}</span>
                            </div>
                        )}

                        {agence.telephone && (
                            <div className="flex items-center text-gray-700">
                                <Phone className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{agence.telephone}</span>
                            </div>
                        )}

                        {agence.email && (
                            <div className="flex items-center text-gray-700">
                                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{agence.email}</span>
                            </div>
                        )}

                        {(agence.heures_ouverture || agence.heures_fermeture) && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Horaires</p>
                                <p className="text-gray-700">
                                    {agence.heures_ouverture && agence.heures_fermeture
                                        ? `${agence.heures_ouverture} - ${agence.heures_fermeture}`
                                        : agence.heures_ouverture || agence.heures_fermeture || 'Non renseignés'}
                                </p>
                            </div>
                        )}

                        {agence.destinations && agence.destinations.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Destinations</p>
                                <div className="flex flex-wrap gap-2">
                                    {agence.destinations.map((dest, idx) => (
                                        <Badge key={idx} variant="outline">
                                            {dest}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {agence.compagnies_bus && agence.compagnies_bus.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Compagnies de bus</p>
                                <div className="flex flex-wrap gap-2">
                                    {agence.compagnies_bus.map((comp, idx) => (
                                        <Badge key={idx} variant="outline">
                                            {comp}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}

                        {agence.services_voyage && agence.services_voyage.length > 0 && (
                            <div className="pt-4 border-t">
                                <p className="font-semibold text-gray-900 mb-2">Services</p>
                                <div className="flex flex-wrap gap-2">
                                    {agence.services_voyage.map((service, idx) => (
                                        <Badge key={idx} variant="outline">
                                            {service}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    <Button
                        onClick={handleBookTicket}
                        className="w-full"
                    >
                        <Bus className="w-4 h-4 mr-2" />
                        Réserver un billet
                    </Button>
                    {agence.telephone && (
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

export default AgenceVoyageDetailsPage;

