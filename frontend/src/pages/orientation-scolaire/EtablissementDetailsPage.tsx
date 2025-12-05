// ✅ Page de détails d'un établissement scolaire

import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { apiGet } from '../../services/apiService';

interface Etablissement {
    id: number;
    nom_etablissement: string;
    type_etablissement: string;
    sous_type?: string;
    adresse?: string;
    ville: string;
    region?: string;
    telephone?: string;
    email?: string;
    site_web?: string;
    filieres?: string[];
    specialites?: string[];
    statistiques_examens?: any;
    is_verified: boolean;
}

const EtablissementDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(true);
    const [etablissement, setEtablissement] = useState<Etablissement | null>(null);

    useEffect(() => {
        loadEtablissement();
    }, [id]);

    const loadEtablissement = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/orientation-scolaire/etablissements/${id}`);
            const data = await response.json();

            if (data.success) {
                setEtablissement(data.data);
            }
        } catch (error) {
            console.error('[EtablissementDetails] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                    <p className="mt-4 text-gray-600">Chargement...</p>
                </div>
            </div>
        );
    }

    if (!etablissement) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <p className="text-gray-600">Établissement non trouvé</p>
                    <button
                        onClick={() => navigate('/orientation-scolaire')}
                        className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md"
                    >
                        Retour
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <button
                        onClick={() => navigate(-1)}
                        className="mb-4 text-blue-600 hover:text-blue-700"
                    >
                        ← Retour
                    </button>
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        {etablissement.nom_etablissement}
                    </h1>
                    <div className="flex items-center gap-4 text-gray-600">
                        <span>📍 {etablissement.ville}{etablissement.region && `, ${etablissement.region}`}</span>
                        <span>🎓 {etablissement.type_etablissement}</span>
                        {etablissement.is_verified && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                                ✓ Vérifié
                            </span>
                        )}
                    </div>
                </div>

                {/* Informations */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Contact */}
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">Contact</h2>
                        <div className="space-y-2 text-gray-600">
                            {etablissement.adresse && <p>📍 {etablissement.adresse}</p>}
                            {etablissement.telephone && <p>📞 {etablissement.telephone}</p>}
                            {etablissement.email && <p>✉️ {etablissement.email}</p>}
                            {etablissement.site_web && (
                                <p>
                                    🌐{' '}
                                    <a
                                        href={etablissement.site_web}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-600 hover:underline"
                                    >
                                        {etablissement.site_web}
                                    </a>
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Filières */}
                    {etablissement.filieres && etablissement.filieres.length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">Filières</h2>
                            <div className="flex flex-wrap gap-2">
                                {etablissement.filieres.map((filiere, idx) => (
                                    <span
                                        key={idx}
                                        className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                                    >
                                        {filiere}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Actions</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <button
                            onClick={() => navigate(`/orientation-scolaire/etablissements/${id}/programmes`)}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                        >
                            <div className="text-2xl mb-2">📖</div>
                            <div className="font-medium text-sm">Programmes</div>
                        </button>
                        <button
                            onClick={() => navigate(`/orientation-scolaire/etablissements/${id}/fournitures`)}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                        >
                            <div className="text-2xl mb-2">✏️</div>
                            <div className="font-medium text-sm">Fournitures</div>
                        </button>
                        <button
                            onClick={() => navigate(`/orientation-scolaire/etablissements/${id}/concours`)}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                        >
                            <div className="text-2xl mb-2">🏆</div>
                            <div className="font-medium text-sm">Concours</div>
                        </button>
                        <button
                            onClick={() => navigate(`/orientation-scolaire/etablissements/${id}/experiences`)}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors"
                        >
                            <div className="text-2xl mb-2">💬</div>
                            <div className="font-medium text-sm">Expériences</div>
                        </button>
                    </div>
                    {/* Bouton Contacter */}
                    <button
                        onClick={() => navigate(`/chat/etablissement/${id}`, {
                            state: {
                                serviceTitle: etablissement.nom_etablissement,
                                etablissementId: id,
                                etablissementName: etablissement.nom_etablissement,
                                type: 'etablissement'
                            }
                        })}
                        className="w-full px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                    >
                        <span>💬</span>
                        <span>Contacter l'établissement</span>
                    </button>
                </div>

                {/* Statistiques */}
                {etablissement.statistiques_examens &&
                    Object.keys(etablissement.statistiques_examens).length > 0 && (
                        <div className="bg-white rounded-lg shadow-md p-6">
                            <h2 className="text-xl font-semibold text-gray-900 mb-4">
                                Statistiques d'examens
                            </h2>
                            <div className="space-y-4">
                                {Object.entries(etablissement.statistiques_examens).map(
                                    ([annee, stats]: [string, any]) => (
                                        <div key={annee} className="border-l-4 border-blue-500 pl-4">
                                            <h3 className="font-semibold text-gray-900">{annee}</h3>
                                            {stats.taux_reussite && (
                                                <p className="text-gray-600">
                                                    Taux de réussite: {stats.taux_reussite}%
                                                </p>
                                            )}
                                            {stats.nb_candidats && (
                                                <p className="text-gray-600">
                                                    Candidats: {stats.nb_candidats}
                                                </p>
                                            )}
                                        </div>
                                    )
                                )}
                            </div>
                        </div>
                    )}
            </div>
        </div>
    );
};

export default EtablissementDetailsPage;

