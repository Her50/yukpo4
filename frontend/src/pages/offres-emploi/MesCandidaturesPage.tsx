// ✅ Page liste des candidatures d'un candidat
import { CheckCircle, Clock, FileText, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface Candidature {
    id: number;
    offre_id: number;
    statut: string;
    date_candidature: string;
    score_matching?: number;
    offre?: {
        titre_poste: string;
        entreprise_id: number;
    };
}

const MesCandidaturesPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [candidatures, setCandidatures] = useState<Candidature[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadCandidatures();
        }
    }, [user]);

    const loadCandidatures = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/offres-emploi/mes-candidatures');
            const data = await response.json();
            if (data.success) {
                setCandidatures(data.data || []);
            }
        } catch (error) {
            console.error('[MesCandidaturesPage] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatutColor = (statut: string) => {
        switch (statut) {
            case 'acceptee':
                return 'bg-green-100 text-green-800';
            case 'refusee':
                return 'bg-red-100 text-red-800';
            case 'en_cours':
                return 'bg-blue-100 text-blue-800';
            default:
                return 'bg-yellow-100 text-yellow-800';
        }
    };

    const getStatutIcon = (statut: string) => {
        switch (statut) {
            case 'acceptee':
                return <CheckCircle className="w-5 h-5" />;
            case 'refusee':
                return <XCircle className="w-5 h-5" />;
            case 'en_cours':
                return <Clock className="w-5 h-5" />;
            default:
                return <FileText className="w-5 h-5" />;
        }
    };

    const getStatutLabel = (statut: string) => {
        switch (statut) {
            case 'acceptee':
                return 'Acceptée';
            case 'refusee':
                return 'Refusée';
            case 'en_cours':
                return 'En cours';
            default:
                return 'En attente';
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Connexion requise</h2>
                    <button
                        onClick={() => navigate('/login')}
                        className="text-indigo-600 hover:text-indigo-700"
                    >
                        Se connecter
                    </button>
                </div>
            </div>
        );
    }

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
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Mes Candidatures</h1>
                    <button
                        onClick={() => navigate('/offres-emploi')}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                        Rechercher des offres
                    </button>
                </div>

                {candidatures.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune candidature</h2>
                        <p className="text-gray-600 mb-4">Vous n'avez pas encore postulé à une offre</p>
                        <button
                            onClick={() => navigate('/offres-emploi/search')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            Rechercher des offres
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {candidatures.map((candidature) => (
                            <div
                                key={candidature.id}
                                className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition cursor-pointer"
                                onClick={() => navigate(`/offres-emploi/${candidature.offre_id}`)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                            {candidature.offre?.titre_poste || 'Offre'}
                                        </h3>
                                        <div className="flex items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {new Date(candidature.date_candidature).toLocaleDateString('fr-FR')}
                                            </div>
                                            {candidature.score_matching && (
                                                <div className="text-indigo-600 font-semibold">
                                                    Score: {candidature.score_matching.toFixed(0)}%
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    <div className={`flex items-center gap-2 px-3 py-1 rounded-full ${getStatutColor(candidature.statut)}`}>
                                        {getStatutIcon(candidature.statut)}
                                        <span className="font-medium">{getStatutLabel(candidature.statut)}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MesCandidaturesPage;

