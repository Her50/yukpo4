// ✅ Page de recherche d'établissements scolaires

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Etablissement {
    id: number;
    nom_etablissement: string;
    type_etablissement: string;
    ville: string;
    region?: string;
    filieres?: string[];
    is_verified: boolean;
    statistiques_examens?: any;
}

const EtablissementSearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const typeParam = searchParams.get('type') || '';

    const [loading, setLoading] = useState(false);
    const [etablissements, setEtablissements] = useState<Etablissement[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [typeEtablissement, setTypeEtablissement] = useState(typeParam || '');
    const [ville, setVille] = useState('');
    const [region, setRegion] = useState('');
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        if (typeEtablissement) {
            searchEtablissements();
        }
    }, [typeEtablissement, ville, region, filiere, page]);

    const searchEtablissements = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (typeEtablissement) params.append('type_etablissement', typeEtablissement);
            if (ville) params.append('ville', ville);
            if (region) params.append('region', region);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/etablissements/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setEtablissements(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[EtablissementSearch] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSearch = () => {
        setPage(1);
        searchEtablissements();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Rechercher un établissement
                </h1>

                {/* Filtres */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type
                            </label>
                            <select
                                value={typeEtablissement}
                                onChange={(e) => setTypeEtablissement(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            >
                                <option value="">Tous</option>
                                <option value="primaire">Primaire</option>
                                <option value="secondaire">Secondaire</option>
                                <option value="superieur">Supérieur</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Ville
                            </label>
                            <input
                                type="text"
                                value={ville}
                                onChange={(e) => setVille(e.target.value)}
                                placeholder="Ex: Douala"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Région
                            </label>
                            <input
                                type="text"
                                value={region}
                                onChange={(e) => setRegion(e.target.value)}
                                placeholder="Ex: Littoral"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Filière
                            </label>
                            <input
                                type="text"
                                value={filiere}
                                onChange={(e) => setFiliere(e.target.value)}
                                placeholder="Ex: Scientifique"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                            />
                        </div>
                    </div>
                    <button
                        onClick={handleSearch}
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
                ) : etablissements.length > 0 ? (
                    <>
                        <div className="mb-4 text-gray-600">
                            {total} établissement{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {etablissements.map((etab) => (
                                <div
                                    key={etab.id}
                                    onClick={() => navigate(`/orientation-scolaire/etablissements/${etab.id}`)}
                                    className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                                >
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {etab.nom_etablissement}
                                    </h3>
                                    <div className="space-y-1 text-sm text-gray-600">
                                        <p>📍 {etab.ville}{etab.region && `, ${etab.region}`}</p>
                                        <p>🎓 {etab.type_etablissement}</p>
                                        {etab.filieres && etab.filieres.length > 0 && (
                                            <p>📚 {etab.filieres.join(', ')}</p>
                                        )}
                                    </div>
                                    {etab.is_verified && (
                                        <span className="inline-block mt-2 px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                            ✓ Vérifié
                                        </span>
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
                        <p className="text-gray-600">Aucun établissement trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default EtablissementSearchPage;

