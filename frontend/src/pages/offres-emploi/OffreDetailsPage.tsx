// ✅ Page détails d'une offre d'emploi avec score de matching
import { Briefcase, CheckCircle, Clock, MapPin, XCircle } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

interface OffreEmploi {
    id: number;
    entreprise_id: number;
    titre_poste: string;
    description: string;
    type_contrat: string;
    duree_contrat?: number;
    lieu_travail: string;
    adresse?: string;
    gps?: string;
    remote: boolean;
    remote_partiel: boolean;
    salaire_min?: number;
    salaire_max?: number;
    devise: string;
    salaire_negociable: boolean;
    niveau_etude?: string;
    experience_min?: number;
    competences_requises?: string[];
    langues_requises?: any;
    permis_requis?: string[];
    secteur: string;
    domaine?: string;
    tags?: string[];
    date_publication: string;
    date_limite_candidature?: string;
    date_debut_poste?: string;
    nombre_candidatures: number;
    nombre_vues: number;
}

interface MatchingScore {
    score_total: number;
    score_competences?: number;
    score_experience?: number;
    score_localisation?: number;
    score_salaire?: number;
    competences_match?: string[];
    competences_manquantes?: string[];
}

const OffreDetailsPage: React.FC = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useAuth();
    const [offre, setOffre] = useState<OffreEmploi | null>(null);
    const [matchingScore, setMatchingScore] = useState<MatchingScore | null>(null);
    const [loading, setLoading] = useState(true);
    const [postulating, setPostulating] = useState(false);

    useEffect(() => {
        if (id) {
            loadOffre();
            if (user) {
                loadMatchingScore();
            }
        }
    }, [id, user]);

    const loadOffre = async () => {
        try {
            setLoading(true);
            const response = await apiGet(`/api/offres-emploi/${id}`);
            const data = await response.json();
            if (data.success) {
                setOffre(data.data);
            }
        } catch (error) {
            console.error('[OffreDetailsPage] Erreur:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadMatchingScore = async () => {
        try {
            const response = await apiGet(`/api/offres-emploi/matching/offres?min_score=0&limit=100`);
            const data = await response.json();
            if (data.success) {
                const match = data.data.find((m: any) => m.offre_id === parseInt(id || '0'));
                if (match) {
                    setMatchingScore({
                        score_total: parseFloat(match.score_total) || 0,
                        score_competences: match.score_competences ? parseFloat(match.score_competences) : undefined,
                        score_experience: match.score_experience ? parseFloat(match.score_experience) : undefined,
                        score_localisation: match.score_localisation ? parseFloat(match.score_localisation) : undefined,
                        score_salaire: match.salaire ? parseFloat(match.score_salaire) : undefined,
                        competences_match: match.competences_match,
                        competences_manquantes: match.competences_manquantes,
                    });
                }
            }
        } catch (error) {
            console.error('[OffreDetailsPage] Erreur matching:', error);
        }
    };

    const handlePostuler = async () => {
        if (!user) {
            navigate('/login');
            return;
        }

        try {
            setPostulating(true);
            const response = await apiPost('/api/offres-emploi/candidatures', {
                offre_id: parseInt(id || '0'),
            });
            const data = await response.json();
            if (data.success) {
                alert('Candidature envoyée avec succès !');
                navigate('/offres-emploi/mes-candidatures');
            } else {
                alert(data.message || 'Erreur lors de la candidature');
            }
        } catch (error) {
            console.error('[OffreDetailsPage] Erreur candidature:', error);
            alert('Erreur lors de la candidature');
        } finally {
            setPostulating(false);
        }
    };

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

    if (!offre) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">Offre non trouvée</h2>
                    <button
                        onClick={() => navigate('/offres-emploi')}
                        className="text-indigo-600 hover:text-indigo-700"
                    >
                        Retour aux offres
                    </button>
                </div>
            </div>
        );
    }

    const formatSalaire = () => {
        if (!offre.salaire_min && !offre.salaire_max) return 'Salaire non renseigné';
        if (offre.salaire_min && offre.salaire_max) {
            return `${offre.salaire_min.toLocaleString()} - ${offre.salaire_max.toLocaleString()} ${offre.devise}`;
        }
        if (offre.salaire_min) return `À partir de ${offre.salaire_min.toLocaleString()} ${offre.devise}`;
        return `Jusqu'à ${offre.salaire_max?.toLocaleString()} ${offre.devise}`;
    };

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-4xl mx-auto px-4">
                {/* Score de matching */}
                {matchingScore && (
                    <div className="mb-6 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-6 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-semibold mb-2">Votre score de correspondance</h3>
                                <div className="text-4xl font-bold">{matchingScore.score_total.toFixed(0)}%</div>
                            </div>
                            <div className="text-right">
                                {matchingScore.score_total >= 70 ? (
                                    <div className="flex items-center gap-2 text-green-200">
                                        <CheckCircle className="w-6 h-6" />
                                        <span>Excellent match !</span>
                                    </div>
                                ) : matchingScore.score_total >= 50 ? (
                                    <div className="flex items-center gap-2 text-yellow-200">
                                        <span>Match correct</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 text-red-200">
                                        <XCircle className="w-6 h-6" />
                                        <span>Match faible</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        {matchingScore.competences_manquantes && matchingScore.competences_manquantes.length > 0 && (
                            <div className="mt-4 text-sm">
                                <p className="font-semibold mb-1">Compétences manquantes :</p>
                                <div className="flex flex-wrap gap-2">
                                    {matchingScore.competences_manquantes.map((comp, idx) => (
                                        <span key={idx} className="bg-white/20 px-2 py-1 rounded">
                                            {comp}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Détails de l'offre */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                            <h1 className="text-3xl font-bold text-gray-900 mb-2">{offre.titre_poste}</h1>
                            <div className="flex items-center gap-4 text-gray-600">
                                <div className="flex items-center gap-1">
                                    <MapPin className="w-4 h-4" />
                                    {offre.lieu_travail}
                                    {offre.remote && <span className="ml-2 text-green-600">(Remote possible)</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Briefcase className="w-4 h-4" />
                                    {offre.type_contrat}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    Publié le {new Date(offre.date_publication).toLocaleDateString('fr-FR')}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <div className="text-sm text-gray-500">{offre.nombre_vues} vues</div>
                            <div className="text-sm text-gray-500">{offre.nombre_candidatures} candidatures</div>
                        </div>
                    </div>

                    <div className="border-t border-gray-200 pt-6 space-y-4">
                        <div>
                            <h3 className="font-semibold text-gray-900 mb-2">Description</h3>
                            <p className="text-gray-700 whitespace-pre-wrap">{offre.description}</p>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Secteur</h3>
                                <p className="text-gray-700">{offre.secteur}</p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Rémunération</h3>
                                <p className="text-gray-700">{formatSalaire()}</p>
                                {offre.salaire_negociable && (
                                    <span className="text-sm text-green-600">(Négociable)</span>
                                )}
                            </div>
                            {offre.niveau_etude && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">Niveau d'étude</h3>
                                    <p className="text-gray-700">{offre.niveau_etude}</p>
                                </div>
                            )}
                            {offre.experience_min && (
                                <div>
                                    <h3 className="font-semibold text-gray-900 mb-2">Expérience requise</h3>
                                    <p className="text-gray-700">{offre.experience_min} an(s) minimum</p>
                                </div>
                            )}
                        </div>

                        {offre.competences_requises && offre.competences_requises.length > 0 && (
                            <div>
                                <h3 className="font-semibold text-gray-900 mb-2">Compétences requises</h3>
                                <div className="flex flex-wrap gap-2">
                                    {offre.competences_requises.map((comp, idx) => (
                                        <span
                                            key={idx}
                                            className={`px-3 py-1 rounded-full text-sm ${matchingScore?.competences_match?.includes(comp)
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                }`}
                                        >
                                            {comp}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {offre.date_limite_candidature && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                <p className="text-sm text-yellow-800">
                                    <strong>Date limite de candidature :</strong>{' '}
                                    {new Date(offre.date_limite_candidature).toLocaleDateString('fr-FR')}
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex gap-4">
                    <button
                        onClick={handlePostuler}
                        disabled={postulating}
                        className="flex-1 bg-indigo-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {postulating ? 'Envoi...' : 'Postuler maintenant'}
                    </button>
                    <button
                        onClick={() => navigate('/offres-emploi')}
                        className="px-6 py-3 border border-gray-300 rounded-lg font-semibold hover:bg-gray-50"
                    >
                        Retour
                    </button>
                </div>
            </div>
        </div>
    );
};

export default OffreDetailsPage;

