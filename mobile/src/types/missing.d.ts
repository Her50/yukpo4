// Types manquants pour corriger les erreurs TypeScript

declare module '@/hooks/useUserPlan' {
    export const useUserPlan: () => {
        plan: string;
        loading: boolean;
    };
}

