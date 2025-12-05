// ✅ Hub pour orientation scolaire et établissements

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

interface EtablissementType {
    id: string;
    name: string;
    icon: string;
    color: string;
    route: string;
}

const OrientationScolaireHubPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(false);

    const etablissementTypes: EtablissementType[] = [
        {
            id: 'primaire',
            name: 'Primaire',
            icon: '📚',
            color: '#10B981',
            route: '/orientation-scolaire/primaire',
        },
        {
            id: 'secondaire',
            name: 'Secondaire',
            icon: '🎓',
            color: '#3B82F6',
            route: '/orientation-scolaire/secondaire',
        },
        {
            id: 'superieur',
            name: 'Supérieur',
            icon: '🎓',
            color: '#8B5CF6',
            route: '/orientation-scolaire/superieur',
        },
    ];

    return (
        <div className="min-h-screen bg-gray-50 py-8">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Orientation Scolaire
                    </h1>
                    <p className="text-gray-600">
                        Trouvez l'établissement scolaire idéal pour vous ou vos enfants
                    </p>
                </div>

                {/* Types d'établissements */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    {etablissementTypes.map((type) => (
                        <div
                            key={type.id}
                            onClick={() => navigate(`${type.route}/search`)}
                            className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                            style={{ borderTop: `4px solid ${type.color}` }}
                        >
                            <div className="flex items-center mb-4">
                                <span className="text-4xl mr-4">{type.icon}</span>
                                <h2 className="text-xl font-semibold text-gray-900">
                                    {type.name}
                                </h2>
                            </div>
                            <p className="text-gray-600 text-sm mb-4">
                                Recherchez des établissements {type.name.toLowerCase()}
                            </p>
                            <button
                                className="w-full py-2 px-4 rounded-md text-white font-medium hover:opacity-90 transition-opacity"
                                style={{ backgroundColor: type.color }}
                            >
                                Rechercher
                            </button>
                        </div>
                    ))}
                </div>

                {/* Actions rapides */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-8">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        Actions rapides
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <button
                            onClick={() => navigate('/orientation-scolaire/concours/actifs')}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors text-left"
                        >
                            <div className="text-2xl mb-2">🏆</div>
                            <div className="font-medium text-gray-900">Concours actifs</div>
                            <div className="text-sm text-gray-600">Voir les concours</div>
                        </button>
                        <button
                            onClick={() => navigate('/orientation-scolaire/conferences/programmees')}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors text-left"
                        >
                            <div className="text-2xl mb-2">📺</div>
                            <div className="font-medium text-gray-900">Conférences</div>
                            <div className="text-sm text-gray-600">Lives programmés</div>
                        </button>
                        <button
                            onClick={() => navigate('/orientation-scolaire/programmes/search')}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors text-left"
                        >
                            <div className="text-2xl mb-2">📖</div>
                            <div className="font-medium text-gray-900">Programmes</div>
                            <div className="text-sm text-gray-600">Télécharger</div>
                        </button>
                        <button
                            onClick={() => navigate('/orientation-scolaire/fournitures/search')}
                            className="p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 transition-colors text-left"
                        >
                            <div className="text-2xl mb-2">✏️</div>
                            <div className="font-medium text-gray-900">Fournitures</div>
                            <div className="text-sm text-gray-600">Listes scolaires</div>
                        </button>
                    </div>
                </div>

                {/* Suggestions */}
                {user && (
                    <div className="bg-white rounded-lg shadow-md p-6">
                        <h2 className="text-xl font-semibold text-gray-900 mb-4">
                            Suggestions pour vous
                        </h2>
                        <p className="text-gray-600">
                            Utilisez notre système de suggestions intelligent pour trouver
                            l'établissement qui correspond le mieux à vos critères.
                        </p>
                        <button
                            onClick={() => navigate('/orientation-scolaire/suggest')}
                            className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                        >
                            Obtenir des suggestions
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default OrientationScolaireHubPage;

