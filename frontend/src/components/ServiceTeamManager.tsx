// Composant de gestion d'équipe pour les services - Frontend
import { Clock, Crown, Edit, Eye, Mail, Trash2, UserPlus, Users, X } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';
import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent } from './ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

interface ServiceTeamMember {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    role: ServiceTeamRole;
    permissions: ServicePermission[];
    serviceId?: string;
    addedAt: string;
    addedBy: string;
    isActive: boolean;
}

interface ServiceTeamRole {
    id: string;
    name: string;
    description: string;
    level: number;
    color: string;
    icon: string;
}

interface ServicePermission {
    id: string;
    name: string;
    description: string;
    category: string;
}

interface ServiceTeamManagerProps {
    serviceId?: string;
    onClose: () => void;
    onMemberAdded?: (member: ServiceTeamMember) => void;
    onMemberRemoved?: (memberId: string) => void;
}

const SERVICE_TEAM_ROLES: ServiceTeamRole[] = [
    {
        id: 'admin',
        name: 'Administrateur',
        description: 'Accès complet à tous les services et paramètres',
        level: 1,
        color: '#DC2626',
        icon: 'crown'
    },
    {
        id: 'manager',
        name: 'Gestionnaire',
        description: 'Gestion des services et équipe, pas d\'accès financier',
        level: 2,
        color: '#7C3AED',
        icon: 'users'
    },
    {
        id: 'editor',
        name: 'Éditeur',
        description: 'Modification du contenu et médias des services',
        level: 3,
        color: '#059669',
        icon: 'edit'
    },
    {
        id: 'viewer',
        name: 'Observateur',
        description: 'Consultation des services et statistiques',
        level: 4,
        color: '#6B7280',
        icon: 'eye'
    }
];

const SERVICE_PERMISSIONS: ServicePermission[] = [
    { id: 'view_services', name: 'Voir les services', description: 'Consulter la liste des services', category: 'general' },
    { id: 'create_service', name: 'Créer un service', description: 'Créer de nouveaux services', category: 'general' },
    { id: 'delete_service', name: 'Supprimer un service', description: 'Supprimer des services', category: 'general' },
    { id: 'edit_content', name: 'Modifier le contenu', description: 'Modifier le titre, description et détails', category: 'content' },
    { id: 'edit_products', name: 'Gérer les produits', description: 'Ajouter, modifier et supprimer des produits', category: 'content' },
    { id: 'edit_pricing', name: 'Modifier les prix', description: 'Changer les prix des services et produits', category: 'content' },
    { id: 'upload_media', name: 'Télécharger des médias', description: 'Ajouter des images, vidéos et documents', category: 'media' },
    { id: 'delete_media', name: 'Supprimer des médias', description: 'Supprimer des images, vidéos et documents', category: 'media' },
    { id: 'view_analytics', name: 'Voir les statistiques', description: 'Consulter les vues, interactions et performances', category: 'analytics' },
    { id: 'export_data', name: 'Exporter les données', description: 'Exporter les statistiques et rapports', category: 'analytics' },
    { id: 'manage_team', name: 'Gérer l\'équipe', description: 'Inviter et gérer les membres de l\'équipe', category: 'team' },
    { id: 'assign_roles', name: 'Assigner des rôles', description: 'Changer les rôles et permissions des membres', category: 'team' },
    { id: 'view_financials', name: 'Voir les finances', description: 'Consulter les revenus et dépenses', category: 'financial' },
    { id: 'manage_payments', name: 'Gérer les paiements', description: 'Configurer et gérer les méthodes de paiement', category: 'financial' }
];

const ROLE_PERMISSIONS: Record<string, string[]> = {
    admin: SERVICE_PERMISSIONS.map(p => p.id),
    manager: SERVICE_PERMISSIONS.filter(p => !['delete_service', 'manage_payments'].includes(p.id)).map(p => p.id),
    editor: SERVICE_PERMISSIONS.filter(p => ['view_services', 'edit_content', 'edit_products', 'edit_pricing', 'upload_media', 'delete_media', 'view_analytics'].includes(p.id)).map(p => p.id),
    viewer: SERVICE_PERMISSIONS.filter(p => ['view_services', 'view_analytics'].includes(p.id)).map(p => p.id)
};

const ServiceTeamManager: React.FC<ServiceTeamManagerProps> = ({
    serviceId,
    onClose,
    onMemberAdded,
    onMemberRemoved
}) => {
    const [members, setMembers] = useState<ServiceTeamMember[]>([]);
    const [invitations, setInvitations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [showInviteModal, setShowInviteModal] = useState(false);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteRole, setInviteRole] = useState<string>('');

    useEffect(() => {
        loadTeamData();
    }, [serviceId]);

    const loadTeamData = async () => {
        try {
            setLoading(true);
            const endpoint = serviceId
                ? `/api/services/${serviceId}/team`
                : '/api/user/services/team';

            const response = await fetch(endpoint);
            const data = await response.json();

            if (data.success) {
                setMembers(data.data.members || []);
                setInvitations(data.data.invitations || []);
            }
        } catch (error) {
            console.error('Erreur chargement équipe:', error);
            toast.error('Impossible de charger les données de l\'équipe');
        } finally {
            setLoading(false);
        }
    };

    const handleInviteUser = async () => {
        if (!inviteEmail || !inviteRole) {
            toast.error('Veuillez remplir tous les champs');
            return;
        }

        try {
            const response = await fetch('/api/services/team/invite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    serviceId,
                    email: inviteEmail,
                    role: inviteRole,
                    permissions: ROLE_PERMISSIONS[inviteRole]
                })
            });

            const data = await response.json();
            if (data.success) {
                toast.success('Invitation envoyée avec succès');
                setShowInviteModal(false);
                setInviteEmail('');
                setInviteRole('');
                loadTeamData();
            } else {
                toast.error(data.message || 'Erreur lors de l\'invitation');
            }
        } catch (error) {
            console.error('Erreur invitation:', error);
            toast.error('Impossible d\'envoyer l\'invitation');
        }
    };

    const handleRemoveMember = async (memberId: string) => {
        if (!confirm('Êtes-vous sûr de vouloir retirer ce membre de l\'équipe ?')) {
            return;
        }

        try {
            const response = await fetch(`/api/services/team/members/${memberId}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                setMembers(members.filter(m => m.id !== memberId));
                onMemberRemoved?.(memberId);
                toast.success('Membre retiré de l\'équipe');
            }
        } catch (error) {
            console.error('Erreur suppression membre:', error);
            toast.error('Impossible de retirer le membre');
        }
    };

    const handleUpdateRole = async (memberId: string, newRoleId: string) => {
        try {
            const response = await fetch(`/api/services/team/members/${memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: newRoleId,
                    permissions: ROLE_PERMISSIONS[newRoleId]
                })
            });

            const data = await response.json();
            if (data.success) {
                const newRole = SERVICE_TEAM_ROLES.find(r => r.id === newRoleId);
                if (newRole) {
                    setMembers(members.map(m =>
                        m.id === memberId
                            ? {
                                ...m,
                                role: newRole,
                                permissions: SERVICE_PERMISSIONS.filter(p => ROLE_PERMISSIONS[newRoleId].includes(p.id))
                            }
                            : m
                    ));
                    toast.success('Rôle mis à jour avec succès');
                }
            }
        } catch (error) {
            console.error('Erreur mise à jour rôle:', error);
            toast.error('Impossible de mettre à jour le rôle');
        }
    };

    const getRoleIcon = (roleId: string) => {
        switch (roleId) {
            case 'admin': return <Crown className="w-4 h-4" />;
            case 'manager': return <Users className="w-4 h-4" />;
            case 'editor': return <Edit className="w-4 h-4" />;
            case 'viewer': return <Eye className="w-4 h-4" />;
            default: return <Users className="w-4 h-4" />;
        }
    };

    if (loading) {
        return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
                    <div className="flex items-center justify-center space-x-2">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
                        <span>Chargement de l'équipe...</span>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white p-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <Users className="w-6 h-6" />
                            <h2 className="text-xl font-bold">
                                {serviceId ? 'Équipe du service' : 'Mon équipe'}
                            </h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-indigo-600">{members.length}</div>
                                <div className="text-sm text-gray-600">Membres actifs</div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-4 text-center">
                                <div className="text-2xl font-bold text-purple-600">{invitations.length}</div>
                                <div className="text-sm text-gray-600">Invitations en attente</div>
                            </CardContent>
                        </Card>
                    </div>

                    <Tabs defaultValue="members" className="space-y-4">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="members">Membres</TabsTrigger>
                            <TabsTrigger value="invitations">Invitations</TabsTrigger>
                        </TabsList>

                        <TabsContent value="members" className="space-y-4">
                            <div className="flex justify-between items-center">
                                <h3 className="text-lg font-semibold">Membres de l'équipe</h3>
                                <Dialog open={showInviteModal} onOpenChange={setShowInviteModal}>
                                    <DialogTrigger asChild>
                                        <Button className="flex items-center space-x-2">
                                            <UserPlus className="w-4 h-4" />
                                            <span>Inviter</span>
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Inviter un membre</DialogTitle>
                                        </DialogHeader>
                                        <div className="space-y-4">
                                            <div>
                                                <Label htmlFor="email">Email ou nom d'utilisateur</Label>
                                                <Input
                                                    id="email"
                                                    value={inviteEmail}
                                                    onChange={(e) => setInviteEmail(e.target.value)}
                                                    placeholder="exemple@email.com ou @username"
                                                />
                                            </div>
                                            <div>
                                                <Label htmlFor="role">Rôle</Label>
                                                <Select value={inviteRole} onValueChange={setInviteRole}>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Sélectionner un rôle" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {SERVICE_TEAM_ROLES.map(role => (
                                                            <SelectItem key={role.id} value={role.id}>
                                                                <div className="flex items-center space-x-2">
                                                                    {getRoleIcon(role.id)}
                                                                    <span>{role.name}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <Button onClick={handleInviteUser} className="w-full">
                                                Envoyer l'invitation
                                            </Button>
                                        </div>
                                    </DialogContent>
                                </Dialog>
                            </div>

                            <div className="space-y-3">
                                {members.map(member => (
                                    <Card key={member.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Avatar>
                                                        <AvatarImage src={member.userAvatar} />
                                                        <AvatarFallback>
                                                            {member.userName.charAt(0).toUpperCase()}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <div className="font-semibold">{member.userName}</div>
                                                        <div className="text-sm text-gray-600">{member.userEmail}</div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-3">
                                                    <Select
                                                        value={member.role.id}
                                                        onValueChange={(value) => handleUpdateRole(member.id, value)}
                                                    >
                                                        <SelectTrigger className="w-40">
                                                            <SelectValue>
                                                                <div className="flex items-center space-x-2">
                                                                    {getRoleIcon(member.role.id)}
                                                                    <span>{member.role.name}</span>
                                                                </div>
                                                            </SelectValue>
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {SERVICE_TEAM_ROLES.map(role => (
                                                                <SelectItem key={role.id} value={role.id}>
                                                                    <div className="flex items-center space-x-2">
                                                                        {getRoleIcon(role.id)}
                                                                        <span>{role.name}</span>
                                                                    </div>
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() => handleRemoveMember(member.id)}
                                                        className="text-red-600 hover:text-red-700"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </div>
                                            </div>
                                            <div className="mt-3">
                                                <div className="text-sm text-gray-600 mb-2">Permissions :</div>
                                                <div className="flex flex-wrap gap-1">
                                                    {member.permissions.slice(0, 3).map(permission => (
                                                        <Badge key={permission.id} variant="secondary" className="text-xs">
                                                            {permission.name}
                                                        </Badge>
                                                    ))}
                                                    {member.permissions.length > 3 && (
                                                        <Badge variant="outline" className="text-xs">
                                                            +{member.permissions.length - 3} autres
                                                        </Badge>
                                                    )}
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>

                        <TabsContent value="invitations" className="space-y-4">
                            <h3 className="text-lg font-semibold">Invitations en attente</h3>
                            <div className="space-y-3">
                                {invitations.map(invitation => (
                                    <Card key={invitation.id}>
                                        <CardContent className="p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center space-x-3">
                                                    <Mail className="w-5 h-5 text-gray-400" />
                                                    <div>
                                                        <div className="font-semibold">{invitation.email}</div>
                                                        <div className="text-sm text-gray-600">
                                                            Invité le {new Date(invitation.invitedAt).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <Badge variant="outline" className="flex items-center space-x-1">
                                                        {getRoleIcon(invitation.role.id)}
                                                        <span>{invitation.role.name}</span>
                                                    </Badge>
                                                    <Badge variant="secondary" className="flex items-center space-x-1">
                                                        <Clock className="w-3 h-3" />
                                                        <span>En attente</span>
                                                    </Badge>
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                                {invitations.length === 0 && (
                                    <Alert>
                                        <AlertDescription>
                                            Aucune invitation en attente
                                        </AlertDescription>
                                    </Alert>
                                )}
                            </div>
                        </TabsContent>
                    </Tabs>
                </div>
            </div>
        </div>
    );
};

export default ServiceTeamManager;
