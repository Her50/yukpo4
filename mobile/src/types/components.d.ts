// Déclarations de types pour nos composants
declare module '../components/SafeIcon' {
    const SafeIcon: any;
    export default SafeIcon;
}

declare module '../components/ServiceCardModern' {
    const ServiceCardModern: any;
    export default ServiceCardModern;
}

declare module '../components/NativeDesign' {
    export const NativeButton: any;
    export const NativeCard: any;
    export const NativeBadge: any;
    export const NativeDivider: any;
    export const NativeInput: any;
}

declare module '../contexts/AuthContext' {
    export const useAuth: any;
}

declare module '../theme/modernTheme' {
    export const modernColors: any;
    export const modernStyles: any;
}

declare module '../lib/yukpoaclient' {
    export const appelerMoteurIA: any;
}

declare module '../services/api' {
    export const apiGet: any;
    export const apiPost: any;
}

declare module '../utils/formDispatcher' {
    export const DynamicField: any;
    export const extractSuggestionValues: any;
    export const IASuggestion: any;
    export const processIASuggestion: any;
}



