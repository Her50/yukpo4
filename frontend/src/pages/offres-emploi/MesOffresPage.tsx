// ✅ Page liste des offres d'un employeur
import { Edit, Eye, Plus, Users } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet } from '../../services/apiService';

interface OffreEmploi {
    id: number;
    titre_poste: string;
    statut: string;
    nombre_candidatures: number;
    nombre_vues: number;
    date_publication: string;
}

const MesOffresPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [offres, setOffres] = useState<OffreEmploi[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            loadOffres();
        }
    }, [user]);

    const loadOffres = async () => {
        try {
            setLoading(true);
            const response = await apiGet('/api/offres-emploi?page=1&limit=50');
            const data = await response.json();
            if (data.success) {
                setOffres(data.data || []);
            }
        } catch (error) {
            console.error('[MesOffresPage] Erreur:', error);
        } finally {
            setLoading(false);
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
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">Mes Offres d'Emploi</h1>
                    <button
                        onClick={() => navigate('/offres-emploi/create')}
                        className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                        <Plus className="w-5 h-5" />
                        Publier une offre
                    </button>
                </div>

                {offres.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune offre publiée</h2>
                        <p className="text-gray-600 mb-4">Commencez par publier votre première offre d'emploi</p>
                        <button
                            onClick={() => navigate('/offres-emploi/create')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            Publier une offre
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {offres.map((offre) => (
                            <div
                                key={offre.id}
                                className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-xl font-semibold text-gray-900">{offre.titre_poste}</h3>
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${offre.statut === 'active' ? 'bg-green-100 text-green-800' :
                                                    offre.statut === 'pourvue' ? 'bg-blue-100 text-blue-800' :
                                                        'bg-gray-100 text-gray-800'
                                                }`}>
                                                {offre.statut}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-6 text-sm text-gray-600">
                                            <div className="flex items-center gap-1">
                                                <Eye className="w-4 h-4" />
                                                {offre.nombre_vues} vues
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Users className="w-4 h-4" />
                                                {offre.nombre_candidatures} candidatures
                                            </div>
                                            <div>
                                                Publié le {new Date(offre.date_publication).toLocaleDateString('fr-FR')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex gap-2 ml-4">
                                        <button
                                            onClick={() => navigate(`/offres-emploi/${offre.id}/candidatures`)}
                                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-sm"
                                        >
                                            Voir candidatures
                                        </button>
                                        <button
                                            onClick={() => navigate(`/offres-emploi/${offre.id}`)}
                                            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 text-sm"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
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

export default MesOffresPage;

