// ✅ NOUVEAU: Hub unifié pour services spécialisés (Web)
// Point d'entrée principal avec accès rapide, statistiques et suggestions

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface ServiceType {
    id: string;
    name: string;
    icon: string;
    color: string;
    count: number;
    route: string;
    category: 'sante' | 'transport';
}

interface ServicesStatistics {
    total: number;
    active: number;
    inactive: number;
    by_type: Record<string, number>;
}

interface UnifiedService {
    id: number;
    service_id: number;
    type: string;
    nom: string;
    is_active: boolean;
    is_available_now?: boolean;
    created_at: string;
    metadata?: any;
}

const SpecializedServicesHubPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [statistics, setStatistics] = useState<ServicesStatistics | null>(null);
    const [services, setServices] = useState<UnifiedService[]>([]);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/specialized-services/user?page=1&limit=20');
            const data = await response.json();

            if (data.success && data.data) {
                setServices(data.data.services || []);
                setStatistics(data.data.statistics || {
                    total: 0,
                    active: 0,
                    inactive: 0,
                    by_type: {},
                });
            }
        } catch (error) {
            console.error('[SpecializedServicesHub] Erreur chargement:', error);
        } finally {
            setLoading(false);
        }
    };

    const serviceTypes: ServiceType[] = [
        {
            id: 'pharmacie',
            name: 'Pharmacie',
            icon: '💊',
            color: '#10B981',
            count: statistics?.by_type?.pharmacie || 0,
            route: '/specialized/pharmacie',
            category: 'sante',
        },
        {
            id: 'hopital',
            name: 'Hôpital',
            icon: '🏥',
            color: '#EF4444',
            count: statistics?.by_type?.hopital || 0,
            route: '/specialized/hopital',
            category: 'sante',
        },
        {
            id: 'laboratoire',
            name: 'Laboratoire',
            icon: '🔬',
            color: '#3B82F6',
            count: statistics?.by_type?.laboratoire || 0,
            route: '/specialized/laboratoire',
            category: 'sante',
        },
        {
            id: 'banque_sang',
            name: 'Banque de Sang',
            icon: '🩸',
            color: '#DC2626',
            count: statistics?.by_type?.banque_sang || 0,
            route: '/specialized/banque-sang',
            category: 'sante',
        },
        {
            id: 'agence_voyage',
            name: 'Agence de Voyage',
            icon: '🚌',
            color: '#F59E0B',
            count: statistics?.by_type?.agence_voyage || 0,
            route: '/specialized/agence-voyage',
            category: 'transport',
        },
        {
            id: 'covoiturage',
            name: 'Covoiturage',
            icon: '🚗',
            color: '#8B5CF6',
            count: statistics?.by_type?.covoiturage || 0,
            route: '/specialized/covoiturage',
            category: 'transport',
        },
        {
            id: 'taxi',
            name: 'Taxi',
            icon: '🚕',
            color: '#F97316',
            count: statistics?.by_type?.taxi || 0,
            route: '/specialized/taxi',
            category: 'transport',
        },
        {
            id: 'bourse_livre',
            name: 'Bourse du Livre',
            icon: '📚',
            color: '#8B5CF6',
            count: 0, // À implémenter : statistiques pour livres scolaires
            route: '/livres-scolaires/search',
            category: 'education',
        },
        {
            id: 'offres_emploi',
            name: 'Offres d\'Emploi',
            icon: '💼',
            color: '#6366F1',
            count: 0, // À implémenter : statistiques pour offres d'emploi
            route: '/offres-emploi',
            category: 'emploi',
        },
        {
            id: 'orientation_scolaire',
            name: 'Orientation Scolaire',
            icon: '🎓',
            color: '#10B981',
            count: 0, // À implémenter : statistiques pour établissements
            route: '/orientation-scolaire',
            category: 'education',
        },
    ];

    const santeTypes = serviceTypes.filter((t) => t.category === 'sante');
    const transportTypes = serviceTypes.filter((t) => t.category === 'transport');
    const educationTypes = serviceTypes.filter((t) => t.category === 'education');
    const emploiTypes = serviceTypes.filter((t) => t.category === 'emploi');

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header avec statistiques */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-6">Services Spécialisés</h1>
                    {statistics && (
                        <div className="grid grid-cols-3 gap-6">
                            <div className="text-center">
                                <div className="text-3xl font-bold text-indigo-600">{statistics.total}</div>
                                <div className="text-sm text-gray-600 mt-1">Total</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-green-600">{statistics.active}</div>
                                <div className="text-sm text-gray-600 mt-1">Actifs</div>
                            </div>
                            <div className="text-center">
                                <div className="text-3xl font-bold text-yellow-600">{statistics.inactive}</div>
                                <div className="text-sm text-gray-600 mt-1">Inactifs</div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Barre de recherche globale */}
                <div className="mb-8">
                    <div
                        className="flex items-center gap-3 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-100 transition"
                        onClick={() => navigate('/search/specialized')}
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-gray-500 flex-1">Rechercher un service spécialisé...</span>
                    </div>
                </div>

                {/* Accès rapide par type - Santé */}
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <span className="text-2xl">❤️</span>
                        <h2 className="text-xl font-bold text-gray-900">Santé</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {santeTypes.map((type) => {
                            // ✅ Phase 4: Double action pour Hôpitaux, Laboratoires, Pharmacie, Banque de sang (Créer + Rechercher)
                            const isSearchable = type.id === 'hopital' || type.id === 'laboratoire' || type.id === 'pharmacie' || type.id === 'banque_sang';
                            const searchRoute =
                                type.id === 'hopital' ? '/hopitaux/search' :
                                    type.id === 'laboratoire' ? '/laboratoires/search' :
                                        type.id === 'pharmacie' ? '/pharmacies/search' :
                                            type.id === 'banque_sang' ? '/banques-sang/search' : '';

                            return (
                                <div
                                    key={type.id}
                                    className="bg-white rounded-lg border-l-4 p-4 hover:shadow-md transition shadow-sm"
                                    style={{ borderLeftColor: type.color }}
                                >
                                    <div
                                        className="cursor-pointer"
                                        onClick={() => navigate(type.route)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl">{type.icon}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{type.name}</h3>
                                        {type.count > 0 && (
                                            <p className="text-sm text-gray-500">
                                                {type.count} service{type.count > 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                    {isSearchable && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(searchRoute);
                                            }}
                                            className="mt-3 w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                            style={{ borderColor: type.color, color: type.color }}
                                        >
                                            🔍 Rechercher
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Accès rapide par type - Transport */}
                <div className="mb-8">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <span className="text-2xl">🚗</span>
                            <h2 className="text-xl font-bold text-gray-900">Transport</h2>
                        </div>
                        {/* ✅ Phase 6: Lien vers Mes trajets */}
                        <button
                            onClick={() => navigate('/covoiturages/my-trips')}
                            className="text-blue-600 hover:text-blue-700 font-semibold text-sm"
                        >
                            Mes trajets →
                        </button>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {transportTypes.map((type) => {
                            // ✅ Phase 5: Double action pour Taxi, Covoiturage et Agence de voyage (Créer + Rechercher)
                            const isSearchable = type.id === 'taxi' || type.id === 'covoiturage' || type.id === 'agence_voyage';
                            const searchRoute =
                                type.id === 'taxi' ? '/taxis/search' :
                                    type.id === 'covoiturage' ? '/covoiturages/search' :
                                        type.id === 'agence_voyage' ? '/agences-voyage/search' : '';

                            return (
                                <div
                                    key={type.id}
                                    className="bg-white rounded-lg border-l-4 p-4 hover:shadow-md transition shadow-sm"
                                    style={{ borderLeftColor: type.color }}
                                >
                                    <div
                                        className="cursor-pointer"
                                        onClick={() => navigate(type.route)}
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-2xl">{type.icon}</span>
                                        </div>
                                        <h3 className="font-semibold text-gray-900 mb-1">{type.name}</h3>
                                        {type.count > 0 && (
                                            <p className="text-sm text-gray-500">
                                                {type.count} service{type.count > 1 ? 's' : ''}
                                            </p>
                                        )}
                                    </div>
                                    {isSearchable && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                navigate(searchRoute);
                                            }}
                                            className="mt-3 w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                            style={{ borderColor: type.color, color: type.color }}
                                        >
                                            🔍 Rechercher
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Accès rapide par type - Éducation */}
                {educationTypes.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">📚 Éducation</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {educationTypes.map((type) => {
                                return (
                                    <div
                                        key={type.id}
                                        className="bg-white rounded-lg border-l-4 p-4 hover:shadow-md transition shadow-sm"
                                        style={{ borderLeftColor: type.color }}
                                    >
                                        <div
                                            className="cursor-pointer"
                                            onClick={() => navigate(type.route)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-2xl">{type.icon}</span>
                                            </div>
                                            <h3 className="font-semibold text-gray-900 mb-1">{type.name}</h3>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/livres-scolaires/search');
                                                }}
                                                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                                style={{ borderColor: type.color, color: type.color }}
                                            >
                                                🔍 Rechercher
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/livres-scolaires/mes-livres');
                                                }}
                                                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                                style={{ borderColor: type.color, color: type.color }}
                                            >
                                                📖 Mes Livres
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/trocs/mes-trocs');
                                                }}
                                                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                                style={{ borderColor: type.color, color: type.color }}
                                            >
                                                🔄 Mes Trocs
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Accès rapide par type - Emploi */}
                {emploiTypes.length > 0 && (
                    <div className="mb-8">
                        <h2 className="text-xl font-bold text-gray-900 mb-4">💼 Emploi</h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {emploiTypes.map((type) => {
                                return (
                                    <div
                                        key={type.id}
                                        className="bg-white rounded-lg border-l-4 p-4 hover:shadow-md transition shadow-sm"
                                        style={{ borderLeftColor: type.color }}
                                    >
                                        <div
                                            className="cursor-pointer"
                                            onClick={() => navigate(type.route)}
                                        >
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-2xl">{type.icon}</span>
                                            </div>
                                            <h3 className="font-semibold text-gray-900 mb-1">{type.name}</h3>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/offres-emploi/search');
                                                }}
                                                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                                style={{ borderColor: type.color, color: type.color }}
                                            >
                                                🔍 Rechercher
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    navigate('/offres-emploi');
                                                }}
                                                className="w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 hover:bg-gray-50 transition"
                                                style={{ borderColor: type.color, color: type.color }}
                                            >
                                                📊 Hub
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Liste des services récents */}
                {services.length > 0 && (
                    <div className="mb-8">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-bold text-gray-900">Mes Services</h2>
                            <button
                                onClick={() => navigate('/specialized/gestion')}
                                className="text-indigo-600 hover:text-indigo-700 font-medium"
                            >
                                Voir tous
                            </button>
                        </div>
                        <div className="space-y-3">
                            {services.slice(0, 5).map((service) => (
                                <div
                                    key={service.id}
                                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                                    onClick={() => {
                                        const routeMap: Record<string, string> = {
                                            pharmacie: '/specialized/pharmacie',
                                            hopital: '/specialized/hopital',
                                            laboratoire: '/specialized/laboratoire',
                                            agence_voyage: '/specialized/agence-voyage',
                                            covoiturage: '/specialized/covoiturage',
                                            taxi: '/specialized/taxi',
                                        };
                                        navigate(routeMap[service.type] || '/specialized/gestion', {
                                            state: { serviceId: service.service_id, mode: 'edit' },
                                        });
                                    }}
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold text-gray-900">{service.nom}</h3>
                                            <p className="text-sm text-gray-500 capitalize">{service.type}</p>
                                        </div>
                                        <span
                                            className={`px-3 py-1 rounded-full text-xs font-medium ${service.is_active
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-yellow-100 text-yellow-800'
                                                }`}
                                        >
                                            {service.is_active ? 'Actif' : 'Inactif'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default SpecializedServicesHubPage;

