// ✅ Page de recherche et affichage des conférences et lives scolaires

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface Conference {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    titre: string;
    description?: string;
    date_debut: string;
    date_fin?: string;
    livekit_room_name: string;
    is_active: boolean;
    created_at: string;
}

const ConferencesLivesPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [searchParams] = useSearchParams();
    const programmeesOnly = searchParams.get('programmees') === 'true';

    const [loading, setLoading] = useState(false);
    const [conferences, setConferences] = useState<Conference[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    useEffect(() => {
        if (programmeesOnly) {
            loadConferencesProgrammees();
        } else {
            searchConferences();
        }
    }, [programmeesOnly, page]);

    const loadConferencesProgrammees = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            const response = await apiGet(`/api/orientation-scolaire/conferences/programmees?${params}`);
            const data = await response.json();

            if (data.success) {
                setConferences(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConferencesLives] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchConferences = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            const response = await apiGet(`/api/orientation-scolaire/conferences/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setConferences(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConferencesLives] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleJoinConference = async (conferenceId: number) => {
        try {
            const response = await apiGet(`/api/orientation-scolaire/conferences/${conferenceId}/join`);
            const data = await response.json();

            if (data.success && data.data?.token) {
                // Rediriger vers la page LiveKit avec le token
                // Note: L'implémentation complète nécessiterait l'intégration LiveKit
                window.open(`/live/${data.data.room_name}?token=${data.data.token}`, '_blank');
            }
        } catch (error) {
            console.error('[ConferencesLives] Erreur join:', error);
            alert('Erreur lors de la connexion à la conférence');
        }
    };

    const isUpcoming = (dateStr: string) => {
        return new Date(dateStr) > new Date();
    };

    const isLive = (dateDebut: string, dateFin?: string) => {
        const now = new Date();
        const debut = new Date(dateDebut);
        const fin = dateFin ? new Date(dateFin) : null;
        return debut <= now && (!fin || fin >= now);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Conférences et Lives Scolaires
                    </h1>
                    <button
                        onClick={() => navigate('/orientation-scolaire/conferences/programmees')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Voir les conférences programmées
                    </button>
                </div>

                {/* Résultats */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Chargement...</p>
                    </div>
                ) : conferences.length > 0 ? (
                    <>
                        <div className="mb-4 text-gray-600">
                            {total} conférence{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {conferences.map((conf) => {
                                const upcoming = isUpcoming(conf.date_debut);
                                const live = isLive(conf.date_debut, conf.date_fin);

                                return (
                                    <div
                                        key={conf.id}
                                        className={`bg-white rounded-lg shadow-md p-6 ${live ? 'border-2 border-red-500' : ''
                                            }`}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {conf.titre}
                                            </h3>
                                            {live && (
                                                <span className="px-2 py-1 bg-red-100 text-red-800 text-xs rounded animate-pulse">
                                                    🔴 EN DIRECT
                                                </span>
                                            )}
                                            {upcoming && !live && (
                                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                                                    À venir
                                                </span>
                                            )}
                                        </div>
                                        <div className="space-y-2 text-sm text-gray-600 mb-4">
                                            <p>
                                                📍 {conf.nom_etablissement || `Établissement #${conf.etablissement_id}`}
                                            </p>
                                            <p>
                                                📅 Début:{' '}
                                                {new Date(conf.date_debut).toLocaleString('fr-FR')}
                                            </p>
                                            {conf.date_fin && (
                                                <p>
                                                    ⏰ Fin:{' '}
                                                    {new Date(conf.date_fin).toLocaleString('fr-FR')}
                                                </p>
                                            )}
                                            {conf.description && (
                                                <p className="text-gray-500 text-xs mt-2">
                                                    {conf.description.substring(0, 100)}
                                                    {conf.description.length > 100 ? '...' : ''}
                                                </p>
                                            )}
                                        </div>
                                        <div className="flex gap-2">
                                            {(live || upcoming) && user && (
                                                <button
                                                    onClick={() => handleJoinConference(conf.id)}
                                                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors"
                                                >
                                                    {live ? '🔴 Rejoindre le live' : 'Rejoindre'}
                                                </button>
                                            )}
                                            {conf.etablissement_id && (
                                                <button
                                                    onClick={() => navigate(`/orientation-scolaire/etablissements/${conf.etablissement_id}`)}
                                                    className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                                >
                                                    Voir établissement
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                        {/* Pagination */}
                        {total > 20 && (
                            <div className="mt-6 flex justify-center gap-2">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="px-4 py-2 border rounded-md disabled:opacity-50"
                                >
                                    Précédent
                                </button>
                                <span className="px-4 py-2">
                                    Page {page} sur {Math.ceil(total / 20)}
                                </span>
                                <button
                                    onClick={() => setPage(p => p + 1)}
                                    disabled={page >= Math.ceil(total / 20)}
                                    className="px-4 py-2 border rounded-md disabled:opacity-50"
                                >
                                    Suivant
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <div className="text-center py-12 bg-white rounded-lg shadow-md">
                        <p className="text-gray-600">Aucune conférence trouvée</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConferencesLivesPage;

