// ✅ Page de recherche et téléchargement de listes de fournitures scolaires

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Fourniture {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    niveau: string;
    annee_scolaire: string;
    liste_fournitures: any; // JSONB
    url_liste?: string;
    created_at: string;
}

const FournituresScolairesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const etablissementId = searchParams.get('etablissement_id');

    const [loading, setLoading] = useState(false);
    const [fournitures, setFournitures] = useState<Fourniture[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [niveau, setNiveau] = useState('');
    const [annee, setAnnee] = useState('');

    useEffect(() => {
        searchFournitures();
    }, [etablissementId, niveau, annee, page]);

    const searchFournitures = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId);
            if (niveau) params.append('niveau', niveau);
            if (annee) params.append('annee_scolaire', annee);

            const response = await apiGet(`/api/orientation-scolaire/fournitures/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setFournitures(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[FournituresScolaires] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (url: string, filename: string) => {
        if (url) {
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            link.target = '_blank';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Fournitures Scolaires
                </h1>

                {/* Filtres */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Niveau
                            </label>
                            <input
                                type="text"
                                value={niveau}
                                onChange={(e) => setNiveau(e.target.value)}
                                placeholder="Ex: 6ème"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Année scolaire
                            </label>
                            <input
                                type="text"
                                value={annee}
                                onChange={(e) => setAnnee(e.target.value)}
                                placeholder="Ex: 2024-2025"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>
                    <button
                        onClick={() => {
                            setPage(1);
                            searchFournitures();
                        }}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Rechercher
                    </button>
                </div>

                {/* Résultats */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Chargement...</p>
                    </div>
                ) : fournitures.length > 0 ? (
                    <>
                        <div className="mb-4 text-gray-600">
                            {total} liste{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {fournitures.map((fourn) => (
                                <div
                                    key={fourn.id}
                                    className="bg-white rounded-lg shadow-md p-6"
                                >
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {fourn.nom_etablissement || `Établissement #${fourn.etablissement_id}`}
                                    </h3>
                                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                                        <p>📚 Niveau: {fourn.niveau}</p>
                                        <p>📅 Année: {fourn.annee_scolaire}</p>
                                        {fourn.liste_fournitures && typeof fourn.liste_fournitures === 'object' && (
                                            <p className="text-xs text-gray-500">
                                                {Object.keys(fourn.liste_fournitures).length} catégorie(s)
                                            </p>
                                        )}
                                    </div>
                                    {fourn.url_liste ? (
                                        <button
                                            onClick={() => handleDownload(fourn.url_liste!, `fournitures-${fourn.id}.pdf`)}
                                            className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                                        >
                                            📥 Télécharger PDF
                                        </button>
                                    ) : (
                                        <div className="p-3 bg-gray-100 rounded-md text-sm text-gray-600">
                                            Liste disponible en ligne
                                        </div>
                                    )}
                                    {fourn.etablissement_id && (
                                        <button
                                            onClick={() => navigate(`/orientation-scolaire/etablissements/${fourn.etablissement_id}`)}
                                            className="w-full mt-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                        >
                                            Voir l'établissement
                                        </button>
                                    )}
                                </div>
                            ))}
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
                        <p className="text-gray-600">Aucune liste de fournitures trouvée</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default FournituresScolairesPage;

