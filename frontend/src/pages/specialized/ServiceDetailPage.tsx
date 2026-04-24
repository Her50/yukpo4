// ✅ NOUVEAU: Page web de détails de service spécialisé

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
const ProductCommentsSection: React.FC<any> = () => null;
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

const ServiceDetailPage: React.FC = () => {
    const { serviceId } = useParams<{ serviceId: string }>();
    const { user } = useAuth();
    const navigate = useNavigate();

    const [loading, setLoading] = useState(true);
    const [service, setService] = useState<any>(null);
    const [ratingStats, setRatingStats] = useState<any>(null);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        if (serviceId) {
            loadServiceDetails();
            loadRatingStats();
        }
    }, [serviceId]);

    const loadServiceDetails = async () => {
        try {
            const response = await apiGet('/api/specialized-services/user');

            if (response.success && (response.data as any).services) {
                const allServices = (response.data as any).services;
                const serviceData = allServices.find((s: any) =>
                    (s.service_id === parseInt(serviceId || '0')) || (s.id === parseInt(serviceId || '0'))
                );

                if (serviceData) {
                    setService(serviceData);
                }
            }
        } catch (error: any) {
            console.error('[ServiceDetailPage] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadRatingStats = async () => {
        if (!serviceId) return;
        try {
            const response = await apiGet(`/api/specialized-services/${serviceId}/ratings/stats`);
            if (response.success) {
                setRatingStats((response.data as any).stats);
            }
        } catch (error: any) {
            console.error('[ServiceDetailPage] Erreur stats:', error);
        }
    };

    const handleReservation = (reservationType: 'rdv' | 'place' | 'course' | 'ticket') => {
        if (!service || !serviceId) return;
        navigate(`/specialized/reservation/${serviceId}/${service.type_ || 'pharmacie'}?type=${reservationType}`);
    };

    const handleOpenChat = () => {
        setShowChat(true);
        // TODO: Intégrer composant chat web
    };

    if (loading) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center">Chargement...</div>
            </div>
        );
    }

    if (!service) {
        return (
            <div className="container mx-auto px-4 py-8">
                <div className="text-center text-red-600">Service non trouvé</div>
            </div>
        );
    }

    const metadata = service.metadata || {};
    const type = service.type_ || 'pharmacie';

    return (
        <div className="container mx-auto px-4 py-8 max-w-4xl">
            <div className="bg-white rounded-lg shadow p-6 mb-6">
                <h1 className="text-3xl font-bold mb-4">{service.nom}</h1>
                {ratingStats && ratingStats.total_ratings > 0 && (
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-yellow-500">⭐</span>
                        <span className="font-semibold">
                            {ratingStats.average_rating.toFixed(1)} ({ratingStats.total_ratings} avis)
                        </span>
                    </div>
                )}

                {/* Informations spécifiques selon type */}
                {type === 'pharmacie' && (
                    <div className="space-y-2">
                        {metadata.is_on_duty_now && (
                            <p className="text-green-600 font-semibold">🟢 En service actuellement</p>
                        )}
                        {metadata.permanent_24h && (
                            <p className="text-blue-600">⏰ Service 24/7</p>
                        )}
                    </div>
                )}

                {type === 'covoiturage' && (
                    <div className="space-y-2">
                        <p><strong>Départ:</strong> {metadata.depart}</p>
                        <p><strong>Destination:</strong> {metadata.destination}</p>
                        <p><strong>Places disponibles:</strong> {metadata.places_disponibles || 0}</p>
                        {metadata.prix_par_place && (
                            <p><strong>Prix:</strong> {metadata.prix_par_place} {metadata.devise || 'XOF'}</p>
                        )}
                    </div>
                )}

                {/* Actions contextuelles */}
                <div className="flex gap-4 mt-6">
                    {type === 'hopital' || type === 'laboratoire' ? (
                        <>
                            <button
                                onClick={() => handleReservation('rdv')}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                            >
                                Prendre RDV
                            </button>
                            <button
                                onClick={handleOpenChat}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                            >
                                Contacter
                            </button>
                        </>
                    ) : type === 'covoiturage' ? (
                        <>
                            <button
                                onClick={() => handleReservation('place')}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                            >
                                Réserver place
                            </button>
                            <button
                                onClick={handleOpenChat}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                            >
                                Contacter
                            </button>
                        </>
                    ) : type === 'taxi' ? (
                        <>
                            <button
                                onClick={() => handleReservation('course')}
                                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                            >
                                Commander course
                            </button>
                            <button
                                onClick={handleOpenChat}
                                className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-semibold"
                            >
                                Contacter
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={handleOpenChat}
                            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-semibold"
                        >
                            Contacter
                        </button>
                    )}
                </div>
            </div>

            {/* Section Avis */}
            <div className="bg-white rounded-lg shadow p-6">
                <ProductCommentsSection
                    serviceId={parseInt(serviceId || '0')}
                    serviceTitle={service.nom}
                    onOpenChat={handleOpenChat}
                    mode="inline"
                />
            </div>
        </div>
    );
};

export default ServiceDetailPage;

