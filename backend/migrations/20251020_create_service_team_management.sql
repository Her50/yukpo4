-- Migration pour la gestion multi-utilisateur des services
-- Date: 2025-10-20

-- Table des rôles d'équipe
CREATE TABLE IF NOT EXISTS service_team_roles (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    level INTEGER NOT NULL DEFAULT 1,
    color VARCHAR(7) DEFAULT '#6B7280',
    icon VARCHAR(50) DEFAULT 'users',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des permissions
CREATE TABLE IF NOT EXISTS service_permissions (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(200) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL DEFAULT 'general',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table des permissions par rôle
CREATE TABLE IF NOT EXISTS role_permissions (
    role_id VARCHAR(50) REFERENCES service_team_roles(id) ON DELETE CASCADE,
    permission_id VARCHAR(100) REFERENCES service_permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- Table des membres d'équipe
CREATE TABLE IF NOT EXISTS service_team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role_id VARCHAR(50) REFERENCES service_team_roles(id) ON DELETE RESTRICT,
    added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    added_at TIMESTAMPTZ DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(service_id, user_id)
);

-- Table des invitations d'équipe
CREATE TABLE IF NOT EXISTS service_team_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role_id VARCHAR(50) REFERENCES service_team_roles(id) ON DELETE RESTRICT,
    invited_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    invited_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),
    token VARCHAR(255) UNIQUE NOT NULL,
    accepted_at TIMESTAMPTZ,
    UNIQUE(service_id, email)
);

-- Table des activités d'équipe
CREATE TABLE IF NOT EXISTS service_team_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id INTEGER REFERENCES services(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    description TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insérer les rôles prédéfinis
INSERT INTO service_team_roles (id, name, description, level, color, icon) VALUES
('admin', 'Administrateur', 'Accès complet à tous les services et paramètres', 1, '#DC2626', 'crown'),
('manager', 'Gestionnaire', 'Gestion des services et équipe, pas d''accès financier', 2, '#7C3AED', 'users'),
('editor', 'Éditeur', 'Modification du contenu et médias des services', 3, '#059669', 'edit'),
('viewer', 'Observateur', 'Consultation des services et statistiques', 4, '#6B7280', 'eye')
ON CONFLICT (id) DO NOTHING;

-- Insérer les permissions prédéfinies
INSERT INTO service_permissions (id, name, description, category) VALUES
-- Général
('view_services', 'Voir les services', 'Consulter la liste des services', 'general'),
('create_service', 'Créer un service', 'Créer de nouveaux services', 'general'),
('delete_service', 'Supprimer un service', 'Supprimer des services', 'general'),

-- Contenu
('edit_content', 'Modifier le contenu', 'Modifier le titre, description et détails', 'content'),
('edit_products', 'Gérer les produits', 'Ajouter, modifier et supprimer des produits', 'content'),
('edit_pricing', 'Modifier les prix', 'Changer les prix des services et produits', 'content'),

-- Médias
('upload_media', 'Télécharger des médias', 'Ajouter des images, vidéos et documents', 'media'),
('delete_media', 'Supprimer des médias', 'Supprimer des images, vidéos et documents', 'media'),

-- Analytics
('view_analytics', 'Voir les statistiques', 'Consulter les vues, interactions et performances', 'analytics'),
('export_data', 'Exporter les données', 'Exporter les statistiques et rapports', 'analytics'),

-- Équipe
('manage_team', 'Gérer l''équipe', 'Inviter et gérer les membres de l''équipe', 'team'),
('assign_roles', 'Assigner des rôles', 'Changer les rôles et permissions des membres', 'team'),

-- Financier
('view_financials', 'Voir les finances', 'Consulter les revenus et dépenses', 'financial'),
('manage_payments', 'Gérer les paiements', 'Configurer et gérer les méthodes de paiement', 'financial')
ON CONFLICT (id) DO NOTHING;

-- Assigner les permissions aux rôles
INSERT INTO role_permissions (role_id, permission_id) VALUES
-- Admin - toutes les permissions
('admin', 'view_services'),
('admin', 'create_service'),
('admin', 'delete_service'),
('admin', 'edit_content'),
('admin', 'edit_products'),
('admin', 'edit_pricing'),
('admin', 'upload_media'),
('admin', 'delete_media'),
('admin', 'view_analytics'),
('admin', 'export_data'),
('admin', 'manage_team'),
('admin', 'assign_roles'),
('admin', 'view_financials'),
('admin', 'manage_payments'),

-- Manager - toutes sauf delete_service et manage_payments
('manager', 'view_services'),
('manager', 'create_service'),
('manager', 'edit_content'),
('manager', 'edit_products'),
('manager', 'edit_pricing'),
('manager', 'upload_media'),
('manager', 'delete_media'),
('manager', 'view_analytics'),
('manager', 'export_data'),
('manager', 'manage_team'),
('manager', 'assign_roles'),
('manager', 'view_financials'),

-- Editor - permissions de contenu et médias
('editor', 'view_services'),
('editor', 'edit_content'),
('editor', 'edit_products'),
('editor', 'edit_pricing'),
('editor', 'upload_media'),
('editor', 'delete_media'),
('editor', 'view_analytics'),

-- Viewer - consultation uniquement
('viewer', 'view_services'),
('viewer', 'view_analytics')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Créer les index pour les performances
CREATE INDEX IF NOT EXISTS idx_service_team_members_service_id ON service_team_members(service_id);
CREATE INDEX IF NOT EXISTS idx_service_team_members_user_id ON service_team_members(user_id);
CREATE INDEX IF NOT EXISTS idx_service_team_members_role_id ON service_team_members(role_id);
CREATE INDEX IF NOT EXISTS idx_service_team_members_active ON service_team_members(is_active);

CREATE INDEX IF NOT EXISTS idx_service_team_invitations_service_id ON service_team_invitations(service_id);
CREATE INDEX IF NOT EXISTS idx_service_team_invitations_email ON service_team_invitations(email);
CREATE INDEX IF NOT EXISTS idx_service_team_invitations_token ON service_team_invitations(token);
CREATE INDEX IF NOT EXISTS idx_service_team_invitations_status ON service_team_invitations(status);
CREATE INDEX IF NOT EXISTS idx_service_team_invitations_expires_at ON service_team_invitations(expires_at);

CREATE INDEX IF NOT EXISTS idx_service_team_activities_service_id ON service_team_activities(service_id);
CREATE INDEX IF NOT EXISTS idx_service_team_activities_user_id ON service_team_activities(user_id);
CREATE INDEX IF NOT EXISTS idx_service_team_activities_created_at ON service_team_activities(created_at);

-- Fonction pour vérifier les permissions d'un utilisateur sur un service
CREATE OR REPLACE FUNCTION check_service_permission(
    p_user_id INTEGER,
    p_service_id INTEGER,
    p_permission_id VARCHAR(100)
) RETURNS BOOLEAN AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    -- Vérifier si l'utilisateur est le propriétaire du service
    IF EXISTS (
        SELECT 1 FROM services 
        WHERE id = p_service_id AND user_id = p_user_id
    ) THEN
        RETURN TRUE;
    END IF;

    -- Vérifier si l'utilisateur a la permission via son rôle d'équipe
    SELECT EXISTS (
        SELECT 1 
        FROM service_team_members stm
        JOIN role_permissions rp ON stm.role_id = rp.role_id
        WHERE stm.user_id = p_user_id 
        AND stm.service_id = p_service_id 
        AND stm.is_active = TRUE
        AND rp.permission_id = p_permission_id
    ) INTO has_permission;

    RETURN has_permission;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour obtenir les permissions d'un utilisateur sur un service
CREATE OR REPLACE FUNCTION get_user_service_permissions(
    p_user_id INTEGER,
    p_service_id INTEGER
) RETURNS TABLE(permission_id VARCHAR(100), permission_name VARCHAR(200)) AS $$
BEGIN
    -- Si l'utilisateur est le propriétaire, retourner toutes les permissions
    IF EXISTS (
        SELECT 1 FROM services 
        WHERE id = p_service_id AND user_id = p_user_id
    ) THEN
        RETURN QUERY
        SELECT sp.id, sp.name
        FROM service_permissions sp;
    ELSE
        -- Sinon, retourner les permissions via le rôle d'équipe
        RETURN QUERY
        SELECT DISTINCT sp.id, sp.name
        FROM service_team_members stm
        JOIN role_permissions rp ON stm.role_id = rp.role_id
        JOIN service_permissions sp ON rp.permission_id = sp.id
        WHERE stm.user_id = p_user_id 
        AND stm.service_id = p_service_id 
        AND stm.is_active = TRUE;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Fonction pour nettoyer les invitations expirées
CREATE OR REPLACE FUNCTION cleanup_expired_invitations() RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE service_team_invitations 
    SET status = 'expired'
    WHERE status = 'pending' 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Trigger pour mettre à jour updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_service_team_roles_updated_at
    BEFORE UPDATE ON service_team_roles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Vue pour les membres d'équipe avec informations complètes
CREATE OR REPLACE VIEW service_team_members_view AS
SELECT 
    stm.id,
    stm.service_id,
    stm.user_id,
    u.username,
    u.email,
    u.avatar_url,
    stm.role_id,
    str.name as role_name,
    str.description as role_description,
    str.level as role_level,
    str.color as role_color,
    str.icon as role_icon,
    stm.added_by,
    added_by_user.username as added_by_username,
    stm.added_at,
    stm.is_active
FROM service_team_members stm
JOIN users u ON stm.user_id = u.id
JOIN service_team_roles str ON stm.role_id = str.id
LEFT JOIN users added_by_user ON stm.added_by = added_by_user.id;

-- Vue pour les invitations avec informations complètes
CREATE OR REPLACE VIEW service_team_invitations_view AS
SELECT 
    sti.id,
    sti.service_id,
    sti.email,
    sti.role_id,
    str.name as role_name,
    str.description as role_description,
    str.level as role_level,
    str.color as role_color,
    str.icon as role_icon,
    sti.invited_by,
    u.username as invited_by_username,
    sti.invited_at,
    sti.expires_at,
    sti.status,
    sti.token,
    sti.accepted_at
FROM service_team_invitations sti
JOIN service_team_roles str ON sti.role_id = str.id
LEFT JOIN users u ON sti.invited_by = u.id;

-- Commentaires sur les tables
COMMENT ON TABLE service_team_roles IS 'Rôles disponibles pour les équipes de services';
COMMENT ON TABLE service_permissions IS 'Permissions disponibles pour les services';
COMMENT ON TABLE role_permissions IS 'Association entre rôles et permissions';
COMMENT ON TABLE service_team_members IS 'Membres des équipes de services';
COMMENT ON TABLE service_team_invitations IS 'Invitations à rejoindre une équipe de service';
COMMENT ON TABLE service_team_activities IS 'Historique des activités des équipes de services';

COMMENT ON FUNCTION check_service_permission IS 'Vérifie si un utilisateur a une permission spécifique sur un service';
COMMENT ON FUNCTION get_user_service_permissions IS 'Retourne toutes les permissions d''un utilisateur sur un service';
COMMENT ON FUNCTION cleanup_expired_invitations IS 'Marque les invitations expirées comme expirées';
