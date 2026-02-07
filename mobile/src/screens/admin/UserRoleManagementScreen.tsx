// Écran de gestion des rôles utilisateurs (admin seulement)
import { useNavigation } from '@react-navigation/native';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { NativeButton, NativeCard } from '../../components/SafeNativeDesign';
import SafeIcon from '../../components/SafeIcon';
import { SafeNativeView } from '../../components/SafeNativeView';
import { useAuth } from '../../contexts/AuthContext';
import { apiGet, apiPatch } from '../../services/api';
import { modernColors } from '../../theme/modernTheme';
import { isAdminUser } from '../../utils/roleHelpers'; // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin

interface UserListItem {
    id: number;
    email: string;
    role: string;
    nom?: string;
    prenom?: string;
    nom_complet?: string;
    is_provider: boolean;
    tokens_balance: number;
    created_at: string;
    updated_at: string;
}

interface ListUsersResponse {
    users: UserListItem[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
}

const VALID_ROLES = ['user', 'admin', 'client', 'prestataire'];

const UserRoleManagementScreen: React.FC = () => {
    const navigation = useNavigation();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [newRole, setNewRole] = useState<string>('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
        if (!user || !isAdminUser(user)) {
            Alert.alert('Accès refusé', 'Cette page est réservée aux administrateurs', [
                { text: 'OK', onPress: () => navigation.goBack() },
            ]);
            return;
        }
        loadUsers();
    }, [user, currentPage, roleFilter, searchQuery]);

    const loadUsers = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('page', currentPage.toString());
            params.append('limit', '20');
            if (roleFilter !== 'all') {
                params.append('role', roleFilter);
            }
            if (searchQuery.trim()) {
                params.append('search', searchQuery.trim());
            }

            const response = await apiGet<ListUsersResponse>(`/api/admin/users?${params.toString()}`);
            const data = response.data || response as any;

            if (data.users) {
                setUsers(data.users);
                setTotalPages(data.total_pages || 1);
            } else {
                setUsers([]);
            }
        } catch (error: any) {
            console.error('[UserRoleManagementScreen] Erreur chargement utilisateurs:', error);
            Alert.alert('Erreur', error.message || 'Impossible de charger les utilisateurs');
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateRole = async () => {
        if (!selectedUser || !newRole) {
            return;
        }

        try {
            setUpdating(true);
            const response = await apiPatch(`/api/admin/users/${selectedUser.id}/role`, {
                role: newRole,
            });

            if (response.success !== false) {
                Alert.alert('✅ Succès', `Rôle mis à jour avec succès : ${newRole}`, [
                    {
                        text: 'OK',
                        onPress: () => {
                            setShowRoleModal(false);
                            setSelectedUser(null);
                            setNewRole('');
                            loadUsers();
                        },
                    },
                ]);
            } else {
                throw new Error(response.message || 'Erreur lors de la mise à jour du rôle');
            }
        } catch (error: any) {
            console.error('[UserRoleManagementScreen] Erreur mise à jour rôle:', error);
            Alert.alert('Erreur', error.message || 'Impossible de mettre à jour le rôle');
        } finally {
            setUpdating(false);
        }
    };

    const openRoleModal = (userItem: UserListItem) => {
        setSelectedUser(userItem);
        setNewRole(userItem.role);
        setShowRoleModal(true);
    };

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            user: '👤 Utilisateur',
            admin: '👑 Administrateur',
            client: '🛒 Client',
            prestataire: '🏪 Prestataire',
        };
        return labels[role] || role;
    };

    const getRoleColor = (role: string) => {
        const colors: Record<string, string> = {
            user: modernColors.textSecondary,
            admin: '#DC2626',
            client: '#059669',
            prestataire: '#7C3AED',
        };
        return colors[role] || modernColors.textSecondary;
    };

    const renderUserItem = ({ item }: { item: UserListItem }) => (
        <NativeCard style={styles.userCard}>
            <View style={styles.userCardHeader}>
                <View style={styles.userInfo}>
                    <Text style={styles.userEmail}>{item.email}</Text>
                    {item.nom_complet && (
                        <Text style={styles.userName}>{item.nom_complet}</Text>
                    )}
                </View>
                <TouchableOpacity
                    style={[styles.roleBadge, { backgroundColor: getRoleColor(item.role) + '20' }]}
                    onPress={() => openRoleModal(item)}
                >
                    <Text style={[styles.roleText, { color: getRoleColor(item.role) }]}>
                        {getRoleLabel(item.role)}
                    </Text>
                    <SafeIcon name="edit" size={14} color={getRoleColor(item.role)} />
                </TouchableOpacity>
            </View>

            <View style={styles.userCardBody}>
                <View style={styles.userStat}>
                    <Text style={styles.userStatLabel}>Tokens</Text>
                    <Text style={styles.userStatValue}>{item.tokens_balance.toLocaleString()}</Text>
                </View>
                {item.is_provider && (
                    <View style={styles.userStat}>
                        <Text style={styles.userStatLabel}>Prestataire</Text>
                        <SafeIcon name="check-circle" size={16} color={modernColors.success} />
                    </View>
                )}
                <Text style={styles.userDate}>
                    Créé le {new Date(item.created_at).toLocaleDateString('fr-FR')}
                </Text>
            </View>
        </NativeCard>
    );

    // ✅ CORRECTION 2026-02-06: Vérifier admin OU super_admin
    if (!user || !isAdminUser(user)) {
        return null;
    }

    return (
        <SafeNativeView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => navigation.goBack()}
                >
                    <SafeIcon name="arrow-left" size={24} color={modernColors.text} />
                </TouchableOpacity>
                <Text style={styles.title}>Gestion des rôles</Text>
            </View>

            {/* Recherche */}
            <View style={styles.searchContainer}>
                <View style={styles.searchInputContainer}>
                    <SafeIcon name="search" size={20} color={modernColors.textSecondary} />
                    <TextInput
                        style={styles.searchInput}
                        placeholder="Rechercher par email ou nom..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        placeholderTextColor={modernColors.textSecondary}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <SafeIcon name="x" size={20} color={modernColors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* Filtres par rôle */}
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersContainer}
                contentContainerStyle={styles.filtersContent}
            >
                {(['all', ...VALID_ROLES] as const).map((role) => (
                    <TouchableOpacity
                        key={role}
                        style={[
                            styles.filterButton,
                            roleFilter === role && styles.filterButtonActive,
                        ]}
                        onPress={() => {
                            setRoleFilter(role);
                            setCurrentPage(1);
                        }}
                    >
                        <Text
                            style={[
                                styles.filterText,
                                roleFilter === role && styles.filterTextActive,
                            ]}
                        >
                            {role === 'all' ? 'Tous' : getRoleLabel(role)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Liste des utilisateurs */}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={modernColors.primary} />
                    <Text style={styles.loadingText}>Chargement...</Text>
                </View>
            ) : users.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <SafeIcon name="users" size={64} color={modernColors.textSecondary} />
                    <Text style={styles.emptyText}>Aucun utilisateur trouvé</Text>
                </View>
            ) : (
                <>
                    <FlatList
                        data={users}
                        renderItem={renderUserItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.listContent}
                        refreshing={loading}
                        onRefresh={loadUsers}
                    />

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <View style={styles.pagination}>
                            <TouchableOpacity
                                style={[styles.pageButton, currentPage === 1 && styles.pageButtonDisabled]}
                                onPress={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                disabled={currentPage === 1}
                            >
                                <SafeIcon name="chevron-left" size={20} color={modernColors.text} />
                            </TouchableOpacity>
                            <Text style={styles.pageInfo}>
                                Page {currentPage} / {totalPages}
                            </Text>
                            <TouchableOpacity
                                style={[styles.pageButton, currentPage >= totalPages && styles.pageButtonDisabled]}
                                onPress={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                disabled={currentPage >= totalPages}
                            >
                                <SafeIcon name="chevron-right" size={20} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}

            {/* Modal de modification de rôle */}
            <Modal
                visible={showRoleModal}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowRoleModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Modifier le rôle</Text>
                            <TouchableOpacity
                                onPress={() => setShowRoleModal(false)}
                                style={styles.closeButton}
                            >
                                <SafeIcon name="x" size={24} color={modernColors.text} />
                            </TouchableOpacity>
                        </View>

                        {selectedUser && (
                            <ScrollView style={styles.modalBody}>
                                <View style={styles.modalUserInfo}>
                                    <Text style={styles.modalUserEmail}>{selectedUser.email}</Text>
                                    {selectedUser.nom_complet && (
                                        <Text style={styles.modalUserName}>{selectedUser.nom_complet}</Text>
                                    )}
                                    <Text style={styles.modalCurrentRole}>
                                        Rôle actuel : {getRoleLabel(selectedUser.role)}
                                    </Text>
                                </View>

                                <View style={styles.roleSelection}>
                                    {VALID_ROLES.map((role) => (
                                        <TouchableOpacity
                                            key={role}
                                            style={[
                                                styles.roleOption,
                                                newRole === role && styles.roleOptionSelected,
                                            ]}
                                            onPress={() => setNewRole(role)}
                                        >
                                            <Text
                                                style={[
                                                    styles.roleOptionText,
                                                    newRole === role && styles.roleOptionTextSelected,
                                                ]}
                                            >
                                                {getRoleLabel(role)}
                                            </Text>
                                            {newRole === role && (
                                                <SafeIcon name="check" size={20} color={modernColors.primary} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </View>

                                <NativeButton
                                    title={updating ? 'Mise à jour...' : 'Confirmer'}
                                    onPress={handleUpdateRole}
                                    disabled={updating || newRole === selectedUser.role}
                                    style={styles.updateButton}
                                />
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>
        </SafeNativeView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: modernColors.background,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    backButton: {
        marginRight: 16,
    },
    title: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    searchContainer: {
        padding: 16,
        backgroundColor: modernColors.surface,
    },
    searchInputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: modernColors.background,
        borderRadius: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: modernColors.border,
    },
    searchInput: {
        flex: 1,
        marginLeft: 12,
        fontSize: 16,
        color: modernColors.text,
    },
    filtersContainer: {
        maxHeight: 60,
        backgroundColor: modernColors.surface,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    filtersContent: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        gap: 8,
    },
    filterButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: modernColors.background,
        borderWidth: 1,
        borderColor: modernColors.border,
        marginRight: 8,
    },
    filterButtonActive: {
        backgroundColor: modernColors.primary,
        borderColor: modernColors.primary,
    },
    filterText: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    filterTextActive: {
        color: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        marginTop: 16,
        fontSize: 16,
        color: modernColors.textSecondary,
    },
    listContent: {
        padding: 16,
    },
    userCard: {
        marginBottom: 12,
        padding: 16,
    },
    userCardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12,
    },
    userInfo: {
        flex: 1,
    },
    userEmail: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    userName: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    roleBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        gap: 6,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '600',
    },
    userCardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 16,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
    },
    userStat: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    userStatLabel: {
        fontSize: 12,
        color: modernColors.textSecondary,
    },
    userStatValue: {
        fontSize: 12,
        fontWeight: '600',
        color: modernColors.text,
    },
    userDate: {
        fontSize: 12,
        color: modernColors.textSecondary,
        marginLeft: 'auto',
    },
    pagination: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
        backgroundColor: modernColors.surface,
        borderTopWidth: 1,
        borderTopColor: modernColors.border,
        gap: 16,
    },
    pageButton: {
        padding: 8,
    },
    pageButtonDisabled: {
        opacity: 0.3,
    },
    pageInfo: {
        fontSize: 14,
        fontWeight: '600',
        color: modernColors.text,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: modernColors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: modernColors.border,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: modernColors.text,
    },
    closeButton: {
        padding: 4,
    },
    modalBody: {
        padding: 16,
    },
    modalUserInfo: {
        marginBottom: 24,
    },
    modalUserEmail: {
        fontSize: 18,
        fontWeight: '600',
        color: modernColors.text,
        marginBottom: 4,
    },
    modalUserName: {
        fontSize: 14,
        color: modernColors.textSecondary,
        marginBottom: 8,
    },
    modalCurrentRole: {
        fontSize: 14,
        color: modernColors.textSecondary,
    },
    roleSelection: {
        gap: 12,
        marginBottom: 24,
    },
    roleOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: modernColors.border,
        backgroundColor: modernColors.background,
    },
    roleOptionSelected: {
        borderColor: modernColors.primary,
        backgroundColor: modernColors.primary + '10',
    },
    roleOptionText: {
        fontSize: 16,
        fontWeight: '600',
        color: modernColors.text,
    },
    roleOptionTextSelected: {
        color: modernColors.primary,
    },
    updateButton: {
        marginTop: 8,
    },
});

export default UserRoleManagementScreen;





