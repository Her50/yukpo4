// ✅ Page de recherche et affichage des expériences d'anciens étudiants

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Experience {
    id: number;
    etablissement_id: number;
    nom_etablissement?: string;
    nom_etudiant: string;
    filiere: string;
    annee_graduation?: string;
    experience_text: string;
    note_satisfaction?: number;
    is_modere: boolean;
    created_at: string;
}

const ExperiencesEtudiantsPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const etablissementId = searchParams.get('etablissement_id');

    const [loading, setLoading] = useState(false);
    const [experiences, setExperiences] = useState<Experience[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);

    // Filtres
    const [filiere, setFiliere] = useState('');

    useEffect(() => {
        searchExperiences();
    }, [etablissementId, filiere, page]);

    const searchExperiences = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
            });

            if (etablissementId) params.append('etablissement_id', etablissementId);
            if (filiere) params.append('filiere', filiere);

            const response = await apiGet(`/api/orientation-scolaire/experiences/search?${params}`);
            const data = await response.json();

            if (data.success) {
                setExperiences(data.data || []);
                setTotal(data.pagination?.total || 0);
            }
        } catch (error) {
            console.error('[ExperiencesEtudiants] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-6">
                    Expériences d'Anciens Étudiants
                </h1>

                {/* Filtres */}
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
                            searchExperiences();
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
                ) : experiences.length > 0 ? (
                    <>
                        <div className="mb-4 text-gray-600">
                            {total} expérience{total > 1 ? 's' : ''} trouvée{total > 1 ? 's' : ''}
                        </div>
                        <div className="space-y-6">
                            {experiences.map((exp) => (
                                <div
                                    key={exp.id}
                                    className="bg-white rounded-lg shadow-md p-6"
                                >
                                    <div className="flex justify-between items-start mb-4">
                                        <div>
                                            <h3 className="text-lg font-semibold text-gray-900">
                                                {exp.nom_etudiant}
                                            </h3>
                                            <p className="text-sm text-gray-600">
                                                📍 {exp.nom_etablissement || `Établissement #${exp.etablissement_id}`}
                                            </p>
                                        </div>
                                        {exp.is_modere && (
                                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                                ✓ Modéré
                                            </span>
                                        )}
                                    </div>
                                    <div className="space-y-2 text-sm text-gray-600 mb-4">
                                        <p>🎓 Filière: {exp.filiere}</p>
                                        {exp.annee_graduation && (
                                            <p>📅 Année de graduation: {exp.annee_graduation}</p>
                                        )}
                                        {exp.note_satisfaction && (
                                            <p>
                                                ⭐ Note: {exp.note_satisfaction}/5
                                            </p>
                                        )}
                                    </div>
                                    <div className="bg-gray-50 rounded-md p-4 mb-4">
                                        <p className="text-gray-700 whitespace-pre-wrap">
                                            {exp.experience_text}
                                        </p>
                                    </div>
                                    {exp.etablissement_id && (
                                        <button
                                            onClick={() => navigate(`/orientation-scolaire/etablissements/${exp.etablissement_id}`)}
                                            className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
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
                        <p className="text-gray-600">Aucune expérience trouvée</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExperiencesEtudiantsPage;

