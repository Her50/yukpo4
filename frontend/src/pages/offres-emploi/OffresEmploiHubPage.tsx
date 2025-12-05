// ✅ NOUVEAU 2025-01-28: Hub principal pour offres d'emploi
// Point d'entrée avec accès rapide pour candidats et employeurs

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface DashboardStats {
    total_offres?: number;
    offres_actives?: number;
    total_candidatures?: number;
    candidatures_attente?: number;
    meilleurs_matchings?: number;
}

const OffresEmploiHubPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<DashboardStats | null>(null);

    useEffect(() => {
        loadStats();
    }, []);

    const loadStats = async () => {
        try {
            setLoading(true);
            if (user) {
                // Charger les stats selon le rôle (candidat ou employeur)
                const endpoint = '/api/offres-emploi/dashboard/candidat';
                const response = await apiGet(endpoint);
                const data = await response.json();
                if (data.success) {
                    setStats(data.data);
                }
            }
        } catch (error) {
            console.error('[OffresEmploiHub] Erreur chargement stats:', error);
        } finally {
            setLoading(false);
        }
    };

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
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="max-w-7xl mx-auto px-4 py-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Offres d'Emploi</h1>
                    <p className="text-gray-600">Trouvez votre emploi idéal ou recrutez les meilleurs talents</p>

                    {stats && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                            {stats.total_offres !== undefined && (
                                <div className="text-center bg-indigo-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-indigo-600">{stats.total_offres}</div>
                                    <div className="text-sm text-gray-600 mt-1">Offres actives</div>
                                </div>
                            )}
                            {stats.total_candidatures !== undefined && (
                                <div className="text-center bg-green-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-green-600">{stats.total_candidatures}</div>
                                    <div className="text-sm text-gray-600 mt-1">Candidatures</div>
                                </div>
                            )}
                            {stats.candidatures_attente !== undefined && (
                                <div className="text-center bg-yellow-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-yellow-600">{stats.candidatures_attente}</div>
                                    <div className="text-sm text-gray-600 mt-1">En attente</div>
                                </div>
                            )}
                            {stats.meilleurs_matchings !== undefined && (
                                <div className="text-center bg-purple-50 rounded-lg p-4">
                                    <div className="text-2xl font-bold text-purple-600">{stats.meilleurs_matchings}</div>
                                    <div className="text-sm text-gray-600 mt-1">Matchings</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-4 py-8">
                {/* Barre de recherche */}
                <div className="mb-8">
                    <div
                        className="flex items-center gap-3 bg-white border border-gray-200 rounded-lg px-4 py-3 cursor-pointer hover:bg-gray-50 transition shadow-sm"
                        onClick={() => navigate('/offres-emploi/search')}
                    >
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <span className="text-gray-500 flex-1">Rechercher une offre d'emploi...</span>
                        <span className="text-sm text-indigo-600 font-medium">Rechercher</span>
                    </div>
                </div>

                {/* Actions rapides - Candidat */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">👤 Espace Candidat</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div
                            className="bg-white rounded-lg border-l-4 p-6 hover:shadow-md transition shadow-sm cursor-pointer"
                            style={{ borderLeftColor: '#6366F1' }}
                            onClick={() => navigate('/offres-emploi/matching/offres')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">🎯</span>
                                <h3 className="font-semibold text-gray-900">Offres Correspondantes</h3>
                            </div>
                            <p className="text-sm text-gray-600">Découvrez les offres qui correspondent à votre profil</p>
                        </div>

                        <div
                            className="bg-white rounded-lg border-l-4 p-6 hover:shadow-md transition shadow-sm cursor-pointer"
                            style={{ borderLeftColor: '#10B981' }}
                            onClick={() => navigate('/offres-emploi/mes-candidatures')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">📋</span>
                                <h3 className="font-semibold text-gray-900">Mes Candidatures</h3>
                            </div>
                            <p className="text-sm text-gray-600">Suivez l'état de vos candidatures</p>
                        </div>

                        <div
                            className="bg-white rounded-lg border-l-4 p-6 hover:shadow-md transition shadow-sm cursor-pointer"
                            style={{ borderLeftColor: '#F59E0B' }}
                            onClick={() => navigate('/offres-emploi/profil')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">👤</span>
                                <h3 className="font-semibold text-gray-900">Mon Profil</h3>
                            </div>
                            <p className="text-sm text-gray-600">Complétez votre profil candidat</p>
                        </div>
                    </div>
                </div>

                {/* Actions rapides - Employeur */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold text-gray-900 mb-4">🏢 Espace Employeur</h2>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div
                            className="bg-white rounded-lg border-l-4 p-6 hover:shadow-md transition shadow-sm cursor-pointer"
                            style={{ borderLeftColor: '#8B5CF6' }}
                            onClick={() => navigate('/offres-emploi/create')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">➕</span>
                                <h3 className="font-semibold text-gray-900">Publier une Offre</h3>
                            </div>
                            <p className="text-sm text-gray-600">Créez une nouvelle offre d'emploi</p>
                        </div>

                        <div
                            className="bg-white rounded-lg border-l-4 p-6 hover:shadow-md transition shadow-sm cursor-pointer"
                            style={{ borderLeftColor: '#EC4899' }}
                            onClick={() => navigate('/offres-emploi/mes-offres')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">📊</span>
                                <h3 className="font-semibold text-gray-900">Mes Offres</h3>
                            </div>
                            <p className="text-sm text-gray-600">Gérez vos offres publiées</p>
                        </div>

                        <div
                            className="bg-white rounded-lg border-l-4 p-6 hover:shadow-md transition shadow-sm cursor-pointer"
                            style={{ borderLeftColor: '#06B6D4' }}
                            onClick={() => navigate('/offres-emploi/dashboard/employeur')}
                        >
                            <div className="flex items-center gap-3 mb-2">
                                <span className="text-2xl">📈</span>
                                <h3 className="font-semibold text-gray-900">Tableau de Bord</h3>
                            </div>
                            <p className="text-sm text-gray-600">Statistiques et analyses</p>
                        </div>
                    </div>
                </div>

                {/* Tendances du marché */}
                <div className="bg-white rounded-lg p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-xl font-bold text-gray-900">📊 Tendances du Marché</h2>
                        <button
                            onClick={() => navigate('/offres-emploi/tendances')}
                            className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                        >
                            Voir plus →
                        </button>
                    </div>
                    <p className="text-gray-600 text-sm">
                        Découvrez les secteurs qui recrutent et les salaires moyens par domaine
                    </p>
                </div>
            </div>
        </div>
    );
};

export default OffresEmploiHubPage;

