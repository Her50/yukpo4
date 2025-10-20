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
import { NativeButton, NativeCard } from './NativeDesign';
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
    const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<ServiceTeamRole | null>(null);
    const [showUserPicker, setShowUserPicker] = useState(false);

    useEffect(() => {
        loadTeamData();
    }, [serviceId]);

    const loadTeamData = async () => {
        try {
            setLoading(true);
            const endpoint = serviceId
                ? `/api/services/${serviceId}/team`
                : '/api/user/services/team';

            const response = await apiGet(endpoint);
            if (response.success) {
                setMembers(response.data.members || []);
                setInvitations(response.data.invitations || []);
            }
        } catch (error) {
            console.error('Erreur chargement équipe:', error);
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
            const response = await apiPost('/api/services/team/invite', {
                serviceId,
                email: inviteEmail,
                role: inviteRole.id,
                permissions: ROLE_PERMISSIONS[inviteRole.id]
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
            const response = await apiPatch(`/api/services/team/members/${memberId}`, {
                role: newRole.id,
                permissions: ROLE_PERMISSIONS[newRole.id]
            });

            if (response.success) {
                setMembers(members.map(m =>
                    m.id === memberId
                        ? { ...m, role: newRole, permissions: SERVICE_PERMISSIONS.filter(p => ROLE_PERMISSIONS[newRole.id].includes(p.id)) }
                        : m
                ));
                Alert.alert('Succès', 'Rôle mis à jour avec succès');
            }
        } catch (error) {
            console.error('Erreur mise à jour rôle:', error);
            Alert.alert('Erreur', 'Impossible de mettre à jour le rôle');
        }
    };

    const renderMember = ({ item }: { item: ServiceTeamMember }) => (
        <NativeCard style={styles.memberCard}>
            <View style={styles.memberHeader}>
                <View style={styles.memberInfo}>
                    <Image
                        source={{ uri: item.userAvatar || 'https://via.placeholder.com/40' }}
                        style={styles.memberAvatar}
                    />
                    <View style={styles.memberDetails}>
                        <Text style={styles.memberName}>{item.userName}</Text>
                        <Text style={styles.memberEmail}>{item.userEmail}</Text>
                    </View>
                </View>
                <View style={styles.memberActions}>
                    <TouchableOpacity
                        style={[styles.roleBadge, { backgroundColor: item.role.color + '20' }]}
                        onPress={() => {
                            setSelectedRole(item.role);
                            setShowRoleModal(true);
                        }}
                    >
                        <SafeIcon name={item.role.icon} size={16} color={item.role.color} />
                        <Text style={[styles.roleText, { color: item.role.color }]}>
                            {item.role.name}
                        </Text>
                    </TouchableOpacity>
                    {item.userId !== user?.id && (
                        <TouchableOpacity
                            style={styles.removeButton}
                            onPress={() => handleRemoveMember(item.id)}
                        >
                            <SafeIcon name="trash" size={16} color="#DC2626" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={styles.permissionsContainer}>
                <Text style={styles.permissionsTitle}>Permissions :</Text>
                <View style={styles.permissionsList}>
                    {item.permissions.slice(0, 3).map(permission => (
                        <View key={permission.id} style={styles.permissionTag}>
                            <Text style={styles.permissionText}>{permission.name}</Text>
                        </View>
                    ))}
                    {item.permissions.length > 3 && (
                        <Text style={styles.morePermissions}>
                            +{item.permissions.length - 3} autres
                        </Text>
                    )}
                </View>
            </View>
        </NativeCard>
    );

    const renderRoleModal = () => (
        <Modal
            visible={showRoleModal}
            animationType="slide"
            presentationStyle="pageSheet"
        >
            <LinearGradient colors={modernColors.primaryGradient.colors} style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Changer le rôle</Text>
                    <TouchableOpacity onPress={() => setShowRoleModal(false)}>
                        <SafeIcon name="x" size={24} color="#fff" />
                    </TouchableOpacity>
                </View>

                <ScrollView style={styles.modalContent}>
                    {SERVICE_TEAM_ROLES.map(role => (
                        <TouchableOpacity
                            key={role.id}
                            style={[
                                styles.roleOption,
                                selectedRole?.id === role.id && styles.roleOptionSelected
                            ]}
                            onPress={() => setSelectedRole(role)}
                        >
                            <View style={styles.roleOptionHeader}>
                                <SafeIcon name={role.icon} size={20} color={role.color} />
                                <Text style={styles.roleOptionName}>{role.name}</Text>
                            </View>
                            <Text style={styles.roleOptionDescription}>{role.description}</Text>
                        </TouchableOpacity>
                    ))}

                    <NativeButton
                        title="Confirmer"
                        onPress={() => {
                            if (selectedRole) {
                                // Logique de mise à jour du rôle
                                setShowRoleModal(false);
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
            <LinearGradient colors={modernColors.primaryGradient.colors} style={styles.modalContainer}>
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
                        {SERVICE_TEAM_ROLES.map(role => (
                            <TouchableOpacity
                                key={role.id}
                                style={[
                                    styles.roleOption,
                                    inviteRole?.id === role.id && styles.roleOptionSelected
                                ]}
                                onPress={() => setInviteRole(role)}
                            >
                                <View style={styles.roleOptionHeader}>
                                    <SafeIcon name={role.icon} size={20} color={role.color} />
                                    <Text style={styles.roleOptionName}>{role.name}</Text>
                                </View>
                                <Text style={styles.roleOptionDescription}>{role.description}</Text>
                            </TouchableOpacity>
                        ))}
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
            <LinearGradient colors={modernColors.primaryGradient.colors} style={styles.header}>
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
                        <Text style={styles.statNumber}>{members.length}</Text>
                        <Text style={styles.statLabel}>Membres actifs</Text>
                    </NativeCard>
                    <NativeCard style={styles.statCard}>
                        <Text style={styles.statNumber}>{invitations.length}</Text>
                        <Text style={styles.statLabel}>Invitations en attente</Text>
                    </NativeCard>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Membres de l'équipe</Text>
                    <FlatList
                        data={members}
                        renderItem={renderMember}
                        keyExtractor={item => item.id}
                        scrollEnabled={false}
                        showsVerticalScrollIndicator={false}
                    />
                </View>

                {invitations.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Invitations en attente</Text>
                        {invitations.map(invitation => (
                            <NativeCard key={invitation.id} style={styles.invitationCard}>
                                <View style={styles.invitationContent}>
                                    <Text style={styles.invitationEmail}>{invitation.email}</Text>
                                    <Text style={styles.invitationRole}>{invitation.role.name}</Text>
                                    <Text style={styles.invitationDate}>
                                        Invité le {new Date(invitation.invitedAt).toLocaleDateString()}
                                    </Text>
                                </View>
                            </NativeCard>
                        ))}
                    </View>
                )}
            </ScrollView>

            {renderRoleModal()}
            {renderInviteModal()}

            {showUserPicker && (
                <UserMentionPicker
                    visible={showUserPicker}
                    onClose={() => setShowUserPicker(false)}
                    onUserSelect={(user) => {
                        setInviteEmail(user.email || user.username);
                        setShowUserPicker(false);
                    }}
                    mode="invite"
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
        justifyContent: 'center',
        alignItems: 'center',
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
        alignItems: 'center',
        justifyContent: 'space-between',
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
        gap: 12,
        marginBottom: 24,
    },
    statCard: {
        flex: 1,
        padding: 16,
        alignItems: 'center' as const,
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
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    memberInfo: {
        flexDirection: 'row' as const,
        alignItems: 'center',
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
        alignItems: 'center',
        gap: 8,
    },
    roleBadge: {
        flexDirection: 'row' as const,
        alignItems: 'center',
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
        alignItems: 'center',
        justifyContent: 'space-between',
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
        alignItems: 'center',
        justifyContent: 'space-between',
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
        alignItems: 'center',
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
        alignItems: 'center',
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
};

export default ServiceTeamManager;
