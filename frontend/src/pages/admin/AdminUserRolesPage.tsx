// Page de gestion des rôles utilisateurs (admin seulement)
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { Search, Users, Edit, ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import RequireAdminPage from '@/components/security/RequireAdminPage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import axios from 'axios';

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

const ROLE_LABELS: Record<string, string> = {
    user: '👤 Utilisateur',
    admin: '👑 Administrateur',
    client: '🛒 Client',
    prestataire: '🏪 Prestataire',
};

const ROLE_COLORS: Record<string, string> = {
    user: 'bg-gray-500',
    admin: 'bg-red-600',
    client: 'bg-green-600',
    prestataire: 'bg-purple-600',
};

const AdminUserRolesPage: React.FC = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<UserListItem[]>([]);
    const [totalPages, setTotalPages] = useState(1);
    const [currentPage, setCurrentPage] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<string>('all');
    const [selectedUser, setSelectedUser] = useState<UserListItem | null>(null);
    const [showRoleDialog, setShowRoleDialog] = useState(false);
    const [newRole, setNewRole] = useState<string>('');
    const [updating, setUpdating] = useState(false);

    useEffect(() => {
        if (user?.role !== 'admin') {
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

            const response = await axios.get<ListUsersResponse>(`/api/admin/users?${params.toString()}`);
            const data = response.data;

            if (data.users) {
                setUsers(data.users);
                setTotalPages(data.total_pages || 1);
            } else {
                setUsers([]);
            }
        } catch (error: any) {
            console.error('[AdminUserRolesPage] Erreur chargement utilisateurs:', error);
            alert(error.message || 'Impossible de charger les utilisateurs');
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
            const response = await axios.patch(`/api/admin/users/${selectedUser.id}/role`, {
                role: newRole,
            });

            if (response.data.success !== false) {
                alert(`✅ Rôle mis à jour avec succès : ${newRole}`);
                setShowRoleDialog(false);
                setSelectedUser(null);
                setNewRole('');
                loadUsers();
            } else {
                throw new Error(response.data.message || 'Erreur lors de la mise à jour du rôle');
            }
        } catch (error: any) {
            console.error('[AdminUserRolesPage] Erreur mise à jour rôle:', error);
            alert(error.message || 'Impossible de mettre à jour le rôle');
        } finally {
            setUpdating(false);
        }
    };

    const openRoleDialog = (userItem: UserListItem) => {
        setSelectedUser(userItem);
        setNewRole(userItem.role);
        setShowRoleDialog(true);
    };

    return (
        <RequireAdminPage>
            <div className="container mx-auto p-6 max-w-7xl">
                {/* Header */}
                <div className="mb-6">
                    <Button
                        variant="ghost"
                        onClick={() => navigate(-1)}
                        className="mb-4"
                    >
                        <ChevronLeft className="w-4 h-4 mr-2" />
                        Retour
                    </Button>
                    <h1 className="text-3xl font-bold">Gestion des rôles utilisateurs</h1>
                    <p className="text-gray-600 mt-2">
                        Gérez les rôles et permissions des utilisateurs de la plateforme
                    </p>
                </div>

                {/* Recherche et filtres */}
                <Card className="mb-6">
                    <CardHeader>
                        <CardTitle>Rechercher et filtrer</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                                <Input
                                    placeholder="Rechercher par email ou nom..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={roleFilter} onValueChange={(value) => {
                                setRoleFilter(value);
                                setCurrentPage(1);
                            }}>
                                <SelectTrigger className="w-full md:w-[200px]">
                                    <SelectValue placeholder="Filtrer par rôle" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Tous les rôles</SelectItem>
                                    {VALID_ROLES.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {ROLE_LABELS[role]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </CardContent>
                </Card>

                {/* Liste des utilisateurs */}
                {loading ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                            <p className="mt-4 text-gray-600">Chargement des utilisateurs...</p>
                        </CardContent>
                    </Card>
                ) : users.length === 0 ? (
                    <Card>
                        <CardContent className="py-12 text-center">
                            <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                            <p className="text-gray-600">Aucun utilisateur trouvé</p>
                        </CardContent>
                    </Card>
                ) : (
                    <>
                        <div className="grid gap-4">
                            {users.map((userItem) => (
                                <Card key={userItem.id}>
                                    <CardContent className="p-6">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-2">
                                                    <h3 className="text-lg font-semibold">{userItem.email}</h3>
                                                    <Badge
                                                        className={`${ROLE_COLORS[userItem.role] || 'bg-gray-500'} text-white cursor-pointer hover:opacity-80`}
                                                        onClick={() => openRoleDialog(userItem)}
                                                    >
                                                        {ROLE_LABELS[userItem.role] || userItem.role}
                                                    </Badge>
                                                </div>
                                                {userItem.nom_complet && (
                                                    <p className="text-gray-600 mb-3">{userItem.nom_complet}</p>
                                                )}
                                                <div className="flex items-center gap-6 text-sm text-gray-500">
                                                    <span>Tokens: {userItem.tokens_balance.toLocaleString()}</span>
                                                    {userItem.is_provider && (
                                                        <span className="text-green-600">✓ Prestataire</span>
                                                    )}
                                                    <span>
                                                        Créé le {new Date(userItem.created_at).toLocaleDateString('fr-FR')}
                                                    </span>
                                                </div>
                                            </div>
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openRoleDialog(userItem)}
                                            >
                                                <Edit className="w-4 h-4 mr-2" />
                                                Modifier
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="flex items-center justify-center gap-4 mt-6">
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                                    disabled={currentPage === 1}
                                >
                                    <ChevronLeft className="w-4 h-4 mr-2" />
                                    Précédent
                                </Button>
                                <span className="text-sm font-medium">
                                    Page {currentPage} / {totalPages}
                                </span>
                                <Button
                                    variant="outline"
                                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                                    disabled={currentPage >= totalPages}
                                >
                                    Suivant
                                    <ChevronRight className="w-4 h-4 ml-2" />
                                </Button>
                            </div>
                        )}
                    </>
                )}

                {/* Dialog de modification de rôle */}
                <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Modifier le rôle</DialogTitle>
                            <DialogDescription>
                                {selectedUser && (
                                    <>
                                        Utilisateur : {selectedUser.email}
                                        {selectedUser.nom_complet && (
                                            <span className="block text-sm text-gray-500 mt-1">
                                                {selectedUser.nom_complet}
                                            </span>
                                        )}
                                        <span className="block text-sm text-gray-500 mt-2">
                                            Rôle actuel : {ROLE_LABELS[selectedUser.role] || selectedUser.role}
                                        </span>
                                    </>
                                )}
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                            <Select value={newRole} onValueChange={setNewRole}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Sélectionner un rôle" />
                                </SelectTrigger>
                                <SelectContent>
                                    {VALID_ROLES.map((role) => (
                                        <SelectItem key={role} value={role}>
                                            {ROLE_LABELS[role]}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <DialogFooter>
                            <Button
                                variant="outline"
                                onClick={() => setShowRoleDialog(false)}
                                disabled={updating}
                            >
                                Annuler
                            </Button>
                            <Button
                                onClick={handleUpdateRole}
                                disabled={updating || newRole === selectedUser?.role}
                            >
                                {updating ? 'Mise à jour...' : 'Confirmer'}
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </RequireAdminPage>
    );
};

export default AdminUserRolesPage;

