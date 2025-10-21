// Composant pour sélectionner et mentionner des utilisateurs (@mention) - Frontend
import { apiGet } from '@/lib/api';
import { ChevronRight, Clock, Grid, Info, Search, UserCheck, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface User {
    id: number;
    nom_complet: string;
    email: string;
    avatar_url?: string;
    is_provider: boolean;
    role: string;
}

interface TagHistoryItem {
    user_id: number;
    user_name: string;
    user_avatar?: string;
    tag_count: number;
    last_tagged: string;
    context?: string;
}

interface UserMentionPickerProps {
    visible: boolean;
    onClose: () => void;
    onSelectUser: (user: User) => void;
    currentQuery?: string;
}

const UserMentionPicker: React.FC<UserMentionPickerProps> = ({
    visible,
    onClose,
    onSelectUser,
    currentQuery = ''
}) => {
    const [searchQuery, setSearchQuery] = useState(currentQuery);
    const [searchResults, setSearchResults] = useState<User[]>([]);
    const [tagHistory, setTagHistory] = useState<TagHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState<'history' | 'search' | 'category'>('history');

    // Charger l'historique des tags au montage
    useEffect(() => {
        if (visible) {
            loadTagHistory();
            if (currentQuery) {
                setSearchQuery(currentQuery);
                searchUsers(currentQuery);
            }
        }
    }, [visible, currentQuery]);

    const loadTagHistory = async () => {
        try {
            const response = await apiGet<TagHistoryItem[]>('/api/conversations/tag-history?limit=10');
            if (response.success && response.data) {
                setTagHistory(response.data);
            }
        } catch (error) {
            console.error('[UserMentionPicker] Erreur chargement historique:', error);
        }
    };

    const searchUsers = async (query: string) => {
        if (!query || query.trim().length < 1) {
            setSearchResults([]);
            return;
        }

        setLoading(true);
        try {
            // Recherche améliorée : nom, email, et recherche partielle
            const response = await apiGet<{ success: boolean; data: User[]; count: number }>(
                `/api/conversations/search-users?query=${encodeURIComponent(query)}&limit=20&search_type=all`
            );

            if (response.success && response.data) {
                const users = response.data.data || [];

                // Tri intelligent : exact matches d'abord, puis partiels
                const sortedUsers = users.sort((a, b) => {
                    const queryLower = query.toLowerCase();
                    const aName = a.nom_complet.toLowerCase();
                    const bName = b.nom_complet.toLowerCase();
                    const aEmail = a.email.toLowerCase();
                    const bEmail = b.email.toLowerCase();

                    // Priorité aux correspondances exactes
                    const aExactName = aName === queryLower;
                    const bExactName = bName === queryLower;
                    const aExactEmail = aEmail === queryLower;
                    const bExactEmail = bEmail === queryLower;

                    if (aExactName || aExactEmail) return -1;
                    if (bExactName || bExactEmail) return 1;

                    // Puis aux correspondances qui commencent par la query
                    const aStartsWithName = aName.startsWith(queryLower);
                    const bStartsWithName = bName.startsWith(queryLower);
                    const aStartsWithEmail = aEmail.startsWith(queryLower);
                    const bStartsWithEmail = bEmail.startsWith(queryLower);

                    if (aStartsWithName || aStartsWithEmail) return -1;
                    if (bStartsWithName || bStartsWithEmail) return 1;

                    // Enfin les correspondances partielles
                    const aContainsName = aName.includes(queryLower);
                    const bContainsName = bName.includes(queryLower);
                    const aContainsEmail = aEmail.includes(queryLower);
                    const bContainsEmail = bEmail.includes(queryLower);

                    if (aContainsName || aContainsEmail) return -1;
                    if (bContainsName || bContainsEmail) return 1;

                    return 0;
                });

                setSearchResults(sortedUsers);
            }
        } catch (error) {
            console.error('[UserMentionPicker] Erreur recherche:', error);
        } finally {
            setLoading(false);
        }
    };

    const searchByCategory = async (category: string) => {
        setLoading(true);
        try {
            const response = await apiGet<{ success: boolean; data: User[]; count: number }>(
                `/api/conversations/search-users?category=${encodeURIComponent(category)}&limit=20`
            );

            if (response.success && response.data) {
                setSearchResults(response.data.data || []);
            }
        } catch (error) {
            console.error('[UserMentionPicker] Erreur recherche catégorie:', error);
        } finally {
            setLoading(false);
        }
    };

    // Recherche automatique quand l'utilisateur tape (améliorée)
    useEffect(() => {
        const timer = setTimeout(() => {
            if (searchQuery.trim().length >= 1) {
                searchUsers(searchQuery);
                setActiveTab('search');
            } else {
                setSearchResults([]);
                setActiveTab('history');
            }
        }, 200); // Debounce réduit à 200ms pour plus de réactivité

        return () => clearTimeout(timer);
    }, [searchQuery]);

    const renderUserItem = (user: User | TagHistoryItem, fromHistory: boolean = false) => {
        const userId = 'user_id' in user ? user.user_id : user.id;
        const userName = 'user_name' in user ? user.user_name : user.nom_complet;
        const userAvatar = 'user_avatar' in user ? user.user_avatar : user.avatar_url;
        const isProvider = 'is_provider' in user ? user.is_provider : false;

        return (
            <div
                key={userId}
                onClick={() => {
                    const fullUser: User = fromHistory ? {
                        id: userId,
                        nom_complet: userName,
                        email: '',
                        avatar_url: userAvatar,
                        is_provider: false,
                        role: 'user'
                    } : user as User;

                    onSelectUser(fullUser);
                    onClose();
                }}
                className="flex items-center gap-3 p-3 bg-white rounded-lg border border-gray-200 hover:border-indigo-500 hover:bg-indigo-50 cursor-pointer transition-all mb-2"
            >
                <div className="relative">
                    {userAvatar ? (
                        <img src={userAvatar} alt={userName} className="w-12 h-12 rounded-full object-cover" />
                    ) : (
                        <div className="w-12 h-12 rounded-full bg-indigo-600 flex items-center justify-center">
                            <span className="text-white text-lg font-semibold">
                                {userName.charAt(0).toUpperCase()}
                            </span>
                        </div>
                    )}
                    {isProvider && (
                        <div className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 rounded-full border-2 border-white flex items-center justify-center">
                            <UserCheck size={10} className="text-white" />
                        </div>
                    )}
                </div>
                <div className="flex-1">
                    <p className="font-semibold text-gray-900">{userName}</p>
                    {'email' in user && user.email && (
                        <p className="text-sm text-gray-500">{user.email}</p>
                    )}
                    {fromHistory && 'tag_count' in user && (
                        <p className="text-xs text-indigo-600 mt-1">
                            📌 Tagué {user.tag_count} fois
                        </p>
                    )}
                </div>
                <ChevronRight size={18} className="text-gray-400" />
            </div>
        );
    };

    const categories = [
        { key: 'livraison', label: 'Livraison', icon: '🚚' },
        { key: 'plombier', label: 'Plomberie', icon: '🔧' },
        { key: 'électricien', label: 'Électricité', icon: '⚡' },
        { key: 'mécanicien', label: 'Mécanique', icon: '🔨' },
        { key: 'coiffeur', label: 'Coiffure', icon: '✂️' },
    ];

    if (!visible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            {/* Overlay */}
            <div
                className="absolute inset-0 bg-black bg-opacity-50"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full sm:max-w-2xl max-h-[80vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">@Mentionner quelqu'un</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex gap-2 p-4 bg-gray-50 border-b border-gray-200">
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-all ${activeTab === 'history'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Clock size={18} />
                        <span>Récents</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('search')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-all ${activeTab === 'search'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Search size={18} />
                        <span>Rechercher</span>
                    </button>
                    <button
                        onClick={() => setActiveTab('category')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 px-4 rounded-lg font-medium transition-all ${activeTab === 'category'
                            ? 'bg-indigo-600 text-white shadow-md'
                            : 'bg-white text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        <Grid size={18} />
                        <span>Catégories</span>
                    </button>
                </div>

                {/* Barre de recherche */}
                {activeTab === 'search' && (
                    <div className="p-4 border-b border-gray-200">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Nom ou email de la personne..."
                                className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                autoFocus
                            />
                            {searchQuery.length > 0 && (
                                <button
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                >
                                    <X size={20} />
                                </button>
                            )}
                        </div>
                    </div>
                )}

                {/* Contenu */}
                <div className="flex-1 overflow-y-auto p-4">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
                            <p className="mt-4 text-gray-500">Recherche en cours...</p>
                        </div>
                    ) : (
                        <>
                            {/* Onglet Historique */}
                            {activeTab === 'history' && (
                                <div>
                                    {tagHistory.length > 0 ? (
                                        <>
                                            <h3 className="text-sm font-semibold text-gray-600 mb-3">
                                                Personnes récemment taguées
                                            </h3>
                                            {tagHistory.map((item) => renderUserItem(item, true))}
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <Clock size={48} className="text-gray-300 mb-4" />
                                            <p className="font-semibold text-gray-900 mb-2">Aucun historique</p>
                                            <p className="text-gray-500 text-center">
                                                Vous n'avez encore tagué personne
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Onglet Recherche */}
                            {activeTab === 'search' && (
                                <div>
                                    {searchQuery.trim().length < 2 ? (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <Info size={32} className="text-indigo-600 mb-4" />
                                            <p className="text-gray-500 text-center">
                                                Tapez au moins 2 caractères pour rechercher
                                            </p>
                                        </div>
                                    ) : searchResults.length > 0 ? (
                                        searchResults.map((item) => renderUserItem(item, false))
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-12">
                                            <Search size={48} className="text-gray-300 mb-4" />
                                            <p className="font-semibold text-gray-900 mb-2">Aucun résultat</p>
                                            <p className="text-gray-500 text-center">
                                                Aucun utilisateur trouvé pour "{searchQuery}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Onglet Catégories */}
                            {activeTab === 'category' && (
                                <div>
                                    <h3 className="text-sm font-semibold text-gray-600 mb-3">
                                        Rechercher par métier
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3 mb-6">
                                        {categories.map((cat) => (
                                            <button
                                                key={cat.key}
                                                onClick={() => {
                                                    searchByCategory(cat.key);
                                                    setActiveTab('search');
                                                }}
                                                className="aspect-square bg-white border border-gray-200 rounded-xl hover:border-indigo-500 hover:bg-indigo-50 transition-all flex flex-col items-center justify-center gap-2"
                                            >
                                                <span className="text-3xl">{cat.icon}</span>
                                                <span className="text-sm font-medium text-gray-700">{cat.label}</span>
                                            </button>
                                        ))}
                                    </div>

                                    {searchResults.length > 0 && (
                                        <div>
                                            <h3 className="text-sm font-semibold text-gray-600 mb-3">Résultats</h3>
                                            {searchResults.map((item) => renderUserItem(item, false))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UserMentionPicker;

