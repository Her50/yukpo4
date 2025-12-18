// Composant de gestion d'équipe pour les services
import { LinearGradient } from 'expo-linear-gradient';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Image,
    Modal,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { apiDelete, apiGet, apiPatch, apiPost } from '../services/api';
import { modernColors } from '../theme/modernTheme';
import {
    ROLE_PERMISSIONS,
    SERVICE_PERMISSIONS,
    SERVICE_TEAM_ROLES,
    ServiceTeamMember,
    ServiceTeamRole
} from '../types/serviceTeam';
import { NativeButton, NativeCard } from './SafeNativeDesign';
import SafeIcon from './SafeIcon';
import UserMentionPicker from './UserMentionPicker';

interface ServiceTeamManagerProps {
    serviceId?: string; // Si null, gestion globale
    onClose: () => void;
    onMemberAdded?: (member: ServiceTeamMember) => void;
    onMemberRemoved?: (memberId: string) => void;
}

const ServiceTeamManager: React.FC<ServiceTeamManagerProps> = ({
    serviceId,
    onClose,
    onMemberAdded,
    onMemberRemoved
}) => {
    const { user } = useAuth();
    const [members, setMembers] = useState<ServiceTeamMember[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [showRoleModal, setShowRoleModal] = useState(false);
    const [selectedRole, setSelectedRole] = useState<ServiceTeamRole | null>(null);
    const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<ServiceTeamRole | null>(null);
    const [showUserPicker, setShowUserPicker] = useState(false);

    useEffect(() => {
        loadTeamData();
    }, [serviceId]);

    // ✅ FONCTION DE MAPPING: Transformer les données backend (snake_case) vers frontend (camelCase)
    const mapBackendMemberToFrontend = (backendMember: any): ServiceTeamMember | null => {
        if (!backendMember || !backendMember.id) {
            return null;
        }

        // ✅ CORRECTION CRITIQUE: Mapper les champs snake_case vers camelCase
        const roleId = backendMember.role?.id || backendMember.role_id || 'viewer';

        // ✅ CORRECTION: Calculer les permissions depuis le rôle (le backend ne les retourne pas)
        const rolePermissions = ROLE_PERMISSIONS && typeof ROLE_PERMISSIONS === 'object'
            ? (ROLE_PERMISSIONS[roleId] || [])
            : [];
        const permissions = Array.isArray(SERVICE_PERMISSIONS) && Array.isArray(rolePermissions)
            ? SERVICE_PERMISSIONS.filter(p => p && p.id && rolePermissions.includes(p.id))
            : [];

        // ✅ CORRECTION: Mapper le rôle
        const role: ServiceTeamRole = backendMember.role && typeof backendMember.role === 'object'
            ? {
                id: backendMember.role.id || roleId,
                name: backendMember.role.name || 'Rôle inconnu',
                description: backendMember.role.description || '',
                level: typeof backendMember.role.level === 'number' ? backendMember.role.level : 4,
                color: backendMember.role.color || '#6B7280',
                icon: backendMember.role.icon || 'user'
            }
            : {
                id: roleId,
                name: 'Observateur',
                description: 'Consultation des services',
                level: 4,
                color: '#6B7280',
                icon: 'eye'
            };

        return {
            id: String(backendMember.id),
            userId: String(backendMember.user_id || backendMember.userId || ''),
            userName: backendMember.username || backendMember.userName || 'Utilisateur inconnu',
            userEmail: backendMember.email || backendMember.userEmail || '',
            userAvatar: backendMember.avatar_url || backendMember.userAvatar || undefined,
            role: role,
            permissions: permissions, // ✅ CORRECTION: Permissions calculées depuis le rôle
            serviceId: backendMember.service_id ? String(backendMember.service_id) : (backendMember.serviceId ? String(backendMember.serviceId) : undefined),
            addedAt: backendMember.added_at || backendMember.addedAt || new Date().toISOString(),
            addedBy: String(backendMember.added_by_username || backendMember.added_by || backendMember.addedBy || ''),
            isActive: backendMember.is_active !== undefined ? Boolean(backendMember.is_active) : (backendMember.isActive !== undefined ? Boolean(backendMember.isActive) : true)
        };
    };

    const loadTeamData = async () => {
        try {
            setLoading(true);
            const endpoint = serviceId
                ? `/api/services/${serviceId}/team`
                : '/api/user/services/team';

            const response = await apiGet(endpoint);
            if (response.success) {
                // ✅ CORRECTION: Vérifier que data existe et est un objet
                const data = response.data || {};

                // ✅ PROTECTION: S'assurer que members et invitations sont des tableaux valides
                const membersData = (data && typeof data === 'object')
                    ? ((data as any).members || (data as any).members_list || [])
                    : [];
                const invitationsData = (data && typeof data === 'object')
                    ? ((data as any).invitations || (data as any).invitations_list || [])
                    : [];

                // ✅ CORRECTION CRITIQUE: Mapper les membres du backend vers le format frontend
                const mappedMembers = Array.isArray(membersData)
                    ? membersData
                        .map(mapBackendMemberToFrontend)
                        .filter((m): m is ServiceTeamMember => m !== null)
                    : [];

                // ✅ CORRECTION: Mapper les invitations aussi
                const mappedInvitations = Array.isArray(invitationsData)
                    ? invitationsData
                        .map((inv: any) => {
                            if (!inv || !inv.id) return null;
                            return {
                                ...inv,
                                id: String(inv.id),
                                email: inv.email || '',
                                role: inv.role && typeof inv.role === 'object' ? inv.role : {
                                    id: inv.role_id || 'viewer',
                                    name: inv.role?.name || 'Rôle inconnu',
                                    description: inv.role?.description || '',
                                    level: inv.role?.level || 4,
                                    color: inv.role?.color || '#6B7280',
                                    icon: inv.role?.icon || 'user'
                                },
                                invitedAt: inv.invited_at || inv.invitedAt || new Date().toISOString()
                            };
                        })
                        .filter((i: any) => i !== null)
                    : [];

                setMembers(mappedMembers);
                setInvitations(mappedInvitations);
            } else {
                // Si l'API retourne une erreur, initialiser avec des tableaux vides
                setMembers([]);
                setInvitations([]);
            }
        } catch (error) {
            console.error('Erreur chargement équipe:', error);
            // ✅ PROTECTION: En cas d'erreur, initialiser avec des tableaux vides
            setMembers([]);
            setInvitations([]);
            Alert.alert('Erreur', 'Impossible de charger les données de l\'équipe');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteUser = async () => {
        if (!inviteEmail || !inviteRole) {
            Alert.alert('Erreur', 'Veuillez remplir tous les champs');
            return;
        }

        try {
            // ✅ CORRECTION: Vérifier que ROLE_PERMISSIONS existe et contient les permissions du rôle
            const rolePerms = (ROLE_PERMISSIONS && typeof ROLE_PERMISSIONS === 'object' && inviteRole?.id)
                ? (ROLE_PERMISSIONS[inviteRole.id] || [])
                : [];

            const response = await apiPost('/api/services/team/invite', {
                serviceId,
                email: inviteEmail,
                role: inviteRole.id,
                permissions: Array.isArray(rolePerms) ? rolePerms : []
            });

            if (response.success) {
                Alert.alert('Succès', 'Invitation envoyée avec succès');
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteRole(null);
                loadTeamData();
            } else {
                Alert.alert('Erreur', response.message || 'Erreur lors de l\'invitation');
            }
        } catch (error) {
            console.error('Erreur invitation:', error);
            Alert.alert('Erreur', 'Impossible d\'envoyer l\'invitation');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        Alert.alert(
            'Confirmer la suppression',
            'Êtes-vous sûr de vouloir retirer ce membre de l\'équipe ?',
            [
                { text: 'Annuler', style: 'cancel' },
                {
                    text: 'Supprimer',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await apiDelete(`/api/services/team/members/${memberId}`);
                            if (response.success) {
                                setMembers(members.filter(m => m.id !== memberId));
                                onMemberRemoved?.(memberId);
                                Alert.alert('Succès', 'Membre retiré de l\'équipe');
                            }
                        } catch (error) {
                            console.error('Erreur suppression membre:', error);
                            Alert.alert('Erreur', 'Impossible de retirer le membre');
                        }
                    }
                }
            ]
        );
    };

    const handleUpdateRole = async (memberId: string, newRole: ServiceTeamRole) => {
        try {
            // ✅ CORRECTION: Vérifier que ROLE_PERMISSIONS existe et contient les permissions du rôle
            const rolePerms = (ROLE_PERMISSIONS && typeof ROLE_PERMISSIONS === 'object' && newRole?.id)
                ? (ROLE_PERMISSIONS[newRole.id] || [])
                : [];

            const response = await apiPatch(`/api/services/team/members/${memberId}`, {
                role: newRole.id,
                permissions: Array.isArray(rolePerms) ? rolePerms : []
            });

            if (response.success) {
                // ✅ PROTECTION CRITIQUE: Vérifier que members est un tableau avant map()
                if (!Array.isArray(members)) {
                    console.error('[ServiceTeamManager] members n\'est pas un tableau:', members);
                    Alert.alert('Erreur', 'Impossible de mettre à jour le rôle : données invalides');
                    return;
                }

                // ✅ CORRECTION: Calculer les permissions valides depuis rolePerms déjà déclaré
                const validPerms = Array.isArray(SERVICE_PERMISSIONS) && Array.isArray(rolePerms)
                    ? SERVICE_PERMISSIONS.filter(p => p && p.id && rolePerms.includes(p.id))
                    : [];

                setMembers(members.map(m => {
                    if (!m || !m.id) return m; // ✅ PROTECTION: Ignorer les membres invalides
                    return m.id === memberId
                        ? { ...m, role: newRole, permissions: validPerms }
                        : m;
                }));
                Alert.alert('Succès', 'Rôle mis à jour avec succès');
            }
        } catch (error) {
            console.error('Erreur mise à jour rôle:', error);
            Alert.alert('Erreur', 'Impossible de mettre à jour le rôle');
        }
    };

    const renderMember = ({ item }: { item: ServiceTeamMember }) => {
        // ✅ PROTECTION: Vérifier que item existe et a les propriétés nécessaires
        if (!item || !item.id) {
            return null;
        }

        // ✅ CORRECTION CRITIQUE: S'assurer que SERVICE_TEAM_ROLES existe avant d'y accéder
        const defaultRole = (Array.isArray(SERVICE_TEAM_ROLES) && SERVICE_TEAM_ROLES.length > 3)
            ? SERVICE_TEAM_ROLES[3]
            : (Array.isArray(SERVICE_TEAM_ROLES) && SERVICE_TEAM_ROLES.length > 0
                ? SERVICE_TEAM_ROLES[SERVICE_TEAM_ROLES.length - 1]
                : null);
        const role = item.role || defaultRole || {
            id: 'viewer',
            name: 'Observateur',
            description: 'Consultation des services',
            level: 4,
            color: '#6B7280',
            icon: 'eye'
        };
        // ✅ CORRECTION: S'assurer que permissions est toujours un tableau valide
        const permissions = Array.isArray(item.permissions) ? item.permissions : [];

        return (
            <NativeCard style={styles.memberCard}>
                <View style={styles.memberHeader}>
                    <View style={styles.memberInfo}>
                        <Image
                            source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }}
                            style={styles.memberAvatar}
                        />
                        <View style={styles.memberDetails}>
                            <Text style={styles.memberName}>{item.userName || 'Utilisateur inconnu'}</Text>
                            <Text style={styles.memberEmail}>{item.userEmail || 'Email inconnu'}</Text>
                        </View>
                    </View>
                    <View style={styles.memberActions}>
                        <TouchableOpacity
                            style={[styles.roleBadge, { backgroundColor: (role.color || '#6B7280') + '20' }]}
                            onPress={() => {
                                setSelectedRole(role);
                                setSelectedMemberId(item.id);
                                setShowRoleModal(true);
                            }}
                        >
                            <SafeIcon name={role.icon || 'user'} size={16} color={role.color || '#6B7280'} />
                            <Text style={[styles.roleText, { color: role.color || '#6B7280' }]}>
                                {role.name || 'Rôle inconnu'}
                            </Text>
                        </TouchableOpacity>
                        {String(item.userId) !== String(user?.id || '') && (
                            <TouchableOpacity
                                style={styles.removeButton}
                                onPress={() => handleRemoveMember(item.id)}
                            >
                                <SafeIcon name="trash" size={16} color="#DC2626" />
                            </TouchableOpacity>
                        )}
                    </View>
                </View>

                {(() => {
                    // ✅ CORRECTION CRITIQUE: Vérifier que permissions existe et est un tableau
                    if (!permissions || !Array.isArray(permissions) || permissions.length === 0) {
                        return null;
                    }

                    // ✅ CORRECTION: Gérer les deux cas - permissions comme objets ou comme IDs
                    const validPermissions = permissions.slice(0, 3).filter(p => {
                        if (!p) return false;
                        // Si c'est un objet avec id, vérifier qu'il a id et name
                        if (typeof p === 'object' && p.id) {
                            return true;
                        }
                        // Si c'est une string (ID), chercher dans SERVICE_PERMISSIONS
                        if (typeof p === 'string') {
                            return SERVICE_PERMISSIONS && Array.isArray(SERVICE_PERMISSIONS) && SERVICE_PERMISSIONS.some(sp => sp.id === p);
                        }
                        return false;
                    });

                    if (!validPermissions || validPermissions.length === 0) {
                        return null;
                    }

                    return (
                        <View style={styles.permissionsContainer}>
                            <Text style={styles.permissionsTitle}>Permissions :</Text>
                            <View style={styles.permissionsList}>
                                {validPermissions.map((permission, idx) => {
                                    // ✅ CORRECTION: Gérer les deux formats (objet ou ID string)
                                    let permissionObj: any = null;
                                    if (typeof permission === 'object' && permission.id) {
                                        permissionObj = permission;
                                    } else if (typeof permission === 'string' && SERVICE_PERMISSIONS && Array.isArray(SERVICE_PERMISSIONS)) {
                                        permissionObj = SERVICE_PERMISSIONS.find(sp => sp.id === permission);
                                    }

                                    const permissionName = permissionObj?.name || (typeof permission === 'string' ? permission : 'Permission');
                                    const permissionId = permissionObj?.id || (typeof permission === 'string' ? permission : `perm-${idx}`);

                                    return (
                                        <View key={permissionId} style={styles.permissionTag}>
                                            <Text style={styles.permissionText}>{permissionName}</Text>
                                        </View>
                                    );
                                })}
                                {permissions.length > 3 && (
                                    <Text style={styles.morePermissions}>
                                        +{permissions.length - 3} autres
                                    </Text>
                                )}
                            </View>
                        </View>
                    );
                })()}
            </NativeCard>
        );
    };

    const renderRoleModal = () => (
        <Modal
            visible={showRoleModal}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <LinearGradient colors={(Array.isArray(modernColors.primaryGradient) && modernColors.primaryGradient.length >= 2) ? modernColors.primaryGradient as [string, string, ...string[]] : ['#6366F1', '#8B5CF6'] as [string, string]} style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Changer le rôle</Text>
                    <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                    {(() => {
                        // ✅ CORRECTION CRITIQUE: Vérifier que SERVICE_TEAM_ROLES existe et est un tableau
                        if (!SERVICE_TEAM_ROLES || !Array.isArray(SERVICE_TEAM_ROLES) || SERVICE_TEAM_ROLES.length === 0) {
                            return (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyStateText}>Aucun rôle disponible</Text>
                                </View>
                            );
                        }

                        // ✅ PROTECTION: Filtrer les rôles invalides avant de mapper
                        const validRoles = SERVICE_TEAM_ROLES.filter(r => r && r.id && r.name);
                        if (validRoles.length === 0) {
                            return (
                                <View style={styles.emptyState}>
                                    <Text style={styles.emptyStateText}>Aucun rôle valide disponible</Text>
                                </View>
                            );
                        }

                        return validRoles.map(role => (
                            <TouchableOpacity
                                key={role.id || `role-${role.name || 'unknown'}`}
                                style={[
                                    styles.roleOption,
                                    selectedRole?.id === role?.id && styles.roleOptionSelected
                                ]}
                                onPress={() => setSelectedRole(role)}
                            >
                                <View style={styles.roleOptionHeader}>
                                    <SafeIcon name={role?.icon || 'user'} size={20} color={role?.color || '#6B7280'} />
                                    <Text style={styles.roleOptionName}>{role?.name || 'Rôle inconnu'}</Text>
                                </View>
                                <Text style={styles.roleOptionDescription}>{role?.description || 'Aucune description'}</Text>
                            </TouchableOpacity>
                        ));
                    })()}

                    <NativeButton
                        title="Confirmer"
                        onPress={() => {
                            if (selectedRole && selectedMemberId) {
                                handleUpdateRole(selectedMemberId, selectedRole);
                                setShowRoleModal(false);
                                setSelectedMemberId(null);
                            }
                        }}
                        variant="primary"
                        style={styles.confirmButton}
                    />
                </ScrollView>
            </LinearGradient>
        </Modal>
    );

    const renderInviteModal = () => (
        <Modal
            visible={showInviteModal}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <LinearGradient colors={(Array.isArray(modernColors.primaryGradient) && modernColors.primaryGradient.length >= 2) ? modernColors.primaryGradient as [string, string, ...string[]] : ['#6366F1', '#8B5CF6'] as [string, string]} style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Inviter un membre</Text>
                    <TouchableOpacity onPress={() => setShowInviteModal(false)}>
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Email ou nom d'utilisateur</Text>
                        <TextInput
                            style={styles.textInput}
                            value={inviteEmail}
                            onChangeText={setInviteEmail}
                            placeholder="exemple@email.com ou @username"
                            keyboardType="email-address"
                            autoCapitalize="none"
                        />
                        <TouchableOpacity
                            style={styles.userPickerButton}
                            onPress={() => setShowUserPicker(true)}
                        >
                            <SafeIcon name="users" size={16} color="#6366F1" />
                            <Text style={styles.userPickerText}>Choisir dans la communauté</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.inputGroup}>
                        <Text style={styles.inputLabel}>Rôle</Text>
                        {(() => {
                            // ✅ CORRECTION CRITIQUE: Vérifier que SERVICE_TEAM_ROLES existe et est un tableau
                            if (!SERVICE_TEAM_ROLES || !Array.isArray(SERVICE_TEAM_ROLES) || SERVICE_TEAM_ROLES.length === 0) {
                                return (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyStateText}>Aucun rôle disponible</Text>
                                    </View>
                                );
                            }

                            // ✅ PROTECTION: Filtrer les rôles invalides avant de mapper
                            const validRoles = SERVICE_TEAM_ROLES.filter(r => r && r.id && r.name);
                            if (validRoles.length === 0) {
                                return (
                                    <View style={styles.emptyState}>
                                        <Text style={styles.emptyStateText}>Aucun rôle valide disponible</Text>
                                    </View>
                                );
                            }

                            return validRoles.map(role => (
                                <TouchableOpacity
                                    key={role.id || `role-${role.name || 'unknown'}`}
                                    style={[
                                        styles.roleOption,
                                        inviteRole?.id === role?.id && styles.roleOptionSelected
                                    ]}
                                    onPress={() => setInviteRole(role)}
                                >
                                    <View style={styles.roleOptionHeader}>
                                        <SafeIcon name={role?.icon || 'user'} size={20} color={role?.color || '#6B7280'} />
                                        <Text style={styles.roleOptionName}>{role?.name || 'Rôle inconnu'}</Text>
                                    </View>
                                    <Text style={styles.roleOptionDescription}>{role?.description || 'Aucune description'}</Text>
                                </TouchableOpacity>
                            ));
                        })()}
                    </View>

                    <NativeButton
                        title="Envoyer l'invitation"
                        onPress={handleInviteUser}
                        variant="primary"
                        style={styles.confirmButton}
                    />
                </ScrollView>
            </LinearGradient>
        </Modal>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#6366F1" />
                <Text style={styles.loadingText}>Chargement de l'équipe...</Text>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <LinearGradient colors={(Array.isArray(modernColors.primaryGradient) && modernColors.primaryGradient.length >= 2) ? modernColors.primaryGradient as [string, string, ...string[]] : ['#6366F1', '#8B5CF6'] as [string, string]} style={styles.header}>
                <View style={styles.headerContent}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <SafeIcon name="arrow-left" size={24} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {serviceId ? 'Équipe du service' : 'Mon équipe'}
                    </Text>
                    <TouchableOpacity
                        style={styles.inviteButton}
                        onPress={() => setShowInviteModal(true)}
                    >
                        <SafeIcon name="user-plus" size={20} color="#fff" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            <ScrollView style={styles.content}>
                <View style={styles.statsContainer}>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statNumber}>{Array.isArray(members) ? members.length : 0}</Text>
                        <Text style={styles.statLabel}>Membres actifs</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statNumber}>{Array.isArray(invitations) ? invitations.length : 0}</Text>
                        <Text style={styles.statLabel}>Invitations en attente</Text>
                    </NativeCard>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Membres de l'équipe</Text>
                    {members && Array.isArray(members) && members.length > 0 ? (
                        <FlatList
                            data={members.filter(m => m && m.id)} // ✅ PROTECTION: Filtrer les membres invalides
                            renderItem={renderMember}
                            keyExtractor={(item, index) => item?.id || `member-${item?.userId || index}`}
                            scrollEnabled={false}
                            showsVerticalScrollIndicator={false}
                        />
                    ) : (
                        <View style={styles.emptyState}>
                            <Text style={styles.emptyStateText}>Aucun membre dans l'équipe</Text>
                        </View>
                    )}
                </View>

                {invitations && Array.isArray(invitations) && invitations.length > 0 && (() => {
                    // ✅ CORRECTION: S'assurer que le filter retourne toujours un tableau valide
                    const validInvitations = invitations.filter(inv => inv && inv.id);
                    if (!validInvitations || validInvitations.length === 0) {
                        return null;
                    }
                    return (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>Invitations en attente</Text>
                            {validInvitations.map((invitation, index) => (
                                <NativeCard key={invitation?.id || `invitation-${index}`} style={styles.invitationCard}>
                                    <View style={styles.invitationContent}>
                                        <Text style={styles.invitationEmail}>{invitation?.email || 'Email inconnu'}</Text>
                                        <Text style={styles.invitationRole}>{invitation?.role?.name || 'Rôle inconnu'}</Text>
                                        <Text style={styles.invitationDate}>
                                            {invitation?.invitedAt
                                                ? `Invité le ${new Date(invitation.invitedAt).toLocaleDateString()}`
                                                : 'Date inconnue'}
                                        </Text>
                                    </View>
                                </NativeCard>
                            ))}
                        </View>
                    );
                })()}
            </ScrollView>

            {renderRoleModal()}
            {renderInviteModal()}

            {showUserPicker && (
                <UserMentionPicker
                    visible={showUserPicker}
                    onClose={() => setShowUserPicker(false)}
                    onSelectUser={(user) => {
                        setInviteEmail(user.email || user.nom_complet || '');
                        setShowUserPicker(false);
                    }}
                />
            )}
        </View>
    );
};

const styles = {
    container: {
        flex: 1,
        backgroundColor: '#f8fafc',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center' as const,
        alignItems: 'center' as const,
        backgroundColor: '#f8fafc',
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
        color: '#6B7280',
    },
    header: {
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    headerContent: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
    },
    closeButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: 'bold' as const,
        color: '#fff',
        flex: 1,
        textAlign: 'center' as const,
    },
    inviteButton: {
        padding: 8,
    },
    content: {
        flex: 1,
        padding: 20,
    },
    statsContainer: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        padding: 16,
        alignItems: 'center' as const,
        justifyContent: 'center' as const,
    },
    statNumber: {
        fontSize: 24,
        fontWeight: 'bold' as const,
        color: '#1F2937',
    },
    statLabel: {
        fontSize: 12,
        color: '#6B7280',
        marginTop: 4,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: 'bold' as const,
        color: '#1F2937',
        marginBottom: 12,
    },
    memberCard: {
        marginBottom: 12,
        padding: 16,
    },
    memberHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        marginBottom: 12,
    },
    memberInfo: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        flex: 1,
    },
    memberAvatar: {
        width: 40,
        height: 40,
        borderRadius: 20,
        marginRight: 12,
    },
    memberDetails: {
        flex: 1,
    },
    memberName: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#1F2937',
    },
    memberEmail: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 2,
    },
    memberActions: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        gap: 8,
    },
    roleBadge: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        gap: 4,
    },
    roleText: {
        fontSize: 12,
        fontWeight: '600' as const,
    },
    removeButton: {
        padding: 8,
    },
    permissionsContainer: {
        marginTop: 8,
    },
    permissionsTitle: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: '#374151',
        marginBottom: 8,
    },
    permissionsList: {
        flexDirection: 'row' as const,
        flexWrap: 'wrap' as const,
        gap: 6,
    },
    permissionTag: {
        backgroundColor: '#E5E7EB',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    permissionText: {
        fontSize: 12,
        color: '#374151',
    },
    morePermissions: {
        fontSize: 12,
        color: '#6B7280',
        fontStyle: 'italic' as const,
    },
    invitationCard: {
        marginBottom: 8,
        padding: 12,
    },
    invitationContent: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
    },
    invitationEmail: {
        fontSize: 14,
        fontWeight: '600' as const,
        color: '#1F2937',
    },
    invitationRole: {
        fontSize: 12,
        color: '#6B7280',
    },
    invitationDate: {
        fontSize: 12,
        color: '#9CA3AF',
    },
    modalContainer: {
        flex: 1,
    },
    modalHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        justifyContent: 'space-between' as const,
        paddingTop: 50,
        paddingBottom: 20,
        paddingHorizontal: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: 'bold' as const,
        color: '#fff',
    },
    modalContent: {
        flex: 1,
        backgroundColor: '#fff',
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 20,
    },
    inputGroup: {
        marginBottom: 24,
    },
    inputLabel: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#1F2937',
        marginBottom: 8,
    },
    textInput: {
        borderWidth: 1,
        borderColor: '#D1D5DB',
        borderRadius: 12,
        padding: 12,
        fontSize: 16,
        backgroundColor: '#fff',
    },
    userPickerButton: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginTop: 8,
        padding: 12,
        backgroundColor: '#F3F4F6',
        borderRadius: 12,
        gap: 8,
    },
    userPickerText: {
        fontSize: 14,
        color: '#6366F1',
        fontWeight: '500' as const,
    },
    roleOption: {
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 8,
    },
    roleOptionSelected: {
        borderColor: '#6366F1',
        backgroundColor: '#EEF2FF',
    },
    roleOptionHeader: {
        flexDirection: 'row' as const,
        alignItems: 'center' as const,
        marginBottom: 4,
        gap: 8,
    },
    roleOptionName: {
        fontSize: 16,
        fontWeight: '600' as const,
        color: '#1F2937',
    },
    roleOptionDescription: {
        fontSize: 14,
        color: '#6B7280',
    },
    confirmButton: {
        marginTop: 20,
    },
    emptyState: {
        padding: 20,
        alignItems: 'center' as const,
    },
    emptyStateText: {
        fontSize: 14,
        color: '#6B7280',
        fontStyle: 'italic' as const,
    },
};

export default ServiceTeamManager;
