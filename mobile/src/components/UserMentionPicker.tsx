// Composant pour sélectionner et mentionner des utilisateurs (@mention)
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { apiGet } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import SafeIcon from './SafeIcon';
import { useLanguageSafe } from '../contexts/LanguageContext';

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
    currentQuery?: string; // Texte après le @
}

const UserMentionPicker: React.FC<UserMentionPickerProps> = ({
    visible,
    onClose,
    onSelectUser,
    currentQuery = ''
}) => {
        const { t } = useLanguageSafe();
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
                // response.data = backend JSON = { success, data: User[], count }
                const backendResp = response.data as any;
                const users: User[] = backendResp?.data || (Array.isArray(backendResp) ? backendResp : []);
                console.log('[UserMentionPicker] searchUsers résultats:', users.length);

                // Tri intelligent : exact matches d'abord, puis partiels
                const sortedUsers = users.sort((a, b) => {
                    const queryLower = query.toLowerCase();
                    const aName = (a.nom_complet || '').toLowerCase();
                    const bName = (b.nom_complet || '').toLowerCase();
                    const aEmail = (a.email || '').toLowerCase();
                    const bEmail = (b.email || '').toLowerCase();

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
                const backendResp = response.data as any;
                setSearchResults(backendResp?.data || (Array.isArray(backendResp) ? backendResp : []));
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
        const userAvatar = 'user_avatar' in user ? user.user_avatar : (user as User).avatar_url;
        const isProvider = 'is_provider' in user ? user.is_provider : false;

        return (
            <TouchableOpacity
                style={styles.userItem}
                onPress={() => {
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
            >
                <View style={styles.userAvatar}>
                    {userAvatar ? (
                        <Image source={{ uri: userAvatar }} style={styles.avatarImage} />
                    ) : (
                        <View style={styles.avatarPlaceholder}>
                            <Text style={styles.avatarText}>
                                {userName.charAt(0).toUpperCase()}
                            </Text>
                        </View>
                    )}
                    {isProvider && (
                        <View style={styles.providerBadge}>
                            <SafeIcon name="check" size={10} color="#FFFFFF" />
                        </View>
                    )}
                </View>
                <View style={styles.userInfo}>
                    <Text style={styles.userName}>{userName}</Text>
                    {'email' in user && user.email && (
                        <Text style={styles.userEmail}>{user.email}</Text>
                    )}
                    {fromHistory && 'tag_count' in user && (
                        <Text style={styles.tagInfo}>
                            📌 Tagué {user.tag_count} fois
                        </Text>
                    )}
                </View>
                <SafeIcon name="chevron-right" size={18} color={modernColors.textSecondary} />
            </TouchableOpacity>
        );
    };

    const categories = [
        { key: 'livraison', label: t('userMentionPicker.livraison'), icon: '🚚' },
        { key: 'plombier', label: 'Plomberie', icon: '🔧' },
        { key: 'électricien', label: t('userMentionPicker.electricite'), icon: '⚡' },
        { key: 'mécanicien', label: t('userMentionPicker.mecanique'), icon: '🔨' },
        { key: 'coiffeur', label: 'Coiffure', icon: '✂️' },
    ];

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.headerTitle}>@Mentionner quelqu'un</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <SafeIcon name="x" size={24} color={modernColors.text} />
                        </TouchableOpacity>
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'history' && styles.tabActive]}
                            onPress={() => setActiveTab('history')}
                        >
                            <SafeIcon name="clock" size={18} color={activeTab === 'history' ? modernColors.primary : modernColors.textSecondary} />
                            <Text style={[styles.tabText, activeTab === 'history' && styles.tabTextActive]}>
                                Récents
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'search' && styles.tabActive]}
                            onPress={() => setActiveTab('search')}
                        >
                            <SafeIcon name="search" size={18} color={activeTab === 'search' ? modernColors.primary : modernColors.textSecondary} />
                            <Text style={[styles.tabText, activeTab === 'search' && styles.tabTextActive]}>
                                Rechercher
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'category' && styles.tabActive]}
                            onPress={() => setActiveTab('category')}
                        >
                            <SafeIcon name="grid" size={18} color={activeTab === 'category' ? modernColors.primary : modernColors.textSecondary} />
                            <Text style={[styles.tabText, activeTab === 'category' && styles.tabTextActive]}>
                                Catégories
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Barre de recherche */}
                    {activeTab === 'search' && (
                        <View style={styles.searchContainer}>
                            <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                            <TextInput
                                style={styles.searchInput}
                                placeholder={t('userMentionPicker.nomOuEmailDeLa')}
                                value={searchQuery}
                                onChangeText={setSearchQuery}
                                autoFocus
                            />
                            {searchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setSearchQuery('')}>
                                    <SafeIcon name="x-circle" size={20} color={modernColors.textSecondary} />
                                </TouchableOpacity>
                            )}
                        </View>
                    )}

                    {/* Contenu selon l'onglet actif */}
                    <View style={styles.content}>
                        {loading ? (
                            <View style={styles.loadingContainer}>
                                <ActivityIndicator size="large" color={modernColors.primary} />
                                <Text style={styles.loadingText}>{t('userMentionPicker.rechercheEnCours')}/Text>
                            </View>
                        ) : (
                            <>
                                {/* Onglet Historique */}
                                {activeTab === 'history' && (
                                    <View style={styles.tabContent}>
                                        {tagHistory.length > 0 ? (
                                            <>
                                                <Text style={styles.sectionTitle}>{t('userMentionPicker.personnesRecemmentTaguees')}</Text>
                                                <FlatList
                                                    data={tagHistory}
                                                    keyExtractor={(item) => item.user_id.toString()}
                                                    renderItem={({ item }) => renderUserItem(item, true)}
                                                    showsVerticalScrollIndicator={false}
                                                />
                                            </>
                                        ) : (
                                            <View style={styles.emptyState}>
                                                <SafeIcon name="clock" size={48} color={modernColors.textSecondary} />
                                                <Text style={styles.emptyTitle}>{t('userMentionPicker.aucunHistorique')}</Text>
                                                <Text style={styles.emptyText}>
                                                    Vous n'avez encore tagué personne
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Onglet Recherche */}
                                {activeTab === 'search' && (
                                    <View style={styles.tabContent}>
                                        {searchQuery.trim().length < 1 ? (
                                            <View style={styles.hintContainer}>
                                                <SafeIcon name="info" size={24} color={modernColors.primary} />
                                                <Text style={styles.hintText}>
                                                    Tapez au moins 1 caractère pour rechercher
                                                </Text>
                                            </View>
                                        ) : searchResults.length > 0 ? (
                                            <FlatList
                                                data={searchResults}
                                                keyExtractor={(item) => item.id.toString()}
                                                renderItem={({ item }) => renderUserItem(item, false)}
                                                showsVerticalScrollIndicator={false}
                                            />
                                        ) : (
                                            <View style={styles.emptyState}>
                                                <SafeIcon name="search" size={48} color={modernColors.textSecondary} />
                                                <Text style={styles.emptyTitle}>{t('userMentionPicker.aucunResultat')}</Text>
                                                <Text style={styles.emptyText}>
                                                    Aucun utilisateur trouvé pour "{searchQuery}"
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                )}

                                {/* Onglet Catégories */}
                                {activeTab === 'category' && (
                                    <View style={styles.tabContent}>
                                        <Text style={styles.sectionTitle}>{t('userMentionPicker.rechercherParMetier')}</Text>
                                        <View style={styles.categoriesGrid}>
                                            {categories.map((cat) => (
                                                <TouchableOpacity
                                                    key={cat.key}
                                                    style={styles.categoryCard}
                                                    onPress={() => {
                                                        searchByCategory(cat.key);
                                                        setActiveTab('search');
                                                    }}
                                                >
                                                    <Text style={styles.categoryIcon}>{cat.icon}</Text>
                                                    <Text style={styles.categoryLabel}>{cat.label}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {searchResults.length > 0 && (
                                            <View style={styles.resultsSection}>
                                                <Text style={styles.sectionTitle}>{t('userMentionPicker.resultats')}</Text>
                                                <FlatList
                                                    data={searchResults}
                                                    keyExtractor={(item) => item.id.toString()}
                                                    renderItem={({ item }) => renderUserItem(item, false)}
                                                    showsVerticalScrollIndicator={false}
                                                />
                                            </View>
                                        )}
                                    </View>
                                )}
                            </>
                        )}
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '80%',
        paddingBottom: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    tabs: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingTop: 12,
        gap: 8,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: modernColors.background,
    },
    tabActive: {
        backgroundColor: modernColors.primary,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
        color: modernColors.textSecondary,
    },
    tabTextActive: {
        color: '#FFFFFF',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 20,
        paddingVertical: 12,
        backgroundColor: modernColors.background,
        borderRadius: 12,
        marginHorizontal: 16,
        marginTop: 12,
    },
    searchInput: {
        flex: 1,
        fontSize: 15,
        color: modernColors.text,
        paddingVertical: 4,
    },
    content: {
        flex: 1,
        paddingHorizontal: 16,
        paddingTop: 16,
    },
    tabContent: {
        flex: 1,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.textSecondary,
        marginBottom: 12,
        paddingHorizontal: 4,
    },
    userItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 12,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    userAvatar: {
        position: 'relative',
        width: 48,
        height: 48,
    },
    avatarImage: {
        width: 48,
        height: 48,
        borderRadius: 24,
    },
    avatarPlaceholder: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: modernColors.primary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 20,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    providerBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: modernColors.success,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: modernColors.surface,
    },
    userInfo: {
        flex: 1,
    },
    userName: {
        fontSize: 15,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 2,
    },
    userEmail: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    tagInfo: {
        fontSize: 11,
        color: modernColors.primary,
        marginTop: 2,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 20,
    },
    categoryCard: {
        width: '30%',
        aspectRatio: 1,
        backgroundColor: modernColors.surface,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    categoryIcon: {
        fontSize: 32,
    },
    categoryLabel: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
        textAlign: 'center',
    },
    resultsSection: {
        flex: 1,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    loadingText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginTop: 12,
    },
    emptyState: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        paddingHorizontal: 40,
    },
    hintContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 40,
    },
    hintText: {
        fontSize: 14,
        color: modernColors.textSecondary,
        textAlign: 'center',
        marginTop: 12,
        paddingHorizontal: 40,
    },
});

export default UserMentionPicker;

