/**
 * Configuration des routes avec rôles
 */

export interface Role {
    ADMIN: 'admin';
    USER: 'user';
    PRESTATAIRE: 'prestataire';
    CLIENT: 'client';
}

export const Role: Role = {
    ADMIN: 'admin',
    USER: 'user',
    PRESTATAIRE: 'prestataire',
    CLIENT: 'client',
};

export const ROUTES_CONFIG = {
    public: [
        '/login',
        '/register',
        '/',
    ],
    protected: [
        '/dashboard',
        '/profile',
        '/services',
        '/create-service',
    ],
    admin: [
        '/admin',
        '/admin/users',
    ],
};

export default ROUTES_CONFIG;
