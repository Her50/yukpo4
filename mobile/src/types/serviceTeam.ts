// Types pour la gestion multi-utilisateur des services
export interface ServiceTeamMember {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userAvatar?: string;
    role: ServiceTeamRole;
    permissions: ServicePermission[];
    serviceId?: string; // Si null, permissions sur tous les services
    addedAt: string;
    addedBy: string;
    isActive: boolean;
}

export interface ServiceTeamRole {
    id: string;
    name: string;
    description: string;
    level: number; // 1 = Admin, 2 = Manager, 3 = Editor, 4 = Viewer
    color: string;
    icon: string;
}

export interface ServicePermission {
    id: string;
    name: string;
    description: string;
    category: PermissionCategory;
}

export enum PermissionCategory {
    GENERAL = 'general',
    CONTENT = 'content',
    MEDIA = 'media',
    ANALYTICS = 'analytics',
    TEAM = 'team',
    FINANCIAL = 'financial'
}

export interface ServiceTeamInvitation {
    id: string;
    serviceId?: string;
    email: string;
    role: ServiceTeamRole;
    permissions: ServicePermission[];
    invitedBy: string;
    invitedAt: string;
    expiresAt: string;
    status: 'pending' | 'accepted' | 'declined' | 'expired';
    token: string;
}

export interface ServiceTeamActivity {
    id: string;
    serviceId: string;
    userId: string;
    userName: string;
    action: string;
    description: string;
    timestamp: string;
    metadata?: any;
}

// Rôles prédéfinis
export const SERVICE_TEAM_ROLES: ServiceTeamRole[] = [
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

// Permissions prédéfinies
export const SERVICE_PERMISSIONS: ServicePermission[] = [
    // Général
    {
        id: 'view_services',
        name: 'Voir les services',
        description: 'Consulter la liste des services',
        category: PermissionCategory.GENERAL
    },
    {
        id: 'create_service',
        name: 'Créer un service',
        description: 'Créer de nouveaux services',
        category: PermissionCategory.GENERAL
    },
    {
        id: 'delete_service',
        name: 'Supprimer un service',
        description: 'Supprimer des services',
        category: PermissionCategory.GENERAL
    },

    // Contenu
    {
        id: 'edit_content',
        name: 'Modifier le contenu',
        description: 'Modifier le titre, description et détails',
        category: PermissionCategory.CONTENT
    },
    {
        id: 'edit_products',
        name: 'Gérer les produits',
        description: 'Ajouter, modifier et supprimer des produits',
        category: PermissionCategory.CONTENT
    },
    {
        id: 'edit_pricing',
        name: 'Modifier les prix',
        description: 'Changer les prix des services et produits',
        category: PermissionCategory.CONTENT
    },

    // Médias
    {
        id: 'upload_media',
        name: 'Télécharger des médias',
        description: 'Ajouter des images, vidéos et documents',
        category: PermissionCategory.MEDIA
    },
    {
        id: 'delete_media',
        name: 'Supprimer des médias',
        description: 'Supprimer des images, vidéos et documents',
        category: PermissionCategory.MEDIA
    },

    // Analytics
    {
        id: 'view_analytics',
        name: 'Voir les statistiques',
        description: 'Consulter les vues, interactions et performances',
        category: PermissionCategory.ANALYTICS
    },
    {
        id: 'export_data',
        name: 'Exporter les données',
        description: 'Exporter les statistiques et rapports',
        category: PermissionCategory.ANALYTICS
    },

    // Équipe
    {
        id: 'manage_team',
        name: 'Gérer l\'équipe',
        description: 'Inviter et gérer les membres de l\'équipe',
        category: PermissionCategory.TEAM
    },
    {
        id: 'assign_roles',
        name: 'Assigner des rôles',
        description: 'Changer les rôles et permissions des membres',
        category: PermissionCategory.TEAM
    },

    // Financier
    {
        id: 'view_financials',
        name: 'Voir les finances',
        description: 'Consulter les revenus et dépenses',
        category: PermissionCategory.FINANCIAL
    },
    {
        id: 'manage_payments',
        name: 'Gérer les paiements',
        description: 'Configurer et gérer les méthodes de paiement',
        category: PermissionCategory.FINANCIAL
    }
];

// Permissions par rôle
export const ROLE_PERMISSIONS: Record<string, string[]> = {
    admin: SERVICE_PERMISSIONS.map(p => p.id),
    manager: SERVICE_PERMISSIONS.filter(p =>
        !['delete_service', 'manage_payments'].includes(p.id)
    ).map(p => p.id),
    editor: SERVICE_PERMISSIONS.filter(p =>
        ['view_services', 'edit_content', 'edit_products', 'edit_pricing', 'upload_media', 'delete_media', 'view_analytics'].includes(p.id)
    ).map(p => p.id),
    viewer: SERVICE_PERMISSIONS.filter(p =>
        ['view_services', 'view_analytics'].includes(p.id)
    ).map(p => p.id)
};
