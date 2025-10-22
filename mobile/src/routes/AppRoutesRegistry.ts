/**
 * Registre des routes de l'application mobile
 * Centralise toutes les routes pour éviter les erreurs d'import
 */

export const ROUTES = {
    // Routes d'authentification
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',

    // Routes principales
    HOME: '/',
    DASHBOARD: '/dashboard',
    PROFILE: '/profile',
    SETTINGS: '/settings',

    // Routes des services
    SERVICES: '/services',
    CREATE_SERVICE: '/create-service',
    SERVICE_DETAIL: '/service/:id',
    MY_SERVICES: '/my-services',

    // Routes de recherche
    SEARCH: '/search',
    RESULTS: '/results',

    // Routes de contact
    CONTACT: '/contact',

    // Routes de paiement
    RECHARGE: '/recharge',
    PAYMENT: '/payment',

    // Routes d'administration
    ADMIN: '/admin',
    USERS: '/admin/users',

    // Routes de test
    TEST: '/test',
} as const;

export type RouteKey = keyof typeof ROUTES;

export default ROUTES;
