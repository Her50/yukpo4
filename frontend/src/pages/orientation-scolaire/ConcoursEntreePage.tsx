// ✅ Page de recherche et affichage des concours d'entrée

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Concours {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    nom_concours: string;
    date_concours: string;
    date_limite_inscription: string;
    filieres_concernées?: string[];
    url_documentation?: string;
    is_active: boolean;
    created_at: string;
}

const ConcoursEntreePage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const etablissementId = searchParams.get('etablissement_id');
    const actifsOnly = searchParams.get('actifs') === 'true';

    const [loading, setLoading] = useState(false);
    const [concours, setConcours] = useState<Concours[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        if (actifsOnly) {
            loadConcoursActifs();
        } else {
            searchConcours();
        }
    }, [etablissementId, filiere, page, actifsOnly]);

    const loadConcoursActifs = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            const response = await apiGet(`/api/orientation-scolaire/concours/actifs?${params}`);
            const data = await response.json();

            if (data.success) {
                setConcours(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConcoursEntree] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchConcours = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/concours/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setConcours(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ConcoursEntree] Erreur:', error);
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

    const isDatePassed = (dateStr: string) => {
        return new Date(dateStr) < new Date();
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900">
                        Concours d'Entrée
                    </h1>
                    <button
                        onClick={() => navigate('/orientation-scolaire/concours/actifs')}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                        Voir les concours actifs
                    </button>
                </div>

                {/* Filtres */}
                {!actifsOnly && (
                    <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                                searchConcours();
                            }}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Rechercher
                        </button>
                    </div>
                )}

                {/* Résultats */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        <p className="mt-4 text-gray-600">Chargement...</p>
                    </div>
                ) : concours.length > 0 ? (
                    <>
                        <div className="mb-4 text-gray-600">
                            {total} concours trouvé{total > 1 ? 's' : ''}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {concours.map((conc) => (
                                <div
                                    key={conc.id}
                                    className={`bg-white rounded-lg shadow-md p-6 ${!conc.is_active || isDatePassed(conc.date_limite_inscription)
                                            ? 'opacity-60'
                                            : ''
                                        }`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <h3 className="text-lg font-semibold text-gray-900">
                                            {conc.nom_concours}
                                        </h3>
                                        {conc.is_active && !isDatePassed(conc.date_limite_inscription) && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                Actif
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                                        <p>
                                            📍 {conc.nom_etablissement || `Établissement #${conc.etablissement_id}`}
                                        </p>
                                        <p>📅 Date concours: {new Date(conc.date_concours).toLocaleDateString('fr-FR')}</p>
                                        <p>
                                            ⏰ Inscription jusqu'au:{' '}
                                            {new Date(conc.date_limite_inscription).toLocaleDateString('fr-FR')}
                                        </p>
                                        {conc.filieres_concernées && conc.filieres_concernées.length > 0 && (
                                            <p>🎓 Filières: {conc.filieres_concernées.join(', ')}</p>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        {conc.url_documentation && (
                                            <button
                                                onClick={() => handleDownload(conc.url_documentation!, `concours-${conc.id}.pdf`)}
                                                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                            >
                                                📄 Documentation
                                            </button>
                                        )}
                                        {conc.etablissement_id && (
                                            <button
                                                onClick={() => navigate(`/orientation-scolaire/etablissements/${conc.etablissement_id}`)}
                                                className="flex-1 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                                            >
                                                Voir établissement
                                            </button>
                                        )}
                                    </div>
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
                        <p className="text-gray-600">Aucun concours trouvé</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ConcoursEntreePage;

