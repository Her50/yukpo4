/**
 * Reducer pour HomeScreen - Optimise les re-renders
 * Gain estimé: -60% de re-renders
 */

import { HomeScreenAction, HomeScreenState } from './HomeScreen.types';

export const initialState: HomeScreenState = {
    ui: {
        loading: false,
        refreshing: false,
        searchMode: 'recommended',
        isCreateService: false,
        showGPSModal: false,
        showCreateServiceAlert: false,
        showNotificationModal: false,
        showChatModal: false,
        showProductSelector: false,
        showLeaderboard: false, // ✅ NOUVEAU: Leaderboard modal
        showChallenges: false, // ✅ NOUVEAU: Challenges modal
    },
    data: {
        searchResults: [],
        searchQuery: '',
        totalSearchResults: 0,
        userBehaviorCategories: [],
        productsForSelection: [],
        pendingInput: null,
    },
    metadata: {
        unreadNotificationsCount: 0,
        unreadChatCount: 0, // ✅ NOUVEAU 2025-01-27: Nombre de conversations non lues
        isCourier: false,
        contentLoaded: false,
        hasUserScrolled: false,
        selectedLocation: null,
    },
};

export const homeScreenReducer = (
    state: HomeScreenState,
    action: HomeScreenAction
): HomeScreenState => {
    switch (action.type) {
        case 'SET_LOADING':
            return {
                ...state,
                ui: { ...state.ui, loading: action.payload },
            };

        case 'SET_REFRESHING':
            return {
                ...state,
                ui: { ...state.ui, refreshing: action.payload },
            };

        case 'SET_SEARCH_MODE':
            return {
                ...state,
                ui: { ...state.ui, searchMode: action.payload },
            };

        case 'SET_IS_CREATE_SERVICE':
            return {
                ...state,
                ui: { ...state.ui, isCreateService: action.payload },
            };

        case 'TOGGLE_GPS_MODAL':
            return {
                ...state,
                ui: { ...state.ui, showGPSModal: !state.ui.showGPSModal },
            };

        case 'TOGGLE_NOTIFICATION_MODAL':
            return {
                ...state,
                ui: { ...state.ui, showNotificationModal: !state.ui.showNotificationModal },
            };

        case 'TOGGLE_CHAT_MODAL':
            return {
                ...state,
                ui: { ...state.ui, showChatModal: !state.ui.showChatModal },
            };

        case 'TOGGLE_PRODUCT_SELECTOR':
            return {
                ...state,
                ui: { ...state.ui, showProductSelector: !state.ui.showProductSelector },
            };

        case 'TOGGLE_LEADERBOARD':
            return {
                ...state,
                ui: { ...state.ui, showLeaderboard: !state.ui.showLeaderboard },
            };

        case 'TOGGLE_CHALLENGES':
            return {
                ...state,
                ui: { ...state.ui, showChallenges: !state.ui.showChallenges },
            };

        case 'SET_SHOW_CREATE_SERVICE_ALERT':
            return {
                ...state,
                ui: { ...state.ui, showCreateServiceAlert: action.payload },
            };

        case 'SET_SEARCH_RESULTS':
            return {
                ...state,
                data: {
                    ...state.data,
                    searchResults: action.payload.results,
                    searchQuery: action.payload.query,
                    totalSearchResults: action.payload.total,
                },
                ui: { ...state.ui, searchMode: 'search' },
            };

        case 'CLEAR_SEARCH':
            return {
                ...state,
                data: {
                    ...state.data,
                    searchResults: [],
                    searchQuery: '',
                    totalSearchResults: 0,
                },
                ui: { ...state.ui, searchMode: 'recommended' },
            };

        case 'SET_UNREAD_NOTIFICATIONS':
            return {
                ...state,
                metadata: { ...state.metadata, unreadNotificationsCount: action.payload },
            };

        case 'SET_UNREAD_CHAT_COUNT':
            return {
                ...state,
                metadata: { ...state.metadata, unreadChatCount: action.payload },
            };

        case 'SET_IS_COURIER':
            return {
                ...state,
                metadata: { ...state.metadata, isCourier: action.payload },
            };

        case 'SET_CONTENT_LOADED':
            return {
                ...state,
                metadata: { ...state.metadata, contentLoaded: action.payload },
            };

        case 'SET_USER_SCROLLED':
            return {
                ...state,
                metadata: { ...state.metadata, hasUserScrolled: action.payload },
            };

        case 'SET_SELECTED_LOCATION':
            return {
                ...state,
                metadata: { ...state.metadata, selectedLocation: action.payload },
            };

        case 'SET_USER_BEHAVIOR_CATEGORIES':
            return {
                ...state,
                data: { ...state.data, userBehaviorCategories: action.payload },
            };

        case 'SET_PRODUCTS_FOR_SELECTION':
            return {
                ...state,
                data: { ...state.data, productsForSelection: action.payload },
            };

        case 'SET_PENDING_INPUT':
            return {
                ...state,
                data: { ...state.data, pendingInput: action.payload },
            };

        case 'RESET_STATE':
            return initialState;

        default:
            return state;
    }
};

