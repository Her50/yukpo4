// ✅ Détails d'une pharmacie avec boutons d'action (Frontend)
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/buttons';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Mail, MapPin, Phone, Pill } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface PharmacieDetails {
    id: number;
    service_id: number;
    user_id: number;
    nom: string;
    adresse?: string;
    quartier?: string;
    ville?: string;
    gps?: string;
    is_available_now: boolean;
    is_on_duty: boolean;
    telephone?: string;
    telephone_urgence?: string;
    email?: string;
    horaires?: any;
}

const PharmacieDetailsPage: React.FC = () => {
    const navigate = useNavigate();
    const { id } = useParams<{ id: string }>();
    const { user } = useAuth();

    const [pharmacie, setPharmacie] = useState<PharmacieDetails | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (id) {
            loadPharmacieDetails();
        }
    }, [id]);

    const loadPharmacieDetails = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/pharmacies/${id}`);
            const data = await response.json();

            if (data.success && data.data) {
                setPharmacie(data.data);
            } else {
                alert('Impossible de charger les détails de la pharmacie');
                navigate('/pharmacies/search');
            }
        } catch (error: any) {
            console.error('[PharmacieDetailsPage] Erreur:', error);
            alert(error.message || 'Impossible de charger les détails');
            navigate('/pharmacies/search');
        } finally {
            setLoading(false);
        }
    };

    const handleCall = () => {
        if (pharmacie?.telephone) {
            window.open(`tel:${pharmacie.telephone}`, '_self');
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

    if (!pharmacie) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <p className="text-gray-600">Pharmacie non trouvée</p>
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
                                    <Pill className="w-8 h-8" />
                                    {pharmacie.nom}
                                </CardTitle>
                            </div>
                            <div className="flex flex-col gap-2">
                                <Badge
                                    variant={pharmacie.is_available_now ? 'default' : 'secondary'}
                                    className={`text-lg px-4 py-2 ${pharmacie.is_available_now ? 'bg-green-100 text-green-800 border-green-300' : ''}`}
                                >
                                    {pharmacie.is_available_now ? 'Disponible' : 'Indisponible'}
                                </Badge>
                                {pharmacie.is_on_duty && (
                                    <Badge className="bg-blue-100 text-blue-800 border-blue-300">
                                        De garde
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {(pharmacie.adresse || pharmacie.ville || pharmacie.quartier) && (
                            <div className="flex items-start text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-0.5" />
                                <div>
                                    {pharmacie.adresse && <p>{pharmacie.adresse}</p>}
                                    <p className="text-sm text-gray-600">
                                        {[pharmacie.quartier, pharmacie.ville].filter(Boolean).join(', ')}
                                    </p>
                                </div>
                            </div>
                        )}

                        {pharmacie.gps && (
                            <div className="flex items-center text-gray-700">
                                <MapPin className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{pharmacie.gps}</span>
                            </div>
                        )}

                        {pharmacie.telephone && (
                            <div className="flex items-center text-gray-700">
                                <Phone className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{pharmacie.telephone}</span>
                            </div>
                        )}

                        {pharmacie.telephone_urgence && (
                            <div className="flex items-center text-red-700">
                                <Phone className="w-5 h-5 mr-3 text-red-400" />
                                <span className="font-semibold">Urgences: {pharmacie.telephone_urgence}</span>
                            </div>
                        )}

                        {pharmacie.email && (
                            <div className="flex items-center text-gray-700">
                                <Mail className="w-5 h-5 mr-3 text-gray-400" />
                                <span>{pharmacie.email}</span>
                            </div>
                        )}
                    </CardContent>
                </Card>

                <div className="space-y-3">
                    {pharmacie.telephone && (
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

export default PharmacieDetailsPage;

