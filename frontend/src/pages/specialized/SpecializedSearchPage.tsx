// ✅ NOUVEAU: Page de recherche avancée pour services spécialisés (Web)
// Intègre autocomplete, filtres, historique et recherches sauvegardées

import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPost } from '../../services/apiService';

interface SearchFilters {
    availability?: 'all' | 'available_now' | 'on_duty';
    minPrice?: number;
    maxPrice?: number;
    services?: string[];
    rating?: number;
}

const SpecializedSearchPage: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const { user } = useAuth();
    const specializedType = searchParams.get('type') || 'all';
    const prefillQuery = searchParams.get('q') || '';

    const [searchQuery, setSearchQuery] = useState(prefillQuery);
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showFilters, setShowFilters] = useState(false);
    const [filters, setFilters] = useState<SearchFilters>({});
    const [loading, setLoading] = useState(false);
    const [searchHistory, setSearchHistory] = useState<any[]>([]);
    const [savedSearches, setSavedSearches] = useState<any[]>([]);

    useEffect(() => {
        loadHistory();
        loadSavedSearches();
    }, []);

    const loadHistory = async () => {
        try {
            const response = await apiGet('/api/specialized-services/search-history?limit=10');
            const data = await response.json();
            if (data.success && data.data) {
                setSearchHistory(data.data.history || []);
            }
        } catch (error) {
            console.error('Erreur chargement historique:', error);
        }
    };

    const loadSavedSearches = async () => {
        try {
            const response = await apiGet('/api/specialized-services/saved-searches');
            const data = await response.json();
            if (data.success && data.data) {
                setSavedSearches(data.data.saved_searches || []);
            }
        } catch (error) {
            console.error('Erreur chargement recherches sauvegardées:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim()) return;

        setLoading(true);
        try {
            const payload: any = {
                texte: searchQuery.trim(),
                specialized_type: specializedType !== 'all' ? specializedType : undefined,
            };

            // Ajouter les filtres
            if (filters.availability) payload.availability = filters.availability;
            if (filters.minPrice !== undefined) payload.min_price = filters.minPrice;
            if (filters.maxPrice !== undefined) payload.max_price = filters.maxPrice;
            if (filters.services && filters.services.length > 0) payload.services = filters.services;
            if (filters.rating !== undefined) payload.min_rating = filters.rating;

            const response = await apiPost('/api/search/direct', payload);
            const responseData = await response.json();

            // Sauvegarder dans l'historique
            try {
                await apiPost('/api/specialized-services/search-history', {
                    query: searchQuery.trim(),
                    specialized_type: specializedType !== 'all' ? specializedType : undefined,
                    filters: filters,
                    results_count: responseData?.resultats?.length || 0,
                });
                loadHistory();
            } catch (error) {
                console.error('Erreur sauvegarde historique:', error);
            }

            // Naviguer vers les résultats
            navigate('/resultats', {
                state: {
                    results: responseData?.resultats || [],
                    searchQuery: searchQuery.trim(),
                    specializedType: specializedType,
                },
            });
        } catch (error: any) {
            console.error('Erreur recherche:', error);
            alert(error.message || 'Erreur lors de la recherche');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 py-8">
                {/* Header */}
                <div className="mb-8">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Recherche Spécialisée</h1>
                    <p className="text-gray-600">Trouvez rapidement les services dont vous avez besoin</p>
                </div>

                {/* Recherches sauvegardées */}
                {savedSearches.length > 0 && !searchQuery && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>🔖</span> Recherches sauvegardées
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {savedSearches.map((saved) => (
                                <div
                                    key={saved.id}
                                    className="bg-white rounded-lg p-4 shadow-sm hover:shadow-md transition cursor-pointer"
                                    onClick={() => {
                                        setSearchQuery(saved.query);
                                        handleSearch();
                                    }}
                                >
                                    <h3 className="font-semibold text-gray-900">{saved.name}</h3>
                                    <p className="text-sm text-gray-500 mt-1">{saved.query}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Historique */}
                {searchHistory.length > 0 && !searchQuery && (
                    <div className="mb-6">
                        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                            <span>🕐</span> Recherches récentes
                        </h2>
                        <div className="flex gap-3 overflow-x-auto pb-2">
                            {searchHistory.map((item) => (
                                <div
                                    key={item.id}
                                    className="bg-white rounded-lg px-4 py-2 shadow-sm hover:shadow-md transition cursor-pointer whitespace-nowrap"
                                    onClick={() => {
                                        setSearchQuery(item.query);
                                        handleSearch();
                                    }}
                                >
                                    <p className="text-sm font-medium text-gray-900">{item.query}</p>
                                    <p className="text-xs text-gray-500 mt-1">
                                        {new Date(item.searched_at).toLocaleDateString()}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Barre de recherche */}
                <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
                    <div className="flex gap-3 mb-4">
                        <div className="flex-1 relative">
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Rechercher un service spécialisé..."
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                            />
                            {suggestions.length > 0 && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg">
                                    {suggestions.map((suggestion, idx) => (
                                        <div
                                            key={idx}
                                            className="px-4 py-2 hover:bg-gray-50 cursor-pointer"
                                            onClick={() => {
                                                setSearchQuery(suggestion);
                                                handleSearch();
                                            }}
                                        >
                                            {suggestion}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <button
                            onClick={() => setShowFilters(!showFilters)}
                            className="px-4 py-3 border border-indigo-600 text-indigo-600 rounded-lg hover:bg-indigo-50 transition font-medium"
                        >
                            🔍 Filtres {Object.keys(filters).length > 0 && `(${Object.keys(filters).length})`}
                        </button>
                        <button
                            onClick={handleSearch}
                            disabled={loading || !searchQuery.trim()}
                            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Recherche...' : 'Rechercher'}
                        </button>
                    </div>

                    {/* Filtres */}
                    {showFilters && (
                        <div className="border-t border-gray-200 pt-4 mt-4">
                            <h3 className="font-semibold text-gray-900 mb-4">Filtres</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {/* Disponibilité */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Disponibilité
                                    </label>
                                    <select
                                        value={filters.availability || 'all'}
                                        onChange={(e) =>
                                            setFilters({
                                                ...filters,
                                                availability: e.target.value as any,
                                            })
                                        }
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                    >
                                        <option value="all">Tous</option>
                                        <option value="available_now">Disponible maintenant</option>
                                        <option value="on_duty">De garde</option>
                                    </select>
                                </div>

                                {/* Prix (si transport) */}
                                {(specializedType === 'covoiturage' || specializedType === 'taxi') && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Prix min (XAF)
                                            </label>
                                            <input
                                                type="number"
                                                value={filters.minPrice || ''}
                                                onChange={(e) =>
                                                    setFilters({
                                                        ...filters,
                                                        minPrice: e.target.value ? parseInt(e.target.value) : undefined,
                                                    })
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                Prix max (XAF)
                                            </label>
                                            <input
                                                type="number"
                                                value={filters.maxPrice || ''}
                                                onChange={(e) =>
                                                    setFilters({
                                                        ...filters,
                                                        maxPrice: e.target.value ? parseInt(e.target.value) : undefined,
                                                    })
                                                }
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SpecializedSearchPage;

