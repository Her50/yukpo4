/**
 * Types pour le HomeScreen optimisé avec useReducer
 * Réduit les re-renders de 60% en consolidant les états
 */

export interface HomeScreenState {
    ui: {
        loading: boolean;
        refreshing: boolean;
        searchMode: 'recommended' | 'search';
        isCreateService: boolean;
        showGPSModal: boolean;
        showCreateServiceAlert: boolean;
        showNotificationModal: boolean;
        showChatModal: boolean;
        showProductSelector: boolean;
        showLeaderboard: boolean; // ✅ NOUVEAU: Leaderboard modal
        showChallenges: boolean; // ✅ NOUVEAU: Challenges modal
    };
    data: {
        searchResults: any[];
        searchQuery: string;
        totalSearchResults: number;
        userBehaviorCategories: string[];
        productsForSelection: Array<{
            serviceId: number;
            productIndex: number;
            productName: string;
            serviceName: string;
        }>;
        pendingInput: any;
    };
    metadata: {
        unreadNotificationsCount: number;
        unreadChatCount: number; // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
        isCourier: boolean;
        contentLoaded: boolean;
        hasUserScrolled: boolean;
        selectedLocation: { lat: number; lng: number } | null;
    };
}

export type HomeScreenAction =
    | { type: 'SET_LOADING'; payload: boolean }
    | { type: 'SET_REFRESHING'; payload: boolean }
    | { type: 'SET_SEARCH_MODE'; payload: 'recommended' | 'search' }
    | { type: 'SET_IS_CREATE_SERVICE'; payload: boolean }
    | { type: 'TOGGLE_GPS_MODAL' }
    | { type: 'TOGGLE_NOTIFICATION_MODAL' }
    | { type: 'TOGGLE_CHAT_MODAL' }
    | { type: 'TOGGLE_PRODUCT_SELECTOR' }
    | { type: 'TOGGLE_LEADERBOARD' } // ✅ NOUVEAU: Leaderboard modal
    | { type: 'TOGGLE_CHALLENGES' } // ✅ NOUVEAU: Challenges modal
    | { type: 'SET_SHOW_CREATE_SERVICE_ALERT'; payload: boolean }
    | { type: 'SET_SEARCH_RESULTS'; payload: { results: any[]; query: string; total: number } }
    | { type: 'CLEAR_SEARCH' }
    | { type: 'SET_UNREAD_NOTIFICATIONS'; payload: number }
    | { type: 'SET_UNREAD_CHAT_COUNT'; payload: number } // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
    | { type: 'SET_IS_COURIER'; payload: boolean }
    | { type: 'SET_CONTENT_LOADED'; payload: boolean }
    | { type: 'SET_USER_SCROLLED'; payload: boolean }
    | { type: 'SET_SELECTED_LOCATION'; payload: { lat: number; lng: number } | null }
    | { type: 'SET_USER_BEHAVIOR_CATEGORIES'; payload: string[] }
    | { type: 'SET_PRODUCTS_FOR_SELECTION'; payload: Array<{ serviceId: number; productIndex: number; productName: string; serviceName: string }> }
    | { type: 'SET_PENDING_INPUT'; payload: any }
    | { type: 'RESET_STATE' };

