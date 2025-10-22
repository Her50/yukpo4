import { ArrowRight, Globe, MapPin, Package, Play } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { apiGet, apiPost } from '../services/apiService';

interface Publicite {
    id: string;
    titre: string;
    description?: string;
    produits: any[];
    videos: string[];
    thumbnails: string[];
    zone_geographique: string;
}

interface PublicitesCarouselProps {
    userId?: string;
    userBehavior?: string[];
}

const PublicitesCarousel: React.FC<PublicitesCarouselProps> = ({ userId, userBehavior = [] }) => {
    const navigate = useNavigate();
    const [publicites, setPublicites] = useState<Publicite[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [loading, setLoading] = useState(true);
    const carouselRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        loadPublicites();
    }, [userId, userBehavior]);

    // Auto-scroll toutes les 5 secondes
    useEffect(() => {
        if (publicites.length <= 1) return;

        const interval = setInterval(() => {
            setCurrentIndex((prev) => (prev + 1) % publicites.length);
        }, 5000);

        return () => clearInterval(interval);
    }, [publicites.length]);

    // Scroll automatique lors du changement d'index
    useEffect(() => {
        if (carouselRef.current && publicites.length > 0) {
            const cardWidth = carouselRef.current.clientWidth;
            carouselRef.current.scrollTo({
                left: currentIndex * (cardWidth + 12),
                behavior: 'smooth'
            });
        }
    }, [currentIndex, publicites.length]);

    const loadPublicites = async () => {
        try {
            setLoading(true);

            const params = new URLSearchParams();
            if (userBehavior.length > 0) {
                params.append('categories', userBehavior.join(','));
            }
            if (userId) {
                params.append('user_id', userId);
            }

            const response = await apiGet(`/api/publicites/actives?${params.toString()}`);

            // Parser le JSON de la réponse
            const jsonData = await response.json();

            if (jsonData && (Array.isArray(jsonData) || jsonData.data)) {
                let pubs = Array.isArray(jsonData) ? jsonData : jsonData.data;

                // Trier par pertinence si comportement fourni
                if (userBehavior.length > 0 && Array.isArray(pubs)) {
                    pubs = pubs.sort((a: Publicite, b: Publicite) => {
                        const scoreA = a.produits?.filter((p: any) =>
                            userBehavior.includes(p.type)
                        ).length || 0;
                        const scoreB = b.produits?.filter((p: any) =>
                            userBehavior.includes(p.type)
                        ).length || 0;
                        return scoreB - scoreA;
                    });
                }

                setPublicites(Array.isArray(pubs) ? pubs : []);
            } else {
                setPublicites([]);
            }

            setLoading(false);
        } catch (error) {
            console.error('[PublicitesCarousel] Erreur chargement:', error);
            // Ne plus continuer à essayer en boucle si l'endpoint n'existe pas
            setPublicites([]);
            setLoading(false);
        }
    };

    const handlePubliciteClick = async (pub: Publicite) => {
        try {
            // Enregistrer le clic pour les analytics
            await apiPost('/api/publicites/track-click', {
                publicite_id: pub.id,
                user_id: userId
            });

            // Naviguer vers le détail du premier produit ou du service
            if (pub.produits && pub.produits.length > 0) {
                const firstProduct = pub.produits[0];

                if (firstProduct.serviceId) {
                    navigate(`/service/${firstProduct.serviceId}`);
                }
            }
        } catch (error) {
            console.error('[PublicitesCarousel] Erreur tracking clic:', error);
        }
    };

    const getCategoryIcon = (type: string): string => {
        const icons: Record<string, string> = {
            'immobilier_batiment': '🏠',
            'immobilier_terrain': '🏞️',
            'hotellerie': '🏨',
            'automobile': '🚗',
            'ticket_voyage': '🎫',
            'telephone': '📱',
            'ordinateur': '💻',
            'vetement': '👔',
            'electromenager': '🔌',
            'mobilier': '🪑',
            'pharmacie': '💊',
            'default': '📦'
        };
        return icons[type] || icons.default;
    };

    if (loading || publicites.length === 0) {
        return null;
    }

    return (
        <div className="mb-8">
            {/* Header */}
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    ✨ Promotions du moment
                </h2>
                <p className="text-sm text-gray-600">
                    {userBehavior.length > 0 ? 'Sélectionnées pour vous' : 'Découvrez les offres'}
                </p>
            </div>

            {/* Carousel */}
            <div
                ref={carouselRef}
                className="flex overflow-x-auto snap-x snap-mandatory gap-3 pb-4 scrollbar-hide"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {publicites.map((pub) => (
                    <div
                        key={pub.id}
                        onClick={() => handlePubliciteClick(pub)}
                        className="flex-shrink-0 w-[85%] md:w-[450px] snap-center cursor-pointer group"
                    >
                        <div className="relative h-56 bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow">
                            <div className="flex h-full">
                                {/* Media section */}
                                <div className="relative w-2/5 bg-black/20">
                                    {pub.videos && pub.videos.length > 0 ? (
                                        <>
                                            <img
                                                src={`data:image/jpeg;base64,${pub.thumbnails[0]}`}
                                                alt={pub.titre}
                                                className="w-full h-full object-cover"
                                            />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                                                <Play className="w-12 h-12 text-white" />
                                            </div>
                                        </>
                                    ) : pub.produits?.[0]?.images?.[0] ? (
                                        <img
                                            src={`data:image/jpeg;base64,${pub.produits[0].images[0]}`}
                                            alt={pub.titre}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                            <Package className="w-16 h-16 text-white/50" />
                                        </div>
                                    )}
                                </div>

                                {/* Content section */}
                                <div className="flex-1 p-4 flex flex-col justify-between">
                                    <div>
                                        <h3 className="text-lg font-bold text-white mb-2 line-clamp-2">
                                            {pub.titre}
                                        </h3>
                                        {pub.description && (
                                            <p className="text-sm text-white/90 line-clamp-2 mb-3">
                                                {pub.description}
                                            </p>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2 text-white text-sm">
                                            <Package className="w-4 h-4" />
                                            <span className="font-semibold">
                                                {pub.produits?.length || 0} produit{(pub.produits?.length || 0) > 1 ? 's' : ''}
                                            </span>
                                        </div>
                                        {pub.produits?.[0]?.prix && (
                                            <p className="text-white font-bold">
                                                À partir de {pub.produits[0].prix} FCFA
                                            </p>
                                        )}
                                        <button className="flex items-center gap-2 px-4 py-2 bg-white/25 hover:bg-white/35 rounded-full text-white text-sm font-semibold transition-colors">
                                            <ArrowRight className="w-4 h-4" />
                                            Voir le produit
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Badge catégorie */}
                            {pub.produits?.[0]?.type && (
                                <div className="absolute top-3 left-3 w-10 h-10 bg-white rounded-full flex items-center justify-center text-2xl shadow-md">
                                    {getCategoryIcon(pub.produits[0].type)}
                                </div>
                            )}

                            {/* Badge zone */}
                            {pub.zone_geographique && (
                                <div className="absolute top-3 right-3 w-8 h-8 bg-white/25 rounded-full flex items-center justify-center">
                                    {pub.zone_geographique === 'local' ? (
                                        <MapPin className="w-4 h-4 text-white" />
                                    ) : (
                                        <Globe className="w-4 h-4 text-white" />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Indicateurs de pagination */}
            {publicites.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    {publicites.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => setCurrentIndex(index)}
                            className={`h-2 rounded-full transition-all ${index === currentIndex
                                ? 'w-6 bg-blue-600'
                                : 'w-2 bg-gray-300 hover:bg-gray-400'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
};

export default PublicitesCarousel;


