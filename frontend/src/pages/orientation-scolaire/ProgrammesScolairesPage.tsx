// ✅ Page de recherche et téléchargement de programmes scolaires

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Programme {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    niveau: string;
    annee_scolaire: string;
    filiere?: string;
    url_programme: string;
    created_at: string;
}

const ProgrammesScolairesPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const etablissementId = searchParams.get('etablissement_id');

    const [loading, setLoading] = useState(false);
    const [programmes, setProgrammes] = useState<Programme[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [niveau, setNiveau] = useState('');
    const [annee, setAnnee] = useState('');
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        searchProgrammes();
    }, [etablissementId, niveau, annee, filiere, page]);

    const searchProgrammes = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId);
            if (niveau) params.append('niveau', niveau);
            if (annee) params.append('annee_scolaire', annee);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/programmes/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setProgrammes(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ProgrammesScolaires] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownload = (url: string, filename: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Programmes Scolaires
                </h1>

                {/* Filtres */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                        onClick={() => {
                            setPage(1);
                            searchProgrammes();
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
                ) : programmes.length > 0 ? (
                    <>
                        <div className="mb-4 text-gray-600">
                            {total} programme{total > 1 ? 's' : ''} trouvé{total > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {programmes.map((prog) => (
                                <div
                                    key={prog.id}
                                    className="bg-white rounded-lg shadow-md p-6"
                                >
                                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                                        {prog.nom_etablissement || `Établissement #${prog.etablissement_id}`}
                                    </h3>
                                    <div className="space-y-1 text-sm text-gray-600 mb-4">
                                        <p>📚 Niveau: {prog.niveau}</p>
                                        <p>📅 Année: {prog.annee_scolaire}</p>
                                        {prog.filiere && <p>🎓 Filière: {prog.filiere}</p>}
                                    </div>
                                    <button
                                        onClick={() => handleDownload(prog.url_programme, `programme-${prog.id}.pdf`)}
                                        className="w-full px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
                                    >
                                        📥 Télécharger
                                    </button>
                                    {prog.etablissement_id && (
                                        <button
                                            onClick={() => navigate(`/orientation-scolaire/etablissements/${prog.etablissement_id}`)}
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
                        <p className="text-gray-600">Aucun programme trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ProgrammesScolairesPage;

