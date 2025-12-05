// ✅ Page liste des résultats de recherche d'offres d'emploi
import { Briefcase, Clock, DollarSign, MapPin } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface OffreEmploi {
    id: number;
    titre_poste: string;
    description: string;
    type_contrat: string;
    lieu_travail: string;
    salaire_min?: number;
    salaire_max?: number;
    secteur: string;
    remote: boolean;
    date_publication: string;
    nombre_candidatures: number;
    nombre_vues: number;
}

const OffreListPage: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [offres, setOffres] = useState<OffreEmploi[]>([]);
    const [loading, setLoading] = useState(true);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const filters = location.state?.filters || {};

    useEffect(() => {
        loadOffres();
    }, [page]);

    const loadOffres = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                ...Object.fromEntries(
                    Object.entries(filters).map(([k, v]) => [
                        k,
                        Array.isArray(v) ? v.join(',') : String(v)
                    ])
                )
            });

            const response = await apiGet(`/api/offres-emploi/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setOffres(data.data || []);
                setTotal(data.total || 0);
            }
        } catch (error) {
            console.error('[OffreListPage] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const formatSalaire = (min?: number, max?: number) => {
        if (!min && !max) return 'Salaire non renseigné';
        if (min && max) return `${min.toLocaleString()} - ${max.toLocaleString()} XAF`;
        if (min) return `À partir de ${min.toLocaleString()} XAF`;
        return `Jusqu'à ${max?.toLocaleString()} XAF`;
    };

    if (loading && offres.length === 0) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
                    <p className="mt-4 text-gray-600">Chargement des offres...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-6xl mx-auto px-4">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-2xl font-bold text-gray-900">
                        {total} offre{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                    </h1>
                    <button
                        onClick={() => navigate('/offres-emploi/search')}
                        className="text-sm text-indigo-600 hover:text-indigo-700"
                    >
                        Modifier la recherche
                    </button>
                </div>

                {offres.length === 0 ? (
                    <div className="bg-white rounded-lg p-8 text-center">
                        <Briefcase className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 mb-2">Aucune offre trouvée</h2>
                        <p className="text-gray-600 mb-4">Essayez de modifier vos critères de recherche</p>
                        <button
                            onClick={() => navigate('/offres-emploi/search')}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                        >
                            Nouvelle recherche
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {offres.map((offre) => (
                            <div
                                key={offre.id}
                                className="bg-white rounded-lg p-6 shadow-sm hover:shadow-md transition cursor-pointer"
                                onClick={() => navigate(`/offres-emploi/${offre.id}`)}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-gray-900 mb-2">
                                            {offre.titre_poste}
                                        </h3>
                                        <p className="text-gray-600 mb-4 line-clamp-2">
                                            {offre.description}
                                        </p>
                                        <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                                            <div className="flex items-center gap-1">
                                                <MapPin className="w-4 h-4" />
                                                {offre.lieu_travail}
                                                {offre.remote && <span className="ml-2 text-green-600">(Remote)</span>}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Briefcase className="w-4 h-4" />
                                                {offre.type_contrat}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <DollarSign className="w-4 h-4" />
                                                {formatSalaire(offre.salaire_min, offre.salaire_max)}
                                            </div>
                                            <div className="flex items-center gap-1">
                                                <Clock className="w-4 h-4" />
                                                {new Date(offre.date_publication).toLocaleDateString('fr-FR')}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="ml-4 text-right">
                                        <div className="text-sm text-gray-500">
                                            {offre.nombre_vues} vue{offre.nombre_vues > 1 ? 's' : ''}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            {offre.nombre_candidatures} candidature{offre.nombre_candidatures > 1 ? 's' : ''}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Pagination */}
                {total > 20 && (
                    <div className="mt-8 flex justify-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(1, p - 1))}
                            disabled={page === 1}
                            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                        >
                            Précédent
                        </button>
                        <span className="px-4 py-2">
                            Page {page} sur {Math.ceil(total / 20)}
                        </span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={page >= Math.ceil(total / 20)}
                            className="px-4 py-2 border border-gray-300 rounded-md disabled:opacity-50"
                        >
                            Suivant
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OffreListPage;

